import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const swapTool = {
  name: 'radius_swap',
  description: 'Swap between native USD and SBC stablecoins on Radius Network. Note: this sends one asset and receives the other — actual swap routing depends on available liquidity.',
  parameters: {
    type: 'object' as const,
    properties: {
      fromAsset: {
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to swap from',
      },
      toAsset: {
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to swap to',
      },
      amount: {
        type: 'string',
        description: 'Amount to swap (e.g., "1.00")',
      },
    },
    required: ['fromAsset', 'toAsset', 'amount'],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { fromAsset: string; toAsset: string; amount: string }) => {
      if (params.fromAsset === params.toAsset) {
        return { success: false, error: 'Cannot swap same asset' };
      }

      // For now, direct swap is a placeholder — Radius doesn't have a DEX yet.
      // This tool is ready for when swap contracts are deployed.
      return {
        success: false,
        error: 'Direct swap not yet available on Radius. Use radius_send_payment to transfer assets individually.',
        fromAsset: params.fromAsset,
        toAsset: params.toAsset,
        amount: params.amount,
      };
    };
  },
};
