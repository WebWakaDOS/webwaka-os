/**
 * POS terminal + float ledger routes (M7b)
 *
 *   POST /pos/terminals          — register POS terminal
 *   POST /pos/float/credit       — top up agent float
 *   POST /pos/float/debit        — deduct from float
 *   GET  /pos/float/balance      — current balance
 *   GET  /pos/float/history      — paginated ledger
 *   POST /pos/float/reverse      — reverse a ledger entry
 *
 * All routes require auth + minimum 'agent' role.
 * All monetary amounts validated as integers (T4/P9).
 * T3 — tenant_id on all DB queries.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import {
  postLedgerEntry,
  reverseLedgerEntry,
  InsufficientFloatError,
  registerTerminal,
  getWalletBalance,
  getFloatHistory,
} from '@webwaka/pos';

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

interface D1BoundStmt {
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): D1BoundStmt };
  batch(statements: D1BoundStmt[]): Promise<{ success: boolean }[]>;
}

// Zod schemas — z.number().int() enforces P9/T4 (no floats)
const CreditSchema = z.object({
  agentId:         z.string().min(1),
  amountKobo:      z.number().int().positive('amountKobo must be a positive integer'),
  reference:       z.string().min(1),
  description:     z.string().optional(),
});

const DebitSchema = z.object({
  agentId:         z.string().min(1),
  amountKobo:      z.number().int().positive('amountKobo must be a positive integer'),
  reference:       z.string().min(1),
  description:     z.string().optional(),
});

const ReverseSchema = z.object({
  originalReference: z.string().min(1),
  reversalReference: z.string().min(1),
  reason:            z.string().min(1),
});

const RegisterTerminalSchema = z.object({
  agentId:      z.string().min(1),
  workspaceId:  z.string().min(1),
  terminalRef:  z.string().min(1),
  model:        z.string().optional(),
});

export const posRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// POST /pos/terminals — register POS terminal
// ---------------------------------------------------------------------------

posRoutes.post('/terminals', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = RegisterTerminalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }
  const { agentId, workspaceId, terminalRef, model } = parsed.data;
  const db = c.env.DB as unknown as D1Like;

  try {
    const result = await registerTerminal(
      db,
      agentId,
      workspaceId,
      auth.tenantId,
      terminalRef,
      model,
    );
    return c.json({ terminalId: result.id, terminalRef }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('UNIQUE')) {
      return c.json({ error: 'Terminal reference already registered.' }, 409);
    }
    return c.json({ error: msg }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /pos/float/balance — current float balance
// ---------------------------------------------------------------------------

posRoutes.get('/float/balance', async (c) => {
  const auth = c.get('auth');
  const agentId = c.req.query('agentId');
  if (!agentId) return c.json({ error: 'agentId query parameter is required.' }, 400);

  const db = c.env.DB as unknown as D1Like;
  const balance = await getWalletBalance(db, agentId, auth.tenantId);
  if (!balance) return c.json({ error: `No wallet found for agent: ${agentId}` }, 404);

  return c.json({
    walletId: balance.walletId,
    agentId: balance.agentId,
    balanceKobo: balance.balanceKobo,
    creditLimitKobo: balance.creditLimitKobo,
  });
});

// ---------------------------------------------------------------------------
// GET /pos/float/history — paginated ledger entries
// ---------------------------------------------------------------------------

posRoutes.get('/float/history', async (c) => {
  const auth = c.get('auth');
  const walletId = c.req.query('walletId');
  const limitStr = c.req.query('limit') ?? '20';
  const limit = Math.min(parseInt(limitStr, 10) || 20, 100);

  if (!walletId) return c.json({ error: 'walletId query parameter is required.' }, 400);

  const db = c.env.DB as unknown as D1Like;

  // T3: verify wallet belongs to this tenant before returning
  const wallet = await db.prepare(
    'SELECT id FROM agent_wallets WHERE id = ? AND tenant_id = ? LIMIT 1',
  ).bind(walletId, auth.tenantId).first<{ id: string }>();

  if (!wallet) return c.json({ error: 'Wallet not found.' }, 404);

  const entries = await getFloatHistory(db, walletId, limit);
  return c.json({ walletId, entries, count: entries.length });
});

// ---------------------------------------------------------------------------
// POST /pos/float/credit — top up agent float
// ---------------------------------------------------------------------------

posRoutes.post('/float/credit', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = CreditSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }
  const { agentId, amountKobo, reference, description } = parsed.data;
  const db = c.env.DB as unknown as D1Like;

  const wallet = await db.prepare(
    'SELECT id FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1',
  ).bind(agentId, auth.tenantId).first<{ id: string }>();

  if (!wallet) return c.json({ error: `No wallet found for agent: ${agentId}` }, 404);

  try {
    const result = await postLedgerEntry(db, {
      walletId: wallet.id,
      amountKobo,              // Positive — credit
      transactionType: 'top_up',
      reference,
      ...(description !== undefined ? { description } : {}),
    });
    return c.json({ ledgerId: result.id, runningBalanceKobo: result.runningBalanceKobo }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return c.json({ error: 'Reference already exists (idempotency).' }, 409);
    }
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /pos/float/debit — deduct from agent float
// ---------------------------------------------------------------------------

posRoutes.post('/float/debit', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = DebitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }
  const { agentId, amountKobo, reference, description } = parsed.data;
  const db = c.env.DB as unknown as D1Like;

  const wallet = await db.prepare(
    'SELECT id FROM agent_wallets WHERE agent_id = ? AND tenant_id = ? LIMIT 1',
  ).bind(agentId, auth.tenantId).first<{ id: string }>();

  if (!wallet) return c.json({ error: `No wallet found for agent: ${agentId}` }, 404);

  try {
    const result = await postLedgerEntry(db, {
      walletId: wallet.id,
      amountKobo: -amountKobo, // Negative — debit
      transactionType: 'cash_out',
      reference,
      ...(description !== undefined ? { description } : {}),
    });
    return c.json({ ledgerId: result.id, runningBalanceKobo: result.runningBalanceKobo }, 201);
  } catch (err) {
    if (err instanceof InsufficientFloatError) {
      return c.json({ error: err.message, code: 'INSUFFICIENT_FLOAT' }, 422);
    }
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return c.json({ error: 'Reference already exists (idempotency).' }, 409);
    }
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /pos/float/reverse — reverse a ledger entry
// ---------------------------------------------------------------------------

posRoutes.post('/float/reverse', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = ReverseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400);
  }
  const { originalReference, reversalReference, reason } = parsed.data;
  const db = c.env.DB as unknown as D1Like;

  // T3 guard — verify the original entry belongs to this tenant via wallet
  const original = await db.prepare(
    `SELECT fl.wallet_id
     FROM float_ledger fl
     JOIN agent_wallets aw ON aw.id = fl.wallet_id
     WHERE fl.reference = ? AND aw.tenant_id = ?
     LIMIT 1`,
  ).bind(originalReference, auth.tenantId).first<{ wallet_id: string }>();

  if (!original) {
    return c.json({ error: `Entry not found: ${originalReference}` }, 404);
  }

  try {
    const result = await reverseLedgerEntry(db, originalReference, reversalReference, reason);
    return c.json({ ledgerId: result.id, runningBalanceKobo: result.runningBalanceKobo }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
