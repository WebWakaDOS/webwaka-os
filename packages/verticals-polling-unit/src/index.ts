/**
 * @webwaka/verticals-polling-unit — public API
 * registerPollingUnitVertical() wires this vertical into the WebWaka FSM registry
 * L3 HITL MANDATORY on ALL AI — electoral data is most politically sensitive
 * ABSOLUTE RULE: NO voter PII; only aggregate INTEGER counts
 */

export * from './types.js';
export { PollingUnitRepository } from './polling-unit.js';

export function registerPollingUnitVertical() {
  return {
    slug: 'polling-unit',
    name: 'Polling Unit / Electoral District',
    milestone: 'M12',
    primary_pillars: ['ops', 'civic', 'compliance'] as const,
    regulatory_gate: 'inec_accredited',
    fsm_states: ['seeded', 'claimed', 'inec_accredited', 'active', 'suspended'],
    ai_autonomy_max: 'L3_HITL',
    kyc_tier_required: 2,
    p13_fields: [],
    ussd_excluded: false,
    no_voter_pii: true,
  };
}
