# Getting Started with Radius + OpenClaw

## Prerequisites

- Node.js 20+
- An OpenClaw installation (`npm i -g openclaw`)
- A master key for HD wallet derivation

## Quick Start

### 1. Generate a Master Key

```bash
echo "0x$(openssl rand -hex 32)"
```

Save this key securely. It derives all your agent wallets deterministically.

### 2. Create a New Agent

```bash
npx create-radius-agent my-agent
cd my-agent
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env and set MASTER_KEY
```

### 4. Run Standalone

```bash
npm run dev
```

### 5. Run Inside OpenClaw

Install the Radius plugin:

```bash
openclaw plugins install @bombadilva/openclaw-plugin
```

Configure in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "radius-payments": {
      "masterKey": "0xYOUR_KEY_HERE",
      "agentId": "my-agent",
      "network": "testnet"
    }
  }
}
```

Start OpenClaw:

```bash
openclaw gateway run
```

Your agent now has these tools available:
- `radius_get_address` — Get payment address
- `radius_check_balance` — Check USD and SBC balance
- `radius_send_payment` — Send payments
- `radius_monitor_payments` — View incoming payments
- `radius_request_payment` — Generate payment requests
- `radius_refund` — Refund a payment
- `radius_swap` — Swap USD <-> SBC

## Network Details

| Property | Testnet | Mainnet |
|----------|---------|---------|
| Chain ID | 72344 | 723 |
| Currency | USD (native) | USD (native) |
| RPC | https://rpc.testnet.radiustech.xyz | https://rpc.radiustech.xyz |
| Block time | ~0.4s | ~0.4s |
| TX cost | ~$0.0000001 | ~$0.0000001 |

## Next Steps

- [Wallet Management](./wallet-management.md)
- [Sending & Receiving Payments](./payments.md)
- [Agent Commerce Patterns](./commerce.md)
- [x402 Protocol Bridge](./x402.md)
