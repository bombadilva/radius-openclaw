import { Type } from '@sinclair/typebox';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';

export function createGetAddressTool(kit: AgentWalletKit, walletIndex: number) {
  return {
    name: 'radius_get_address',
    label: 'Radius Get Address',
    description: "Get this agent's Radius payment address for receiving stablecoin payments",
    parameters: Type.Object({
      index: Type.Optional(Type.Number({
        description: "Wallet index (default: agent's primary wallet)",
      })),
    }),
    async execute(_id: string, params: { index?: number }) {
      const idx = params.index ?? walletIndex;
      const address = kit.wallet.deriveAddress(idx);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          address,
          walletIndex: idx,
          agentId: kit.wallet.agentId,
          network: kit.chainClient.chain.name,
        }, null, 2) }],
      };
    },
  };
}
