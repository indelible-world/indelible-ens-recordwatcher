import "dotenv/config";
import { ENS_INDELIBLE_ADDRESS, ENS_REGISTRY_ADDRESS } from "indelible";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  /** Ethereum RPC URL (must support eth_subscribe for WebSocket, or polling for HTTP) */
  rpcUrl: requireEnv("RPC_URL"),

  /** Private key of the account that will call removeEnsBinding */
  privateKey: requireEnv("PRIVATE_KEY") as `0x${string}`,

  /** Deployed IndelibleENS contract address — defaults to the canonical protocol address */
  indelibleEnsAddress: (process.env.INDELIBLE_ENS_ADDRESS ??
    ENS_INDELIBLE_ADDRESS) as `0x${string}`,

  /** ENS Registry address — defaults to the canonical address from indelible-protocol */
  ensRegistryAddress: (process.env.ENS_REGISTRY_ADDRESS ??
    ENS_REGISTRY_ADDRESS) as `0x${string}`,

  /**
   * Known ENS resolver addresses to watch for TextChanged events.
   * Comma-separated. If empty, the watcher will discover resolvers from
   * NewResolver events on the ENS registry.
   */
  resolverAddresses: (process.env.RESOLVER_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as `0x${string}`[],

  /** How often (ms) to poll all known bindings for staleness (default: 5 min) */
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 300_000),

  /** Chain ID (default: 1 for mainnet) */
  chainId: Number(process.env.CHAIN_ID ?? 1),
};
