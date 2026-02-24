import { type PublicClient, type WalletClient, type Transport, type Chain, type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ChainClient } from './chain.js';
import type { AgentWallet } from './wallet.js';

/**
 * Mutex-protected signer that prevents nonce races per wallet index.
 * Derives key on-demand, signs, increments nonce, releases key.
 */
export class Signer {
  private readonly chainClient: ChainClient;
  private readonly wallet: AgentWallet;
  private readonly locks = new Map<number, Promise<void>>();
  private readonly nonces = new Map<number, number>();

  constructor(chainClient: ChainClient, wallet: AgentWallet) {
    this.chainClient = chainClient;
    this.wallet = wallet;
  }

  /**
   * Send a transaction from the wallet at the given index.
   * Mutex ensures only one transaction per index at a time.
   */
  async sendTransaction(
    index: number,
    params: { to: `0x${string}`; value: bigint; data?: `0x${string}` },
  ): Promise<`0x${string}`> {
    // Acquire mutex for this index
    while (this.locks.has(index)) {
      await this.locks.get(index);
    }

    let resolve: () => void;
    const lock = new Promise<void>((r) => { resolve = r; });
    this.locks.set(index, lock);

    try {
      return await this.chainClient.rpcLimiter.run(async () => {
        // Derive key on-demand
        const privateKey = this.wallet.derivePrivateKey(index);
        const account = privateKeyToAccount(privateKey);

        const walletClient = this.chainClient.getWalletClient(privateKey);
        const publicClient = this.chainClient.getPublicClient();

        // Get nonce: use tracked nonce, fallback to on-chain
        let nonce = this.nonces.get(index);
        if (nonce === undefined) {
          nonce = await publicClient.getTransactionCount({
            address: account.address,
          });
        }

        try {
          const hash = await walletClient.sendTransaction({
            to: params.to,
            value: params.value,
            data: params.data,
            nonce,
          });

          // Increment nonce on success
          this.nonces.set(index, nonce + 1);
          return hash;
        } catch (err) {
          // Reset nonce on failure — will re-fetch from chain next time
          this.nonces.delete(index);
          throw err;
        }
      });
    } finally {
      this.locks.delete(index);
      resolve!();
    }
  }

  /**
   * Wait for a transaction receipt.
   */
  async waitForReceipt(hash: `0x${string}`, timeout = 60_000) {
    const publicClient = this.chainClient.getPublicClient();
    return this.chainClient.rpcLimiter.run(() =>
      publicClient.waitForTransactionReceipt({ hash, timeout }),
    );
  }

  /**
   * Sync nonce from chain for a given index.
   */
  async syncNonce(index: number): Promise<number> {
    const address = this.wallet.deriveAddress(index);
    const publicClient = this.chainClient.getPublicClient();
    const nonce = await this.chainClient.rpcLimiter.run(() =>
      publicClient.getTransactionCount({ address }),
    );
    this.nonces.set(index, nonce);
    return nonce;
  }
}
