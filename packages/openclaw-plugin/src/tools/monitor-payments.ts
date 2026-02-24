import { Type } from '@sinclair/typebox';
import { formatAmount, type Asset } from '@bombadilva/agent-wallet';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createMonitorPaymentsTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_monitor_payments',
    label: 'Radius Monitor Payments',
    description: "List recent incoming payments received by this agent's Radius wallet",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({
        description: 'Maximum number of payments to return (default: 20)',
      })),
    }),
    async execute(_id: string, params: { limit?: number }) {
      const limit = params.limit ?? 20;
      const transactions = kit.db.getReceivedTransactions(kit.wallet.agentId, limit);
      const payments = transactions.map((tx) => ({
        txHash: tx.tx_hash,
        from: tx.counterparty,
        amount: formatAmount(BigInt(tx.amount), tx.asset as Asset),
        asset: tx.asset,
        blockNumber: tx.block_number,
        refunded: !!tx.refunded,
        timestamp: tx.created_at,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          payments,
          count: payments.length,
          agentId: kit.wallet.agentId,
        }, null, 2) }],
      };
    },
  };
}
