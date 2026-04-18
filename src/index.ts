import { config } from "./config.js";
import {
  watchTextChangedEvents,
  watchResolverChanges,
  pollAllBindings,
} from "./watcher.js";

async function main() {
  console.log("=== Indelible ENS Record Watcher ===");
  console.log(`Contract:  ${config.indelibleEnsAddress}`);
  console.log(`Chain ID:  ${config.chainId}`);
  console.log(`RPC:       ${config.rpcUrl.replace(/\/\/.*@/, "//***@")}`);
  console.log(`Resolvers: ${config.resolverAddresses.length > 0 ? config.resolverAddresses.join(", ") : "(watching registry for resolver changes)"}`);
  console.log(`Poll interval: ${config.pollIntervalMs / 1000}s`);
  console.log();

  // 1. Run an initial poll to catch any stale bindings
  await pollAllBindings();

  // 2. Watch for TextChanged events on known resolvers
  watchTextChangedEvents(config.resolverAddresses);

  // 3. Watch for resolver changes on the ENS registry (covers resolver swaps)
  watchResolverChanges();

  // 4. Periodically poll all bindings as a safety net
  setInterval(() => {
    pollAllBindings().catch((err) =>
      console.error("[poll] Unhandled error:", err)
    );
  }, config.pollIntervalMs);

  console.log("Watcher running. Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
