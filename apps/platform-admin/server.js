/**
 * Local development shim for the WebWaka OS Platform Admin.
 *
 * Production target: Cloudflare Workers (TDR-0002).
 * This file is a LOCAL DEV ONLY static file server using Node.js built-ins.
 * No third-party server framework — Platform Invariant T1 compliance.
 *
 * NOT deployed to production. Replaced by Cloudflare Pages in staging/production.
 *
 * Milestone 5 additions:
 *   GET  /admin/claims           — stub claim request list (dev only)
 *   GET  /admin/claims/:id       — stub claim detail (dev only)
 *   POST /admin/claims/:id/approve — stub approve (dev only)
 *   POST /admin/claims/:id/reject  — stub reject (dev only)
 *   POST /admin/claims/expire-stale — stub expire (dev only)
 *
 * Production Hono routes: apps/platform-admin/src/routes/claims.ts
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 5000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

// Stub in-memory claim store for local dev
const STUB_CLAIMS = [
  {
    id: 'clm_stub_001',
    profileId: 'prof_stub_001',
    subjectType: 'individual',
    subjectId: 'ind_stub_001',
    claimState: 'claimable',
    requesterEmail: 'seun@example.ng',
    requesterName: 'Seun Adeyemi',
    status: 'pending',
    verificationMethod: 'email',
    expiresAt: Math.floor(Date.now() / 1000) + 2592000,
    createdAt: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    id: 'clm_stub_002',
    profileId: 'prof_stub_002',
    subjectType: 'organization',
    subjectId: 'org_stub_002',
    claimState: 'claim_pending',
    requesterEmail: 'admin@webwaka.ng',
    requesterName: 'Emeka Okafor',
    status: 'pending',
    verificationMethod: 'document',
    expiresAt: Math.floor(Date.now() / 1000) + 2505600,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // -------------------------------------------------------------------------
  // Health endpoint
  // -------------------------------------------------------------------------
  if (pathname === '/health') {
    jsonResponse(res, 200, {
      status: 'ok',
      app: 'WebWaka OS Platform Admin',
      milestone: 5,
      routes: ['/admin/claims', '/admin/claims/:id', '/admin/claims/:id/approve', '/admin/claims/:id/reject'],
    });
    return;
  }

  // -------------------------------------------------------------------------
  // Admin claims API stubs (dev only — production: Hono Worker + D1)
  // Production routes: apps/platform-admin/src/routes/claims.ts
  // -------------------------------------------------------------------------

  // POST /admin/claims/expire-stale
  if (req.method === 'POST' && pathname === '/admin/claims/expire-stale') {
    jsonResponse(res, 200, { expired: true, message: 'Stale claims expired (stub)' });
    return;
  }

  // POST /admin/claims/:id/approve
  const approveMatch = pathname.match(/^\/admin\/claims\/([^/]+)\/approve$/);
  if (req.method === 'POST' && approveMatch) {
    const claimId = approveMatch[1];
    const claim = STUB_CLAIMS.find((c) => c.id === claimId);
    if (!claim) { jsonResponse(res, 404, { error: 'Claim not found' }); return; }
    if (claim.status !== 'pending') { jsonResponse(res, 409, { error: `Claim is already ${claim.status}` }); return; }
    claim.status = 'approved';
    claim.claimState = 'verified';
    jsonResponse(res, 200, { id: claimId, status: 'approved', profileState: 'verified' });
    return;
  }

  // POST /admin/claims/:id/reject
  const rejectMatch = pathname.match(/^\/admin\/claims\/([^/]+)\/reject$/);
  if (req.method === 'POST' && rejectMatch) {
    const claimId = rejectMatch[1];
    const claim = STUB_CLAIMS.find((c) => c.id === claimId);
    if (!claim) { jsonResponse(res, 404, { error: 'Claim not found' }); return; }
    if (claim.status !== 'pending') { jsonResponse(res, 409, { error: `Claim is already ${claim.status}` }); return; }
    const body = await readBody(req);
    claim.status = 'rejected';
    claim.claimState = 'claimable';
    jsonResponse(res, 200, { id: claimId, status: 'rejected', reason: body.reason ?? null });
    return;
  }

  // GET /admin/claims/:id
  const claimDetailMatch = pathname.match(/^\/admin\/claims\/([^/]+)$/);
  if (req.method === 'GET' && claimDetailMatch) {
    const claimId = claimDetailMatch[1];
    const claim = STUB_CLAIMS.find((c) => c.id === claimId);
    if (!claim) { jsonResponse(res, 404, { error: 'Claim not found' }); return; }
    jsonResponse(res, 200, claim);
    return;
  }

  // GET /admin/claims
  if (req.method === 'GET' && pathname === '/admin/claims') {
    const statusFilter = url.searchParams.get('status') ?? 'pending';
    const filtered = statusFilter === 'all'
      ? STUB_CLAIMS
      : STUB_CLAIMS.filter((c) => c.status === statusFilter);
    jsonResponse(res, 200, { claims: filtered, total: filtered.length, limit: 50, offset: 0 });
    return;
  }

  // -------------------------------------------------------------------------
  // Static file serving (M7e: PWA headers for manifest.json and sw.js)
  // -------------------------------------------------------------------------
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, requestPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    // M7e: PWA headers — required for Lighthouse PWA score ≥ 80 (P5)
    const headers = {
      'Content-Type': contentType,
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    };

    // Link manifest header on all HTML responses
    if (ext === '.html' || requestPath === '/index.html') {
      headers['Link'] = '</manifest.json>; rel=manifest';
    }

    // Service worker must be served from root scope (no cache)
    if (pathname === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`WebWaka OS Platform Admin (local dev shim) running on http://0.0.0.0:${PORT}`);
  console.log(`Serving static files from: ${PUBLIC_DIR}`);
  console.log(`Claims admin stubs available at: /admin/claims`);
});
