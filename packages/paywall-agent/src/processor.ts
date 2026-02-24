import { createHash } from 'node:crypto';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import { parseAmount } from '@bombadilva/agent-wallet';
import type { Channel, Message } from './channels/base.js';

// ── Types ───────────────────────────────────────────────────────────

export interface PaywallConfig {
  paywallAmount: string;
  asset: 'USD' | 'SBC';
  agentId: string;
}

interface QuarantinedEntry {
  message: Message;
  walletIndex: number;
  walletAddress: string;
  addedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Deterministic mapping from senderId to a wallet index (1-based, reserving 0 for the agent). */
function senderToWalletIndex(senderId: string): number {
  const hash = createHash('sha256').update(senderId).digest();
  // Use first 4 bytes as unsigned 32-bit integer, shift to 1-based
  return (hash.readUInt32BE(0) % 1_000_000) + 1;
}

// ── Processor ───────────────────────────────────────────────────────

export class PaywallProcessor {
  private readonly channel: Channel;
  private readonly kit: AgentWalletKit;
  private readonly config: PaywallConfig;
  private readonly repliedSenders = new Set<string>();

  constructor(channel: Channel, kit: AgentWalletKit, config: PaywallConfig) {
    this.channel = channel;
    this.kit = kit;
    this.config = config;
  }

  /** Process a batch of new messages through the paywall. */
  async processBatch(): Promise<{ delivered: number; quarantined: number }> {
    const messages = await this.channel.fetchMessages();
    let delivered = 0;
    let quarantined = 0;

    for (const msg of messages) {
      try {
        if (this.isWhitelisted(msg.senderId)) {
          await this.channel.deliverMessage(msg);
          delivered++;
          continue;
        }

        const walletIndex = senderToWalletIndex(msg.senderId);
        const address = this.kit.wallet.deriveAddress(walletIndex);

        if (await this.hasPaidEnough(address)) {
          this.whitelist(msg.senderId, walletIndex, address);
          await this.channel.deliverMessage(msg);
          delivered++;
          continue;
        }

        // Quarantine and request payment (at most once per session per sender)
        await this.channel.quarantineMessage(msg);
        this.addToQuarantine(msg, walletIndex, address);
        quarantined++;

        if (!this.repliedSenders.has(msg.senderId)) {
          this.repliedSenders.add(msg.senderId);
          await this.channel.sendPaymentRequest(
            msg.senderId,
            address,
            this.config.paywallAmount,
            this.config.asset,
          );
        }
      } catch (err) {
        const m = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
        console.error(`[paywall] Error processing ${msg.id}: ${m}`);
      }
    }

    return { delivered, quarantined };
  }

  /** Called when an incoming payment is detected for a watched address. */
  async onPaymentReceived(walletAddress: string): Promise<void> {
    const entries = this.getQuarantineEntries();
    const matching = entries.filter(
      (e) => e.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
    );
    if (matching.length === 0) return;

    const senderId = matching[0].message.senderId;
    const walletIndex = matching[0].walletIndex;

    // Check if the payment actually meets the threshold
    const address = walletAddress as `0x${string}`;
    if (!(await this.hasPaidEnough(address))) return;

    // Deliver all quarantined messages from this sender
    for (const entry of matching) {
      try {
        await this.channel.deliverMessage(entry.message);
      } catch (err) {
        const m = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
        console.error(`[paywall] Delivery failed for ${entry.message.id}: ${m}`);
      }
    }

    this.whitelist(senderId, walletIndex, walletAddress);
    this.removeFromQuarantine(senderId);
    console.log(`[paywall] Sender ${senderId} paid and whitelisted`);
  }

  // ── Whitelist management ──────────────────────────────────────────

  isWhitelisted(senderId: string): boolean {
    const raw = this.kit.db.getMeta(`whitelist:${senderId}`);
    return raw === '1';
  }

  whitelist(senderId: string, walletIndex: number, address: string): void {
    this.kit.db.setMeta(`whitelist:${senderId}`, '1');
    this.kit.db.upsertWallet(this.config.agentId, walletIndex, address, `sender:${senderId}`);
  }

  removeWhitelist(senderId: string): void {
    this.kit.db.setMeta(`whitelist:${senderId}`, '0');
  }

  // ── Payment check ─────────────────────────────────────────────────

  private async hasPaidEnough(address: `0x${string}`): Promise<boolean> {
    try {
      const balance = await this.kit.operations.getBalance(address);
      const threshold = parseAmount(this.config.paywallAmount, this.config.asset);
      const received = this.config.asset === 'USD' ? balance.usdRaw : balance.sbcRaw;
      // Check total received from transactions rather than current balance
      // For simplicity, use balance as proxy (funds sent to this address)
      return received >= threshold;
    } catch {
      return false;
    }
  }

  // ── Quarantine persistence (JSON in meta table) ───────────────────

  getQuarantineEntries(): QuarantinedEntry[] {
    const raw = this.kit.db.getMeta('quarantine');
    if (!raw) return [];
    try {
      return JSON.parse(raw) as QuarantinedEntry[];
    } catch {
      return [];
    }
  }

  private addToQuarantine(msg: Message, walletIndex: number, walletAddress: string): void {
    const entries = this.getQuarantineEntries();
    entries.push({
      message: msg,
      walletIndex,
      walletAddress,
      addedAt: new Date().toISOString(),
    });
    this.kit.db.setMeta('quarantine', JSON.stringify(entries));
  }

  private removeFromQuarantine(senderId: string): void {
    const entries = this.getQuarantineEntries();
    const filtered = entries.filter((e) => e.message.senderId !== senderId);
    this.kit.db.setMeta('quarantine', JSON.stringify(filtered));
  }

  /** Get all distinct senders with their paywall status. */
  getSenders(): Array<{ senderId: string; whitelisted: boolean; quarantinedCount: number }> {
    const entries = this.getQuarantineEntries();
    const senderMap = new Map<string, number>();
    for (const e of entries) {
      senderMap.set(e.message.senderId, (senderMap.get(e.message.senderId) ?? 0) + 1);
    }

    const allSenderIds = new Set<string>();
    for (const e of entries) allSenderIds.add(e.message.senderId);

    // Also include whitelisted senders from wallets table
    const wallets = this.kit.db.getWallets(this.config.agentId);
    for (const w of wallets) {
      if (w.label?.startsWith('sender:')) {
        allSenderIds.add(w.label.slice(7));
      }
    }

    return [...allSenderIds].map((senderId) => ({
      senderId,
      whitelisted: this.isWhitelisted(senderId),
      quarantinedCount: senderMap.get(senderId) ?? 0,
    }));
  }
}
