/**
 * packages/verticals — FSM Engine
 * WebWaka OS M8 — Verticals Framework
 *
 * Base FSM for all WebWaka OS verticals.
 * Every vertical extends this engine with sector-specific states.
 *
 * Platform Invariant P2: Build once, reuse everywhere.
 */

import type {
  VerticalFSMDefinition,
  VerticalFSMTransition,
  BaseVerticalState,
} from './types.js';

export class VerticalFSMError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_TRANSITION'
      | 'GUARD_FAILED'
      | 'STATE_NOT_FOUND',
  ) {
    super(message);
    this.name = 'VerticalFSMError';
  }
}

/**
 * Evaluate whether a state transition is permitted.
 * Returns `true` if allowed, throws `VerticalFSMError` if not.
 */
export function assertValidTransition<TState extends string>(
  fsm: VerticalFSMDefinition<TState>,
  fromState: TState,
  toState: TState,
): VerticalFSMTransition<TState> {
  if (!fsm.states.includes(fromState)) {
    throw new VerticalFSMError(
      `State '${fromState}' is not defined in FSM for vertical '${fsm.slug}'`,
      'STATE_NOT_FOUND',
    );
  }
  if (!fsm.states.includes(toState)) {
    throw new VerticalFSMError(
      `State '${toState}' is not defined in FSM for vertical '${fsm.slug}'`,
      'STATE_NOT_FOUND',
    );
  }

  const transition = fsm.transitions.find(
    (t) => t.from === fromState && t.to === toState,
  );

  if (!transition) {
    throw new VerticalFSMError(
      `No transition from '${fromState}' to '${toState}' in vertical '${fsm.slug}'`,
      'INVALID_TRANSITION',
    );
  }

  return transition;
}

/**
 * List all valid next states from the current state.
 */
export function getAvailableTransitions<TState extends string>(
  fsm: VerticalFSMDefinition<TState>,
  fromState: TState,
): ReadonlyArray<VerticalFSMTransition<TState>> {
  return fsm.transitions.filter((t) => t.from === fromState);
}

/**
 * Base FSM definition shared by all verticals.
 * Verticals extend this with additional intermediate states.
 */
export const BASE_VERTICAL_FSM: VerticalFSMDefinition<BaseVerticalState> = {
  slug: '__base__',
  states: ['seeded', 'claimed', 'active', 'suspended', 'deprecated'] as const,
  initialState: 'seeded',
  transitions: [
    {
      from: 'seeded',
      to: 'claimed',
      guard: 'requireKYCTier(1) + requirePrimaryPhoneVerified()',
      description: 'Workspace owner verified their identity and phone',
    },
    {
      from: 'claimed',
      to: 'active',
      guard: 'requireKYCTier(vertical.required_kyc_tier)',
      description: 'All vertical requirements met — entity goes live',
    },
    {
      from: 'active',
      to: 'suspended',
      guard: 'admin or payment_failure',
      description: 'Compliance failure or subscription lapse',
    },
    {
      from: 'suspended',
      to: 'active',
      guard: 'admin reinstatement',
      description: 'Issue resolved — entity reactivated',
    },
    {
      from: 'claimed',
      to: 'suspended',
      guard: 'admin',
      description: 'Pre-activation suspension (compliance review)',
    },
    {
      from: 'active',
      to: 'deprecated',
      guard: 'admin',
      description: 'Permanent removal from platform',
    },
    {
      from: 'suspended',
      to: 'deprecated',
      guard: 'admin',
      description: 'Suspended entity permanently removed',
    },
  ],
};

/**
 * Compose base FSM with vertical-specific extension states.
 * Extension states are inserted between 'claimed' and 'active'.
 */
export function composeVerticalFSM<TExtState extends string>(
  slug: string,
  extensionStates: readonly TExtState[],
  extensionTransitions: ReadonlyArray<VerticalFSMTransition<BaseVerticalState | TExtState>>,
): VerticalFSMDefinition<BaseVerticalState | TExtState> {
  const allStates = [
    ...BASE_VERTICAL_FSM.states,
    ...extensionStates,
  ] as const as ReadonlyArray<BaseVerticalState | TExtState>;

  return {
    slug,
    states: allStates,
    initialState: 'seeded',
    transitions: [
      ...BASE_VERTICAL_FSM.transitions,
      ...extensionTransitions,
    ],
  };
}
