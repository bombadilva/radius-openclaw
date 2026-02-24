# Sending & Receiving Payments

## Assets on Radius

Radius has two assets:

| Asset | Type | Decimals | Address |
|-------|------|----------|---------|
| USD | Native currency | 18 | N/A (native) |
| SBC | ERC-20 token | 6 | `0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb` |

## Sending Payments

### Via OpenClaw Agent Tool

When the Radius plugin is loaded, agents can send payments naturally:

```
Agent: "Send 0.05 USD to 0x1234..."
→ Uses radius_send_payment tool
→ Returns TX hash and confirmation
```

### Programmatic

```typescript
// Send native USD
const result = await kit.operations.send(
  0,                    // wallet index
  '0x1234...' as `0x${string}`,  // recipient
  '1.50',              // amount (human-readable)
  'USD',               // asset
);

// Send SBC token
const result = await kit.operations.send(0, recipient, '100', 'SBC');
```

### Via CLI

```bash
radius send 0x1234... 1.50 --asset USD
radius send 0x1234... 100 --asset SBC --index 1
```

## Receiving Payments

### Payment Monitor

The payment monitor polls blocks and emits events for incoming transfers:

```typescript
kit.monitor.watch(address, agentId, walletIndex);
kit.monitor.on('payment_received', (event) => {
  console.log(`Received ${event.amount} ${event.asset} from ${event.from}`);
  console.log(`TX: ${event.txHash}, Block: ${event.blockNumber}`);
});
kit.monitor.start();
```

### Via OpenClaw Plugin

The plugin's background payment watcher service automatically monitors the agent's primary address. When a payment arrives, it injects a notification into the agent's context.

### Via CLI

```bash
radius monitor                    # Watch primary address
radius monitor 0x1234...          # Watch specific address
radius monitor --poll 5000        # Custom poll interval (ms)
```

## Refunds

```typescript
// Refund a specific transaction
const result = await kit.operations.refund(0, txHash);
// Sends the same amount back to the original sender
```

```bash
# Via CLI (through the faucet/paywall admin API)
curl -X POST http://localhost:3001/api/refund/0xTXHASH
```

## Payment Requests

Generate a payment request that other agents or users can fulfill:

```typescript
// Via OpenClaw tool: radius_request_payment
// Returns: { address, amount, asset, paymentUrl }
```

## Persistence

All transactions are automatically recorded in the local SQLite database:

```typescript
// Query transaction history
const txs = kit.db.getTransactions(agentId, 50);
const received = kit.db.getReceivedTransactions(agentId);
const stats = kit.db.getStats(agentId);
```

## Testnet Faucet

Get testnet USD for development:

```bash
# Start the faucet server
radius-faucet  # runs on port 3001

# Request funds via CLI
radius faucet 0xYourAddress

# Request via API
curl -X POST http://localhost:3001/api/drip \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xYourAddress"}'
```
