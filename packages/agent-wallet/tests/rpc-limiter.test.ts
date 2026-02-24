import { describe, it, expect } from 'vitest';
import { RpcLimiter } from '../src/rpc-limiter.js';

describe('RpcLimiter', () => {
  it('should allow concurrent requests up to the limit', async () => {
    const limiter = new RpcLimiter(3);
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 10 }, () =>
      limiter.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
        return true;
      }),
    );

    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('should reject when queue is full', async () => {
    const limiter = new RpcLimiter(1, 2);

    // Fill the active slot with a long-running task
    const p1 = limiter.run(
      () => new Promise<void>((r) => setTimeout(r, 200)),
    );

    // Fill the queue (2 slots) with quick tasks that will resolve once active
    const p2 = limiter.run(() => Promise.resolve());
    const p3 = limiter.run(() => Promise.resolve());

    // Queue is full — this should reject immediately
    await expect(
      limiter.run(() => Promise.resolve()),
    ).rejects.toThrow('RPC backpressure: queue full');

    // Wait for everything to drain
    await Promise.all([p1, p2, p3]);
  });

  it('should report pending count', async () => {
    const limiter = new RpcLimiter(1, 10);

    let release: () => void;
    const blocker = new Promise<void>((r) => { release = r; });

    const p1 = limiter.run(() => blocker);
    const p2 = limiter.run(() => Promise.resolve());
    // Let p2 enter the queue
    await new Promise((r) => setTimeout(r, 5));

    expect(limiter.pendingCount).toBe(1);
    expect(limiter.activeCount).toBe(1);

    release!();
    await Promise.all([p1, p2]);

    expect(limiter.pendingCount).toBe(0);
  });
});
