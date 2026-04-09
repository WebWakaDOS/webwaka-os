/**
 * NURTW / Road Transport Workers Union vertical routes — M12 Transport Extended
 *
 * POST   /nurtw                         — Create profile
 * GET    /nurtw/workspace/:workspaceId  — Get by workspace (T3)
 * GET    /nurtw/:id                     — Get profile (T3)
 * PATCH  /nurtw/:id                     — Update profile
 * POST   /nurtw/:id/transition          — FSM transition
 * POST   /nurtw/:id/members             — Add member
 * GET    /nurtw/:id/members             — List members (T3)
 * POST   /nurtw/:id/members/:mid/dues   — Record dues collection (P9)
 * GET    /nurtw/:id/members/:mid/dues   — List dues log (T3)
 * POST   /nurtw/:id/welfare             — Create welfare claim (P9)
 * GET    /nurtw/:id/welfare             — List welfare claims (T3)
 * PATCH  /nurtw/:id/welfare/:wid        — Update welfare claim status
 * GET    /nurtw/:id/ai-efficiency       — AI fleet efficiency (P13; L3 HITL: no member names)
 *
 * Platform Invariants: T3, P9, P13
 * AI Autonomy: L3 HITL (politically sensitive — membership/leadership data)
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  NurtwRepository,
  guardSeedToClaimed,
  guardClaimedToNurtwVerified,
  isValidNurtwTransition,
} from '@webwaka/verticals-nurtw';
import type { NurtwFSMState, WelfareClaimStatus, WelfareClaimType, ChapterLevel } from '@webwaka/verticals-nurtw';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const nurtwRoutes = new Hono<{ Bindings: Env }>();

nurtwRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; union_name?: string; chapter_level?: string; nurtw_registration?: string; state?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.union_name) return c.json({ error: 'workspace_id, union_name are required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, unionName: body.union_name, chapterLevel: body.chapter_level as ChapterLevel, nurtwRegistration: body.nurtw_registration, state: body.state });
  return c.json({ nurtw: profile }, 201);
});

nurtwRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new NurtwRepository(c.env.DB);
  return c.json({ nurtw: await repo.findProfileByWorkspace(workspaceId, auth.tenantId) });
});

nurtwRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new NurtwRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'NURTW profile not found' }, 404);
  return c.json({ nurtw: profile });
});

nurtwRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { union_name?: string; chapter_level?: string; nurtw_registration?: string; state?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new NurtwRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { unionName: body.union_name, chapterLevel: body.chapter_level as ChapterLevel, nurtwRegistration: body.nurtw_registration, state: body.state });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ nurtw: updated });
});

nurtwRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const to = body.to_status as NurtwFSMState;
  if (!isValidNurtwTransition(profile.status, to)) return c.json({ error: `Invalid transition: ${profile.status} → ${to}` }, 422);
  const kycTier = auth.kycTier ?? 0;
  if (profile.status === 'seeded' && to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (profile.status === 'claimed' && to === 'nurtw_verified') {
    const g = guardClaimedToNurtwVerified({ nurtwRegistration: profile.nurtwRegistration, kycTier });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionStatus(id, auth.tenantId, to);
  return c.json({ nurtw: updated });
});

nurtwRoutes.post('/:id/members', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { member_name?: string; vehicle_plate?: string; vehicle_type?: string; member_since?: number; monthly_dues_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.member_name || body.monthly_dues_kobo === undefined) return c.json({ error: 'member_name, monthly_dues_kobo are required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  try {
    const member = await repo.createMember({ profileId: id, tenantId: auth.tenantId, memberName: body.member_name, vehiclePlate: body.vehicle_plate, vehicleType: body.vehicle_type, memberSince: body.member_since, monthlyDuesKobo: body.monthly_dues_kobo });
    return c.json({ member }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

nurtwRoutes.get('/:id/members', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new NurtwRepository(c.env.DB);
  const members = await repo.listMembers(id, auth.tenantId);
  return c.json({ members, count: members.length });
});

nurtwRoutes.post('/:id/members/:mid/dues', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, mid } = c.req.param();
  let body: { amount_kobo?: number; collection_date?: number; collector_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (body.amount_kobo === undefined) return c.json({ error: 'amount_kobo is required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  try {
    const dues = await repo.createDuesLog({ memberId: mid, profileId: id, tenantId: auth.tenantId, amountKobo: body.amount_kobo, collectionDate: body.collection_date, collectorId: body.collector_id });
    return c.json({ dues }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

nurtwRoutes.get('/:id/members/:mid/dues', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { mid } = c.req.param();
  const repo = new NurtwRepository(c.env.DB);
  const dues = await repo.listDuesLog(mid, auth.tenantId);
  return c.json({ dues, count: dues.length });
});

nurtwRoutes.post('/:id/welfare', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { member_id?: string; claim_type?: string; amount_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.member_id || body.amount_kobo === undefined) return c.json({ error: 'member_id, amount_kobo are required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  try {
    const claim = await repo.createWelfareClaim({ memberId: body.member_id, profileId: id, tenantId: auth.tenantId, claimType: body.claim_type as WelfareClaimType, amountKobo: body.amount_kobo });
    return c.json({ welfare_claim: claim }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

nurtwRoutes.get('/:id/welfare', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new NurtwRepository(c.env.DB);
  const claims = await repo.listWelfareClaims(id, auth.tenantId);
  return c.json({ welfare_claims: claims, count: claims.length });
});

nurtwRoutes.patch('/:id/welfare/:wid', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { wid } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new NurtwRepository(c.env.DB);
  const updated = await repo.updateWelfareClaimStatus(wid, auth.tenantId, body.status as WelfareClaimStatus);
  if (!updated) return c.json({ error: 'Welfare claim not found' }, 404);
  return c.json({ welfare_claim: updated });
});

// AI fleet efficiency — P13: NO member names, plates, leadership names passed to AI
// L3 HITL: politically sensitive; results flagged for human review before surfacing
nurtwRoutes.get(
  '/:id/ai-efficiency',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new NurtwRepository(c.env.DB);
    const members = await repo.listMembers(id, auth.tenantId);
    const data = members.map(m => ({ dues_status: m.duesStatus, monthly_dues_kobo: m.monthlyDuesKobo, vehicle_type: m.vehicleType }));
    return c.json({ capability: 'FLEET_EFFICIENCY_REPORT', ai_autonomy_level: 3, hitl_required: true, data, count: data.length });
  },
);
