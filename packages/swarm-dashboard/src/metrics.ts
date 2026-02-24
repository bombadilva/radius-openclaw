import type { AgentDb, TransactionRow, WalletRow } from '@bombadilva/agent-wallet';

// ── Types ───────────────────────────────────────────────────────────

export interface SwarmMetrics {
  totalAgents: number;
  totalTransactions: number;
  totalVolume: string;
  avgTxPerAgent: number;
  cooperationRate: number;
  activeAgents: number;
  uptimeSeconds: number;
  strategyBreakdown: Record<string, { count: number; cooperationRate: number }>;
  topAgents: Array<{ id: string; address: string; txCount: number; volume: string }>;
  recentTransactions: Array<{
    hash: string; from: string; to: string;
    amount: string; asset: string; timestamp: number;
  }>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  txCount: number;
  volume: string;
  activeAgents: number;
}

// ── Collector ───────────────────────────────────────────────────────

export class MetricsCollector {
  private readonly db: AgentDb;
  private readonly startTime = Date.now();
  private snapshots: SwarmMetrics[] = [];

  constructor(db: AgentDb) {
    this.db = db;
  }

  collectMetrics(agentIds: string[]): SwarmMetrics {
    const agentStats = new Map<string, { wallet: WalletRow; txs: TransactionRow[] }>();
    let allTxs: TransactionRow[] = [];

    for (const id of agentIds) {
      const wallets = this.db.getWallets(id);
      const txs = this.db.getTransactions(id, 500);
      agentStats.set(id, { wallet: wallets[0], txs });
      allTxs = allTxs.concat(txs);
    }

    const totalAgents = agentIds.length;
    const totalTransactions = allTxs.length;
    const totalVolume = allTxs.reduce((sum, t) => sum + BigInt(t.amount), 0n).toString();
    const avgTxPerAgent = totalAgents > 0 ? totalTransactions / totalAgents : 0;

    const receivedCount = allTxs.filter(t => t.direction === 'received').length;
    const cooperationRate = totalTransactions > 0 ? receivedCount / totalTransactions : 0;

    const recentAgentIds = new Set(
      allTxs.filter(t => {
        const age = Date.now() - new Date(t.created_at).getTime();
        return age < 300_000; // 5 min
      }).map(t => t.agent_id),
    );

    const strategyBreakdown: SwarmMetrics['strategyBreakdown'] = {};
    for (const id of agentIds) {
      const label = id.split('-')[0] || 'unknown';
      if (!strategyBreakdown[label]) {
        strategyBreakdown[label] = { count: 0, cooperationRate: 0 };
      }
      const txs = agentStats.get(id)?.txs ?? [];
      const recv = txs.filter(t => t.direction === 'received').length;
      strategyBreakdown[label].count++;
      strategyBreakdown[label].cooperationRate =
        txs.length > 0 ? recv / txs.length : 0;
    }

    const topAgents = agentIds
      .map(id => {
        const s = agentStats.get(id)!;
        const vol = s.txs.reduce((sum, t) => sum + BigInt(t.amount), 0n);
        return {
          id,
          address: s.wallet?.address ?? 'unknown',
          txCount: s.txs.length,
          volume: vol.toString(),
        };
      })
      .sort((a, b) => b.txCount - a.txCount)
      .slice(0, 10);

    const recentTransactions = allTxs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map(t => ({
        hash: t.tx_hash,
        from: t.direction === 'sent' ? t.agent_id : t.counterparty,
        to: t.direction === 'received' ? t.agent_id : t.counterparty,
        amount: t.amount,
        asset: t.asset,
        timestamp: new Date(t.created_at).getTime(),
      }));

    const metrics: SwarmMetrics = {
      totalAgents,
      totalTransactions,
      totalVolume,
      avgTxPerAgent: Math.round(avgTxPerAgent * 100) / 100,
      cooperationRate: Math.round(cooperationRate * 1000) / 1000,
      activeAgents: recentAgentIds.size,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      strategyBreakdown,
      topAgents,
      recentTransactions,
    };

    this.snapshots.push(metrics);
    if (this.snapshots.length > 1000) this.snapshots.shift();

    return metrics;
  }

  getTimeSeries(period: 'hour' | 'day' = 'hour'): TimeSeriesPoint[] {
    const cutoff = period === 'hour' ? 3_600_000 : 86_400_000;
    const now = Date.now();
    return this.snapshots
      .filter((_, i) => {
        const ts = this.snapshots[i].uptimeSeconds * 1000 + this.startTime;
        return now - ts < cutoff;
      })
      .map(s => ({
        timestamp: s.uptimeSeconds * 1000 + this.startTime,
        txCount: s.totalTransactions,
        volume: s.totalVolume,
        activeAgents: s.activeAgents,
      }));
  }

  snapshot(): SwarmMetrics[] {
    return [...this.snapshots];
  }

  restore(data: SwarmMetrics[]): void {
    this.snapshots = [...data];
  }
}
