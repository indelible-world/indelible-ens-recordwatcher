import { getVerification } from 'indelible/ens';
import { publicClient, ensIndelibleAddress } from './config.js';
import { checkAndRevoke } from './ensBinding.js';

/**
 * Scans every binding recorded in the `verifications` array (skipping index 0,
 * the non-functional placeholder) and revokes any that are stale. Acts as a
 * safety net for missed/unreliable events.
 */
export async function pollAllBindings(): Promise<void> {
    let index = 1;
    let checked = 0;
    let revoked = 0;

    while (true) {
        const verification = await getVerification(publicClient, index, { ensIndelibleAddress });
        if (!verification) break; // out-of-bounds index — reached the end of the array

        if (verification.endTimestamp === 0) {
            checked++;
            try {
                const result = await checkAndRevoke(verification.node);
                if (result.action === 'revoked') {
                    revoked++;
                    console.log(`[poll] revoked binding for ${verification.name} (node ${verification.node}, tx ${result.txHash})`);
                }
            } catch (err) {
                console.error(`[poll] failed to check/revoke node ${verification.node}:`, err);
            }
        }
        index++;
    }

    console.log(`[poll] scanned ${index - 1} verification(s), checked ${checked} active binding(s), revoked ${revoked}`);
}
