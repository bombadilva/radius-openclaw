import { keccak256, encodePacked } from 'viem';

const DOMAIN_SEPARATOR = keccak256(encodePacked(['string'], ['radius-agent-wallet']));

/**
 * Derive a deployment-scoped seed for HD wallet generation.
 *
 * seed = keccak256(masterKey || keccak256('radius-agent-wallet') || agentId)
 *
 * This ensures:
 * - Different master keys → different wallets
 * - Different agent IDs → different wallets
 * - Same inputs → deterministic output
 */
export function deriveSeed(
  masterKey: `0x${string}`,
  agentId: string,
): `0x${string}` {
  if (!masterKey || !masterKey.startsWith('0x') || masterKey.length < 66) {
    throw new Error('masterKey must be a 0x-prefixed 32-byte hex string');
  }
  if (!agentId || agentId.trim().length === 0) {
    throw new Error('agentId must be a non-empty string');
  }

  return keccak256(
    encodePacked(
      ['bytes32', 'bytes32', 'string'],
      [masterKey as `0x${string}`, DOMAIN_SEPARATOR, agentId],
    ),
  );
}
