import { describe, it, expect } from 'vitest';
import { ChainClient, radiusTestnet, radiusMainnet } from '../src/chain.js';

describe('Chain definitions', () => {
  it('should define testnet with chain ID 72344', () => {
    expect(radiusTestnet.id).toBe(72344);
    expect(radiusTestnet.nativeCurrency.symbol).toBe('USD');
    expect(radiusTestnet.nativeCurrency.decimals).toBe(18);
  });

  it('should define mainnet with chain ID 723', () => {
    expect(radiusMainnet.id).toBe(723);
    expect(radiusMainnet.nativeCurrency.symbol).toBe('USD');
    expect(radiusMainnet.nativeCurrency.decimals).toBe(18);
  });
});

describe('ChainClient', () => {
  it('should create a testnet client', () => {
    const client = new ChainClient({ network: 'testnet' });
    expect(client.chain.id).toBe(72344);
  });

  it('should create a mainnet client', () => {
    const client = new ChainClient({ network: 'mainnet' });
    expect(client.chain.id).toBe(723);
  });

  it('should accept a custom RPC URL', () => {
    const client = new ChainClient({
      network: 'testnet',
      rpcUrl: 'https://custom-rpc.example.com',
    });
    expect(client.chain.id).toBe(72344);
  });

  it('should reject invalid RPC URL', () => {
    expect(() => new ChainClient({
      network: 'testnet',
      rpcUrl: 'not-a-url',
    })).toThrow('Invalid RPC URL');
  });

  it('should provide a public client', () => {
    const client = new ChainClient({ network: 'testnet' });
    const publicClient = client.getPublicClient();
    expect(publicClient).toBeDefined();
  });

  it('should provide a wallet client', () => {
    const client = new ChainClient({ network: 'testnet' });
    // Use a known test key (not a real one)
    const walletClient = client.getWalletClient(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    );
    expect(walletClient).toBeDefined();
  });
});
