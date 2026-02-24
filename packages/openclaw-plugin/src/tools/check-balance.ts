import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export const checkBalanceTool = {
  name: 'radius_check_balance',
  description: 'Check the USD and SBC stablecoin balance of a Radius wallet address',
  parameters: {
    type: 'object' as const,
    properties: {
      address: {
        type: 'string',
        description: 'Ethereum address to check (0x...). Omit to check this agent\'s wallet.',
      },
    },
    required: [],
  },

  createHandler(kit: AgentWalletKit, walletIndex: number) {
    return async (params: { address?: string }) => {
      const address = (params.address as `0x${string}`) || kit.wallet.deriveAddress(walletIndex);
      const balance = await kit.operations.getBalance(address);

      return {
        address,
        usd: balance.usd,
        sbc: balance.sbc,
        network: kit.chainClient.chain.name,
      };
    };
  },
};
