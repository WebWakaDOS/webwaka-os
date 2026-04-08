/**
 * Agent wallet management.
 * (Platform Invariant P9 + T4 — all monetary values are integer kobo)
 * T3 — tenant_id on all queries.
 */

import { getLedgerHistory, type LedgerRow } from './float-ledger.js';

interface D1BoundStmt {
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): D1BoundStmt };
  batch(statements: D1BoundStmt[]): Promise<{ success: boolean }[]>;
}

export interface WalletBalance {
  walletId: string;
  agentId: string;
  balanceKobo: number;
  creditLimitKobo: number;
}

/**
 * Create an agent wallet (idempotent — UNIQUE on agent_id in DB).
 * Returns the wallet id.
 */
export async function createAgentWallet(
  db: D1Like,
  agentId: string,
  tenantId: string,
): Promise<{ walletId: string }> {
  // Check if already exists (UNIQUE constraint on agent_id)
  const existing = await db.prepare(
    'SELECT id FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1',
  ).bind(agentId, tenantId).first<{ id: string }>();

  if (existing) return { walletId: existing.id };

  const walletId = `wlt_${crypto.randomUUID()}`;
  await db.prepare(
    'INSERT INTO agent_wallets (id, agent_id, tenant_id, balance_kobo, credit_limit_kobo) VALUES (?, ?, ?, 0, 0)',
  ).bind(walletId, agentId, tenantId).run();
  return { walletId };
}

/**
 * Get current wallet balance for an agent.
 */
export async function getWalletBalance(
  db: D1Like,
  agentId: string,
  tenantId: string,
): Promise<WalletBalance | null> {
  const row = await db.prepare(
    'SELECT id, agent_id, balance_kobo, credit_limit_kobo FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1',
  ).bind(agentId, tenantId).first<{
    id: string;
    agent_id: string;
    balance_kobo: number;
    credit_limit_kobo: number;
  }>();

  if (!row) return null;

  return {
    walletId: row.id,
    agentId: row.agent_id,
    balanceKobo: row.balance_kobo,
    creditLimitKobo: row.credit_limit_kobo,
  };
}

/**
 * Get paginated float ledger history for an agent's wallet.
 */
export async function getFloatHistory(
  db: D1Like,
  walletId: string,
  limit = 20,
): Promise<LedgerRow[]> {
  return getLedgerHistory(db, walletId, limit);
}
