import { HDKey } from '@scure/bip32';
import { privateKeyToAccount } from 'viem/accounts';
import { deriveSeed } from './seed.js';

// BIP-44 path: m/44'/60'/0'/0/{index}
const DERIVATION_PATH = "m/44'/60'/0'/0";

/**
 * HD Wallet manager for agent wallets.
 * Keys are derived on-demand and never stored.
 */
export class AgentWallet {
  private readonly parentKey: HDKey;
  readonly agentId: string;

  constructor(masterKey: `0x${string}`, agentId: string) {
    this.agentId = agentId;
    const seed = deriveSeed(masterKey, agentId);
    const master = HDKey.fromMasterSeed(Buffer.from(seed.slice(2), 'hex'));
    this.parentKey = master.derive(DERIVATION_PATH);
  }

  /**
   * Derive private key at index. Key is returned for immediate use
   * and should fall out of scope after signing.
   */
  derivePrivateKey(index: number): `0x${string}` {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid wallet index: ${index}`);
    }
    const child = this.parentKey.deriveChild(index);
    if (!child.privateKey) {
      throw new Error(`HD derivation failed at index ${index}`);
    }
    return `0x${Buffer.from(child.privateKey).toString('hex')}` as `0x${string}`;
  }

  /**
   * Derive the address at index without exposing the private key
   * beyond this call's scope.
   */
  deriveAddress(index: number): `0x${string}` {
    const key = this.derivePrivateKey(index);
    return privateKeyToAccount(key).address;
  }

  /**
   * Generate addresses for a range of indices.
   */
  generateAddresses(count: number, startIndex = 0): Array<{ index: number; address: `0x${string}` }> {
    const addresses: Array<{ index: number; address: `0x${string}` }> = [];
    for (let i = startIndex; i < startIndex + count; i++) {
      addresses.push({ index: i, address: this.deriveAddress(i) });
    }
    return addresses;
  }
}
