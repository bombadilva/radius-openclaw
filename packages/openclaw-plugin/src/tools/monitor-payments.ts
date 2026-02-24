import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import { formatAmount, type Asset } from '@bombadilva/agent-wallet';

export const monitorPaymentsTool = {
  name: 'radius_monitor_payments',
  description: 'List recent incoming payments received by this agent\'s Radius wallet',
  parameters: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of payments to return (default: 20)',
      },
    },
    required: [],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { limit?: number }) => {
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
        payments,
        count: payments.length,
        agentId: kit.wallet.agentId,
      };
    };
  },
};
