/**
 * Event publisher — appends domain events to the event_log D1 table.
 * Uses optimistic versioning: fetches current max version and increments.
 *
 * Milestone 6 — Event Bus Layer
 */

import type { DomainEvent, EventType } from './event-types.js';

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

export interface PublishEventParams<TPayload = Record<string, unknown>> {
  aggregate: string;
  aggregateId: string;
  eventType: EventType;
  tenantId: string;
  payload: TPayload;
}

/**
 * Publish a domain event to the event_log table.
 * Returns the saved event with its assigned version.
 */
export async function publishEvent<TPayload = Record<string, unknown>>(
  db: D1Like,
  params: PublishEventParams<TPayload>,
): Promise<DomainEvent<TPayload>> {
  const id = `evt_${crypto.randomUUID().replace(/-/g, '')}`;

  // Get current max version for this aggregate (optimistic concurrency)
  const current = await db
    .prepare(
      `SELECT COALESCE(MAX(version), 0) AS max_version
       FROM event_log
       WHERE aggregate = ? AND aggregate_id = ?`,
    )
    .bind(params.aggregate, params.aggregateId)
    .first<{ max_version: number }>();

  const version = (current?.max_version ?? 0) + 1;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO event_log (id, aggregate, aggregate_id, event_type, tenant_id, payload, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    )
    .bind(
      id,
      params.aggregate,
      params.aggregateId,
      params.eventType,
      params.tenantId,
      JSON.stringify(params.payload),
      version,
    )
    .run();

  return {
    id,
    aggregate: params.aggregate,
    aggregateId: params.aggregateId,
    eventType: params.eventType,
    tenantId: params.tenantId,
    payload: params.payload,
    version,
    createdAt: now,
  };
}

/**
 * Fetch events for an aggregate (ordered by version).
 */
export async function getAggregateEvents<TPayload = Record<string, unknown>>(
  db: D1Like,
  aggregate: string,
  aggregateId: string,
): Promise<DomainEvent<TPayload>[]> {
  const rows = await db
    .prepare(
      `SELECT id, aggregate, aggregate_id, event_type, tenant_id, payload, version,
              datetime(created_at,'unixepoch') AS created_at
       FROM event_log
       WHERE aggregate = ? AND aggregate_id = ?
       ORDER BY version ASC`,
    )
    .bind(aggregate, aggregateId)
    .all<{
      id: string;
      aggregate: string;
      aggregate_id: string;
      event_type: string;
      tenant_id: string;
      payload: string;
      version: number;
      created_at: string;
    }>();

  return rows.results.map((r) => ({
    id: r.id,
    aggregate: r.aggregate,
    aggregateId: r.aggregate_id,
    eventType: r.event_type as EventType,
    tenantId: r.tenant_id,
    payload: JSON.parse(r.payload) as TPayload,
    version: r.version,
    createdAt: r.created_at,
  }));
}
