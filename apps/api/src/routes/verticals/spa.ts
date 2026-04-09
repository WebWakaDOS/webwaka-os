/**
 * Spa / Massage Parlour vertical routes — M10 Commerce P2 Batch 2
 *
 * POST   /spa                                    — Create profile
 * GET    /spa/workspace/:workspaceId             — Get by workspace (T3)
 * GET    /spa/:id                                — Get profile (T3)
 * PATCH  /spa/:id                               — Update profile
 * POST   /spa/:id/transition                    — FSM transition
 * POST   /spa/:id/services                      — Create service (P9)
 * GET    /spa/:id/services                      — List services
 * POST   /spa/:id/appointments                  — Book appointment (P9)
 * GET    /spa/:id/appointments                  — List appointments
 * PATCH  /spa/:id/appointments/:apptId          — Update appointment status
 * POST   /spa/:id/memberships                   — Create membership (P9)
 * GET    /spa/:id/memberships                   — List memberships
 * GET    /spa/:id/ai-advisory                   — AI advisory (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 * P13: Client health intake data NEVER passed to AI advisory
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  SpaRepository,
  guardSeedToClaimed,
  guardClaimedToPermitVerified,
  isValidSpaTransition,
} from '@webwaka/verticals-spa';
import type { SpaFSMState, AppointmentStatus } from '@webwaka/verticals-spa';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const spaRoutes = new Hono<{ Bindings: Env }>();

spaRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; spa_name?: string; type?: string; nasc_number?: string; state_health_permit?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.spa_name || !body.type) return c.json({ error: 'workspace_id, spa_name, type are required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, spaName: body.spa_name, type: body.type as never, nascNumber: body.nasc_number, stateHealthPermit: body.state_health_permit });
  return c.json({ spa: profile }, 201);
});

spaRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new SpaRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ spa: profile });
});

spaRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SpaRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Spa profile not found' }, 404);
  return c.json({ spa: profile });
});

spaRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { spa_name?: string; type?: string; nasc_number?: string; state_health_permit?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new SpaRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { spaName: body.spa_name, type: body.type as never, nascNumber: body.nasc_number, stateHealthPermit: body.state_health_permit });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ spa: updated });
});

spaRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as SpaFSMState;
  if (!isValidSpaTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'permit_verified') {
    const g = guardClaimedToPermitVerified({ nascNumber: profile.nascNumber ?? null, stateHealthPermit: profile.stateHealthPermit ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ spa: updated });
});

spaRoutes.post('/:id/services', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { service_name?: string; category?: string; duration_minutes?: number; price_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.service_name || body.price_kobo === undefined) return c.json({ error: 'service_name, price_kobo are required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  try {
    const service = await repo.createService({ workspaceId: id, tenantId: auth.tenantId, serviceName: body.service_name, category: body.category as never, durationMinutes: body.duration_minutes, priceKobo: body.price_kobo });
    return c.json({ service }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

spaRoutes.get('/:id/services', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SpaRepository(c.env.DB);
  const services = await repo.listServices(id, auth.tenantId);
  return c.json({ services, count: services.length });
});

spaRoutes.post('/:id/appointments', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; service_id?: string; therapist_id?: string; room_number?: string; appointment_time?: number; deposit_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.service_id || body.appointment_time === undefined) return c.json({ error: 'client_phone, service_id, appointment_time are required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  try {
    const appointment = await repo.createAppointment({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, serviceId: body.service_id, therapistId: body.therapist_id, roomNumber: body.room_number, appointmentTime: body.appointment_time, depositKobo: body.deposit_kobo });
    return c.json({ appointment }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

spaRoutes.get('/:id/appointments', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SpaRepository(c.env.DB);
  const appointments = await repo.listAppointments(id, auth.tenantId);
  // P13: no health intake data in list response
  return c.json({ appointments, count: appointments.length });
});

spaRoutes.patch('/:id/appointments/:apptId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { apptId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  const updated = await repo.updateAppointmentStatus(apptId, auth.tenantId, body.status as AppointmentStatus);
  if (!updated) return c.json({ error: 'Appointment not found' }, 404);
  return c.json({ appointment: updated });
});

spaRoutes.post('/:id/memberships', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; package_name?: string; monthly_fee_kobo?: number; sessions_per_month?: number; valid_until?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone || !body.package_name || body.monthly_fee_kobo === undefined) return c.json({ error: 'client_phone, package_name, monthly_fee_kobo are required' }, 400);
  const repo = new SpaRepository(c.env.DB);
  try {
    const membership = await repo.createMembership({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, packageName: body.package_name, monthlyFeeKobo: body.monthly_fee_kobo, sessionsPerMonth: body.sessions_per_month, validUntil: body.valid_until });
    return c.json({ membership }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

spaRoutes.get('/:id/memberships', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new SpaRepository(c.env.DB);
  const memberships = await repo.listMemberships(id, auth.tenantId);
  return c.json({ memberships, count: memberships.length });
});

// AI advisory — service/appointment aggregate; NEVER health data (P13)
spaRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new SpaRepository(c.env.DB);
    const services = await repo.listServices(id, auth.tenantId);
    // P13: no client phone, no health intake data
    const advisory = services.map(s => ({ service_name: s.serviceName, category: s.category, duration_minutes: s.durationMinutes, price_kobo: s.priceKobo }));
    return c.json({ capability: 'APPOINTMENT_OPTIMIZATION', advisory_data: advisory, count: advisory.length });
  },
);
