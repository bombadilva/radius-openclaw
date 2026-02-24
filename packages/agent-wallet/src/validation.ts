/**
 * Input validation for addresses, amounts, and configuration.
 * All public-facing functions should validate through here.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function isValidAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && ADDRESS_RE.test(value);
}

export function isValidPrivateKey(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && HEX_KEY_RE.test(value);
}

export function isValidAmount(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value === '' || value === '.') return false;
  const num = Number(value);
  return !isNaN(num) && num >= 0 && isFinite(num);
}

export function isValidAsset(value: unknown): value is 'USD' | 'SBC' {
  return value === 'USD' || value === 'SBC';
}

export function isValidNetwork(value: unknown): value is 'testnet' | 'mainnet' {
  return value === 'testnet' || value === 'mainnet';
}

export function assertValidAddress(value: unknown, label = 'address'): asserts value is `0x${string}` {
  if (!isValidAddress(value)) {
    throw new Error(`Invalid ${label}: expected 0x-prefixed 40-hex-char address`);
  }
}

export function assertValidAmount(value: unknown, label = 'amount'): asserts value is string {
  if (!isValidAmount(value)) {
    throw new Error(`Invalid ${label}: expected non-negative numeric string`);
  }
}

export function assertValidAsset(value: unknown, label = 'asset'): asserts value is 'USD' | 'SBC' {
  if (!isValidAsset(value)) {
    throw new Error(`Invalid ${label}: expected 'USD' or 'SBC'`);
  }
}

/** Maximum safe send amount per transaction (mainnet guard). */
export const MAX_SEND_USD = '10000';
export const MAX_SEND_SBC = '1000000';

export function assertWithinLimits(amount: string, asset: 'USD' | 'SBC'): void {
  const limit = asset === 'USD' ? MAX_SEND_USD : MAX_SEND_SBC;
  if (Number(amount) > Number(limit)) {
    throw new Error(`Amount ${amount} ${asset} exceeds per-transaction limit of ${limit} ${asset}`);
  }
}
