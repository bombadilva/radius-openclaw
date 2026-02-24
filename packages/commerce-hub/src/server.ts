import express, { type Request, type Response } from 'express';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import * as registry from './agent-registry.js';
import { routeRequest, getHistory } from './router.js';

// ── Server factory ─────────────────────────────────────────────────

export function createServer(kit: AgentWalletKit, walletIndex: number): express.Express {
  const app = express();
  app.use(express.json());

  // Register a service agent
  app.post('/api/agents', (req: Request, res: Response) => {
    const { id, name, description, address, price, asset, strategy, endpoint, tags } = req.body;
    if (!id || !name || !address || !price) {
      res.status(400).json({ error: 'Missing required fields: id, name, address, price' });
      return;
    }
    registry.register({
      id,
      name,
      description: description ?? '',
      address,
      price,
      asset: asset ?? 'USD',
      strategy: strategy ?? 'always-cooperate',
      endpoint,
      tags: tags ?? [],
      registeredAt: Date.now(),
    });
    console.log(`[hub] Registered agent: ${id}`);
    res.status(201).json({ success: true, agentId: id });
  });

  // List all agents
  app.get('/api/agents', (_req: Request, res: Response) => {
    res.json(registry.listAll());
  });

  // Get agent details
  app.get('/api/agents/:id', (req: Request, res: Response) => {
    const agent = registry.find(req.params.id as string);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  });

  // Unregister an agent
  app.delete('/api/agents/:id', (req: Request, res: Response) => {
    const agentId = req.params.id as string;
    const removed = registry.unregister(agentId);
    if (!removed) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    console.log(`[hub] Unregistered agent: ${agentId}`);
    res.json({ success: true });
  });

  // Request a service (finds agent, handles payment)
  app.post('/api/request', async (req: Request, res: Response) => {
    const { clientAddress, agentId, tag, payload } = req.body;
    if (!clientAddress) {
      res.status(400).json({ error: 'clientAddress is required' });
      return;
    }
    try {
      const result = await routeRequest(kit, walletIndex, {
        clientAddress,
        agentId,
        tag,
        payload,
      });
      res.status(result.success ? 200 : 502).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // Marketplace stats
  app.get('/api/stats', (_req: Request, res: Response) => {
    const agents = registry.listAll();
    const interactions = getHistory();
    res.json({
      totalAgents: agents.length,
      totalInteractions: interactions.length,
      cooperativeRate: interactions.length > 0
        ? (interactions.filter((i) => i.cooperated).length / interactions.length).toFixed(2)
        : '1.00',
      tags: [...new Set(agents.flatMap((a) => a.tags))],
    });
  });

  return app;
}
