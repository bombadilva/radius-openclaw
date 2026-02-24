import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { encrypt, decrypt } from './encryption.js';

// ── Types ───────────────────────────────────────────────────────────

export interface WalletRow {
  agent_id: string;
  wallet_index: number;
  address: string;
  label: string | null;
  created_at: string;
}

export interface TransactionRow {
  tx_hash: string;
  agent_id: string;
  wallet_index: number;
  direction: 'sent' | 'received';
  counterparty: string;
  amount: string;
  asset: string;
  block_number: number;
  refunded: number;
  refund_hash: string | null;
  created_at: string;
}

export interface CounterpartyRow {
  address: string;
  agent_id: string;
  label: string | null;
  total_sent: string;
  total_received: string;
  tx_count: number;
  first_seen: string;
  last_seen: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

// ── Configuration ───────────────────────────────────────────────────

export interface DbConfig {
  dataDir: string;
  dbName?: string;
  encryptionSeed?: `0x${string}`;
}

// ── Database ────────────────────────────────────────────────────────

export class AgentDb {
  private readonly db: Database.Database;
  private readonly encryptionSeed?: `0x${string}`;

  constructor(config: DbConfig) {
    this.encryptionSeed = config.encryptionSeed;

    fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    const dbPath = path.join(config.dataDir, config.dbName ?? 'agent-wallet.db');
    this.db = new Database(dbPath);

    // Set file permissions
    fs.chmodSync(dbPath, 0o600);

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_wallets (
        agent_id      TEXT NOT NULL,
        wallet_index  INTEGER NOT NULL,
        address       TEXT NOT NULL,
        label         TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (agent_id, wallet_index)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        tx_hash       TEXT PRIMARY KEY,
        agent_id      TEXT NOT NULL,
        wallet_index  INTEGER NOT NULL,
        direction     TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
        counterparty  TEXT NOT NULL,
        amount        TEXT NOT NULL,
        asset         TEXT NOT NULL DEFAULT 'USD',
        block_number  INTEGER NOT NULL,
        refunded      INTEGER DEFAULT 0,
        refund_hash   TEXT,
        created_at    TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS counterparties (
        address       TEXT NOT NULL,
        agent_id      TEXT NOT NULL,
        label         TEXT,
        total_sent    TEXT DEFAULT '0',
        total_received TEXT DEFAULT '0',
        tx_count      INTEGER DEFAULT 0,
        first_seen    TEXT DEFAULT (datetime('now')),
        last_seen     TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (address, agent_id)
      );

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_agent
        ON transactions(agent_id, wallet_index);
      CREATE INDEX IF NOT EXISTS idx_transactions_counterparty
        ON transactions(counterparty);
      CREATE INDEX IF NOT EXISTS idx_wallets_address
        ON agent_wallets(address);
    `);
  }

  // ── Wallet queries ──────────────────────────────────────────────

  upsertWallet(agentId: string, walletIndex: number, address: string, label?: string): void {
    this.db.prepare(`
      INSERT INTO agent_wallets (agent_id, wallet_index, address, label)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, wallet_index) DO UPDATE SET address = excluded.address
    `).run(agentId, walletIndex, address, label ?? null);
  }

  getWallet(agentId: string, walletIndex: number): WalletRow | undefined {
    return this.db.prepare(
      'SELECT * FROM agent_wallets WHERE agent_id = ? AND wallet_index = ?',
    ).get(agentId, walletIndex) as WalletRow | undefined;
  }

  getWalletByAddress(address: string): WalletRow | undefined {
    return this.db.prepare(
      'SELECT * FROM agent_wallets WHERE LOWER(address) = LOWER(?)',
    ).get(address) as WalletRow | undefined;
  }

  getWallets(agentId: string): WalletRow[] {
    return this.db.prepare(
      'SELECT * FROM agent_wallets WHERE agent_id = ? ORDER BY wallet_index',
    ).all(agentId) as WalletRow[];
  }

  // ── Transaction queries ─────────────────────────────────────────

  insertTransaction(tx: Omit<TransactionRow, 'created_at' | 'refunded' | 'refund_hash'>): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO transactions
        (tx_hash, agent_id, wallet_index, direction, counterparty, amount, asset, block_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tx.tx_hash, tx.agent_id, tx.wallet_index, tx.direction,
      tx.counterparty, tx.amount, tx.asset, tx.block_number,
    );
  }

  getTransaction(txHash: string): TransactionRow | undefined {
    return this.db.prepare(
      'SELECT * FROM transactions WHERE tx_hash = ?',
    ).get(txHash) as TransactionRow | undefined;
  }

  getTransactions(agentId: string, limit = 50): TransactionRow[] {
    return this.db.prepare(
      'SELECT * FROM transactions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    ).all(agentId, limit) as TransactionRow[];
  }

  getReceivedTransactions(agentId: string, limit = 50): TransactionRow[] {
    return this.db.prepare(
      `SELECT * FROM transactions WHERE agent_id = ? AND direction = 'received'
       ORDER BY created_at DESC LIMIT ?`,
    ).all(agentId, limit) as TransactionRow[];
  }

  markRefunded(txHash: string, refundHash: string): void {
    this.db.prepare(
      'UPDATE transactions SET refunded = 1, refund_hash = ? WHERE tx_hash = ?',
    ).run(refundHash, txHash);
  }

  // ── Counterparty queries ────────────────────────────────────────

  upsertCounterparty(
    address: string,
    agentId: string,
    direction: 'sent' | 'received',
    amount: string,
  ): void {
    const existing = this.db.prepare(
      'SELECT * FROM counterparties WHERE LOWER(address) = LOWER(?) AND agent_id = ?',
    ).get(address, agentId) as CounterpartyRow | undefined;

    if (!existing) {
      this.db.prepare(`
        INSERT INTO counterparties (address, agent_id, total_sent, total_received, tx_count)
        VALUES (?, ?, ?, ?, 1)
      `).run(
        address, agentId,
        direction === 'sent' ? amount : '0',
        direction === 'received' ? amount : '0',
      );
    } else {
      const totalSent = direction === 'sent'
        ? (BigInt(existing.total_sent) + BigInt(amount)).toString()
        : existing.total_sent;
      const totalReceived = direction === 'received'
        ? (BigInt(existing.total_received) + BigInt(amount)).toString()
        : existing.total_received;

      this.db.prepare(`
        UPDATE counterparties
        SET total_sent = ?, total_received = ?, tx_count = tx_count + 1, last_seen = datetime('now')
        WHERE LOWER(address) = LOWER(?) AND agent_id = ?
      `).run(totalSent, totalReceived, address, agentId);
    }
  }

  getCounterparties(agentId: string): CounterpartyRow[] {
    return this.db.prepare(
      'SELECT * FROM counterparties WHERE agent_id = ? ORDER BY last_seen DESC',
    ).all(agentId) as CounterpartyRow[];
  }

  // ── Meta queries ────────────────────────────────────────────────

  getMeta(key: string): string | undefined {
    const row = this.db.prepare(
      'SELECT value FROM meta WHERE key = ?',
    ).get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    ).run(key, value);
  }

  // ── Atomic encrypted export/import ──────────────────────────────

  exportEncrypted(filePath: string): void {
    if (!this.encryptionSeed) {
      throw new Error('Encryption seed not configured');
    }

    const data = {
      wallets: this.db.prepare('SELECT * FROM agent_wallets').all(),
      transactions: this.db.prepare('SELECT * FROM transactions').all(),
      counterparties: this.db.prepare('SELECT * FROM counterparties').all(),
      meta: this.db.prepare('SELECT * FROM meta').all(),
    };

    const json = JSON.stringify(data);
    const encrypted = encrypt(json, this.encryptionSeed);

    // Atomic write: temp file → rename
    const tmpPath = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, encrypted, { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  }

  importEncrypted(filePath: string): void {
    if (!this.encryptionSeed) {
      throw new Error('Encryption seed not configured');
    }

    const encrypted = fs.readFileSync(filePath, 'utf8');
    const json = decrypt(encrypted, this.encryptionSeed);
    const data = JSON.parse(json);

    const importTx = this.db.transaction(() => {
      for (const w of data.wallets) {
        this.upsertWallet(w.agent_id, w.wallet_index, w.address, w.label);
      }
      for (const t of data.transactions) {
        this.insertTransaction(t);
      }
      for (const m of data.meta) {
        this.setMeta(m.key, m.value);
      }
    });
    importTx();
  }

  // ── Stats ─────────────────────────────────────────────────────

  getStats(agentId: string) {
    const totalSent = (this.db.prepare(
      "SELECT COUNT(*) as c FROM transactions WHERE agent_id = ? AND direction = 'sent'",
    ).get(agentId) as { c: number }).c;

    const totalReceived = (this.db.prepare(
      "SELECT COUNT(*) as c FROM transactions WHERE agent_id = ? AND direction = 'received'",
    ).get(agentId) as { c: number }).c;

    const uniqueCounterparties = (this.db.prepare(
      'SELECT COUNT(*) as c FROM counterparties WHERE agent_id = ?',
    ).get(agentId) as { c: number }).c;

    return { totalSent, totalReceived, uniqueCounterparties };
  }

  close(): void {
    this.db.close();
  }
}
