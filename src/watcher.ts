import { parseAbi, type Hex } from 'viem';
import { publicClient, resolverAddresses, ensRegistryAddress } from './config.js';
import { checkAndRevoke } from './ensBinding.js';

const TEXT_CHANGED_ABI = parseAbi([
    'event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)',
]);

const NEW_RESOLVER_ABI = parseAbi(['event NewResolver(bytes32 indexed node, address resolver)']);

async function handleNodeChange(node: Hex, source: string): Promise<void> {
    try {
        const result = await checkAndRevoke(node);
        if (result.action === 'revoked') {
            console.log(`[${source}] revoked binding for node ${node} (tx ${result.txHash})`);
        }
    } catch (err) {
        console.error(`[${source}] failed to check/revoke node ${node}:`, err);
    }
}

/**
 * Watches `TextChanged` events (filtered to the `indelible-address` key) on
 * the configured resolver addresses, and `NewResolver` events on the ENS
 * registry (which can indicate a resolver swap away from one we're not
 * watching). Returns an unwatch function.
 */
export function startWatching(): () => void {
    const unwatchFns: Array<() => void> = [];

    if (resolverAddresses.length > 0) {
        const unwatch = publicClient.watchContractEvent({
            address: resolverAddresses,
            abi: TEXT_CHANGED_ABI,
            eventName: 'TextChanged',
            args: { indexedKey: 'indelible-address' },
            onLogs: (logs) => {
                for (const log of logs) {
                    void handleNodeChange(log.args.node!, 'TextChanged');
                }
            },
            onError: (err) => console.error('[TextChanged watcher] error:', err),
        });
        unwatchFns.push(unwatch);
        console.log(`Watching TextChanged events on ${resolverAddresses.length} resolver(s)`);
    } else {
        console.log('No RESOLVER_ADDRESSES configured — relying on NewResolver events + periodic polling');
    }

    const unwatchRegistry = publicClient.watchContractEvent({
        address: ensRegistryAddress,
        abi: NEW_RESOLVER_ABI,
        eventName: 'NewResolver',
        onLogs: (logs) => {
            for (const log of logs) {
                void handleNodeChange(log.args.node!, 'NewResolver');
            }
        },
        onError: (err) => console.error('[NewResolver watcher] error:', err),
    });
    unwatchFns.push(unwatchRegistry);

    return () => unwatchFns.forEach((fn) => fn());
}
