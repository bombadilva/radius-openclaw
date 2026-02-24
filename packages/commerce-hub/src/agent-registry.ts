// ── Types ──────────────────────────────────────────────────────────

export interface ServiceAgent {
  id: string;
  name: string;
  description: string;
  address: `0x${string}`;
  price: string;
  asset: 'USD' | 'SBC';
  strategy: string;
  endpoint?: string;
  tags: string[];
  registeredAt: number;
}

// ── Registry ───────────────────────────────────────────────────────

const agents = new Map<string, ServiceAgent>();

export function register(agent: ServiceAgent): void {
  agents.set(agent.id, agent);
}

export function unregister(id: string): boolean {
  return agents.delete(id);
}

export function find(id: string): ServiceAgent | undefined {
  return agents.get(id);
}

export function listAll(): ServiceAgent[] {
  return [...agents.values()];
}

export function findByTag(tag: string): ServiceAgent[] {
  return [...agents.values()].filter((a) => a.tags.includes(tag));
}

export function count(): number {
  return agents.size;
}
