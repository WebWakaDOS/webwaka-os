/**
 * Politician vertical routes — M8b
 *
 * POST   /politician                          — Create politician profile
 * GET    /politician/:id                      — Get politician profile (T3 scoped)
 * PATCH  /politician/:id                      — Update politician profile
 * DELETE /politician/:id                      — Hard delete (admin)
 * POST   /politician/:id/transition           — FSM state transition
 * GET    /politician/workspace/:workspaceId   — List by workspace (T3 scoped)
 *
 * All routes require authMiddleware (wired in index.ts).
 *
 * Platform Invariants:
 *   T3 — all queries include tenantId from auth context
 *   FSM guards enforced at API layer (KYC tier checks)
 */

import { Hono } from 'hono';
import {
  PoliticianRepository,
  guardSeedToClaimed,
  guardClaimedToCandidate,
  isValidPoliticianTransition,
} from '@webwaka/verticals-politician';
import type { PoliticianFSMState, OfficeType } from '@webwaka/verticals-politician';
import type { Env } from '../env.js';

export const politicianRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// POST /politician — Create politician profile
// ---------------------------------------------------------------------------

politicianRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };

  let body: {
    individual_id?: string;
    workspace_id?: string;
    office_type?: string;
    jurisdiction_id?: string;
    party_id?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.individual_id || !body.workspace_id || !body.office_type || !body.jurisdiction_id) {
    return c.json(
      { error: 'individual_id, workspace_id, office_type, jurisdiction_id are required' },
      400,
    );
  }

  const validOfficeTypes: OfficeType[] = [
    'councilor', 'lga_chairman', 'state_assembly', 'hor', 'senator', 'governor', 'president',
  ];
  if (!validOfficeTypes.includes(body.office_type as OfficeType)) {
    return c.json(
      { error: `office_type must be one of: ${validOfficeTypes.join(', ')}` },
      400,
    );
  }

  const repo = new PoliticianRepository(c.env.DB);

  const profile = await repo.create({
    individualId: body.individual_id,
    workspaceId: body.workspace_id,
    tenantId: auth.tenantId,
    officeType: body.office_type as OfficeType,
    jurisdictionId: body.jurisdiction_id,
    ...(body.party_id !== undefined ? { partyId: body.party_id } : {}),
  });

  return c.json({ politician: profile }, 201);
});

// ---------------------------------------------------------------------------
// GET /politician/workspace/:workspaceId — List by workspace (T3 scoped)
// ---------------------------------------------------------------------------

politicianRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();

  const repo = new PoliticianRepository(c.env.DB);
  const profiles = await repo.findByWorkspace(workspaceId, auth.tenantId);

  return c.json({ politicians: profiles, count: profiles.length });
});

// ---------------------------------------------------------------------------
// GET /politician/:id — Get politician profile (T3 scoped)
// ---------------------------------------------------------------------------

politicianRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  const repo = new PoliticianRepository(c.env.DB);
  const profile = await repo.findById(id, auth.tenantId);

  if (!profile) {
    return c.json({ error: 'Politician profile not found' }, 404);
  }

  return c.json({ politician: profile });
});

// ---------------------------------------------------------------------------
// PATCH /politician/:id — Update politician profile (T3 scoped)
// ---------------------------------------------------------------------------

politicianRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: {
    office_type?: string;
    jurisdiction_id?: string;
    party_id?: string | null;
    nin_verified?: boolean;
    inec_filing_ref?: string | null;
    term_start?: number | null;
    term_end?: number | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const repo = new PoliticianRepository(c.env.DB);
  const updated = await repo.update(id, auth.tenantId, {
    ...(body.office_type !== undefined ? { officeType: body.office_type as OfficeType } : {}),
    ...(body.jurisdiction_id !== undefined ? { jurisdictionId: body.jurisdiction_id } : {}),
    ...('party_id' in body ? { partyId: body.party_id ?? null } : {}),
    ...(body.nin_verified !== undefined ? { ninVerified: body.nin_verified } : {}),
    ...('inec_filing_ref' in body ? { inecFilingRef: body.inec_filing_ref ?? null } : {}),
    ...('term_start' in body ? { termStart: body.term_start ?? null } : {}),
    ...('term_end' in body ? { termEnd: body.term_end ?? null } : {}),
  });

  if (!updated) {
    return c.json({ error: 'Politician profile not found' }, 404);
  }

  return c.json({ politician: updated });
});

// ---------------------------------------------------------------------------
// POST /politician/:id/transition — FSM state transition (T3 scoped)
// ---------------------------------------------------------------------------

politicianRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();

  let body: { to?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.to) {
    return c.json({ error: 'to (target FSM state) is required' }, 400);
  }

  const repo = new PoliticianRepository(c.env.DB);
  const current = await repo.findById(id, auth.tenantId);

  if (!current) {
    return c.json({ error: 'Politician profile not found' }, 404);
  }

  const toState = body.to as PoliticianFSMState;

  if (!isValidPoliticianTransition(current.status, toState)) {
    return c.json(
      {
        error: 'INVALID_TRANSITION',
        message: `Transition from ${current.status} to ${toState} is not allowed`,
      },
      422,
    );
  }

  // Apply KYC guards for self-service transitions
  if (current.status === 'seeded' && toState === 'claimed') {
    const kycTier = (auth as Record<string, unknown>)['kycTier'] as number | undefined ?? 0;
    const guard = guardSeedToClaimed({
      kycTier,
      ninVerified: current.ninVerified,
    });
    if (!guard.allowed) {
      return c.json({ error: 'GUARD_FAILED', message: guard.reason }, 403);
    }
  }

  if (current.status === 'claimed' && toState === 'candidate') {
    const kycTier = (auth as Record<string, unknown>)['kycTier'] as number | undefined ?? 0;
    const guard = guardClaimedToCandidate({
      kycTier,
      inecFilingRef: current.inecFilingRef,
    });
    if (!guard.allowed) {
      return c.json({ error: 'GUARD_FAILED', message: guard.reason }, 403);
    }
  }

  const updated = await repo.transition(id, auth.tenantId, toState);
  return c.json({ politician: updated });
});

// ---------------------------------------------------------------------------
// DELETE /politician/:id — Hard delete (admin only)
// ---------------------------------------------------------------------------

politicianRoutes.delete('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; role?: string };
  const { id } = c.req.param();

  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return c.json({ error: 'Admin role required' }, 403);
  }

  const repo = new PoliticianRepository(c.env.DB);
  const deleted = await repo.delete(id, auth.tenantId);

  if (!deleted) {
    return c.json({ error: 'Politician profile not found or delete failed' }, 404);
  }

  return c.json({ deleted: true, id });
});
