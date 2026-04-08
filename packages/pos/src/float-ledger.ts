/**
 * POS float double-entry ledger.
 * (Platform Invariants P9 + T4 — all monetary values are integer kobo. NEVER floating point.)
 *
 * The float_ledger table is append-only.
 * No UPDATE or DELETE on ledger rows ever.
 * Reversals are new rows with negative amountKobo.
 */

interface D1BoundStmt {
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): D1BoundStmt };
  batch(statements: D1BoundStmt[]): Promise<{ success: boolean }[]>;
}

export interface LedgerEntry {
  walletId: string;
  amountKobo: number;       // Platform Invariant T4 — integer kobo only
  transactionType: 'top_up' | 'cash_in' | 'cash_out' | 'commission' | 'reversal' | 'fee';
  reference: string;
  description?: string;
}

export interface LedgerResult {
  id: string;
  runningBalanceKobo: number;
}

export interface LedgerRow {
  id: string;
  wallet_id: string;
  amount_kobo: number;
  running_balance_kobo: number;
  transaction_type: string;
  reference: string;
  description: string | null;
  created_at: number;
}

/**
 * Guard: amountKobo must be a non-zero integer. Never a float.
 */
function assertIntegerKobo(amount: number, label = 'amountKobo'): void {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`${label} must be an integer (kobo). Got: ${amount}`);
  }
  if (amount === 0) {
    throw new TypeError(`${label} must be non-zero.`);
  }
}

/**
 * Posts a double-entry ledger transaction.
 *
 * Platform Invariant P9: All amounts are integer kobo. Never floats.
 * Ledger is append-only — no UPDATE or DELETE on float_ledger rows.
 */
export async function postLedgerEntry(
  db: D1Like,
  entry: LedgerEntry,
): Promise<LedgerResult> {
  assertIntegerKobo(entry.amountKobo);

  const wallet = await db.prepare(
    'SELECT balance_kobo FROM agent_wallets WHERE id = ?',
  ).bind(entry.walletId).first<{ balance_kobo: number }>();

  if (!wallet) throw new Error(`Wallet not found: ${entry.walletId}`);

  const newBalance = wallet.balance_kobo + entry.amountKobo;

  if (newBalance < 0) {
    throw new InsufficientFloatError(
      `Insufficient float: balance=${wallet.balance_kobo} kobo, debit=${Math.abs(entry.amountKobo)} kobo`,
    );
  }

  const id = `flt_${crypto.randomUUID()}`;

  const stmt1 = db.prepare(
    'UPDATE agent_wallets SET balance_kobo = ?, updated_at = unixepoch() WHERE id = ?',
  ).bind(newBalance, entry.walletId);

  const stmt2 = db.prepare(
    'INSERT INTO float_ledger (id, wallet_id, amount_kobo, running_balance_kobo, transaction_type, reference, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    entry.walletId,
    entry.amountKobo,
    newBalance,
    entry.transactionType,
    entry.reference,
    entry.description ?? null,
  );

  await db.batch([stmt1, stmt2]);

  return { id, runningBalanceKobo: newBalance };
}

export class InsufficientFloatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFloatError';
  }
}

/**
 * Reverse a ledger entry. Posts an equal and opposite entry.
 * Ledger is append-only — no row deletion or mutation. (P9)
 */
export async function reverseLedgerEntry(
  db: D1Like,
  originalReference: string,
  reversalReference: string,
  reason: string,
): Promise<LedgerResult> {
  const original = await db.prepare(
    'SELECT wallet_id, amount_kobo FROM float_ledger WHERE reference = ?',
  ).bind(originalReference).first<{ wallet_id: string; amount_kobo: number }>();

  if (!original) throw new Error(`Original entry not found: ${originalReference}`);

  return postLedgerEntry(db, {
    walletId: original.wallet_id,
    amountKobo: -original.amount_kobo,  // Equal and opposite
    transactionType: 'reversal',
    reference: reversalReference,
    description: `Reversal of ${originalReference}: ${reason}`,
  });
}

/**
 * Get paginated ledger entries for a wallet.
 */
export async function getLedgerHistory(
  db: D1Like,
  walletId: string,
  limit = 20,
): Promise<LedgerRow[]> {
  const result = await db.prepare(
    'SELECT * FROM float_ledger WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?',
  ).bind(walletId, limit).all<LedgerRow>();
  return result.results;
}
