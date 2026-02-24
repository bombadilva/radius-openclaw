import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import type { PaymentRequirement, PaymentPayload } from './types.js';

export interface X402ClientOptions {
  maxAmount?: string;
}

export interface X402Client {
  fetch(url: string, options?: RequestInit): Promise<globalThis.Response>;
}

/**
 * Client that automatically handles 402 responses by sending payment
 * and retrying the request with an X-PAYMENT header.
 */
export function x402Client(
  kit: AgentWalletKit,
  walletIndex: number,
  opts: X402ClientOptions = {},
): X402Client {
  const maxAmount = opts.maxAmount ?? '10';

  return {
    async fetch(url: string, options?: RequestInit): Promise<globalThis.Response> {
      const res = await globalThis.fetch(url, options);

      if (res.status !== 402) return res;

      const body = await res.json() as { requirement: PaymentRequirement };
      const req = body.requirement;

      if (!req?.payTo || !req?.maxAmountRequired || !req?.asset) {
        throw new Error('402 response missing valid payment requirement');
      }

      if (parseFloat(req.maxAmountRequired) > parseFloat(maxAmount)) {
        throw new Error(
          `Payment ${req.maxAmountRequired} ${req.asset} exceeds max ${maxAmount}`.slice(0, 100),
        );
      }

      const sendResult = await kit.operations.send(
        walletIndex,
        req.payTo,
        req.maxAmountRequired,
        req.asset,
      );

      const payload: PaymentPayload = {
        txHash: sendResult.hash,
        chainId: kit.chainClient.chain.id,
        payer: sendResult.from,
      };

      const retryHeaders = new Headers(options?.headers);
      retryHeaders.set('X-PAYMENT', JSON.stringify(payload));

      return globalThis.fetch(url, { ...options, headers: retryHeaders });
    },
  };
}
