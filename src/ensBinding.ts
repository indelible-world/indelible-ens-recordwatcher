import type { Address, Hex } from 'viem';
import { getBindingByNode, resolveIndelibleAddress, type EnsVerification } from 'indelible/ens';
import ensAbi from 'indelible/abi/ens' with { type: 'json' };
import { publicClient, walletClient, account, ensIndelibleAddress } from './config.js';

export type CheckResult =
    | { action: 'no-binding' }
    | { action: 'already-revoked' }
    | { action: 'still-valid' }
    | { action: 'revoked'; txHash: Hex };

function sameAddress(a: Address | null | undefined, b: Address | null | undefined): boolean {
    return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Checks whether the on-chain binding for `node` is stale (the ENS
 * `indelible-address` record no longer matches the bound authority), and
 * if so, sends `removeEnsBinding(node)`. Safe to call repeatedly — it is a
 * no-op if there is no binding, the binding is already revoked, or the
 * record still resolves to the bound authority.
 */
export async function checkAndRevoke(node: Hex): Promise<CheckResult> {
    const binding: EnsVerification | null = await getBindingByNode(publicClient, node, { ensIndelibleAddress });
    if (!binding) return { action: 'no-binding' };
    if (binding.endTimestamp !== 0) return { action: 'already-revoked' };

    const resolved = await resolveIndelibleAddress(publicClient, binding.dnsName, node, { ensIndelibleAddress });
    if (sameAddress(resolved, binding.authority)) return { action: 'still-valid' };

    const txHash = await walletClient.writeContract({
        address: ensIndelibleAddress,
        abi: ensAbi,
        functionName: 'removeEnsBinding',
        args: [node],
        account,
        chain: walletClient.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
        throw new Error(`removeEnsBinding transaction failed for node ${node} (tx ${txHash})`);
    }
    return { action: 'revoked', txHash };
}
