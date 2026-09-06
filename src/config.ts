import 'dotenv/config';
import { createPublicClient, createWalletClient, http, webSocket, isHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainById, ENS_INDELIBLE_ADDRESS, ENS_REGISTRY_ADDRESS } from 'indelible';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function parseAddressList(value: string | undefined): Address[] {
    if (!value) return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as Address[];
}

const rpcUrl = requireEnv('RPC_URL');
const privateKey = requireEnv('PRIVATE_KEY') as Hex;
if (!isHex(privateKey, { strict: true }) || privateKey.length !== 66) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed 32-byte hex string');
}

export const chainId = Number(process.env.CHAIN_ID ?? 1);
export const chain = getChainById(chainId);

const transport = rpcUrl.startsWith('ws') ? webSocket(rpcUrl) : http(rpcUrl);

export const account = privateKeyToAccount(privateKey);
export const publicClient = createPublicClient({ chain, transport });
export const walletClient = createWalletClient({ account, chain, transport });

export const ensIndelibleAddress = (process.env.INDELIBLE_ENS_ADDRESS as Address | undefined) ?? ENS_INDELIBLE_ADDRESS;
export const ensRegistryAddress = (process.env.ENS_REGISTRY_ADDRESS as Address | undefined) ?? ENS_REGISTRY_ADDRESS;
export const resolverAddresses = parseAddressList(process.env.RESOLVER_ADDRESSES);
export const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 300_000);
