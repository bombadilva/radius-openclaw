import type { AgentWalletKit, PaymentEvent } from '@bombadilva/agent-wallet';

export interface PluginContext {
  emitEvent(name: string, data: unknown): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

/**
 * Background service that polls for incoming payments and
 * emits events into the agent's context.
 */
export class PaymentWatcherService {
  private readonly kit: AgentWalletKit;
  private readonly walletIndex: number;
  private readonly context: PluginContext;

  constructor(kit: AgentWalletKit, walletIndex: number, context: PluginContext) {
    this.kit = kit;
    this.walletIndex = walletIndex;
    this.context = context;
  }

  start(): void {
    const address = this.kit.wallet.deriveAddress(this.walletIndex);

    // Register address for monitoring
    this.kit.monitor.watch(address, this.kit.wallet.agentId, this.walletIndex);

    // Forward payment events to agent context
    this.kit.monitor.on('payment_received', (event: PaymentEvent) => {
      this.context.log(
        'info',
        `Payment received: ${event.amount} ${event.asset} from ${event.from}`,
      );
      this.context.emitEvent('radius:payment_received', {
        txHash: event.txHash,
        from: event.from,
        amount: event.amount,
        asset: event.asset,
        blockNumber: event.blockNumber,
      });
    });

    this.kit.monitor.on('error', (err: Error) => {
      this.context.log('error', `Payment monitor error: ${err.message.slice(0, 100)}`);
    });

    // Start polling
    this.kit.monitor.start();
    this.context.log('info', `Payment watcher started for ${address}`);
  }

  stop(): void {
    this.kit.monitor.stop();
    this.context.log('info', 'Payment watcher stopped');
  }
}
