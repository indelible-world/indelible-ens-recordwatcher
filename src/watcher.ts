import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type Address,
  type Hex,
  keccak256,
  toHex,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { config } from "./config.js";
import {
  indelibleEnsAbi,
  resolverTextChangedAbi,
  ensRegistryAbi,
} from "./abi.js";

// ---------- clients ----------

const transport = config.rpcUrl.startsWith("ws")
  ? webSocket(config.rpcUrl)
  : http(config.rpcUrl);

const chain = { ...mainnet, id: config.chainId };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const publicClient: any = createPublicClient({ chain, transport });

const account = privateKeyToAccount(config.privateKey);
const walletClient = createWalletClient({ account, chain, transport });

// ---------- contracts ----------

const indelibleEns = getContract({
  address: config.indelibleEnsAddress,
  abi: indelibleEnsAbi,
  client: { public: publicClient, wallet: walletClient },
});

// ---------- helpers ----------

/** keccak256 of "indelible-address" — used to match the indexed key in TextChanged */
const INDELIBLE_ADDRESS_KEY_HASH = keccak256(
  toHex("indelible-address")
);

/**
 * Check whether a binding for `node` is active but stale (the on-chain
 * indelible-address no longer matches the recorded authority) and revoke it.
 */
async function checkAndRevoke(node: Hex): Promise<boolean> {
  try {
    const bindingIndex = await publicClient.readContract({
      address: config.indelibleEnsAddress,
      abi: indelibleEnsAbi,
      functionName: "nodeToBinding",
      args: [node],
    });

    if (bindingIndex === 0n) {
      console.log(`  No binding exists for node ${node}`);
      return false;
    }

    const verification = await publicClient.readContract({
      address: config.indelibleEnsAddress,
      abi: indelibleEnsAbi,
      functionName: "verifications",
      args: [bindingIndex],
    });

    const [authority, , , , endTimestamp] = verification;

    if (endTimestamp !== 0n) {
      console.log(`  Binding for node ${node} already revoked`);
      return false;
    }

    const resolvedAddr = await publicClient.readContract({
      address: config.indelibleEnsAddress,
      abi: indelibleEnsAbi,
      functionName: "resolveIndelibleAddress",
      args: [node],
    });

    if (resolvedAddr === authority) {
      console.log(`  Binding for node ${node} is still valid`);
      return false;
    }

    console.log(
      `  Stale binding detected for node ${node}:`,
      `authority=${authority}, resolved=${resolvedAddr}. Revoking...`
    );

    const txHash = await walletClient.writeContract({
      address: config.indelibleEnsAddress,
      abi: indelibleEnsAbi,
      functionName: "removeEnsBinding",
      args: [node],
      chain,
      account,
    });

    console.log(`  Revocation tx sent: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log(
      `  Revocation confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`
    );

    return receipt.status === "success";
  } catch (err) {
    console.error(`  Error checking/revoking node ${node}:`, err);
    return false;
  }
}

// ---------- event watcher ----------

/**
 * Watch TextChanged events on known resolver addresses. When the
 * `indelible-address` key changes, check whether the binding is stale.
 */
export function watchTextChangedEvents(resolverAddresses: Address[]) {
  if (resolverAddresses.length === 0) {
    console.warn("No resolver addresses provided — skipping event watcher");
    return;
  }

  for (const resolverAddress of resolverAddresses) {
    console.log(`Watching TextChanged on resolver ${resolverAddress}`);

    publicClient.watchEvent({
      address: resolverAddress,
      event: resolverTextChangedAbi[0],
      onLogs: async (logs: any[]) => {
        for (const log of logs) {
          const node = log.args.node;
          const key = log.args.key;

          // Only care about indelible-address changes
          if (key !== "indelible-address") continue;

          console.log(
            `[event] TextChanged for indelible-address on node ${node} (block ${log.blockNumber})`
          );

          if (node) {
            await checkAndRevoke(node);
          }
        }
      },
      onError: (err: Error) => {
        console.error(
          `Event watcher error on resolver ${resolverAddress}:`,
          err
        );
      },
    });
  }
}

/**
 * Watch NewResolver events on the ENS Registry. When a name changes its
 * resolver, the old indelible-address text record may no longer exist,
 * making the binding stale.
 */
export function watchResolverChanges() {
  console.log("Watching NewResolver events on ENS Registry");

  publicClient.watchEvent({
    address: config.ensRegistryAddress,
    event: ensRegistryAbi[0],
    onLogs: async (logs: any[]) => {
      for (const log of logs) {
        const node = log.args.node;
        if (!node) continue;

        console.log(
          `[event] NewResolver for node ${node} (block ${log.blockNumber})`
        );

        await checkAndRevoke(node);
      }
    },
    onError: (err: Error) => {
      console.error("NewResolver watcher error:", err);
    },
  });
}

// ---------- polling ----------

/**
 * Scan all verifications in the contract and revoke any that are stale.
 * This acts as a safety net in case events are missed.
 */
export async function pollAllBindings() {
  console.log("[poll] Scanning all active bindings...");

  try {
    // Find the total number of verifications by binary-searching for a revert.
    // The verifications array is public, so we read indices until one fails.
    let index = 1n; // Index 0 is the dummy entry
    const nodesToCheck: Hex[] = [];

    while (true) {
      try {
        const verification = await publicClient.readContract({
          address: config.indelibleEnsAddress,
          abi: indelibleEnsAbi,
          functionName: "verifications",
          args: [index],
        });

        const [, node, , , endTimestamp] = verification;

        // Only check active (non-revoked) bindings
        if (endTimestamp === 0n && node !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          nodesToCheck.push(node);
        }

        index++;
      } catch {
        // Reached the end of the array
        break;
      }
    }

    console.log(
      `[poll] Found ${nodesToCheck.length} active binding(s) to check`
    );

    let revoked = 0;
    for (const node of nodesToCheck) {
      const didRevoke = await checkAndRevoke(node);
      if (didRevoke) revoked++;
    }

    console.log(`[poll] Revoked ${revoked} stale binding(s)`);
  } catch (err) {
    console.error("[poll] Error scanning bindings:", err);
  }
}

export { checkAndRevoke, publicClient };
