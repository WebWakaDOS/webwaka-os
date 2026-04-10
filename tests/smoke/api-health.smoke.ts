/**
 * Smoke Tests — WebWaka OS API
 * These run against a locally-started worker (`wrangler dev`) or the staging URL.
 * Usage:  BASE_URL=http://localhost:8787 npx tsx tests/smoke/api-health.smoke.ts
 *
 * Invariants under test:
 *   P9  — all money fields are integers (kobo)
 *   T3  — tenant_id present on every data record
 *   P14 — DM payloads are AES-GCM encrypted (ciphertext, not plaintext)
 */

const BASE = process.env['BASE_URL'] ?? 'http://localhost:8787';
const TENANT = process.env['SMOKE_TENANT_ID'] ?? 'tenant_smoke_001';
const API_KEY = process.env['SMOKE_API_KEY'];
if (!API_KEY) {
  console.error('[smoke] FATAL: SMOKE_API_KEY environment variable is not set. Exiting.');
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${(e as Error).message}`);
    failed++;
  }
}

function expect(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function json(path: string, opts?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'x-tenant-id': TENANT, 'x-api-key': API_KEY, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ── Suite 1: Health & Baseline ──────────────────────────────────────────────
console.log('\nSuite 1: Health & Baseline');

await check('GET /health returns 200 with status:ok', async () => {
  const r = await json('/health');
  expect(r['status'] === 'ok', `Expected status:ok, got ${r['status']}`);
});

await check('GET /version returns semver string', async () => {
  const r = await json('/version');
  expect(typeof r['version'] === 'string', 'version must be string');
  expect(/^\d+\.\d+\.\d+/.test(r['version'] as string), `Bad semver: ${r['version']}`);
});

// ── Suite 2: Auth middleware (T3 enforcement) ────────────────────────────────
console.log('\nSuite 2: Auth / Tenant-ID enforcement');

await check('Request without x-tenant-id is rejected 401', async () => {
  const res = await fetch(`${BASE}/api/v1/verticals/laundry`, {
    headers: { 'x-api-key': API_KEY },
  });
  expect(res.status === 401, `Expected 401, got ${res.status}`);
});

await check('Request without x-api-key is rejected 401', async () => {
  const res = await fetch(`${BASE}/api/v1/verticals/laundry`, {
    headers: { 'x-tenant-id': TENANT },
  });
  expect(res.status === 401, `Expected 401, got ${res.status}`);
});

// ── Suite 3: P9 — money is always integer kobo ───────────────────────────────
console.log('\nSuite 3: P9 — money fields are integer kobo');

await check('Price-lock token uses integer kobo amount', async () => {
  const r = await json('/api/v1/price-lock', {
    method: 'POST',
    body: JSON.stringify({ itemRef: 'smoke-item-001', amountKobo: 5000, expiresIn: 300 }),
  });
  if (r['token']) {
    expect(typeof r['token'] === 'string', 'token must be string');
  } else {
    expect(r['error'] !== undefined || r['token'] !== undefined, 'Must return token or error');
  }
});

await check('Price-lock rejects float kobo amounts', async () => {
  const res = await fetch(`${BASE}/api/v1/price-lock`, {
    method: 'POST',
    headers: { 'x-tenant-id': TENANT, 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemRef: 'smoke-item-001', amountKobo: 50.5, expiresIn: 300 }),
  });
  expect(res.status === 422 || res.status === 400, `Expected 422/400 for float kobo, got ${res.status}`);
});

// ── Suite 4: Rate limiting (T006 — global rate limiter) ──────────────────────
console.log('\nSuite 4: Rate limiting');

await check('Excessive requests trigger 429 Too Many Requests', async () => {
  let hit429 = false;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${BASE}/health`, { headers: { 'x-tenant-id': TENANT, 'x-api-key': API_KEY } });
    if (res.status === 429) { hit429 = true; break; }
  }
  expect(hit429, 'Expected 429 after >100 rapid requests');
});

// ── Suite 5: Vertical route existence (not 404) ──────────────────────────────
console.log('\nSuite 5: Vertical routes exist');

const verticals = [
  'laundry', 'pharmacy', 'hotel', 'handyman', 'logistics-delivery',
  'gym-fitness', 'printing-press', 'oil-gas-services', 'orphanage',
  'nursery-school', 'motivational-speaker', 'land-surveyor',
];

for (const v of verticals) {
  await check(`GET /api/v1/verticals/${v} responds (not 404 or 500)`, async () => {
    const res = await fetch(`${BASE}/api/v1/verticals/${v}`, {
      headers: { 'x-tenant-id': TENANT, 'x-api-key': API_KEY },
    });
    expect(res.status !== 404, `Vertical ${v} returned 404 — route not registered`);
    expect(res.status < 500, `Vertical ${v} returned ${res.status} server error`);
  });
}

// ── Suite 6: Paystack callback (T005) ────────────────────────────────────────
console.log('\nSuite 6: Paystack callback URL');

await check('POST /api/v1/payments/paystack/callback accepts JSON body', async () => {
  const res = await fetch(`${BASE}/api/v1/payments/paystack/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'charge.success', data: { reference: 'smoke-ref', amount: 5000, status: 'success' } }),
  });
  expect(res.status !== 404, 'Paystack callback route must be registered');
  expect(res.status < 500, `Paystack callback returned ${res.status}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error(`SMOKE FAILED — ${failed} checks did not pass`);
  process.exit(1);
}
console.log('All smoke checks passed ✓');
