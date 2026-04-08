# TDR-0007: Cloudflare D1 Environment Model (Shared Staging + Shared Production)

**Status:** APPROVED
**Approval owner:** Founder
**Author:** Base44 Super Agent (validated)
**Date:** 2026-04-07
**Supersedes:** —
**Superseded by:** —

---

## Context

WebWaka OS is a monorepo with multiple apps and packages that share a common data model. A decision is needed on how D1 databases are structured across environments.

Options considered:
1. One D1 database per app per environment (many databases)
2. One shared database per environment (one staging, one production)
3. One database per tenant (many databases at runtime)

---

## Decision

**Use two D1 databases as the baseline:**
- **One shared staging database** (`webwaka-os-staging`) — used by all apps in the staging environment
- **One shared production database** (`webwaka-os-production`) — used by all apps in the production environment

Tenant isolation is achieved through **row-level scoping** (`tenant_id` column on all tenant-scoped tables), NOT through database-per-tenant.

---

## Consequences

### Positive
- Avoids D1 database sprawl (Cloudflare has limits on D1 databases per account)
- Simplifies migration management — one migration set, two environments
- Consistent with the existing WebWaka repo patterns (confirmed across all 14 active repos)
- Cross-entity joins work natively (no cross-DB federation needed)
- Easier to reason about data model as the platform evolves

### Negative / Constraints
- All apps share the same DB — a schema migration must be backwards-compatible with all deployed apps simultaneously
- A slow query from one app can affect all apps (D1 has per-account query limits)
- In the long run, high-volume tenants may require migration to dedicated databases — this TDR will be superseded when that threshold is reached

### Mitigations
- Migration deploy order: database migration first, then app deploy
- Blue/green-compatible migrations: additive only in a single release
- Query performance monitored via Cloudflare Analytics
- Tenant isolation enforced by `tenant_id` on every query (see `docs/governance/security-baseline.md`)

---

## Database IDs

| Environment | Name | D1 Database ID |
|---|---|---|
| Staging | webwaka-os-staging | `[TO BE CREATED — Cloudflare setup pending]` |
| Production | webwaka-os-production | `[TO BE CREATED — Cloudflare setup pending]` |

These IDs will be stored in:
- GitHub Actions secrets: `CLOUDFLARE_D1_STAGING_ID`, `CLOUDFLARE_D1_PRODUCTION_ID`
- `infra/cloudflare/environments.md` (non-secret reference doc)

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| One DB per app per env | D1 account limits; migration sprawl; unnecessary for a monorepo |
| One DB per tenant | D1 account limits at scale; complex provisioning for claim-first onboarding |
| External DB (PlanetScale, Supabase) | Contradicts Cloudflare-first architecture (TDR-0002) |

---

> **M7 Cross-Reference 2026-04-08:** Reviewed by Base44 Super Agent — no conflicts with M7 additions. New packages (identity, otp, community, social) and apps/ussd-gateway conform to all decisions in this TDR.
