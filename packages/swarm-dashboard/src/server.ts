import express from 'express';
import type { Request, Response } from 'express';
import type { SwarmMetrics } from './metrics.js';
import type { MetricsCollector } from './metrics.js';
import type { TransactionExplorer } from './explorer.js';

// ── Types ───────────────────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  collector: MetricsCollector;
  explorer: TransactionExplorer;
  agentIds: string[];
}

// ── Server ──────────────────────────────────────────────────────────

export function createServer(config: ServerConfig): express.Express {
  const { collector, explorer, agentIds } = config;
  const app = express();
  let latestMetrics: SwarmMetrics | null = null;

  /** Refresh cached metrics. */
  const refresh = () => { latestMetrics = collector.collectMetrics(agentIds); };
  refresh();

  // ── API routes ──────────────────────────────────────────────────

  app.get('/api/metrics', (_req: Request, res: Response) => {
    refresh();
    res.json(latestMetrics);
  });

  app.get('/api/agents', (_req: Request, res: Response) => {
    refresh();
    res.json(latestMetrics?.topAgents ?? []);
  });

  app.get('/api/transactions', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20')));
    const all = latestMetrics?.recentTransactions ?? [];
    const start = (page - 1) * limit;
    res.json({ page, limit, total: all.length, data: all.slice(start, start + limit) });
  });

  app.get('/api/transactions/:hash', (req: Request, res: Response) => {
    const tx = explorer.byHash(req.params.hash as string);
    if (!tx) { res.status(404).json({ error: 'Transaction not found' }); return; }
    res.json(tx);
  });

  app.get('/api/agent/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!agentIds.includes(id)) { res.status(404).json({ error: 'Agent not found' }); return; }
    const txs = explorer.byAgent(id, 100);
    const vol = txs.reduce((s, t) => s + BigInt(t.amount), 0n).toString();
    res.json({ id, txCount: txs.length, volume: vol, transactions: txs.slice(0, 20) });
  });

  // ── Dashboard HTML ────────────────────────────────────────────────

  app.get('/', (_req: Request, res: Response) => {
    refresh();
    res.type('html').send(renderDashboard(latestMetrics));
  });

  return app;
}

// ── HTML Template ───────────────────────────────────────────────────

function renderDashboard(m: SwarmMetrics | null): string {
  const metrics = m ?? {
    totalAgents: 0, totalTransactions: 0, totalVolume: '0',
    avgTxPerAgent: 0, cooperationRate: 0, activeAgents: 0,
    uptimeSeconds: 0, strategyBreakdown: {}, topAgents: [], recentTransactions: [],
  };

  const txRows = metrics.recentTransactions
    .map(t => `<tr>
      <td title="${t.hash}">${t.hash.slice(0, 10)}...</td>
      <td>${t.from.slice(0, 12)}</td><td>${t.to.slice(0, 12)}</td>
      <td>${t.amount}</td><td>${t.asset}</td>
      <td>${new Date(t.timestamp).toLocaleTimeString()}</td>
    </tr>`).join('');

  const agentRows = metrics.topAgents
    .map(a => `<tr>
      <td>${a.id}</td>
      <td title="${a.address}">${a.address.slice(0, 12)}...</td>
      <td>${a.txCount}</td><td>${a.volume}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Radius Swarm Dashboard</title>
<meta http-equiv="refresh" content="5">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0d1117;color:#c9d1d9;font-family:system-ui,sans-serif;padding:20px}
  h1{color:#58a6ff;margin-bottom:20px;font-size:1.5rem}
  h2{color:#8b949e;margin:20px 0 10px;font-size:1.1rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px}
  .card .label{color:#8b949e;font-size:.8rem;text-transform:uppercase}
  .card .value{color:#58a6ff;font-size:1.8rem;font-weight:700;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #21262d;font-size:.85rem}
  th{color:#8b949e;text-transform:uppercase;font-size:.75rem}
  tr:hover{background:#161b22}
  .footer{color:#484f58;font-size:.75rem;margin-top:30px;text-align:center}
</style></head><body>
<h1>Radius Swarm Dashboard</h1>
<div class="cards">
  <div class="card"><div class="label">Total Agents</div><div class="value">${metrics.totalAgents}</div></div>
  <div class="card"><div class="label">Active Agents</div><div class="value">${metrics.activeAgents}</div></div>
  <div class="card"><div class="label">Transactions</div><div class="value">${metrics.totalTransactions}</div></div>
  <div class="card"><div class="label">Volume</div><div class="value">${metrics.totalVolume}</div></div>
  <div class="card"><div class="label">Avg TX/Agent</div><div class="value">${metrics.avgTxPerAgent}</div></div>
  <div class="card"><div class="label">Cooperation</div><div class="value">${(metrics.cooperationRate * 100).toFixed(1)}%</div></div>
</div>
<h2>Recent Transactions</h2>
<table><thead><tr><th>Hash</th><th>From</th><th>To</th><th>Amount</th><th>Asset</th><th>Time</th></tr></thead>
<tbody>${txRows || '<tr><td colspan="6" style="color:#484f58">No transactions yet</td></tr>'}</tbody></table>
<h2>Top Agents</h2>
<table><thead><tr><th>Agent</th><th>Address</th><th>TX Count</th><th>Volume</th></tr></thead>
<tbody>${agentRows || '<tr><td colspan="4" style="color:#484f58">No agents yet</td></tr>'}</tbody></table>
<div class="footer">Uptime: ${metrics.uptimeSeconds}s | Auto-refresh: 5s</div>
</body></html>`;
}
