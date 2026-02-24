import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createRefundTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_refund',
    label: 'Radius Refund',
    description: 'Refund a previously received payment by sending the same amount back to the original sender',
    parameters: Type.Object({
      txHash: Type.String({ description: 'Transaction hash of the payment to refund' }),
    }),
    async execute(_id: string, params: { txHash: string }) {
      const result = await kit.operations.refund(
        walletIndex,
        params.txHash as `0x${string}`,
      );
      kit.db.markRefunded(params.txHash, result.refundHash);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: true,
          refundHash: result.refundHash,
          originalTxHash: params.txHash,
          refundedTo: result.originalFrom,
          amount: result.amount,
          asset: result.asset,
        }, null, 2) }],
      };
    },
  };
}
