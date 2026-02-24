import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentDb } from '../src/db.js';

let db: AgentDb;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radius-test-'));
  db = new AgentDb({ dataDir: tmpDir });
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('AgentDb', () => {
  describe('wallets', () => {
    it('should upsert and retrieve a wallet', () => {
      db.upsertWallet('agent-1', 0, '0xabc123');
      const wallet = db.getWallet('agent-1', 0);
      expect(wallet).toBeDefined();
      expect(wallet!.address).toBe('0xabc123');
      expect(wallet!.agent_id).toBe('agent-1');
    });

    it('should find wallet by address (case-insensitive)', () => {
      db.upsertWallet('agent-1', 0, '0xAbC123');
      const wallet = db.getWalletByAddress('0xabc123');
      expect(wallet).toBeDefined();
      expect(wallet!.agent_id).toBe('agent-1');
    });

    it('should list wallets for an agent', () => {
      db.upsertWallet('agent-1', 0, '0xaaa');
      db.upsertWallet('agent-1', 1, '0xbbb');
      db.upsertWallet('agent-2', 0, '0xccc');

      const wallets = db.getWallets('agent-1');
      expect(wallets).toHaveLength(2);
    });
  });

  describe('transactions', () => {
    it('should insert and retrieve a transaction', () => {
      db.insertTransaction({
        tx_hash: '0xhash1',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'received',
        counterparty: '0xsender',
        amount: '1000000000000000000',
        asset: 'USD',
        block_number: 100,
      });

      const tx = db.getTransaction('0xhash1');
      expect(tx).toBeDefined();
      expect(tx!.direction).toBe('received');
      expect(tx!.amount).toBe('1000000000000000000');
    });

    it('should ignore duplicate transactions', () => {
      const tx = {
        tx_hash: '0xhash1',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'received' as const,
        counterparty: '0xsender',
        amount: '1000',
        asset: 'USD',
        block_number: 100,
      };

      db.insertTransaction(tx);
      db.insertTransaction(tx); // Should not throw

      const txns = db.getTransactions('agent-1');
      expect(txns).toHaveLength(1);
    });

    it('should get received transactions', () => {
      db.insertTransaction({
        tx_hash: '0xhash1',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'received',
        counterparty: '0xsender',
        amount: '1000',
        asset: 'USD',
        block_number: 100,
      });
      db.insertTransaction({
        tx_hash: '0xhash2',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'sent',
        counterparty: '0xrecipient',
        amount: '500',
        asset: 'USD',
        block_number: 101,
      });

      const received = db.getReceivedTransactions('agent-1');
      expect(received).toHaveLength(1);
      expect(received[0].direction).toBe('received');
    });

    it('should mark transaction as refunded', () => {
      db.insertTransaction({
        tx_hash: '0xhash1',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'received',
        counterparty: '0xsender',
        amount: '1000',
        asset: 'USD',
        block_number: 100,
      });

      db.markRefunded('0xhash1', '0xrefund-hash');
      const tx = db.getTransaction('0xhash1');
      expect(tx!.refunded).toBe(1);
      expect(tx!.refund_hash).toBe('0xrefund-hash');
    });
  });

  describe('counterparties', () => {
    it('should track counterparty stats', () => {
      db.upsertCounterparty('0xsender', 'agent-1', 'received', '1000');
      db.upsertCounterparty('0xsender', 'agent-1', 'received', '2000');

      const parties = db.getCounterparties('agent-1');
      expect(parties).toHaveLength(1);
      expect(parties[0].total_received).toBe('3000');
      expect(parties[0].tx_count).toBe(2);
    });
  });

  describe('meta', () => {
    it('should set and get meta values', () => {
      db.setMeta('last_block', '12345');
      expect(db.getMeta('last_block')).toBe('12345');
    });

    it('should return undefined for missing meta', () => {
      expect(db.getMeta('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing meta', () => {
      db.setMeta('key', 'value1');
      db.setMeta('key', 'value2');
      expect(db.getMeta('key')).toBe('value2');
    });
  });

  describe('stats', () => {
    it('should report correct stats', () => {
      db.insertTransaction({
        tx_hash: '0xhash1',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'sent',
        counterparty: '0xrecipient',
        amount: '1000',
        asset: 'USD',
        block_number: 100,
      });
      db.insertTransaction({
        tx_hash: '0xhash2',
        agent_id: 'agent-1',
        wallet_index: 0,
        direction: 'received',
        counterparty: '0xsender',
        amount: '2000',
        asset: 'USD',
        block_number: 101,
      });
      db.upsertCounterparty('0xrecipient', 'agent-1', 'sent', '1000');
      db.upsertCounterparty('0xsender', 'agent-1', 'received', '2000');

      const stats = db.getStats('agent-1');
      expect(stats.totalSent).toBe(1);
      expect(stats.totalReceived).toBe(1);
      expect(stats.uniqueCounterparties).toBe(2);
    });
  });
});
