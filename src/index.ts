import { account, chainId, ensIndelibleAddress, pollIntervalMs } from './config.js';
import { startWatching } from './watcher.js';
import { pollAllBindings } from './poll.js';

async function main() {
    console.log(`indelible-ens-recordwatcher starting (chainId=${chainId}, account=${account.address}, contract=${ensIndelibleAddress})`);

    const stopWatching = startWatching();

    // Run an initial full scan on startup, then on a fixed interval.
    await pollAllBindings().catch((err) => console.error('[poll] initial scan failed:', err));
    const pollTimer = setInterval(() => {
        pollAllBindings().catch((err) => console.error('[poll] scan failed:', err));
    }, pollIntervalMs);

    const shutdown = () => {
        console.log('Shutting down...');
        clearInterval(pollTimer);
        stopWatching();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
