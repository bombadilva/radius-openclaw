export interface PaymentRequirement {
  scheme: 'radius';
  network: 'testnet' | 'mainnet';
  payTo: `0x${string}`;
  maxAmountRequired: string;
  asset: 'USD' | 'SBC';
  resource: string;
  description?: string;
  mimeType?: string;
}

export interface PaymentPayload {
  txHash: `0x${string}`;
  chainId: number;
  payer: `0x${string}`;
}

export interface VerificationResult {
  valid: boolean;
  txHash?: `0x${string}`;
  amount?: string;
  error?: string;
}
