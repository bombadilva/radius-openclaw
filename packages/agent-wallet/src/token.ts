import { type Address, getContract, parseAbi } from 'viem';
import type { ChainClient } from './chain.js';

// SBC ERC-20 contract address on Radius
export const SBC_ADDRESS: Address = '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb';
export const SBC_DECIMALS = 6;
export const NATIVE_USD_DECIMALS = 18;

export type Asset = 'USD' | 'SBC';

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

/**
 * Get the SBC ERC-20 contract instance for read operations.
 */
export function getSbcContract(chainClient: ChainClient) {
  return getContract({
    address: SBC_ADDRESS,
    abi: ERC20_ABI,
    client: chainClient.getPublicClient(),
  });
}

/**
 * Parse a human-readable amount string to the correct unit for the asset.
 * Native USD: 18 decimals. SBC: 6 decimals.
 */
export function parseAmount(amount: string, asset: Asset): bigint {
  const decimals = asset === 'SBC' ? SBC_DECIMALS : NATIVE_USD_DECIMALS;
  const parts = amount.split('.');
  const whole = BigInt(parts[0] || '0');
  let frac = parts[1] || '';

  if (frac.length > decimals) {
    frac = frac.slice(0, decimals);
  }
  frac = frac.padEnd(decimals, '0');

  return whole * 10n ** BigInt(decimals) + BigInt(frac);
}

/**
 * Format a raw amount to a human-readable string for the asset.
 */
export function formatAmount(raw: bigint, asset: Asset): string {
  const decimals = asset === 'SBC' ? SBC_DECIMALS : NATIVE_USD_DECIMALS;
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
