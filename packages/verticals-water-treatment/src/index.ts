/**
 * @webwaka/verticals-water-treatment — public API
 * registerWaterTreatmentVertical() wires this vertical into the WebWaka FSM registry
 * SCALED INTEGERS: ph_x100, chlorine_ppm10, turbidity_ntu10 — NO floats
 * AI: L2 advisory cap — quality alerts on aggregate stats only
 */

export * from './types.js';
export { WaterTreatmentRepository } from './water-treatment.js';

export function registerWaterTreatmentVertical() {
  return {
    slug: 'water-treatment',
    name: 'Water Treatment / Borehole Operator',
    milestone: 'M11',
    primary_pillars: ['ops', 'compliance'] as const,
    regulatory_gate: 'nafdac_verified',
    fsm_states: ['seeded', 'claimed', 'nafdac_verified', 'active', 'suspended'],
    ai_autonomy_max: 'L2',
    kyc_tier_required: 2,
    p13_fields: ['client_phone'],
    ussd_excluded: false,
    scaled_integers: { ph_x100: 'pH×100', chlorine_ppm10: 'ppm×10', turbidity_ntu10: 'NTU×10' },
  };
}
