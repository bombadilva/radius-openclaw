import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export interface LifecycleContext {
  log(level: 'info' | 'warn' | 'error', message: string): void;
  injectMessage(role: 'system' | 'assistant', content: string): void;
}

/**
 * Agent startup hook: initialize wallet, verify chain, check funding.
 */
export async function onAgentStartup(
  kit: AgentWalletKit,
  walletIndex: number,
  context: LifecycleContext,
): Promise<void> {
  // Validate chain connection
  try {
    await kit.chainClient.validateChainId();
    context.log('info', `Connected to ${kit.chainClient.chain.name} (chain ${kit.chainClient.chain.id})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
    context.log('error', `Chain validation failed: ${msg}`);
    throw err;
  }

  // Derive and register wallet
  const address = kit.wallet.deriveAddress(walletIndex);
  kit.db.upsertWallet(kit.wallet.agentId, walletIndex, address);
  context.log('info', `Agent wallet: ${address}`);

  // Check balance
  try {
    const balance = await kit.operations.getBalance(address);
    context.log('info', `Balance: ${balance.usd} USD, ${balance.sbc} SBC`);

    if (balance.usdRaw === 0n && balance.sbcRaw === 0n) {
      context.log('warn', 'Wallet has zero balance — fund it to enable payments');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
    context.log('warn', `Could not check balance: ${msg}`);
  }
}

/**
 * Payment received hook: inject notification into agent conversation.
 */
export function onPaymentReceived(
  event: { from: string; amount: string; asset: string; txHash: string },
  context: LifecycleContext,
): void {
  context.injectMessage(
    'system',
    `[Radius Payment Received] ${event.amount} ${event.asset} from ${event.from} (tx: ${event.txHash})`,
  );
}
