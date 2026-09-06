import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  ContractFunctionRevertedError,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import ensAbi from "indelible/abi/ens";
import { ens } from "indelible";
import { config } from "./config.js";
import { resolverTextChangedAbi, ensRegistryAbi } from "./abi.js";

// ---------- clients ----------

const transport = config.rpcUrl.startsWith("ws")
  ? webSocket(config.rpcUrl)
  : http(config.rpcUrl);

const chain = { ...mainnet, id: config.chainId };

const publicClient: PublicClient = createPublicClient({ chain, transport });

const account = privateKeyToAccount(config.privateKey);
const walletClient = createWalletClient({ account, chain, transport });

const ensOpts = { ensIndelibleAddress: config.indelibleEnsAddress };

/**
 * Check whether a binding for `node` is active but stale (the on-chain
 * indelible-address no longer matches the recorded authority) and revoke it.
 */
async function checkAndRevoke(node: Hex): Promise<boolean> {
  try {
    const binding = await ens.getBindingByNode(publicClient, node, ensOpts);

    if (!binding) {
      console.log(`  No binding exists for node ${node}`);
      return false;
    }

    if (!binding.isActive) {
      console.log(`  Binding for node ${node} already revoked`);
      return false;
    }

    const resolvedAddr = await ens.resolveIndelibleAddress(
      publicClient,
      binding.dnsName,
      node,
      ensOpts
    );

    if (resolvedAddr?.toLowerCase() === binding.authority.toLowerCase()) {
      console.log(`  Binding for node ${node} is still valid`);
      return false;
    }

    console.log(
      `  Stale binding detected for node ${node}:`,
      `authority=${binding.authority}, resolved=${resolvedAddr}. Revoking...`
    );

    const txHash = await walletClient.writeContract({
      address: config.indelibleEnsAddress,
      abi: ensAbi,
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

const MAX_READ_RETRIES = 3;

/** Whether `err` is a genuine contract revert (e.g. array out-of-bounds), not a transient RPC/network error. */
function isContractRevert(err: unknown): boolean {
  return (
    err instanceof Error &&
    "walk" in err &&
    typeof (err as { walk: unknown }).walk === "function" &&
    (err as { walk: (fn: (e: unknown) => boolean) => unknown }).walk(
      (e) => e instanceof ContractFunctionRevertedError
    ) != null
  );
}

/**
 * Read `verifications(index)` directly (bypassing indelible's `ens.getVerification`,
 * which swallows every error — including transient RPC failures — as "end of array").
 * Distinguishes a real out-of-bounds revert (end of the array) from a transient
 * RPC error (retried). Returns `null` only once the array has genuinely been exhausted.
 */
async function readVerificationAtIndex(
  index: number
): Promise<{ node: Hex; isActive: boolean } | null> {
  for (let attempt = 0; attempt <= MAX_READ_RETRIES; attempt++) {
    try {
      const result = (await publicClient.readContract({
        address: config.indelibleEnsAddress,
        abi: ensAbi,
        functionName: "verifications",
        args: [BigInt(index)],
      })) as [Address, Hex, Hex, bigint, bigint];
      const [, node, , , endTimestamp] = result;
      return { node, isActive: endTimestamp === 0n };
    } catch (err) {
      if (isContractRevert(err)) return null;
      if (attempt === MAX_READ_RETRIES) {
        throw new Error(
          `Failed to read verifications(${index}) after ${MAX_READ_RETRIES + 1} attempts`,
          { cause: err }
        );
      }
      console.warn(
        `  [poll] Transient error reading verifications(${index}), retrying (${attempt + 1}/${MAX_READ_RETRIES})...`
      );
    }
  }
  return null;
}

/**
 * Scan all verifications in the contract and revoke any that are stale.
 * This acts as a safety net in case events are missed.
 */
export async function pollAllBindings() {
  console.log("[poll] Scanning all active bindings...");

  try {
    // The verifications array is public; index 0 is a dummy entry, so read
    // sequentially until we hit a genuine out-of-bounds revert (end of array).
    let index = 1;
    const nodesToCheck: Hex[] = [];

    while (true) {
      const verification = await readVerificationAtIndex(index);
      if (!verification) break;

      if (verification.isActive) {
        nodesToCheck.push(verification.node);
      }

      index++;
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
