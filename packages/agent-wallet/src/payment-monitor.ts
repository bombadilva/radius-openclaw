import { EventEmitter } from 'node:events';
import { formatEther, decodeEventLog, parseAbi } from 'viem';
import type { ChainClient } from './chain.js';
import type { AgentDb } from './db.js';
import { SBC_ADDRESS, formatAmount } from './token.js';

// ── Events ──────────────────────────────────────────────────────────

export interface PaymentEvent {
  txHash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  amountRaw: bigint;
  asset: 'USD' | 'SBC';
  blockNumber: number;
  walletIndex: number;
  agentId: string;
}

export interface PaymentMonitorEvents {
  payment_received: [PaymentEvent];
  payment_confirmed: [PaymentEvent];
  error: [Error];
  checkpoint: [number];
}

// ── ERC-20 Transfer event ───────────────────────────────────────────

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// ── Monitor ─────────────────────────────────────────────────────────

export interface PaymentMonitorConfig {
  pollInterval?: number; // ms, default 2000
  confirmations?: number; // blocks to wait for "confirmed" event, default 1
}

export class PaymentMonitor extends EventEmitter<PaymentMonitorEvents> {
  private readonly chainClient: ChainClient;
  private readonly db: AgentDb;
  private readonly watchAddresses: Map<string, { agentId: string; walletIndex: number }>;
  private readonly pollInterval: number;
  private readonly confirmations: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    chainClient: ChainClient,
    db: AgentDb,
    config?: PaymentMonitorConfig,
  ) {
    super();
    this.chainClient = chainClient;
    this.db = db;
    this.watchAddresses = new Map();
    this.pollInterval = config?.pollInterval ?? 2000;
    this.confirmations = config?.confirmations ?? 1;
  }

  /**
   * Register an address to watch for incoming payments.
   */
  watch(address: `0x${string}`, agentId: string, walletIndex: number): void {
    this.watchAddresses.set(address.toLowerCase(), { agentId, walletIndex });
  }

  /**
   * Remove an address from the watch list.
   */
  unwatch(address: `0x${string}`): void {
    this.watchAddresses.delete(address.toLowerCase());
  }

  /**
   * Start block-by-block polling.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll();
  }

  /**
   * Stop polling.
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      await this.scanBlocks();
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }

    if (this.running) {
      this.timer = setTimeout(() => this.poll(), this.pollInterval);
    }
  }

  private async scanBlocks(): Promise<void> {
    const client = this.chainClient.getPublicClient();

    const currentBlock = await this.chainClient.rpcLimiter.run(() =>
      client.getBlockNumber(),
    );

    const lastChecked = this.db.getMeta('last_block');
    const startBlock = lastChecked ? BigInt(lastChecked) + 1n : currentBlock;

    if (startBlock > currentBlock) return;

    for (let blockNum = startBlock; blockNum <= currentBlock; blockNum++) {
      if (!this.running) break;

      try {
        const block = await this.chainClient.rpcLimiter.run(() =>
          client.getBlock({
            blockNumber: blockNum,
            includeTransactions: true,
          }),
        );

        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue;

          // Check native USD transfers
          if (tx.to && tx.value > 0n) {
            const watched = this.watchAddresses.get(tx.to.toLowerCase());
            if (watched) {
              const event: PaymentEvent = {
                txHash: tx.hash,
                from: tx.from,
                to: tx.to as `0x${string}`,
                amount: formatAmount(tx.value, 'USD'),
                amountRaw: tx.value,
                asset: 'USD',
                blockNumber: Number(blockNum),
                walletIndex: watched.walletIndex,
                agentId: watched.agentId,
              };

              this.recordAndEmit(event);
            }
          }

          // Check SBC ERC-20 Transfer events
          if (tx.to?.toLowerCase() === SBC_ADDRESS.toLowerCase()) {
            await this.checkErc20Transfer(tx.hash, Number(blockNum));
          }
        }
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
        break; // Don't skip blocks on error
      }

      // Checkpoint after each block
      this.db.setMeta('last_block', blockNum.toString());
      this.emit('checkpoint', Number(blockNum));
    }
  }

  private async checkErc20Transfer(txHash: `0x${string}`, blockNumber: number): Promise<void> {
    const client = this.chainClient.getPublicClient();

    const receipt = await this.chainClient.rpcLimiter.run(() =>
      client.getTransactionReceipt({ hash: txHash }),
    );

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== SBC_ADDRESS.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({
          abi: TRANSFER_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'Transfer') {
          const { from, to, value } = decoded.args;
          const watched = this.watchAddresses.get(to.toLowerCase());
          if (watched) {
            const event: PaymentEvent = {
              txHash,
              from: from as `0x${string}`,
              to: to as `0x${string}`,
              amount: formatAmount(value, 'SBC'),
              amountRaw: value,
              asset: 'SBC',
              blockNumber,
              walletIndex: watched.walletIndex,
              agentId: watched.agentId,
            };

            this.recordAndEmit(event);
          }
        }
      } catch {
        // Not a Transfer event log, skip
      }
    }
  }

  private recordAndEmit(event: PaymentEvent): void {
    // Record in database
    this.db.insertTransaction({
      tx_hash: event.txHash,
      agent_id: event.agentId,
      wallet_index: event.walletIndex,
      direction: 'received',
      counterparty: event.from,
      amount: event.amountRaw.toString(),
      asset: event.asset,
      block_number: event.blockNumber,
    });

    this.db.upsertCounterparty(
      event.from,
      event.agentId,
      'received',
      event.amountRaw.toString(),
    );

    this.emit('payment_received', event);
  }

  /**
   * Get recent payments from the database.
   */
  getRecentPayments(agentId: string, limit = 20) {
    return this.db.getReceivedTransactions(agentId, limit);
  }
}
