#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import {
  createAgentWallet,
  AgentWallet,
  ChainClient,
  formatAmount,
  type AgentWalletKit,
} from '@bombadilva/agent-wallet';

const program = new Command();

function getKit(): AgentWalletKit {
  const masterKey = process.env.MASTER_KEY as `0x${string}`;
  const agentId = process.env.AGENT_ID || 'radius-cli';
  const network = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';

  if (!masterKey) {
    console.error('Error: MASTER_KEY environment variable is required');
    console.error('Run: export MASTER_KEY=0x$(openssl rand -hex 32)');
    process.exit(1);
  }

  return createAgentWallet({
    masterKey,
    agentId,
    network,
    rpcUrl: process.env.RPC_URL,
    dataDir: process.env.DATA_DIR || './data',
  });
}

program
  .name('radius')
  .description('CLI for Radius Network')
  .version('0.1.0');

// ── wallet commands ─────────────────────────────────────────────────

const wallet = program.command('wallet').description('Wallet management');

wallet
  .command('generate')
  .description('Generate HD wallet addresses')
  .option('-c, --count <n>', 'Number of addresses', '5')
  .option('-s, --start <n>', 'Start index', '0')
  .action((opts) => {
    const kit = getKit();
    const count = parseInt(opts.count);
    const start = parseInt(opts.start);
    const addresses = kit.wallet.generateAddresses(count, start);

    console.log(`Agent: ${kit.wallet.agentId}`);
    console.log(`Network: ${kit.chainClient.chain.name}\n`);
    for (const { index, address } of addresses) {
      console.log(`  [${index}] ${address}`);
    }
  });

wallet
  .command('balance')
  .description('Check wallet balance')
  .argument('[address]', 'Address to check (default: wallet index 0)')
  .action(async (address?: string) => {
    const kit = getKit();
    const addr = (address as `0x${string}`) || kit.wallet.deriveAddress(0);

    try {
      const balance = await kit.operations.getBalance(addr);
      console.log(`Address: ${addr}`);
      console.log(`Network: ${kit.chainClient.chain.name}`);
      console.log(`    USD: ${balance.usd}`);
      console.log(`    SBC: ${balance.sbc}`);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message.slice(0, 100) : 'Unknown');
      process.exit(1);
    }
  });

// ── send ────────────────────────────────────────────────────────────

program
  .command('send')
  .description('Send payment')
  .argument('<to>', 'Recipient address')
  .argument('<amount>', 'Amount to send')
  .option('-a, --asset <asset>', 'Asset (USD or SBC)', 'USD')
  .option('-i, --index <n>', 'Wallet index', '0')
  .action(async (to: string, amount: string, opts) => {
    const kit = getKit();
    const asset = opts.asset as 'USD' | 'SBC';
    const index = parseInt(opts.index);

    console.log(`Sending ${amount} ${asset} to ${to}...`);

    try {
      const result = await kit.operations.send(index, to as `0x${string}`, amount, asset);
      console.log(`  TX: ${result.hash}`);
      console.log(`  From: ${result.from}`);
      console.log(`  To: ${result.to}`);
      console.log(`  Amount: ${result.amount} ${result.asset}`);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message.slice(0, 100) : 'Unknown');
      process.exit(1);
    }
  });

// ── monitor ─────────────────────────────────────────────────────────

program
  .command('monitor')
  .description('Watch for incoming payments')
  .argument('[address]', 'Address to watch (default: wallet index 0)')
  .option('-p, --poll <ms>', 'Poll interval in ms', '2000')
  .action(async (address?: string, opts?: { poll: string }) => {
    const kit = getKit();
    const addr = (address as `0x${string}`) || kit.wallet.deriveAddress(0);
    const pollInterval = parseInt(opts?.poll || '2000');

    console.log(`Monitoring ${addr} on ${kit.chainClient.chain.name}...`);
    console.log(`Poll interval: ${pollInterval}ms\n`);

    kit.monitor.watch(addr, kit.wallet.agentId, 0);

    kit.monitor.on('payment_received', (event) => {
      const time = new Date().toISOString();
      console.log(`[${time}] Payment received!`);
      console.log(`  From: ${event.from}`);
      console.log(`  Amount: ${event.amount} ${event.asset}`);
      console.log(`  TX: ${event.txHash}`);
      console.log(`  Block: ${event.blockNumber}\n`);
    });

    kit.monitor.on('error', (err) => {
      console.error(`[error] ${err.message.slice(0, 100)}`);
    });

    kit.monitor.start();

    // Keep running
    process.on('SIGINT', () => {
      console.log('\nStopping monitor...');
      kit.monitor.stop();
      process.exit(0);
    });
  });

// ── faucet ──────────────────────────────────────────────────────────

program
  .command('faucet')
  .description('Request testnet funds')
  .argument('<address>', 'Address to fund')
  .option('-u, --url <url>', 'Faucet URL', 'http://localhost:3001')
  .action(async (address: string, opts) => {
    try {
      const res = await fetch(`${opts.url}/api/drip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        console.error('Error:', data.error);
        process.exit(1);
      }

      console.log(`Funded ${address}`);
      console.log(`  Amount: ${data.amount} ${data.asset}`);
      console.log(`  TX: ${data.txHash}`);
    } catch (err) {
      console.error('Error: Could not reach faucet. Is it running?');
      process.exit(1);
    }
  });

// ── status ──────────────────────────────────────────────────────────

program
  .command('status')
  .description('Network status')
  .action(async () => {
    const kit = getKit();
    const client = kit.chainClient.getPublicClient();

    try {
      await kit.chainClient.validateChainId();
      const blockNumber = await client.getBlockNumber();

      console.log(`Network: ${kit.chainClient.chain.name}`);
      console.log(`Chain ID: ${kit.chainClient.chain.id}`);
      console.log(`Block: ${blockNumber}`);
      console.log(`Status: connected`);
    } catch (err) {
      console.error('Status: disconnected');
      console.error('Error:', err instanceof Error ? err.message.slice(0, 100) : 'Unknown');
      process.exit(1);
    }
  });

program.parse();
