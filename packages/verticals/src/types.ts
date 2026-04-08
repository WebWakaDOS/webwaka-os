/**
 * packages/verticals — Vertical Registry Types
 * WebWaka OS M8 — Verticals Framework
 *
 * T2: TypeScript strict mode
 * T3: All vertical-scoped queries include tenant_id
 */

export type VerticalCategory =
  | 'politics'
  | 'transport'
  | 'civic'
  | 'commerce'
  | 'health'
  | 'education'
  | 'professional'
  | 'creator'
  | 'place'
  | 'financial'
  | 'agricultural'
  | 'media'
  | 'institutional'
  | 'social';

export type VerticalPriority = 1 | 2 | 3;

export type VerticalEntityType = 'individual' | 'organization' | 'place' | 'offering';

export type VerticalStatus = 'planned' | 'active' | 'deprecated';

export type BaseVerticalState =
  | 'seeded'
  | 'claimed'
  | 'active'
  | 'suspended'
  | 'deprecated';

export interface VerticalRecord {
  id: string;
  slug: string;
  display_name: string;
  category: VerticalCategory;
  subcategory: string | null;
  priority: VerticalPriority;
  status: VerticalStatus;
  entity_type: VerticalEntityType;
  fsm_states: string;
  required_kyc_tier: 0 | 1 | 2 | 3;
  requires_frsc: 0 | 1;
  requires_cac: 0 | 1;
  requires_it: 0 | 1;
  requires_community: 0 | 1;
  requires_social: 0 | 1;
  package_name: string | null;
  milestone_target: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface VerticalFSMDefinition<TState extends string = string> {
  slug: string;
  states: readonly TState[];
  transitions: ReadonlyArray<VerticalFSMTransition<TState>>;
  initialState: TState;
}

export interface VerticalFSMTransition<TState extends string = string> {
  from: TState;
  to: TState;
  guard?: string;
  description?: string;
}

export interface VerticalEntitlements {
  slug: string;
  required_kyc_tier: 0 | 1 | 2 | 3;
  requires_frsc: boolean;
  requires_cac: boolean;
  requires_it: boolean;
  requires_community: boolean;
  requires_social: boolean;
}

export interface VerticalActivationContext {
  workspaceId: string;
  tenantId: string;
  userId: string;
  kycTier: 0 | 1 | 2 | 3;
  frscVerified: boolean;
  cacVerified: boolean;
  itVerified: boolean;
}

export type VerticalLookupResult =
  | { found: true; vertical: VerticalRecord }
  | { found: false };
