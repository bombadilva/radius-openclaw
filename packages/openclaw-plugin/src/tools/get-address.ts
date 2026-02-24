import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const getAddressTool = {
  name: 'radius_get_address',
  description: 'Get this agent\'s Radius payment address for receiving stablecoin payments',
  parameters: {
    type: 'object' as const,
    properties: {
      index: {
        type: 'number',
        description: 'Wallet index (default: agent\'s primary wallet)',
      },
    },
    required: [],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { index?: number }) => {
      const idx = params.index ?? walletIndex;
      const address = kit.wallet.deriveAddress(idx);

      return {
        address,
        walletIndex: idx,
        agentId: kit.wallet.agentId,
        network: kit.chainClient.chain.name,
      };
    };
  },
};
