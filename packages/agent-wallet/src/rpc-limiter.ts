/**
 * Semaphore-based RPC rate limiter with bounded queue.
 * Prevents OOM from unbounded concurrent RPC requests.
 */
export class RpcLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;

  constructor(maxConcurrent = 100, maxQueue?: number) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue ?? maxConcurrent * 10;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new Error('RPC backpressure: queue full'));
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
