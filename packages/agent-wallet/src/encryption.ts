import * as crypto from 'node:crypto';

const ENCRYPTION_INFO = 'radius-agent-wallet-encryption';

/**
 * Derive an AES-256 encryption key from a seed using HKDF.
 * Key is separate from wallet seed — different HKDF info string.
 */
function deriveKey(seed: `0x${string}`, salt: Buffer): Buffer {
  const ikm = Buffer.from(seed.slice(2), 'hex');
  return Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, ENCRYPTION_INFO, 32),
  );
}

/**
 * Encrypt data with AES-256-GCM.
 * Format: v1:{salt}:{iv}:{tag}:{ciphertext}
 */
export function encrypt(data: string, seed: `0x${string}`): string {
  const salt = crypto.randomBytes(32);
  const key = deriveKey(seed, salt);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return [
    'v1',
    salt.toString('hex'),
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt AES-256-GCM encrypted data.
 */
export function decrypt(encrypted: string, seed: `0x${string}`): string {
  const parts = encrypted.split(':');

  if (parts[0] !== 'v1' || parts.length !== 5) {
    throw new Error('Unsupported encryption format');
  }

  const [, saltHex, ivHex, tagHex, ciphertext] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = deriveKey(seed, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
