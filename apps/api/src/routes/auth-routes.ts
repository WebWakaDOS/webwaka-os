/**
 * Auth routes.
 *
 * POST /auth/login   — authenticate with email + password, returns JWT
 * POST /auth/refresh — refresh an expiring JWT (auth required)
 * GET  /auth/me      — return the caller's AuthContext (auth required)
 * POST /auth/verify  — validate a JWT and return its decoded payload
 */

import { Hono } from 'hono';
import { issueJwt, verifyJwt, extractAuthContext } from '@webwaka/auth';
import { Role } from '@webwaka/types';
import type { UserId, WorkspaceId, TenantId } from '@webwaka/types';
import { asId } from '@webwaka/types';
import type { Env } from '../env.js';

interface UserRow {
  id: string;
  password_hash: string;
  workspace_id: string;
  tenant_id: string;
  role: string;
}

const authRoutes = new Hono<{ Bindings: Env }>();

// POST /auth/login
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>().catch(() => null);

  if (!body?.email || !body?.password) {
    return c.json({ error: 'email and password are required.' }, 400);
  }

  // Look up user by email
  const userRow = await c.env.DB.prepare(
    `SELECT id, password_hash, workspace_id, tenant_id, role
     FROM users WHERE email = ? LIMIT 1`,
  )
    .bind(body.email.toLowerCase().trim())
    .first<UserRow>();

  if (!userRow) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  // Verify password using Web Crypto (PBKDF2)
  const encoder = new TextEncoder();
  const [storedSalt, storedHash] = userRow.password_hash.split(':');

  if (!storedSalt || !storedHash) {
    return c.json({ error: 'Authentication configuration error.' }, 500);
  }

  const saltBuffer = Uint8Array.from(atob(storedSalt), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(body.password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const derivedHash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));

  if (derivedHash !== storedHash) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  const token = await issueJwt(
    {
      sub: asId<UserId>(userRow.id),
      workspace_id: asId<WorkspaceId>(userRow.workspace_id),
      tenant_id: asId<TenantId>(userRow.tenant_id),
      role: (userRow.role as Role) ?? Role.Member,
    },
    c.env.JWT_SECRET,
  );

  return c.json({ token });
});

// POST /auth/refresh — re-issue a fresh JWT for the authenticated caller
// Note: authMiddleware must be applied before this route in the app entry
authRoutes.post('/refresh', async (c) => {
  const auth = c.get('auth');
  if (!auth) {
    return c.json({ error: 'Not authenticated.' }, 401);
  }

  const token = await issueJwt(
    {
      sub: auth.userId,
      workspace_id: auth.workspaceId,
      tenant_id: auth.tenantId,
      role: auth.role,
    },
    c.env.JWT_SECRET,
  );

  return c.json({ token });
});

// GET /auth/me — return the caller's decoded AuthContext
// Note: authMiddleware must be applied before this route in the app entry
authRoutes.get('/me', (c) => {
  const auth = c.get('auth');
  if (!auth) {
    return c.json({ error: 'Not authenticated.' }, 401);
  }
  return c.json({ data: auth });
});

// POST /auth/verify — validate a JWT token and return its decoded payload (no secret in response)
authRoutes.post('/verify', async (c) => {
  const body = await c.req.json<{ token: string }>().catch(() => null);

  if (!body?.token) {
    return c.json({ error: 'token is required.' }, 400);
  }

  try {
    const payload = await verifyJwt(body.token, c.env.JWT_SECRET);
    const context = extractAuthContext(payload);
    return c.json({ valid: true, data: context });
  } catch {
    return c.json({ valid: false, error: 'Invalid or expired token.' }, 401);
  }
});

export { authRoutes };
