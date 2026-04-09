/**
 * Vet Clinic routes — M10
 * P13: animal_ref_id / owner_ref_id opaque; no clinical diagnosis to AI
 * P9: consultationFeeKobo / costKobo / unitPriceKobo must be integers
 * T3: all queries scoped to tenantId
 * P12: AI blocked on USSD
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import {
  VetClinicRepository,
  guardClaimedToVcnbVerified,
  guardHighValueSurgery,
  guardP13AnimalClinicalData,
  guardFractionalKobo,
  isValidVetClinicTransition,
} from '@webwaka/verticals-vet-clinic';

type Auth = { userId: string; tenantId: string };

const app = new Hono<{ Bindings: Env }>();

function repo(c: { env: Env }) { return new VetClinicRepository(c.env.DB); }
function auth(c: Parameters<Parameters<typeof app.use>[1]>[0]) { return c.get('auth') as Auth; }

app.post('/profiles', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ workspaceId: string; clinicName: string; clinicType?: string; cacRc?: string }>();
  const profile = await repo(c).createProfile({ workspaceId: body.workspaceId, tenantId, clinicName: body.clinicName, clinicType: body.clinicType as never, cacRc: body.cacRc });
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
  const body = await c.req.json<{ to: string; vcnbRegistration?: string }>();
  const to = body.to as Parameters<typeof isValidVetClinicTransition>[1];
  const current = await repo(c).findProfileById(c.req.param('id'), tenantId);
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!isValidVetClinicTransition(current.status, to)) return c.json({ error: `Invalid FSM transition: ${current.status} → ${to}` }, 422);
  if (to === 'vcnb_verified') {
    const g = guardClaimedToVcnbVerified({ vcnbRegistration: body.vcnbRegistration ?? current.vcnbRegistration });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
    await repo(c).updateProfile(c.req.param('id'), tenantId, { vcnbRegistration: body.vcnbRegistration });
  }
  const updated = await repo(c).transition(c.req.param('id'), tenantId, to);
  return c.json(updated);
});

app.post('/profiles/:id/patients', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ species: string; breed?: string; ageMonths?: number }>();
  const patient = await repo(c).createPatient({ profileId: c.req.param('id'), tenantId, species: body.species, breed: body.breed, ageMonths: body.ageMonths });
  return c.json(patient, 201);
});

app.get('/profiles/:id/patients', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listPatients(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/appointments', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ animalRefId: string; vetId: string; appointmentTime: number; appointmentType?: string; consultationFeeKobo: number; kycTier?: number }>();
  const kycG = guardHighValueSurgery({ consultationFeeKobo: body.consultationFeeKobo, kycTier: body.kycTier ?? 1 });
  if (!kycG.allowed) return c.json({ error: kycG.reason }, 403);
  const g = guardFractionalKobo(body.consultationFeeKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const appt = await repo(c).createAppointment({ profileId: c.req.param('id'), tenantId, animalRefId: body.animalRefId, vetId: body.vetId, appointmentTime: body.appointmentTime, appointmentType: body.appointmentType as never, consultationFeeKobo: body.consultationFeeKobo });
  return c.json(appt, 201);
});

app.get('/profiles/:id/appointments', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listAppointments(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/vaccinations', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ animalRefId: string; vaccineName: string; dateAdministered?: number; nextDue?: number; costKobo: number }>();
  const g = guardFractionalKobo(body.costKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const vacc = await repo(c).createVaccination({ profileId: c.req.param('id'), tenantId, animalRefId: body.animalRefId, vaccineName: body.vaccineName, dateAdministered: body.dateAdministered, nextDue: body.nextDue, costKobo: body.costKobo });
  return c.json(vacc, 201);
});

app.post('/profiles/:id/shop', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ productName: string; category?: string; unitPriceKobo: number; quantityInStock?: number }>();
  const g = guardFractionalKobo(body.unitPriceKobo);
  if (!g.allowed) return c.json({ error: g.reason }, 422);
  const item = await repo(c).createShopItem({ profileId: c.req.param('id'), tenantId, productName: body.productName, category: body.category as never, unitPriceKobo: body.unitPriceKobo, quantityInStock: body.quantityInStock });
  return c.json(item, 201);
});

app.get('/profiles/:id/shop', async (c) => {
  const { tenantId } = auth(c);
  return c.json(await repo(c).listShopItems(c.req.param('id'), tenantId));
});

app.post('/profiles/:id/ai/demand-report', async (c) => {
  const { tenantId } = auth(c);
  const body = await c.req.json<{ aiRights?: boolean; ndprConsent?: boolean; isUssdSession?: boolean; payload?: Record<string, unknown> }>();
  if (body.isUssdSession) return c.json({ error: 'P12: AI blocked on USSD sessions' }, 403);
  if (!body.aiRights) return c.json({ error: 'AI rights not enabled' }, 403);
  if (!body.ndprConsent) return c.json({ error: 'P10: NDPR consent required' }, 403);
  if (body.payload) {
    const p13 = guardP13AnimalClinicalData({ payloadKeys: Object.keys(body.payload) });
    if (!p13.allowed) return c.json({ error: p13.reason }, 403);
  }
  const stats = await repo(c).aggregateStats(c.req.param('id'), tenantId);
  return c.json({ report: 'DEMAND_PLANNING', stats, autonomyLevel: 'L2' });
});

export default app;
