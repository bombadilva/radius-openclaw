import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import type { ServiceAgent } from './agent-registry.js';
import { find, findByTag } from './agent-registry.js';
import { getStrategy, type InteractionOutcome } from './strategies.js';

// ── Types ──────────────────────────────────────────────────────────

export interface ServiceRequest {
  clientAddress: `0x${string}`;
  agentId?: string;
  tag?: string;
  payload?: unknown;
}

export interface ServiceResponse {
  success: boolean;
  agentId: string;
  txHash?: string;
  amount?: string;
  asset?: string;
  error?: string;
}

// ── History tracking ───────────────────────────────────────────────

const history: InteractionOutcome[] = [];

export function getHistory(): InteractionOutcome[] {
  return history;
}

function recordOutcome(counterparty: string, cooperated: boolean, amount: string): void {
  history.push({ counterparty, cooperated, amount, timestamp: Date.now() });
}

// ── Matching ───────────────────────────────────────────────────────

function resolveAgent(req: ServiceRequest): ServiceAgent | undefined {
  if (req.agentId) return find(req.agentId);
  if (req.tag) {
    const matches = findByTag(req.tag);
    return matches.length > 0 ? matches[0] : undefined;
  }
  return undefined;
}

// ── Route request ──────────────────────────────────────────────────

export async function routeRequest(
  kit: AgentWalletKit,
  walletIndex: number,
  req: ServiceRequest,
): Promise<ServiceResponse> {
  const agent = resolveAgent(req);
  if (!agent) {
    return { success: false, agentId: '', error: 'No matching agent found' };
  }

  const strategy = getStrategy(agent.strategy);
  const cooperate = strategy.shouldCooperate(req.clientAddress, history);

  if (!cooperate) {
    recordOutcome(req.clientAddress, false, '0');
    return { success: false, agentId: agent.id, error: 'Agent declined request' };
  }

  const amount = strategy.paymentAmount(agent.price, req.clientAddress, history);

  try {
    const result = await kit.operations.send(
      walletIndex,
      agent.address,
      amount,
      agent.asset,
    );

    recordOutcome(req.clientAddress, true, amount);

    kit.db.insertTransaction({
      tx_hash: result.hash,
      agent_id: agent.id,
      wallet_index: walletIndex,
      direction: 'sent',
      counterparty: req.clientAddress,
      amount,
      asset: agent.asset,
      block_number: 0,
    });

    console.log(`[hub] Routed to ${agent.id}: ${amount} ${agent.asset} (${result.hash})`);

    return {
      success: true,
      agentId: agent.id,
      txHash: result.hash,
      amount,
      asset: agent.asset,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
    recordOutcome(req.clientAddress, false, '0');
    console.error(`[hub] Route failed for ${agent.id}: ${msg}`);
    return { success: false, agentId: agent.id, error: 'Payment failed' };
  }
}
