/**
 * Domain event type catalogue for WebWaka OS event bus.
 * All events follow: {aggregate, aggregate_id, event_type, tenant_id, payload, version}
 *
 * Milestone 6 — Event Bus Layer
 */

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const EventType = {
  // Entity lifecycle
  EntityCreated:         'entity.created',
  EntityUpdated:         'entity.updated',

  // Claim lifecycle
  ClaimIntentCaptured:   'claim.intent_captured',
  ClaimAdvanced:         'claim.advanced',
  ClaimApproved:         'claim.approved',
  ClaimRejected:         'claim.rejected',

  // Payment
  PaymentInitialized:    'payment.initialized',
  PaymentSuccess:        'payment.success',
  PaymentFailed:         'payment.failed',

  // Workspace
  WorkspaceActivated:    'workspace.activated',
  WorkspaceInviteSent:   'workspace.invite_sent',

  // Search index
  SearchIndexed:         'search.indexed',
  SearchDeindexed:       'search.deindexed',

  // Profile
  ProfileViewed:         'profile.viewed',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

// ---------------------------------------------------------------------------
// Base event shape
// ---------------------------------------------------------------------------

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  aggregate: string;
  aggregateId: string;
  eventType: EventType;
  tenantId: string;
  payload: TPayload;
  version: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Typed event payloads
// ---------------------------------------------------------------------------

export interface EntityCreatedPayload {
  entityType: string;
  displayName: string;
  placeId?: string;
}

export interface ClaimAdvancedPayload {
  profileId: string;
  fromState: string;
  toState: string;
  evidence?: Record<string, unknown>;
}

export interface PaymentSuccessPayload {
  workspaceId: string;
  paystackRef: string;
  amountKobo: number;
  plan: string;
}

export interface PaymentFailedPayload {
  workspaceId: string;
  paystackRef: string;
  reason?: string;
}

export interface SearchIndexedPayload {
  entityId: string;
  entityType: string;
  displayName: string;
  placeId?: string;
}
