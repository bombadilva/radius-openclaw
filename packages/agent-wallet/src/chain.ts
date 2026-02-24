import {
  defineChain,
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { RpcLimiter } from './rpc-limiter.js';

// ── Chain definitions ───────────────────────────────────────────────

export const radiusTestnet = defineChain({
  id: 72344,
  name: 'Radius Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.radiustech.xyz'] },
  },
});

export const radiusMainnet = defineChain({
  id: 723,
  name: 'Radius',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.radiustech.xyz'] },
  },
});

// ── Configuration ───────────────────────────────────────────────────

export interface ChainConfig {
  network: 'testnet' | 'mainnet';
  rpcUrl?: string;
  maxConcurrentRpc?: number;
}

// ── Client factory ──────────────────────────────────────────────────

export class ChainClient {
  readonly chain: Chain;
  readonly rpcLimiter: RpcLimiter;
  private readonly rpcUrl: string;
  private _publicClient: PublicClient | null = null;

  constructor(config: ChainConfig) {
    this.chain = config.network === 'mainnet' ? radiusMainnet : radiusTestnet;
    this.rpcUrl = config.rpcUrl ?? this.chain.rpcUrls.default.http[0];
    this.rpcLimiter = new RpcLimiter(config.maxConcurrentRpc ?? 100);

    // Validate RPC URL
    try {
      new URL(this.rpcUrl);
    } catch {
      throw new Error(`Invalid RPC URL: "${this.rpcUrl}"`);
    }
  }

  getPublicClient(): PublicClient {
    if (!this._publicClient) {
      this._publicClient = createPublicClient({
        chain: this.chain,
        transport: http(this.rpcUrl),
      });
    }
    return this._publicClient;
  }

  getWalletClient(privateKey: `0x${string}`): WalletClient<Transport, Chain, Account> {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  async validateChainId(): Promise<void> {
    const client = this.getPublicClient();
    const actual = await this.rpcLimiter.run(() => client.getChainId());
    if (actual !== this.chain.id) {
      throw new Error(
        `Chain ID mismatch: configured ${this.chain.id}, RPC reports ${actual}`,
      );
    }
  }
}
