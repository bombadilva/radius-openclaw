import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createSendPaymentTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_send_payment',
    label: 'Radius Send Payment',
    description: 'Send USD or SBC stablecoin on Radius Network to an Ethereum address',
    parameters: Type.Object({
      to: Type.String({ description: 'Recipient Ethereum address (0x...)' }),
      amount: Type.String({ description: 'Amount to send (e.g., "0.05", "1.00")' }),
      asset: Type.Optional(Type.Unsafe<'USD' | 'SBC'>({
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to send (default: USD)',
      })),
    }),
    async execute(_id: string, params: { to: string; amount: string; asset?: string }) {
      const asset = (params.asset as 'USD' | 'SBC') || 'USD';
      const result = await kit.operations.send(
        walletIndex,
        params.to as `0x${string}`,
        params.amount,
        asset,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: true,
          txHash: result.hash,
          from: result.from,
          to: result.to,
          amount: result.amount,
          asset: result.asset,
          network: kit.chainClient.chain.name,
        }, null, 2) }],
      };
    },
  };
}
