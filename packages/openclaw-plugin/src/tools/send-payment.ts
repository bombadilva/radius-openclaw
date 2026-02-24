import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const sendPaymentTool = {
  name: 'radius_send_payment',
  description: 'Send USD or SBC stablecoin on Radius Network to an Ethereum address',
  parameters: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient Ethereum address (0x...)',
      },
      amount: {
        type: 'string',
        description: 'Amount to send (e.g., "0.05", "1.00")',
      },
      asset: {
        type: 'string',
        enum: ['USD', 'SBC'],
        description: 'Asset to send (default: USD)',
        default: 'USD',
      },
    },
    required: ['to', 'amount'],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { to: string; amount: string; asset?: string }) => {
      const asset = (params.asset as 'USD' | 'SBC') || 'USD';

      const result = await kit.operations.send(
        walletIndex,
        params.to as `0x${string}`,
        params.amount,
        asset,
      );

      return {
        success: true,
        txHash: result.hash,
        from: result.from,
        to: result.to,
        amount: result.amount,
        asset: result.asset,
        network: kit.chainClient.chain.name,
      };
    };
  },
};
