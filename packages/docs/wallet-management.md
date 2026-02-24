# Wallet Management

## HD Wallet Architecture

Radius agent wallets use BIP-44 hierarchical deterministic (HD) derivation:

```
Master Key (32 bytes)
  -> Deployment Seed = keccak256(masterKey + keccak256('radius-agent-wallet') + agentId)
    -> m/44'/60'/0'/0/0  (primary address)
    -> m/44'/60'/0'/0/1  (secondary address)
    -> m/44'/60'/0'/0/N  (Nth address)
```

### Key Properties

- **Deterministic**: Same master key + agent ID always produces the same addresses
- **Never stored**: Private keys are derived on-demand and fall out of scope after signing
- **Isolated**: Different agent IDs produce completely different wallet trees
- **Unlimited**: Generate as many addresses as needed (sequential indices)

## Using the CLI

```bash
# Generate addresses
radius wallet generate --count 5

# Check balance
radius wallet balance
radius wallet balance 0x1234...

# Send payment
radius send 0xRecipient 1.50 --asset USD
radius send 0xRecipient 100 --asset SBC
```

## Programmatic Usage

```typescript
import { createAgentWallet } from '@bombadilva/agent-wallet';

const kit = createAgentWallet({
  masterKey: process.env.MASTER_KEY as `0x${string}`,
  agentId: 'my-agent',
  network: 'testnet',
});

// Derive addresses
const primary = kit.wallet.deriveAddress(0);
const addresses = kit.wallet.generateAddresses(10);

// Check balance
const balance = await kit.operations.getBalance(primary);
console.log(`${balance.usd} USD, ${balance.sbc} SBC`);

// Send payment
const result = await kit.operations.send(0, recipientAddr, '1.50', 'USD');
console.log(`TX: ${result.hash}`);
```

## Security Best Practices

1. **Never log or display the master key** — Store only in `.env` or secrets manager
2. **Use unique agent IDs** — Each deployment should have its own identity
3. **Monitor wallet balances** — Set up alerts for unexpected drains
4. **Use the smallest wallet index** — Index 0 for primary operations
5. **Rotate master keys** by migrating funds — Generate new key, transfer balances, update config
