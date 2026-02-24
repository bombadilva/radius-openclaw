import { describe, it, expect } from 'vitest';
import { deriveSeed } from '../src/seed.js';

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;

describe('deriveSeed', () => {
  it('should produce a deterministic seed', () => {
    const seed1 = deriveSeed(TEST_KEY, 'agent-001');
    const seed2 = deriveSeed(TEST_KEY, 'agent-001');
    expect(seed1).toBe(seed2);
  });

  it('should produce different seeds for different agent IDs', () => {
    const seed1 = deriveSeed(TEST_KEY, 'agent-001');
    const seed2 = deriveSeed(TEST_KEY, 'agent-002');
    expect(seed1).not.toBe(seed2);
  });

  it('should produce different seeds for different master keys', () => {
    const key2 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as `0x${string}`;
    const seed1 = deriveSeed(TEST_KEY, 'agent-001');
    const seed2 = deriveSeed(key2, 'agent-001');
    expect(seed1).not.toBe(seed2);
  });

  it('should return a 0x-prefixed 32-byte hex string', () => {
    const seed = deriveSeed(TEST_KEY, 'test');
    expect(seed).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should reject invalid master key', () => {
    expect(() => deriveSeed('0xshort' as `0x${string}`, 'test')).toThrow('masterKey');
  });

  it('should reject empty agent ID', () => {
    expect(() => deriveSeed(TEST_KEY, '')).toThrow('agentId');
  });
});
