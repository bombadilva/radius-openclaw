import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const refundTool = {
  name: 'radius_refund',
  description: 'Refund a previously received payment by sending the same amount back to the original sender',
  parameters: {
    type: 'object' as const,
    properties: {
      txHash: {
        type: 'string',
        description: 'Transaction hash of the payment to refund',
      },
    },
    required: ['txHash'],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { txHash: string }) => {
      const result = await kit.operations.refund(
        walletIndex,
        params.txHash as `0x${string}`,
      );

      // Mark as refunded in database
      kit.db.markRefunded(params.txHash, result.refundHash);

      return {
        success: true,
        refundHash: result.refundHash,
        originalTxHash: params.txHash,
        refundedTo: result.originalFrom,
        amount: result.amount,
        asset: result.asset,
      };
    };
  },
};
