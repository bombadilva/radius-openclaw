#!/usr/bin/env node
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createAgentWallet } from '@bombadilva/agent-wallet';

// ── Config ──────────────────────────────────────────────────────────

const MASTER_KEY = process.env.MASTER_KEY as `0x${string}`;
const AGENT_ID = process.env.AGENT_ID || 'radius-faucet';
const NETWORK = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';
const RPC_URL = process.env.RPC_URL;
const PORT = Number(process.env.PORT || '3001');
const DRIP_AMOUNT = process.env.DRIP_AMOUNT || '0.1';
const RATE_LIMIT_SECONDS = Number(process.env.RATE_LIMIT_SECONDS || '60');
const WALLET_INDEX = 0;

if (!MASTER_KEY) {
  console.error('MASTER_KEY is required');
  process.exit(1);
}

// ── State ───────────────────────────────────────────────────────────

const kit = createAgentWallet({
  masterKey: MASTER_KEY,
  agentId: AGENT_ID,
  network: NETWORK,
  rpcUrl: RPC_URL,
  dataDir: process.env.DATA_DIR || './data',
});

const rateLimits = new Map<string, number>();

function isRateLimited(address: string): boolean {
  const lastDrip = rateLimits.get(address.toLowerCase());
  if (!lastDrip) return false;
  return Date.now() - lastDrip < RATE_LIMIT_SECONDS * 1000;
}

function recordDrip(address: string): void {
  rateLimits.set(address.toLowerCase(), Date.now());
}

// ── Server ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/api/info', async (_req: Request, res: Response) => {
  const faucetAddress = kit.wallet.deriveAddress(WALLET_INDEX);
  try {
    const balance = await kit.operations.getBalance(faucetAddress);
    res.json({
      faucetAddress,
      network: kit.chainClient.chain.name,
      chainId: kit.chainClient.chain.id,
      dripAmount: DRIP_AMOUNT,
      rateLimitSeconds: RATE_LIMIT_SECONDS,
      balance: balance.usd,
    });
  } catch {
    res.json({
      faucetAddress,
      network: kit.chainClient.chain.name,
      dripAmount: DRIP_AMOUNT,
      rateLimitSeconds: RATE_LIMIT_SECONDS,
    });
  }
});

app.post('/api/drip', async (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    res.status(400).json({ error: 'Invalid Ethereum address' });
    return;
  }

  if (isRateLimited(address)) {
    const lastDrip = rateLimits.get(address.toLowerCase())!;
    const waitSeconds = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (Date.now() - lastDrip)) / 1000);
    res.status(429).json({ error: `Rate limited. Try again in ${waitSeconds}s` });
    return;
  }

  try {
    const result = await kit.operations.send(
      WALLET_INDEX,
      address as `0x${string}`,
      DRIP_AMOUNT,
      'USD',
    );

    recordDrip(address);

    kit.db.insertTransaction({
      tx_hash: result.hash,
      agent_id: AGENT_ID,
      wallet_index: WALLET_INDEX,
      direction: 'sent',
      counterparty: address,
      amount: DRIP_AMOUNT,
      asset: 'USD',
      block_number: 0,
    });

    console.log(`[faucet] Sent ${DRIP_AMOUNT} USD to ${address} (tx: ${result.hash})`);

    res.json({
      success: true,
      txHash: result.hash,
      amount: DRIP_AMOUNT,
      asset: 'USD',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
    console.error(`[faucet] Failed to drip to ${address}: ${msg}`);
    res.status(500).json({ error: 'Faucet transaction failed. Try again later.' });
  }
});

app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = kit.db.getStats(AGENT_ID);
  res.json({
    totalDrips: stats.totalSent,
    uniqueRecipients: stats.uniqueCounterparties,
  });
});

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Radius Faucet ===');

  await kit.chainClient.validateChainId();
  const faucetAddress = kit.wallet.deriveAddress(WALLET_INDEX);
  kit.db.upsertWallet(AGENT_ID, WALLET_INDEX, faucetAddress);

  const balance = await kit.operations.getBalance(faucetAddress);
  console.log(`[faucet] Address: ${faucetAddress}`);
  console.log(`[faucet] Balance: ${balance.usd} USD`);
  console.log(`[faucet] Drip: ${DRIP_AMOUNT} USD per request`);
  console.log(`[faucet] Rate limit: ${RATE_LIMIT_SECONDS}s per address`);

  app.listen(PORT, () => {
    console.log(`[faucet] Running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
