import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createRequestPaymentTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_request_payment',
    label: 'Radius Request Payment',
    description: "Generate a payment request with this agent's address and requested amount",
    parameters: Type.Object({
      amount: Type.String({ description: 'Amount to request (e.g., "0.05")' }),
      asset: Type.Optional(Type.Unsafe<'USD' | 'SBC'>({
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to request (default: USD)',
      })),
      memo: Type.Optional(Type.String({
        description: 'Optional memo or description for the payment',
      })),
    }),
    async execute(_id: string, params: { amount: string; asset?: string; memo?: string }) {
      const address = kit.wallet.deriveAddress(walletIndex);
      const asset = params.asset || 'USD';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          address,
          amount: params.amount,
          asset,
          memo: params.memo,
          network: kit.chainClient.chain.name,
          chainId: kit.chainClient.chain.id,
          paymentUri: `radius:${address}?amount=${params.amount}&asset=${asset}${params.memo ? `&memo=${encodeURIComponent(params.memo)}` : ''}`,
        }, null, 2) }],
      };
    },
  };
}
