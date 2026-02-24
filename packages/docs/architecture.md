# Architecture

## System Layers

```
D. Developer Tools          — CLI, scaffolding, docs
C. Applications             — Paywall agent, commerce hub, x402 bridge, faucet
B. OpenClaw Plugin          — Tools, skills, services, hooks
A. Core Library             — Chain client, HD wallet, monitor, persistence, ops
   ─────────────────────────────────────────────────────────────
   Radius Network           — Testnet (72344) / Mainnet (723)
```

## Package Map

| Package | Layer | Description |
|---------|-------|-------------|
| `@bombadilva/agent-wallet` | A | Core wallet library — no OpenClaw dependency |
| `@bombadilva/openclaw-plugin` | B | OpenClaw plugin with tools, skills, services |
| `@bombadilva/paywall-agent` | C | Channel-agnostic payment paywall |
| `@bombadilva/commerce-hub` | C | Multi-agent marketplace |
| `@bombadilva/x402-bridge` | C | HTTP 402 payment protocol bridge |
| `@bombadilva/radius-faucet` | C | Testnet USD faucet |
| `@bombadilva/swarm-dashboard` | C | Real-time monitoring + explorer |
| `@bombadilva/radius-cli` | D | Command-line interface |
| `create-radius-agent` | D | Project scaffolder |

## Core Library Internals

```
@bombadilva/agent-wallet
├── chain.ts           Chain client (viem) + RPC limiter
├── rpc-limiter.ts     Semaphore-based concurrency control
├── seed.ts            Deployment-scoped seed derivation
├── wallet.ts          BIP-44 HD wallet (address derivation)
├── signer.ts          Mutex-protected transaction signing
├── token.ts           USD/SBC token constants + parsing
├── operations.ts      High-level send/balance/refund
├── db.ts              SQLite persistence (WAL, encrypted export)
├── encryption.ts      AES-256-GCM with HKDF key derivation
├── payment-monitor.ts Block-by-block payment polling + events
└── index.ts           Barrel exports + createAgentWallet() factory
```

## Security Model

### Key Management
- Master key → deployment seed → HD wallet tree
- Keys derived on-demand, never persisted to disk
- Scoped per deployment: `keccak256(masterKey + domain + agentId)`

### Signing Safety
- Mutex per wallet index prevents nonce races
- Local nonce tracking with on-chain fallback on failure
- Transaction signing is the only operation that touches private keys

### Data Protection
- SQLite with WAL mode and foreign keys
- AES-256-GCM encryption for exports
- HKDF-derived encryption key (separate from wallet seed)
- Atomic writes (temp file + rename) with 0o600 permissions

### Network Safety
- RPC semaphore: 100 concurrent, 1000 queue max
- Backpressure rejection when queue is full
- Chain ID validation on startup (fail-closed)
- Error messages truncated to 100 chars (no key leakage)

## Data Flow

### Payment Send
```
Agent → Operations.send() → Signer.sendTransaction() → WalletClient → Radius RPC
         ↓                    ↓ (mutex lock)              ↓
       parseAmount()       derivePrivateKey()          sendRawTx
         ↓                    ↓ (nonce tracking)
       validate            sign + broadcast
```

### Payment Receive
```
Radius blocks → PaymentMonitor.poll() → filter for watched addresses
                  ↓                        ↓
              getBlock()              check native transfers + SBC logs
                  ↓                        ↓
              checkpoint              emit 'payment_received' event
                  ↓                        ↓
              persist to DB           notify agent context
```
