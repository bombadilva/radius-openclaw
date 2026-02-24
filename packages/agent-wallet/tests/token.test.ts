import { describe, it, expect } from 'vitest';
import { parseAmount, formatAmount } from '../src/token.js';

describe('parseAmount', () => {
  it('should parse USD amounts with 18 decimals', () => {
    expect(parseAmount('1', 'USD')).toBe(10n ** 18n);
    expect(parseAmount('0.5', 'USD')).toBe(5n * 10n ** 17n);
    expect(parseAmount('0.001', 'USD')).toBe(10n ** 15n);
  });

  it('should parse SBC amounts with 6 decimals', () => {
    expect(parseAmount('1', 'SBC')).toBe(1_000_000n);
    expect(parseAmount('0.5', 'SBC')).toBe(500_000n);
    expect(parseAmount('0.000001', 'SBC')).toBe(1n);
  });

  it('should truncate excess decimals', () => {
    expect(parseAmount('1.1234567', 'SBC')).toBe(1_123_456n);
  });

  it('should handle whole numbers', () => {
    expect(parseAmount('100', 'USD')).toBe(100n * 10n ** 18n);
    expect(parseAmount('100', 'SBC')).toBe(100_000_000n);
  });
});

describe('formatAmount', () => {
  it('should format USD amounts', () => {
    expect(formatAmount(10n ** 18n, 'USD')).toBe('1');
    expect(formatAmount(5n * 10n ** 17n, 'USD')).toBe('0.5');
    expect(formatAmount(10n ** 15n, 'USD')).toBe('0.001');
  });

  it('should format SBC amounts', () => {
    expect(formatAmount(1_000_000n, 'SBC')).toBe('1');
    expect(formatAmount(500_000n, 'SBC')).toBe('0.5');
    expect(formatAmount(1n, 'SBC')).toBe('0.000001');
  });

  it('should strip trailing zeros', () => {
    expect(formatAmount(10n ** 18n, 'USD')).toBe('1');
    expect(formatAmount(1_000_000n, 'SBC')).toBe('1');
  });

  it('should handle zero', () => {
    expect(formatAmount(0n, 'USD')).toBe('0');
    expect(formatAmount(0n, 'SBC')).toBe('0');
  });
});
