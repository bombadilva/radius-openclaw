import type { Operations, SendResult } from './operations.js';
import type { AgentWallet } from './wallet.js';

/**
 * Streaming micropayment session.
 * Sends small increments over time, allowing either party to stop.
 */
export interface StreamConfig {
  /** Recipient address. */
  to: `0x${string}`;
  /** Total amount to stream. */
  totalAmount: string;
  /** Amount per tick. */
  tickAmount: string;
  /** Interval between ticks in ms (default: 1000). */
  intervalMs?: number;
  /** Asset to send (default: USD). */
  asset?: 'USD' | 'SBC';
  /** Wallet index to send from (default: 0). */
  walletIndex?: number;
  /** Called after each tick payment. Return false to stop. */
  onTick?: (tick: StreamTick) => boolean | Promise<boolean>;
  /** Called on error. Return true to continue, false to abort. */
  onError?: (error: Error, tick: number) => boolean | Promise<boolean>;
}

export interface StreamTick {
  tickNumber: number;
  txHash: `0x${string}`;
  amountSent: string;
  totalSent: string;
  remaining: string;
}

export interface StreamResult {
  totalTicks: number;
  totalSent: string;
  transactions: `0x${string}`[];
  completed: boolean;
  stoppedBy?: 'sender' | 'error' | 'receiver';
}

/**
 * Execute a streaming micropayment session.
 */
export async function streamPayment(
  operations: Operations,
  config: StreamConfig,
): Promise<StreamResult> {
  const asset = config.asset ?? 'USD';
  const walletIndex = config.walletIndex ?? 0;
  const intervalMs = config.intervalMs ?? 1000;
  const total = Number(config.totalAmount);
  const perTick = Number(config.tickAmount);

  const transactions: `0x${string}`[] = [];
  let totalSent = 0;
  let tickNumber = 0;

  while (totalSent < total) {
    const amount = Math.min(perTick, total - totalSent);
    tickNumber++;

    try {
      const result = await operations.send(
        walletIndex,
        config.to,
        amount.toString(),
        asset,
      );

      totalSent += amount;
      transactions.push(result.hash);

      const tick: StreamTick = {
        tickNumber,
        txHash: result.hash,
        amountSent: amount.toString(),
        totalSent: totalSent.toString(),
        remaining: (total - totalSent).toString(),
      };

      if (config.onTick) {
        const shouldContinue = await config.onTick(tick);
        if (!shouldContinue) {
          return {
            totalTicks: tickNumber,
            totalSent: totalSent.toString(),
            transactions,
            completed: false,
            stoppedBy: 'sender',
          };
        }
      }
    } catch (err) {
      if (config.onError) {
        const shouldContinue = await config.onError(
          err instanceof Error ? err : new Error(String(err)),
          tickNumber,
        );
        if (!shouldContinue) {
          return {
            totalTicks: tickNumber,
            totalSent: totalSent.toString(),
            transactions,
            completed: false,
            stoppedBy: 'error',
          };
        }
      } else {
        return {
          totalTicks: tickNumber,
          totalSent: totalSent.toString(),
          transactions,
          completed: false,
          stoppedBy: 'error',
        };
      }
    }

    // Wait between ticks (unless this was the last one)
    if (totalSent < total) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    totalTicks: tickNumber,
    totalSent: totalSent.toString(),
    transactions,
    completed: true,
  };
}
