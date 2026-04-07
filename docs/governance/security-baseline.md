# Security Baseline

**Status:** ACTIVE
**Owner:** Base44 Super Agent (draft) → Founder (approval)
**Last updated:** 2026-04-07

---

## Purpose

This document defines the non-negotiable security rules for WebWaka OS. All implementations must comply. Violations are critical bugs.

---

## 1. Secrets Management

- **All secrets live in GitHub Actions secrets or Cloudflare Worker secrets.** Never in code, config files, or documentation.
- Required GitHub Actions secrets for CI/CD:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_D1_STAGING_ID`
  - `CLOUDFLARE_D1_PRODUCTION_ID`
  - `JWT_SECRET_STAGING`
  - `JWT_SECRET_PRODUCTION`
  - `INTER_SERVICE_SECRET`
- Cloudflare Worker secrets set via `wrangler secret put` — never in `wrangler.toml`.
- No `.env` files committed. `.env.example` files are allowed with placeholder values only.
- Secret rotation policy: rotate all secrets every 90 days or immediately on suspected exposure.

---

## 2. Authentication and Tenancy

- **Every API request (except explicitly public endpoints) must carry a valid JWT.**
- JWTs must be validated using `@webwaka/core`s `jwtAuthMiddleware`.
- JWT payload must include: `sub` (user ID), `tenant_id`, `role`.
- **`tenant_id` must be present and validated on every authenticated request.** Missing `tenant_id` is a hard 401.
- Cross-tenant access is a critical security bug. Every query must be scoped by `tenant_id`.
- Super admin routes require explicit `super_admin` role check — not just any admin.

---

## 3. Role-Based Access Control (RBAC)

- Use `requireRole()` from `@webwaka/core` for all protected routes.
- Roles: `super_admin`, `admin`, `manager`, `agent`, `cashier`, `member`, `public`.
- Role hierarchy is enforced at the middleware layer, not in business logic.
- No hardcoded role checks in DB queries — use middleware.

---

## 4. Input Validation

- All request bodies must be validated before processing. Use Zod schemas.
- Monetary values are always stored and transmitted as **integer kobo** (NGN×100). Floating point is not allowed for money.
- IDs are opaque strings — never sequential integers exposed to clients.
- SQL queries use parameterised bindings only. No string interpolation in DB queries.

---

## 5. Rate Limiting

- All public endpoints must have rate limiting via Cloudflare KV or Workers rate limiting API.
- Authentication endpoints (login, OTP, token refresh) have stricter limits.
- Rate limit state is stored in KV binding `RATE_LIMIT_KV`.

---

## 6. Audit Logging

- All destructive operations (delete, archive, deactivate) must emit an audit log entry.
- All financial operations must emit an audit log entry.
- All RBAC escalations must emit an audit log entry.
- Audit logs include: `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `timestamp`, `ip` (where available).
- Audit logs are append-only. No update or delete on audit log records.

---

## 7. Data Isolation

- **D1 database uses row-level tenant isolation.** All tables with tenant-scoped data include a `tenant_id` column with a NOT NULL constraint.
- KV keys for tenant config use the pattern `tenant:{tenant_id}` to prevent namespace collisions.
- R2 bucket paths are prefixed with `{tenant_id}/` for all tenant assets.
- No shared in-memory state between tenant requests (Cloudflare Workers are stateless by design).

---

## 8. Transport Security

- All traffic served over HTTPS only. Cloudflare handles TLS termination.
- CORS: `ALLOWED_ORIGINS` must be explicitly set. No wildcard `*` in production.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on all responses.

---

## 9. Dependency Security

- Dependabot is enabled and triaged weekly.
- No `file:` or `github:` references in production `package.json` (enforced by CI).
- `npm audit` runs in CI. High/critical vulnerabilities block merge.

---

## 10. Incident Response

- Any suspected cross-tenant data exposure: **immediately report to security@webwaka.com and isolate the affected tenant**.
- Any secret exposure: rotate immediately, audit access logs, notify Founder.
- Rollback procedure: revert merge commit on `main`, CI redeploys previous version.

---

## Enforcement

These rules are enforced by:
- PR template checklist
- CI checks (TypeScript, tests, audit)
- Code review (CODEOWNERS)
- Base44 Super Agent governance review at each milestone
