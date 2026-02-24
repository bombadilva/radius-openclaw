// Chain
export { ChainClient, radiusTestnet, radiusMainnet, type ChainConfig } from './chain.js';
export { RpcLimiter } from './rpc-limiter.js';

// Wallet
export { AgentWallet } from './wallet.js';
export { deriveSeed } from './seed.js';
export { Signer } from './signer.js';

// Token
export {
  SBC_ADDRESS,
  SBC_DECIMALS,
  NATIVE_USD_DECIMALS,
  type Asset,
  parseAmount,
  formatAmount,
  getSbcContract,
} from './token.js';

// Operations
export { Operations, type SendResult, type Balance, type RefundResult } from './operations.js';

// Persistence
export { AgentDb, type DbConfig, type WalletRow, type TransactionRow, type CounterpartyRow } from './db.js';
export { encrypt, decrypt } from './encryption.js';

// Payment Monitor
export {
  PaymentMonitor,
  type PaymentEvent,
  type PaymentMonitorConfig,
} from './payment-monitor.js';

// ── Convenience factory ─────────────────────────────────────────────

import { ChainClient, type ChainConfig } from './chain.js';
import { AgentWallet } from './wallet.js';
import { Signer } from './signer.js';
import { Operations } from './operations.js';
import { AgentDb, type DbConfig } from './db.js';
import { PaymentMonitor, type PaymentMonitorConfig } from './payment-monitor.js';

export interface AgentWalletConfig {
  masterKey: `0x${string}`;
  agentId: string;
  network: 'testnet' | 'mainnet';
  rpcUrl?: string;
  dataDir?: string;
  encryptionSeed?: `0x${string}`;
  pollInterval?: number;
  maxConcurrentRpc?: number;
}

export interface AgentWalletKit {
  chainClient: ChainClient;
  wallet: AgentWallet;
  signer: Signer;
  operations: Operations;
  db: AgentDb;
  monitor: PaymentMonitor;
}

/**
 * Create a complete agent wallet kit from a single config.
 * This is the recommended way to initialize the library.
 */
export function createAgentWallet(config: AgentWalletConfig): AgentWalletKit {
  if (!config.masterKey) throw new Error('masterKey is required');
  if (!config.agentId) throw new Error('agentId is required');
  if (!config.network) throw new Error('network is required');

  const chainClient = new ChainClient({
    network: config.network,
    rpcUrl: config.rpcUrl,
    maxConcurrentRpc: config.maxConcurrentRpc,
  });

  const wallet = new AgentWallet(config.masterKey, config.agentId);
  const signer = new Signer(chainClient, wallet);
  const operations = new Operations(chainClient, signer, wallet);

  const db = new AgentDb({
    dataDir: config.dataDir ?? './data',
    encryptionSeed: config.encryptionSeed,
  });

  const monitor = new PaymentMonitor(chainClient, db, {
    pollInterval: config.pollInterval,
  });

  return { chainClient, wallet, signer, operations, db, monitor };
}
