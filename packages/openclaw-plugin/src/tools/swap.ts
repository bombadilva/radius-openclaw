import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createSwapTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_swap',
    label: 'Radius Swap',
    description: 'Swap between native USD and SBC stablecoins on Radius Network.',
    parameters: Type.Object({
      fromAsset: Type.Unsafe<'USD' | 'SBC'>({
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to swap from',
      }),
      toAsset: Type.Unsafe<'USD' | 'SBC'>({
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to swap to',
      }),
      amount: Type.String({ description: 'Amount to swap (e.g., "1.00")' }),
    }),
    async execute(_id: string, params: { fromAsset: string; toAsset: string; amount: string }) {
      if (params.fromAsset === params.toAsset) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            success: false,
            error: 'Cannot swap same asset',
          }, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: false,
          error: 'Direct swap not yet available on Radius. Use radius_send_payment to transfer assets individually.',
        }, null, 2) }],
      };
    },
  };
}
