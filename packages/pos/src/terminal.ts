/**
 * POS terminal CRUD operations.
 * T3 — tenant_id on all queries.
 */

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ success: boolean }>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

export interface PosTerminal {
  id: string;
  terminal_ref: string;
  agent_id: string;
  workspace_id: string;
  tenant_id: string;
  status: 'active' | 'suspended' | 'decommissioned';
  model: string | null;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Register a new POS terminal for an agent.
 */
export async function registerTerminal(
  db: D1Like,
  agentId: string,
  workspaceId: string,
  tenantId: string,
  terminalRef: string,
  model?: string,
): Promise<{ id: string }> {
  const id = `pos_${crypto.randomUUID()}`;
  await db.prepare(
    `INSERT INTO pos_terminals (id, terminal_ref, agent_id, workspace_id, tenant_id, status, model)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  ).bind(id, terminalRef, agentId, workspaceId, tenantId, model ?? null).run();
  return { id };
}

/**
 * Lookup a terminal by its hardware reference ID (T3 — must also match tenantId).
 */
export async function getTerminalByRef(
  db: D1Like,
  terminalRef: string,
  tenantId: string,
): Promise<PosTerminal | null> {
  return db.prepare(
    'SELECT * FROM pos_terminals WHERE terminal_ref = ? AND tenant_id = ? LIMIT 1',
  ).bind(terminalRef, tenantId).first<PosTerminal>();
}

/**
 * Update terminal's last_seen_at heartbeat.
 */
export async function updateTerminalLastSeen(
  db: D1Like,
  terminalRef: string,
  tenantId: string,
): Promise<void> {
  await db.prepare(
    `UPDATE pos_terminals SET last_seen_at = unixepoch(), updated_at = unixepoch()
     WHERE terminal_ref = ? AND tenant_id = ?`,
  ).bind(terminalRef, tenantId).run();
}

/**
 * Suspend a terminal (tenant-scoped).
 */
export async function suspendTerminal(
  db: D1Like,
  tenantId: string,
  terminalId: string,
): Promise<void> {
  await db.prepare(
    `UPDATE pos_terminals SET status = 'suspended', updated_at = unixepoch()
     WHERE id = ? AND tenant_id = ?`,
  ).bind(terminalId, tenantId).run();
}
