import { encodeFunctionData, parseAbi, formatEther } from 'viem';
import type { ChainClient } from './chain.js';
import type { Signer } from './signer.js';
import type { AgentWallet } from './wallet.js';
import {
  SBC_ADDRESS,
  SBC_DECIMALS,
  NATIVE_USD_DECIMALS,
  type Asset,
  parseAmount,
  formatAmount,
  getSbcContract,
} from './token.js';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

export interface SendResult {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  asset: Asset;
}

export interface Balance {
  usd: string;
  usdRaw: bigint;
  sbc: string;
  sbcRaw: bigint;
}

export interface RefundResult {
  refundHash: `0x${string}`;
  originalFrom: `0x${string}`;
  amount: string;
  asset: Asset;
}

/**
 * High-level payment operations for Radius.
 */
export class Operations {
  private readonly chainClient: ChainClient;
  private readonly signer: Signer;
  private readonly wallet: AgentWallet;

  constructor(chainClient: ChainClient, signer: Signer, wallet: AgentWallet) {
    this.chainClient = chainClient;
    this.signer = signer;
    this.wallet = wallet;
  }

  /**
   * Send native USD or SBC to an address.
   */
  async send(
    walletIndex: number,
    to: `0x${string}`,
    amount: string,
    asset: Asset = 'USD',
  ): Promise<SendResult> {
    const from = this.wallet.deriveAddress(walletIndex);
    const rawAmount = parseAmount(amount, asset);

    let hash: `0x${string}`;

    if (asset === 'USD') {
      hash = await this.signer.sendTransaction(walletIndex, {
        to,
        value: rawAmount,
      });
    } else {
      // SBC ERC-20 transfer
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to, rawAmount],
      });
      hash = await this.signer.sendTransaction(walletIndex, {
        to: SBC_ADDRESS,
        value: 0n,
        data,
      });
    }

    return { hash, from, to, amount, asset };
  }

  /**
   * Check balance of an address for both assets.
   */
  async getBalance(address: `0x${string}`): Promise<Balance> {
    const publicClient = this.chainClient.getPublicClient();

    const [usdRaw, sbcRaw] = await Promise.all([
      this.chainClient.rpcLimiter.run(() =>
        publicClient.getBalance({ address }),
      ),
      this.chainClient.rpcLimiter.run(async () => {
        const contract = getSbcContract(this.chainClient);
        return contract.read.balanceOf([address]) as Promise<bigint>;
      }),
    ]);

    return {
      usd: formatAmount(usdRaw, 'USD'),
      usdRaw,
      sbc: formatAmount(sbcRaw, 'SBC'),
      sbcRaw,
    };
  }

  /**
   * Refund a received payment: look up tx.from, send back the same amount.
   */
  async refund(
    walletIndex: number,
    txHash: `0x${string}`,
  ): Promise<RefundResult> {
    const publicClient = this.chainClient.getPublicClient();

    const tx = await this.chainClient.rpcLimiter.run(() =>
      publicClient.getTransaction({ hash: txHash }),
    );

    const originalFrom = tx.from;

    // Determine if this was a native USD transfer or SBC transfer
    let amount: string;
    let asset: Asset;

    if (tx.to?.toLowerCase() === SBC_ADDRESS.toLowerCase()) {
      // SBC ERC-20 transfer — parse the transfer amount from input data
      // transfer(address,uint256) — amount is the last 32 bytes
      const amountHex = ('0x' + tx.input.slice(-64)) as `0x${string}`;
      const rawAmount = BigInt(amountHex);
      amount = formatAmount(rawAmount, 'SBC');
      asset = 'SBC';
    } else {
      // Native USD transfer
      amount = formatAmount(tx.value, 'USD');
      asset = 'USD';
    }

    const result = await this.send(walletIndex, originalFrom, amount, asset);

    return {
      refundHash: result.hash,
      originalFrom,
      amount,
      asset,
    };
  }

  /**
   * Approve SBC spending for a spender address.
   */
  async approveSbc(
    walletIndex: number,
    spender: `0x${string}`,
    amount: string,
  ): Promise<`0x${string}`> {
    const rawAmount = parseAmount(amount, 'SBC');
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, rawAmount],
    });

    return this.signer.sendTransaction(walletIndex, {
      to: SBC_ADDRESS,
      value: 0n,
      data,
    });
  }
}
