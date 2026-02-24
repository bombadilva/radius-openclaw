import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createCheckBalanceTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_check_balance',
    label: 'Radius Check Balance',
    description: "Check the USD and SBC stablecoin balance of a Radius wallet address",
    parameters: Type.Object({
      address: Type.Optional(Type.String({
        description: "Ethereum address to check (0x...). Omit to check this agent's wallet.",
      })),
    }),
    async execute(_id: string, params: { address?: string }) {
      const address = (params.address as `0x${string}`) || kit.wallet.deriveAddress(walletIndex);
      const balance = await kit.operations.getBalance(address);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          address,
          usd: balance.usd,
          sbc: balance.sbc,
          network: kit.chainClient.chain.name,
        }, null, 2) }],
      };
    },
  };
}
