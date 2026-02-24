import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const requestPaymentTool = {
  name: 'radius_request_payment',
  description: 'Generate a payment request with this agent\'s address and requested amount',
  parameters: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'string',
        description: 'Amount to request (e.g., "0.05")',
      },
      asset: {
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to request (default: USD)',
        default: 'USD',
      },
      memo: {
        type: 'string',
        description: 'Optional memo or description for the payment',
      },
    },
    required: ['amount'],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { amount: string; asset?: string; memo?: string }) => {
      const address = kit.wallet.deriveAddress(walletIndex);
      const asset = params.asset || 'USD';
      const chainId = kit.chainClient.chain.id;

      return {
        address,
        amount: params.amount,
        asset,
        memo: params.memo,
        network: kit.chainClient.chain.name,
        chainId,
        paymentUri: `radius:${address}?amount=${params.amount}&asset=${asset}${params.memo ? `&memo=${encodeURIComponent(params.memo)}` : ''}`,
      };
    };
  },
};
