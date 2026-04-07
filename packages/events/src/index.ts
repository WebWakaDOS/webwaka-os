/**
 * @webwaka/events — Domain event bus (publisher + subscriber + projections).
 * Milestone 6 — Event Bus Layer
 */

export type {
  DomainEvent,
  EventType,
  EntityCreatedPayload,
  ClaimAdvancedPayload,
  PaymentSuccessPayload,
  PaymentFailedPayload,
  SearchIndexedPayload,
} from './event-types.js';

export { EventType as EventTypes } from './event-types.js';

export type { PublishEventParams } from './publisher.js';
export { publishEvent, getAggregateEvents } from './publisher.js';

export type { EventHandler } from './subscriber.js';
export {
  subscribe,
  dispatch,
  clearSubscriptions,
  handlerCount,
} from './subscriber.js';

export { rebuildSearchIndexFromEvents } from './projections/search.js';
export type { RebuildResult } from './projections/search.js';
