import { describe, it, expect } from 'vitest';
import { AgentWallet } from '../src/wallet.js';

const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;

describe('AgentWallet', () => {
  it('should derive deterministic addresses', () => {
    const wallet1 = new AgentWallet(TEST_KEY, 'test-agent');
    const wallet2 = new AgentWallet(TEST_KEY, 'test-agent');

    expect(wallet1.deriveAddress(0)).toBe(wallet2.deriveAddress(0));
    expect(wallet1.deriveAddress(1)).toBe(wallet2.deriveAddress(1));
  });

  it('should derive different addresses for different indices', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    const addr0 = wallet.deriveAddress(0);
    const addr1 = wallet.deriveAddress(1);
    expect(addr0).not.toBe(addr1);
  });

  it('should derive different addresses for different agent IDs', () => {
    const wallet1 = new AgentWallet(TEST_KEY, 'agent-A');
    const wallet2 = new AgentWallet(TEST_KEY, 'agent-B');
    expect(wallet1.deriveAddress(0)).not.toBe(wallet2.deriveAddress(0));
  });

  it('should return valid Ethereum addresses', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    const addr = wallet.deriveAddress(0);
    expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('should generate multiple addresses', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    const addresses = wallet.generateAddresses(5);
    expect(addresses).toHaveLength(5);
    expect(addresses[0].index).toBe(0);
    expect(addresses[4].index).toBe(4);

    // All unique
    const unique = new Set(addresses.map((a) => a.address));
    expect(unique.size).toBe(5);
  });

  it('should generate addresses with custom start index', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    const addresses = wallet.generateAddresses(3, 10);
    expect(addresses[0].index).toBe(10);
    expect(addresses[2].index).toBe(12);
  });

  it('should derive private keys as 0x-prefixed hex', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    const key = wallet.derivePrivateKey(0);
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should reject negative index', () => {
    const wallet = new AgentWallet(TEST_KEY, 'test-agent');
    expect(() => wallet.deriveAddress(-1)).toThrow('Invalid wallet index');
  });

  it('should store agentId', () => {
    const wallet = new AgentWallet(TEST_KEY, 'my-agent');
    expect(wallet.agentId).toBe('my-agent');
  });
});
