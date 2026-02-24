import type { Request, Response, NextFunction } from 'express';
import type { PaymentRequirement, PaymentPayload, VerificationResult } from './types.js';

export interface X402MiddlewareOptions {
  payTo: `0x${string}`;
  amount: string;
  asset: 'USD' | 'SBC';
  network: 'testnet' | 'mainnet';
  description?: string;
  verifierUrl?: string;
}

declare global {
  namespace Express {
    interface Request {
      x402Payment?: PaymentPayload & { verified: VerificationResult };
    }
  }
}

async function verifyViaUrl(url: string, payload: PaymentPayload): Promise<VerificationResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<VerificationResult>;
}

function buildRequirement(opts: X402MiddlewareOptions, resource: string): PaymentRequirement {
  return {
    scheme: 'radius',
    network: opts.network,
    payTo: opts.payTo,
    maxAmountRequired: opts.amount,
    asset: opts.asset,
    resource,
    description: opts.description,
  };
}

/**
 * Express middleware that gates routes behind x402 payment.
 * Without a valid X-PAYMENT header, responds 402 with payment requirements.
 */
export function x402Middleware(opts: X402MiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers['x-payment'] as string | undefined;

    if (!header) {
      const requirement = buildRequirement(opts, req.originalUrl);
      res.status(402)
        .set('Accepts-Payment', JSON.stringify(requirement))
        .json({ status: 402, message: 'Payment Required', requirement });
      return;
    }

    let payload: PaymentPayload;
    try {
      payload = JSON.parse(header) as PaymentPayload;
    } catch {
      res.status(400).json({ error: 'Invalid X-PAYMENT header: malformed JSON' });
      return;
    }

    if (!payload.txHash || !payload.chainId || !payload.payer) {
      res.status(400).json({ error: 'X-PAYMENT missing required fields (txHash, chainId, payer)' });
      return;
    }

    try {
      let result: VerificationResult;
      if (opts.verifierUrl) {
        result = await verifyViaUrl(opts.verifierUrl, payload);
      } else {
        // Without a verifier URL, accept the payment optimistically
        result = { valid: true, txHash: payload.txHash };
      }

      if (!result.valid) {
        res.status(402).json({ error: (result.error ?? 'Payment verification failed').slice(0, 100) });
        return;
      }

      req.x402Payment = { ...payload, verified: result };
      next();
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : 'Verification error';
      res.status(500).json({ error: msg });
    }
  };
}
