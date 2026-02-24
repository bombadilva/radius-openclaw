#!/usr/bin/env node
import 'dotenv/config';
import { createAgentWallet } from '@bombadilva/agent-wallet';
import type { Channel, Message } from './channels/base.js';
import { PaywallProcessor } from './processor.js';
import { createServer } from './server.js';

// ── Config ──────────────────────────────────────────────────────────

const MASTER_KEY = process.env.MASTER_KEY as `0x${string}`;
const AGENT_ID = process.env.AGENT_ID || 'paywall-agent';
const NETWORK = (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet';
const RPC_URL = process.env.RPC_URL;
const PORT = Number(process.env.PORT || '3002');
const PAYWALL_AMOUNT = process.env.PAYWALL_AMOUNT || '0.01';
const ASSET = (process.env.ASSET || 'USD') as 'USD' | 'SBC';
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || '5000');

if (!MASTER_KEY) {
  console.error('MASTER_KEY is required');
  process.exit(1);
}

// ── Console channel (demo/testing) ──────────────────────────────────

class ConsoleChannel implements Channel {
  name = 'console';
  private inbox: Message[] = [];

  async fetchMessages(): Promise<Message[]> {
    const batch = this.inbox.splice(0);
    return batch;
  }

  async deliverMessage(msg: Message): Promise<void> {
    console.log(`[console] DELIVERED [${msg.senderId}]: ${msg.content.slice(0, 80)}`);
  }

  async sendPaymentRequest(senderId: string, address: string, amount: string, asset: string): Promise<void> {
    console.log(`[console] PAYMENT REQUEST to ${senderId}: send ${amount} ${asset} to ${address}`);
  }

  async quarantineMessage(msg: Message): Promise<void> {
    console.log(`[console] QUARANTINED [${msg.senderId}]: ${msg.content.slice(0, 80)}`);
  }

  /** Push a message into the inbox (for testing). */
  push(msg: Message): void {
    this.inbox.push(msg);
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Radius Paywall Agent ===');

  const kit = createAgentWallet({
    masterKey: MASTER_KEY,
    agentId: AGENT_ID,
    network: NETWORK,
    rpcUrl: RPC_URL,
    dataDir: process.env.DATA_DIR || './data',
  });

  await kit.chainClient.validateChainId();

  const channel = new ConsoleChannel();

  const config = { paywallAmount: PAYWALL_AMOUNT, asset: ASSET, agentId: AGENT_ID };
  const processor = new PaywallProcessor(channel, kit, config);

  // Register the agent's primary wallet
  const agentAddress = kit.wallet.deriveAddress(0);
  kit.db.upsertWallet(AGENT_ID, 0, agentAddress, 'paywall-treasury');

  console.log(`[paywall] Agent: ${AGENT_ID}`);
  console.log(`[paywall] Treasury: ${agentAddress}`);
  console.log(`[paywall] Paywall: ${PAYWALL_AMOUNT} ${ASSET}`);
  console.log(`[paywall] Channel: ${channel.name}`);

  // Start Express admin API
  const app = createServer(kit, processor, config);
  app.listen(PORT, () => {
    console.log(`[paywall] Dashboard: http://localhost:${PORT}`);
  });

  // Start payment monitor to detect incoming payments and trigger delivery
  kit.monitor.on('payment_received', (event) => {
    console.log(`[paywall] Payment received: ${event.amount} ${event.asset} from ${event.from}`);
    const address = kit.wallet.deriveAddress(event.walletIndex);
    processor.onPaymentReceived(address).catch((err) => {
      const m = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
      console.error(`[paywall] Payment processing error: ${m}`);
    });
  });

  kit.monitor.on('error', (err) => {
    console.error(`[paywall] Monitor error: ${err.message.slice(0, 100)}`);
  });

  // Watch all known sender wallets for incoming payments
  const wallets = kit.db.getWallets(AGENT_ID);
  for (const w of wallets) {
    if (w.wallet_index > 0) {
      kit.monitor.watch(w.address as `0x${string}`, AGENT_ID, w.wallet_index);
    }
  }

  kit.monitor.start();
  console.log(`[paywall] Payment monitor started (poll: ${POLL_INTERVAL}ms)`);

  // Periodic batch processing
  setInterval(async () => {
    try {
      const result = await processor.processBatch();
      if (result.delivered > 0 || result.quarantined > 0) {
        console.log(`[paywall] Batch: ${result.delivered} delivered, ${result.quarantined} quarantined`);
      }
    } catch (err) {
      const m = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
      console.error(`[paywall] Batch error: ${m}`);
    }
  }, POLL_INTERVAL);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
