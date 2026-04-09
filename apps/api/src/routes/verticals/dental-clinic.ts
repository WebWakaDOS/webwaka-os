/**
 * Dental Clinic routes — M9
 * P13: patient_ref_id opaque; no clinical data to AI
 * P9: consultationFeeKobo / treatmentCostKobo must be integers
 * T3: all queries scoped to tenantId
 * L2 for scheduling AI; L3 HITL if patient-adjacent
 * P12: AI blocked on USSD
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  DentalClinicRepository,
  guardClaimedToMdcnVerified,
  guardKycForInsurance,
  guardP13PatientData,
  guardFractionalKobo,
  isValidDentalClinicTransition,
} from '@webwaka/verticals-dental-clinic';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new DentalClinicRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; clinicName: string; cacRc?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, clinicName: body.clinicName, cacRc: body.cacRc });
  return c.json(profile, 201);
});

app.get('/profiles/:id', async (c) => {
  const { tenantId } = auth(c);
  const p = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!p) return c.json({ error: 'not found' }, 404);
  return c.json(p);
});

app.patch('/profiles/:id/transition', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ to: string; mdcnFacilityReg?: string; kycTier?: number }>();
  const to = body.to as Parameters<typeof isValidDentalClinicTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidDentalClinicTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'mdcn_verified') {
    const g = guardClaimedToMdcnVerified({ mdcnFacilityReg: body.mdcnFacilityReg ?? current.mdcnFacilityReg, kycTier: body.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { mdcnFacilityReg: body.mdcnFacilityReg });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/dentists', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ mdcnRegNumber: string; specialisation?: string }>();
  const dentist = await repo(c).createDentist({ profileId: c.req.param('id'), tenantId, mdcnRegNumber: body.mdcnRegNumber, specialisation: body.specialisation });
  return c.json(dentist, 201);
});

app.get('/profiles/:id/dentists', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listDentists(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/appointments', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ dentistRefId: string; appointmentTime: number; treatmentType?: string; consultationFeeKobo: number }>();
  const g = guardFractionalKobo(body.consultationFeeKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const appt = await repo(c).createAppointment({ profileId: c.req.param('id'), tenantId, dentistRefId: body.dentistRefId, appointmentTime: body.appointmentTime, treatmentType: body.treatmentType as never, consultationFeeKobo: body.consultationFeeKobo });
  return c.json(appt, 201);
});

app.get('/profiles/:id/appointments', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listAppointments(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/treatments', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ appointmentId: string; treatmentCostKobo: number; labRef?: string; notesRef?: string }>();
  const g = guardFractionalKobo(body.treatmentCostKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const treatment = await repo(c).createTreatment({ profileId: c.req.param('id'), appointmentId: body.appointmentId, tenantId, treatmentCostKobo: body.treatmentCostKobo, labRef: body.labRef, notesRef: body.notesRef });
  return c.json(treatment, 201);
});

app.get('/profiles/:id/treatments', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listTreatments(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/appointment-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; autonomyLevel?: string; payload?: Record<string, unknown> }>();
  if (body.isUssdSession) return c.json({ error: 'P12: AI blocked on USSD sessions' }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required' }, 403);
  if (body.payload) {
    const p13 = guardP13PatientData({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  const kycBody = body as { kycTier?: number };
  if ((kycBody.kycTier ?? 0) < 2) return c.json({ error: 'KYC Tier 2 required for AI reports' }, 403);
  return c.json({ report: 'APPOINTMENT_OPTIMIZATION', stats, autonomyLevel: 'L2' });
});

app.post('/profiles/:id/ai/insurance-report', async (c) => {
  const { tenantId: _ } = auth(c);
  const body = await c.req.json<{ kycTier?: number }>();
  const g = guardKycForInsurance({ kycTier: body.kycTier ?? 0 });
  if (!g.allowed) return c.json({ error: g.reason }, 403);
  return c.json({ report: 'INSURANCE_BILLING_REPORT', autonomyLevel: 'L3_HITL' });
});

export default app;
