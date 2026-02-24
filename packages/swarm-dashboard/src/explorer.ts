import type { AgentDb, TransactionRow, ChainClient } from '@bombadilva/agent-wallet';

// ── Types ───────────────────────────────────────────────────────────

export interface FormattedTx {
  hash: string;
  agentId: string;
  direction: 'sent' | 'received';
  counterparty: string;
  amount: string;
  asset: string;
  blockNumber: number;
  refunded: boolean;
  createdAt: string;
}

export interface BlockInfo {
  number: number;
  timestamp: number;
  txCount: number;
}

// ── Explorer ────────────────────────────────────────────────────────

export class TransactionExplorer {
  private readonly db: AgentDb;
  private readonly chain: ChainClient;

  constructor(db: AgentDb, chain: ChainClient) {
    this.db = db;
    this.chain = chain;
  }

  /** Query transactions for a specific agent. */
  byAgent(agentId: string, limit = 50): FormattedTx[] {
    return this.db.getTransactions(agentId, limit).map(formatTx);
  }

  /** Query transactions involving a specific address. */
  byAddress(address: string, agentIds: string[], limit = 50): FormattedTx[] {
    const results: TransactionRow[] = [];
    for (const id of agentIds) {
      const txs = this.db.getTransactions(id, 500);
      for (const tx of txs) {
        if (tx.counterparty.toLowerCase() === address.toLowerCase()) {
          results.push(tx);
        }
      }
      if (results.length >= limit) break;
    }
    return results.slice(0, limit).map(formatTx);
  }

  /** Query transactions within a time range. */
  byTimeRange(
    agentIds: string[],
    startMs: number,
    endMs: number,
    limit = 100,
  ): FormattedTx[] {
    const results: TransactionRow[] = [];
    for (const id of agentIds) {
      const txs = this.db.getTransactions(id, 500);
      for (const tx of txs) {
        const ts = new Date(tx.created_at).getTime();
        if (ts >= startMs && ts <= endMs) results.push(tx);
      }
    }
    return results
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(formatTx);
  }

  /** Lookup a single transaction by hash. */
  byHash(txHash: string): FormattedTx | undefined {
    const row = this.db.getTransaction(txHash);
    return row ? formatTx(row) : undefined;
  }

  /** Fetch block info from the chain. */
  async getBlock(blockNumber: number): Promise<BlockInfo> {
    const client = this.chain.getPublicClient();
    const block = await this.chain.rpcLimiter.run(() =>
      client.getBlock({ blockNumber: BigInt(blockNumber) }),
    );
    return {
      number: Number(block.number),
      timestamp: Number(block.timestamp),
      txCount: block.transactions.length,
    };
  }

  /** Fetch the latest block number. */
  async getLatestBlock(): Promise<number> {
    const client = this.chain.getPublicClient();
    const num = await this.chain.rpcLimiter.run(() => client.getBlockNumber());
    return Number(num);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatTx(row: TransactionRow): FormattedTx {
  return {
    hash: row.tx_hash,
    agentId: row.agent_id,
    direction: row.direction,
    counterparty: row.counterparty,
    amount: row.amount,
    asset: row.asset,
    blockNumber: row.block_number,
    refunded: row.refunded === 1,
    createdAt: row.created_at,
  };
}
