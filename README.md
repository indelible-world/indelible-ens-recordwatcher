# indelible-ens-recordwatcher

Watches for ENS `indelible-address` text record changes and automatically revokes stale bindings on the IndelibleENS contract by calling `removeEnsBinding(node)`.

Can be run by Indelible or any third party — the `removeEnsBinding` function is permissionless.

## How it works

1. **Event watching** — Listens for `TextChanged` events on configured ENS resolver contracts, filtering for the `indelible-address` key. Also watches `NewResolver` events on the ENS Registry to catch resolver swaps.
2. **Staleness check** — When a change is detected, reads the on-chain binding and compares the stored `authority` to the current `resolveIndelibleAddress(node)` result.
3. **Revocation** — If the binding is active (`endTimestamp == 0`) but the resolved address no longer matches the authority, sends a `removeEnsBinding(node)` transaction.
4. **Periodic polling** — As a safety net, periodically scans all active bindings to catch any missed events.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your RPC URL, private key, and contract address
```

## Run

```bash
# Development (with hot reload via tsx)
npm run dev

# Production
npm run build
npm start
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RPC_URL` | Yes | Ethereum RPC URL (WebSocket recommended for real-time events) |
| `PRIVATE_KEY` | Yes | Private key for the account sending revocation txs |
| `INDELIBLE_ENS_ADDRESS` | Yes | Deployed IndelibleENS contract address |
| `ENS_REGISTRY_ADDRESS` | No | ENS Registry address (defaults to mainnet) |
| `RESOLVER_ADDRESSES` | No | Comma-separated resolver addresses to watch |
| `POLL_INTERVAL_MS` | No | Polling interval in ms (default: 300000 = 5 min) |
| `CHAIN_ID` | No | Chain ID (default: 1) |
