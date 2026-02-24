# Radius as the Preferred Stablecoin Network for OpenClaw Agents

## Context

Radius Network is a stablecoin-native EVM blockchain (native USD, 2.5M TPS, sub-second finality, ~$0.0000001/tx) built by the USDC creators for AI agent micropayments. OpenClaw is an agent framework with plugins, skills, tools, and multi-agent support. The goal: make Radius the default payment rail for any OpenClaw agent, so that paying, receiving, and monitoring stablecoin transactions is as natural as reading a file.

We already have two production codebases proving the patterns work:
- **stampy** — email paywall using Radius payments
- **radius-bots** — 10K bot swarm with cooperation strategies on Radius

## What We're Building

Five layers, each delivering standalone value:

```
D. Developer Tools          — CLI, scaffolding, docs
C. Applications             — Paywall agent, commerce hub, x402 bridge, faucet
B. OpenClaw Plugin          — Tools, skills, services, hooks
A. Core Library             — Chain client, HD wallet, monitor, persistence, ops
   ─────────────────────────────────────────────────────────────
   Radius Network           — Testnet (72344) / Mainnet (723)
```

---

## Quick Start

### Install the plugin

```bash
openclaw plugins install @bombadilva/openclaw-plugin
```

### Configure

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "enabled": true,
    "entries": {
      "radius-payments": {
        "enabled": true,
        "config": {
          "masterKey": "$MASTER_KEY",
          "agentId": "my-agent-001",
          "network": "testnet"
        }
      }
    }
  }
}
```

Generate a master key (never share it):

```bash
echo "MASTER_KEY=0x$(openssl rand -hex 32)" >> .env
```

### Test it

```bash
openclaw agent --message "What is my Radius wallet address?"
openclaw agent --message "Check my balance"
openclaw agent --message "Send 0.01 USD to 0x..."
```

---

## A. Core Library: `@bombadilva/agent-wallet`

Reusable TypeScript package — no OpenClaw dependency. Anyone building on Radius can use it.

### A1. Chain Client (`src/chain.ts` + `src/rpc-limiter.ts`)
- Unified chain definition for testnet/mainnet via viem `defineChain`
- Public client (read) + wallet client (sign/send) factories
- `RpcLimiter` semaphore (100 concurrent, 1000 queue max, reject on backpressure)
- Chain ID validation against RPC endpoint (fail-closed)

### A2. HD Wallet (`src/wallet.ts` + `src/seed.ts` + `src/signer.ts`)
- BIP-44 derivation at `m/44'/60'/0'/0/{index}` via @scure/bip32
- Deployment-scoped seed: `keccak256(masterKey + keccak256('radius-agent-wallet') + agentId)`
- Keys derived on-demand, never stored — fall out of scope after signing
- Mutex-protected signer (prevents nonce races per wallet)
- Nonce tracking: local increment, fallback to on-chain `getTransactionCount` on failure

### A3. Payment Monitor (`src/payment-monitor.ts`)
- Block-by-block polling (2s default, configurable)
- Checkpoint persistence (never re-scans, never skips on error)
- Event emitter pattern: `PaymentReceived`, `PaymentConfirmed`
- Supports both native USD transfers and SBC ERC-20 Transfer events

### A4. Persistence (`src/db.ts` + `src/encryption.ts`)
- SQLite via better-sqlite3 (WAL mode, foreign keys)
- Schema: `agent_wallets`, `transactions`, `counterparties`, `meta`
- AES-256-GCM encryption by default (HKDF-derived key, separate from wallet seed)
- Atomic writes (temp file + rename), restrictive permissions (0o600)

### A5. Token Operations (`src/operations.ts` + `src/token.ts`)
- `send(to, amount, asset)` — native USD or SBC
- `getBalance(address, asset)` — both assets
- `refund(txHash)` — look up original tx.from, send back
- SBC ERC-20 interactions: `transfer`, `approve`, `balanceOf` at `0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb`
- Handles 18-decimal native USD vs 6-decimal SBC correctly

---

## B. OpenClaw Plugin: `@bombadilva/openclaw-plugin`

### B1. Plugin Package

```
@bombadilva/openclaw-plugin/
  openclaw.plugin.json        — Manifest (masterKey, deploymentId, network config)
  src/
    index.ts                  — register(api: OpenClawPluginApi)
    tools/                    — 7 agent tools
    services/                 — Background payment watcher
    hooks/                    — Agent lifecycle integration
  skills/
    radius-payments/SKILL.md  — Teaches agents payment fundamentals
    radius-commerce/SKILL.md  — Teaches agent-to-agent commerce
```

### B2. Agent Tools (registered via `api.registerTool`)

| Tool | Description | Wraps |
|------|-------------|-------|
| `radius_send_payment` | Send USD/SBC to an address | A5: operations.send |
| `radius_check_balance` | Check wallet balance (both assets) | A5: operations.getBalance |
| `radius_get_address` | Get this agent's payment address | A2: wallet.deriveAddress |
| `radius_monitor_payments` | List recent incoming payments | A3: monitor query |
| `radius_request_payment` | Generate payment request (address + amount + URL) | A2 + formatting |
| `radius_refund` | Refund a received payment | A5: operations.refund |
| `radius_swap` | Swap native USD ↔ SBC | A5: token operations |

Each tool is a thin wrapper (~30 lines) over `@bombadilva/agent-wallet`.

### B3. Skills

**`radius-payments` SKILL.md:** How Radius works, when to use each tool, security rules (never log keys, confirm large payments), error handling patterns.

**`radius-commerce` SKILL.md:** Agent-to-agent negotiation, payment verification, streaming micropayments, reputation evaluation, x402 compatibility.

### B4. Background Service: Payment Watcher
- Registers via `api.registerService()`, runs block polling in background
- Emits `radius:payment_received` events into agent context
- Agent can react to payments in conversation (e.g., "Payment of $0.05 received from 0x...")

### B5. Lifecycle Hooks
- `agent_startup`: Initialize HD wallet, verify chain connection, check funding
- `payment_received`: Inject payment notification into agent conversation

---

## C. Applications (Planned)

### C1. Paywall Agent (generalized STAMPY)
- OpenClaw agent that paywalls ANY channel (email, Telegram, Discord, Matrix)
- Abstracts stampy's processor.ts from email-specific to channel-agnostic
- Admin dashboard via Express

### C2. Agent Commerce Hub
- Multi-agent marketplace: specialized agents offer services paid via Radius
- Weather agent ($0.001/query), code review agent ($0.01/review), data analysis agent ($0.005/analysis)
- Router agent handles discovery + payment orchestration
- Cooperation strategies from radius-bots (tit-for-tat, cautious, metered)

### C3. x402-Radius Bridge
- Express middleware: serves HTTP 402 responses requiring Radius payment
- Client module: auto-pays 402 responses using agent's Radius wallet
- Facilitator: verifies + settles payments on Radius
- Makes OpenClaw agents compatible with the broader x402 ecosystem (Coinbase, etc.) but settling on Radius instead of Base

### C4. Faucet Agent
- OpenClaw agent distributing testnet USD with rate limiting
- Every developer building on Radius needs this

### C5. Bot Swarm Dashboard
- Real-time monitoring UI for radius-bots economy
- OpenClaw agent that answers questions about swarm state

---

## D. Developer Tools (Planned)

### D1. `radius-cli`
```
radius wallet generate       — Generate HD wallet addresses
radius wallet balance <addr> — Check balance
radius send <to> <amount>    — Send payment
radius monitor <address>     — Watch for incoming payments
radius faucet <address>      — Request testnet funds
radius status                — Network status + block height
```

### D2. `create-radius-agent`
- `npx create-radius-agent my-agent` scaffolds a complete OpenClaw agent with Radius pre-configured
- Generates: package.json, .env.example, plugin config, AGENTS.md, skills, starter code

### D3. Documentation + Examples
- Wallet management, send/receive, monitoring, commerce patterns, x402, multi-agent

### D4. Agent Transaction Explorer
- Lightweight block explorer for agent transactions on Radius
- Shows which agents are transacting, volumes, cooperation metrics

---

## Implementation Order

### Phase 1: Foundation — delivers value immediately (DONE)

- `@bombadilva/agent-wallet` core: chain client, RPC limiter, HD wallet, seed, signer, operations, token, persistence, encryption, payment monitor
- `@bombadilva/openclaw-plugin`: plugin manifest, 7 tools, 2 skills, payment watcher service, lifecycle hooks
- 53 tests passing

### Phase 2: Applications — drives adoption

- C1 Paywall Agent (generalized STAMPY)
- C4 Faucet Agent + D2 create-radius-agent
- D1 radius-cli
- C5 Bot Swarm Dashboard

### Phase 3: Competitive Positioning — establishes market

- C3 x402-Radius Bridge
- C2 Agent Commerce Hub
- D3 Documentation + D4 Explorer

### Phase 4: Production — hardens for mainnet

- Security audit, mainnet deployment, abuse prevention
- Streaming micropayments, multi-sig wallets, payment channels
- ClawHub publication, community templates

---

## Competitive Position

| | Coinbase x402 + Base | Google AP2 | **Radius + OpenClaw** |
|---|---|---|---|
| Cost/tx | ~$0.001 | Varies | **~$0.0000001** |
| Finality | ~2s | Depends | **<1s** |
| TPS | ~1000 | N/A | **2.5M** |
| Agent framework | None | None | **Native OpenClaw plugin** |
| Currency | USDC | Multiple | **Native USD** |
| MEV | Present | N/A | **None** |
| Wallet mgmt | External (CDP) | External | **Built-in HD (zero storage)** |
| DX | SDK + middleware | SDK | **Plugin + skills + CLI + templates** |

The differentiator is **depth of integration**: x402/AP2 are protocols that tell agents HOW to pay. Radius + OpenClaw is the complete stack — wallet, execution, monitoring, persistence, AND the agent framework.

---

## Security Principles

1. **Keys derived, never stored** — on-demand from HD tree, fall out of scope after signing
2. **Fail-closed config** — crash on missing masterKey/agentId/network, no silent defaults
3. **Encryption by default** — AES-256-GCM for all persistent data, opt-out not opt-in
4. **Error messages never expose keys** — `err.message.slice(0, 100)` everywhere
5. **RPC backpressure** — semaphore with bounded queue, reject when full
6. **Atomic persistence** — write-to-tmp-then-rename for all file operations
7. **Deployment isolation** — cryptographically scoped wallet trees per deployment

---

## Verification

Phase 1 verification:
1. `npm test` on @bombadilva/agent-wallet — unit tests for chain, wallet, monitor, persistence, operations
2. `openclaw plugins install -l ./packages/openclaw-plugin` — verify plugin loads
3. `openclaw agent --message "What is my Radius wallet address?"` — agent uses `radius_get_address` tool
4. `openclaw agent --message "Check my balance"` — agent uses `radius_check_balance` tool
5. `openclaw agent --message "Send 0.01 USD to 0x..."` — agent uses `radius_send_payment` tool
6. Send testnet USD to agent's address → payment watcher fires → agent acknowledges receipt

---

## License

MIT
