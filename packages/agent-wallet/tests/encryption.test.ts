import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/encryption.js';

const TEST_SEED = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;

describe('encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'Hello, Radius!';
    const encrypted = encrypt(plaintext, TEST_SEED);
    const decrypted = decrypt(encrypted, TEST_SEED);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time (random salt)', () => {
    const plaintext = 'same data';
    const enc1 = encrypt(plaintext, TEST_SEED);
    const enc2 = encrypt(plaintext, TEST_SEED);
    expect(enc1).not.toBe(enc2);
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('', TEST_SEED);
    const decrypted = decrypt(encrypted, TEST_SEED);
    expect(decrypted).toBe('');
  });

  it('should handle JSON data', () => {
    const data = JSON.stringify({ wallets: [{ index: 0, address: '0x123' }] });
    const encrypted = encrypt(data, TEST_SEED);
    const decrypted = decrypt(encrypted, TEST_SEED);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
  });

  it('should fail with wrong seed', () => {
    const plaintext = 'secret';
    const encrypted = encrypt(plaintext, TEST_SEED);
    const wrongSeed = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as `0x${string}`;
    expect(() => decrypt(encrypted, wrongSeed)).toThrow();
  });

  it('should fail with corrupted ciphertext', () => {
    const encrypted = encrypt('test', TEST_SEED);
    const corrupted = encrypted.slice(0, -4) + 'xxxx';
    expect(() => decrypt(corrupted, TEST_SEED)).toThrow();
  });

  it('should use v1 format', () => {
    const encrypted = encrypt('test', TEST_SEED);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted.split(':').length).toBe(5);
  });
});
