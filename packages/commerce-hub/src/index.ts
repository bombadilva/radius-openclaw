#!/usr/bin/env node
import 'dotenv/config';
import { createAgentWallet } from '@bombadilva/agent-wallet';
import * as registry from './agent-registry.js';
import { createServer } from './server.js';

// ── Config ──────────────────────────────────────────────────────────

const MASTER_KEY = process.env.MASTER_KEY as `0x${string}`;
const AGENT_ID = process.env.AGENT_ID || 'commerce-hub';
const NETWORK = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';
const RPC_URL = process.env.RPC_URL;
const PORT = Number(process.env.PORT || '3004');
const WALLET_INDEX = 0;

if (!MASTER_KEY) {
  console.error('MASTER_KEY is required');
  process.exit(1);
}

// ── Init ────────────────────────────────────────────────────────────

const kit = createAgentWallet({
  masterKey: MASTER_KEY,
  agentId: AGENT_ID,
  network: NETWORK,
  rpcUrl: RPC_URL,
  dataDir: process.env.DATA_DIR || './data',
});

// ── Demo agents ─────────────────────────────────────────────────────

function registerDemoAgents(hubAddress: `0x${string}`): void {
  registry.register({
    id: 'summarizer',
    name: 'Text Summarizer',
    description: 'Summarizes long documents into concise briefs',
    address: hubAddress,
    price: '0.01',
    asset: 'USD',
    strategy: 'always-cooperate',
    tags: ['text', 'ai', 'summarization'],
    registeredAt: Date.now(),
  });

  registry.register({
    id: 'translator',
    name: 'Language Translator',
    description: 'Translates text between supported languages',
    address: hubAddress,
    price: '0.02',
    asset: 'USD',
    strategy: 'tit-for-tat',
    tags: ['text', 'ai', 'translation'],
    registeredAt: Date.now(),
  });

  registry.register({
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Runs statistical analysis on provided datasets',
    address: hubAddress,
    price: '0.05',
    asset: 'USD',
    strategy: 'cautious',
    tags: ['data', 'ai', 'analytics'],
    registeredAt: Date.now(),
  });
}

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Radius Commerce Hub ===');

  await kit.chainClient.validateChainId();
  const hubAddress = kit.wallet.deriveAddress(WALLET_INDEX);
  kit.db.upsertWallet(AGENT_ID, WALLET_INDEX, hubAddress);

  const balance = await kit.operations.getBalance(hubAddress);
  console.log(`[hub] Address: ${hubAddress}`);
  console.log(`[hub] Balance: ${balance.usd} USD`);

  registerDemoAgents(hubAddress);
  console.log(`[hub] Registered ${registry.count()} demo agents`);

  const app = createServer(kit, WALLET_INDEX);
  app.listen(PORT, () => {
    console.log(`[hub] Running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
