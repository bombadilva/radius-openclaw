import { describe, it, expect } from 'vitest';
import {
  isValidAddress,
  isValidPrivateKey,
  isValidAmount,
  isValidAsset,
  isValidNetwork,
  assertValidAddress,
  assertValidAmount,
  assertValidAsset,
  assertWithinLimits,
} from '../src/validation.js';

describe('isValidAddress', () => {
  it('accepts valid addresses', () => {
    expect(isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidAddress('0x123')).toBe(false);
    expect(isValidAddress('not-an-address')).toBe(false);
    expect(isValidAddress('')).toBe(false);
    expect(isValidAddress(null)).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
    expect(isValidAddress(123)).toBe(false);
  });
});

describe('isValidPrivateKey', () => {
  it('accepts valid 32-byte hex keys', () => {
    expect(isValidPrivateKey('0x' + 'ab'.repeat(32))).toBe(true);
  });

  it('rejects invalid keys', () => {
    expect(isValidPrivateKey('0x123')).toBe(false);
    expect(isValidPrivateKey('not-a-key')).toBe(false);
  });
});

describe('isValidAmount', () => {
  it('accepts valid amounts', () => {
    expect(isValidAmount('0')).toBe(true);
    expect(isValidAmount('1.5')).toBe(true);
    expect(isValidAmount('100')).toBe(true);
    expect(isValidAmount('0.001')).toBe(true);
  });

  it('rejects invalid amounts', () => {
    expect(isValidAmount('')).toBe(false);
    expect(isValidAmount('.')).toBe(false);
    expect(isValidAmount('abc')).toBe(false);
    expect(isValidAmount('-1')).toBe(false);
    expect(isValidAmount(null)).toBe(false);
  });
});

describe('isValidAsset', () => {
  it('accepts USD and SBC', () => {
    expect(isValidAsset('USD')).toBe(true);
    expect(isValidAsset('SBC')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isValidAsset('ETH')).toBe(false);
    expect(isValidAsset('usd')).toBe(false);
  });
});

describe('isValidNetwork', () => {
  it('accepts testnet and mainnet', () => {
    expect(isValidNetwork('testnet')).toBe(true);
    expect(isValidNetwork('mainnet')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isValidNetwork('devnet')).toBe(false);
  });
});

describe('assertValidAddress', () => {
  it('throws on invalid address', () => {
    expect(() => assertValidAddress('bad')).toThrow('Invalid address');
  });

  it('does not throw on valid address', () => {
    expect(() => assertValidAddress('0x1234567890abcdef1234567890abcdef12345678')).not.toThrow();
  });
});

describe('assertWithinLimits', () => {
  it('allows amounts within limits', () => {
    expect(() => assertWithinLimits('100', 'USD')).not.toThrow();
    expect(() => assertWithinLimits('10000', 'USD')).not.toThrow();
  });

  it('rejects amounts exceeding limits', () => {
    expect(() => assertWithinLimits('10001', 'USD')).toThrow('exceeds per-transaction limit');
    expect(() => assertWithinLimits('1000001', 'SBC')).toThrow('exceeds per-transaction limit');
  });
});
