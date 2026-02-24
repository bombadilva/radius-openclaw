#!/usr/bin/env node

import 'dotenv/config';
import { createAgentWallet } from '@bombadilva/agent-wallet';
import { MetricsCollector } from './metrics.js';
import { TransactionExplorer } from './explorer.js';
import { createServer } from './server.js';

// ── Config ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3400');
const MASTER_KEY = process.env.MASTER_KEY as `0x${string}` | undefined;
const NETWORK = (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const DATA_DIR = process.env.DATA_DIR ?? './data';
const AGENT_IDS = (process.env.AGENT_IDS ?? '').split(',').filter(Boolean);
const COLLECT_INTERVAL = parseInt(process.env.COLLECT_INTERVAL ?? '10000');

if (!MASTER_KEY) {
  console.error('MASTER_KEY env var is required');
  process.exit(1);
}
if (AGENT_IDS.length === 0) {
  console.error('AGENT_IDS env var is required (comma-separated)');
  process.exit(1);
}

// ── Bootstrap ───────────────────────────────────────────────────────

const kit = createAgentWallet({
  masterKey: MASTER_KEY,
  agentId: 'dashboard',
  network: NETWORK,
  dataDir: DATA_DIR,
});

const collector = new MetricsCollector(kit.db);
const explorer = new TransactionExplorer(kit.db, kit.chainClient);

// Register known agents in the database
for (const id of AGENT_IDS) {
  const agentKit = createAgentWallet({
    masterKey: MASTER_KEY,
    agentId: id,
    network: NETWORK,
    dataDir: DATA_DIR,
  });
  kit.db.upsertWallet(id, 0, agentKit.wallet.deriveAddress(0));
}

// Periodic metrics collection
const timer = setInterval(() => {
  try {
    collector.collectMetrics(AGENT_IDS);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Metrics error:', msg.slice(0, 100));
  }
}, COLLECT_INTERVAL);

// ── Start server ────────────────────────────────────────────────────

const app = createServer({ port: PORT, collector, explorer, agentIds: AGENT_IDS });

const server = app.listen(PORT, () => {
  console.log(`Swarm dashboard running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(timer);
  server.close();
  kit.db.close();
  process.exit(0);
});
