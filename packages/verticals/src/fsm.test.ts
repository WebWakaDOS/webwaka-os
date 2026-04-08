/**
 * packages/verticals — FSM Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  assertValidTransition,
  getAvailableTransitions,
  composeVerticalFSM,
  VerticalFSMError,
  BASE_VERTICAL_FSM,
} from './fsm.js';

describe('BASE_VERTICAL_FSM', () => {
  it('has all 5 base states', () => {
    expect(BASE_VERTICAL_FSM.states).toContain('seeded');
    expect(BASE_VERTICAL_FSM.states).toContain('claimed');
    expect(BASE_VERTICAL_FSM.states).toContain('active');
    expect(BASE_VERTICAL_FSM.states).toContain('suspended');
    expect(BASE_VERTICAL_FSM.states).toContain('deprecated');
  });

  it('initial state is seeded', () => {
    expect(BASE_VERTICAL_FSM.initialState).toBe('seeded');
  });
});

describe('assertValidTransition', () => {
  it('allows seeded → claimed', () => {
    const t = assertValidTransition(BASE_VERTICAL_FSM, 'seeded', 'claimed');
    expect(t.from).toBe('seeded');
    expect(t.to).toBe('claimed');
  });

  it('allows claimed → active', () => {
    const t = assertValidTransition(BASE_VERTICAL_FSM, 'claimed', 'active');
    expect(t.from).toBe('claimed');
    expect(t.to).toBe('active');
  });

  it('allows active → suspended', () => {
    const t = assertValidTransition(BASE_VERTICAL_FSM, 'active', 'suspended');
    expect(t.to).toBe('suspended');
  });

  it('allows active → deprecated', () => {
    const t = assertValidTransition(BASE_VERTICAL_FSM, 'active', 'deprecated');
    expect(t.to).toBe('deprecated');
  });

  it('throws INVALID_TRANSITION for seeded → active (no direct path)', () => {
    expect(() =>
      assertValidTransition(BASE_VERTICAL_FSM, 'seeded', 'active'),
    ).toThrow(VerticalFSMError);
  });

  it('throws STATE_NOT_FOUND for unknown from-state', () => {
    expect(() =>
      assertValidTransition(
        BASE_VERTICAL_FSM,
        'nonexistent' as never,
        'claimed',
      ),
    ).toThrow(VerticalFSMError);
  });

  it('throws STATE_NOT_FOUND for unknown to-state', () => {
    expect(() =>
      assertValidTransition(
        BASE_VERTICAL_FSM,
        'seeded',
        'flying' as never,
      ),
    ).toThrow(VerticalFSMError);
  });
});

describe('getAvailableTransitions', () => {
  it('returns transitions from seeded', () => {
    const transitions = getAvailableTransitions(BASE_VERTICAL_FSM, 'seeded');
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.every((t) => t.from === 'seeded')).toBe(true);
  });

  it('returns empty array from deprecated', () => {
    const transitions = getAvailableTransitions(BASE_VERTICAL_FSM, 'deprecated');
    expect(transitions).toHaveLength(0);
  });
});

describe('composeVerticalFSM', () => {
  it('composes politician FSM with extension states', () => {
    const politicianFSM = composeVerticalFSM(
      'politician',
      ['candidate', 'elected', 'in_office', 'post_office'] as const,
      [
        { from: 'claimed', to: 'candidate', guard: 'requireKYCTier(2)', description: 'Filed candidacy' },
        { from: 'candidate', to: 'elected', guard: 'election_results', description: 'Election won' },
        { from: 'elected', to: 'in_office', guard: 'sworn_in', description: 'Sworn in to office' },
        { from: 'in_office', to: 'post_office', guard: 'term_end', description: 'Term completed' },
      ],
    );

    expect(politicianFSM.slug).toBe('politician');
    expect(politicianFSM.states).toContain('candidate');
    expect(politicianFSM.states).toContain('elected');
    expect(politicianFSM.states).toContain('in_office');
    expect(politicianFSM.states).toContain('post_office');
    expect(politicianFSM.states).toContain('seeded');
    expect(politicianFSM.states).toContain('active');
  });

  it('composes transport FSM with FRSC states', () => {
    const motorParkFSM = composeVerticalFSM(
      'motor-park',
      ['frsc_verified', 'route_licensed'] as const,
      [
        { from: 'claimed', to: 'frsc_verified', guard: 'verifyFRSC()', description: 'FRSC operator verified' },
        { from: 'frsc_verified', to: 'route_licensed', guard: 'routeLicenseSubmitted', description: 'Route license approved' },
        { from: 'route_licensed', to: 'active', guard: 'requireKYCTier(2)', description: 'Fully operational' },
      ],
    );

    expect(motorParkFSM.states).toContain('frsc_verified');
    expect(motorParkFSM.states).toContain('route_licensed');
    const t = assertValidTransition(motorParkFSM, 'claimed', 'frsc_verified');
    expect(t.guard).toBe('verifyFRSC()');
  });

  it('composes civic FSM with IT registration state', () => {
    const churchFSM = composeVerticalFSM(
      'church',
      ['it_verified', 'community_active'] as const,
      [
        { from: 'claimed', to: 'it_verified', guard: 'verifyCAC_IT()', description: 'Incorporated Trustees verified' },
        { from: 'it_verified', to: 'community_active', guard: 'communitySpaceCreated', description: 'Community platform launched' },
        { from: 'community_active', to: 'active', guard: 'requireKYCTier(1)', description: 'Fully operational' },
      ],
    );

    expect(churchFSM.slug).toBe('church');
    expect(churchFSM.states).toContain('it_verified');
    expect(churchFSM.states).toContain('community_active');
  });
});
