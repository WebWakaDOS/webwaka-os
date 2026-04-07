/**
 * Event subscriber — in-process event handler registry.
 * (No durable queue in M6; Cloudflare Queues wired in M7+)
 *
 * subscribe(eventType, handler) — register a handler
 * dispatch(event)               — call all handlers for an event type
 *
 * Milestone 6 — Event Bus Layer
 */

import type { DomainEvent, EventType } from './event-types.js';

export type EventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => Promise<void>;

// Handler registry — singleton map per runtime context
const registry = new Map<string, EventHandler[]>();

/**
 * Register an event handler for a given event type.
 * Multiple handlers per event type are supported (fan-out).
 */
export function subscribe(eventType: EventType, handler: EventHandler): void {
  const existing = registry.get(eventType) ?? [];
  existing.push(handler as EventHandler);
  registry.set(eventType, existing);
}

/**
 * Dispatch an event to all registered handlers.
 * Handler errors are caught and logged — they do not abort the dispatch.
 */
export async function dispatch<TPayload = Record<string, unknown>>(
  event: DomainEvent<TPayload>,
): Promise<{ handled: number; errors: string[] }> {
  const handlers = (registry.get(event.eventType) ?? []) as EventHandler<TPayload>[];
  const errors: string[] = [];

  await Promise.all(
    handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`[${event.eventType}] ${message}`);
        console.error(`[events] Handler error for ${event.eventType}:`, err);
      }
    }),
  );

  return { handled: handlers.length, errors };
}

/**
 * Clear all registered handlers (for testing / hot-reload).
 */
export function clearSubscriptions(): void {
  registry.clear();
}

/**
 * Return registered handler count for a given event type.
 */
export function handlerCount(eventType: EventType): number {
  return registry.get(eventType)?.length ?? 0;
}
