import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ChainClient } from '@bombadilva/agent-wallet';
import { formatAmount } from '@bombadilva/agent-wallet';
import type { PaymentPayload, VerificationResult } from './types.js';

export interface VerifierOptions {
  chainClient: ChainClient;
  expectedPayTo?: `0x${string}`;
  expectedAsset?: 'USD' | 'SBC';
}

/**
 * Verify that a transaction exists on-chain and sent the correct amount
 * to the correct address.
 */
async function verifyPayment(
  chainClient: ChainClient,
  payload: PaymentPayload,
  expectedPayTo?: `0x${string}`,
): Promise<VerificationResult> {
  const client = chainClient.getPublicClient();

  const tx = await chainClient.rpcLimiter.run(() =>
    client.getTransaction({ hash: payload.txHash }),
  );

  if (!tx) {
    return { valid: false, error: 'Transaction not found on-chain' };
  }

  if (tx.chainId !== undefined && tx.chainId !== payload.chainId) {
    return { valid: false, error: 'Chain ID mismatch' };
  }

  if (expectedPayTo && tx.to?.toLowerCase() !== expectedPayTo.toLowerCase()) {
    return { valid: false, error: 'Payment sent to wrong address' };
  }

  const amount = formatAmount(tx.value, 'USD');

  return { valid: true, txHash: payload.txHash, amount };
}

/**
 * Create an Express router with a POST /verify endpoint for payment verification.
 */
export function createVerifierRouter(opts: VerifierOptions): Router {
  const router = Router();

  router.post('/verify', async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as PaymentPayload;

    if (!payload?.txHash || !payload?.chainId || !payload?.payer) {
      res.status(400).json({ valid: false, error: 'Missing txHash, chainId, or payer' });
      return;
    }

    try {
      const result = await verifyPayment(opts.chainClient, payload, opts.expectedPayTo);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : 'Verification failed';
      res.status(500).json({ valid: false, error: msg });
    }
  });

  return router;
}
