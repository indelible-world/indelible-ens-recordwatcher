import "dotenv/config";

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

  /** Deployed IndelibleENS contract address */
  indelibleEnsAddress: requireEnv("INDELIBLE_ENS_ADDRESS") as `0x${string}`,

  /** ENS Registry address (mainnet default) */
  ensRegistryAddress: (process.env.ENS_REGISTRY_ADDRESS ??
    "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e") as `0x${string}`,

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
