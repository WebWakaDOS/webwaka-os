# WebWaka OS — Architecture Overview

> For detailed architecture decisions, see `docs/architecture/decisions/`.

## 3-in-1 Pillar Architecture

WebWaka's product surface is organized around three primary pillars and a cross-cutting AI layer. Every app, package, and vertical belongs to one or more pillars. All new modules must declare their primary pillar.

| Pillar | Description | Primary Apps | Primary Packages |
|--------|-------------|-------------|-----------------|
| **Pillar 1 — Operations-Management (POS)** | Transaction, inventory, reporting, back-office workflows | `apps/api` (pos, payments, workspaces routes), `apps/ussd-gateway`, `apps/platform-admin`, `apps/partner-admin` | `packages/pos`, `packages/offerings`, `packages/workspaces`, `packages/payments` |
| **Pillar 2 — Branding / Website / Portal** | Branded digital presence, single-vendor store, service portal | `apps/brand-runtime` | `packages/white-label-theming`, `packages/design-system`, `packages/frontend` |
| **Pillar 3 — Listing / Multi-Vendor Marketplace** | Public discovery, claim-first onboarding, geography-driven search | `apps/public-discovery`, `apps/tenant-public` | `packages/profiles`, `packages/search-indexing`, `packages/claims`, `packages/geography`, `packages/verticals` |
| **Cross-cutting — AI / SuperAgent** | Intelligence layer serving all three pillars (NOT a fourth pillar) | — | `packages/ai-abstraction`, `packages/ai-adapters`, `packages/superagent` |
| **Pre-vertical Infrastructure** | Shared foundation for all pillars | `apps/api` (shared routes) | `packages/auth`, `packages/auth-tenancy`, `packages/entities`, `packages/entitlements`, `packages/identity`, `packages/community`, `packages/social`, `packages/otp`, `packages/contact` |

**Pillar declaration rule:** All new packages must include `[Pillar N]`, `[AI]`, or `[Infra]` as the first word in their `package.json` `"description"` field. All new verticals must declare `primary_pillars` in their `VerticalRegistration`.

See `docs/governance/3in1-platform-architecture.md` for the complete pillar reference.

---

## Platform Model

WebWaka OS is a **multi-tenant, multi-vertical, white-label platform** where:
- A **Platform Operator** (WebWaka) manages the overall system
- **Partners** subscribe and operate branded instances
- **Sub-partners** can be delegated under partners
- **Tenants** own their data and configuration within their subscription scope
- **End users** interact through tenant-branded interfaces

## Runtime Stack

```
Edge (Cloudflare Workers)
  └── Hono (HTTP routing + middleware)
       ├── Auth + Tenancy middleware (@webwaka/core)
       ├── RBAC middleware (@webwaka/core)
       └── Module handlers

Storage
  ├── D1 — relational data (per-env: one staging, one production)
  ├── KV — tenant config, sessions, rate limits
  └── R2 — documents, assets (when needed)
```

## Monorepo Layout

```
apps/
  api/                  — Cloudflare Workers API entry point
  platform-admin/       — Super admin dashboard
  partner-admin/        — Partner/tenant management portal
  public-discovery/     — Public search and discovery frontend
  brand-runtime/        — Tenant-branded website/storefront runtime

packages/
  entities/             — Canonical root entity definitions
  relationships/        — Cross-entity graph rules
  entitlements/         — Subscription, features, limits, rights
  geography/            — Place hierarchy, ancestry, aggregation
  politics/             — Political office and territory model
  profiles/             — Discovery records and claim surfaces
  workspaces/           — Operations layer management context
  offerings/            — Products/services/routes/tickets/etc.
  auth-tenancy/         — Identity, tenant scope, access control
  ai-abstraction/       — Provider-neutral AI routing + BYOK
  offline-sync/         — Sync queue, PWA helpers, conflict model
  search-indexing/      — Facets, indexing, aggregation
  design-system/        — Shared UI patterns and tokens
  white-label-theming/  — Branding rules, theming, templates
  shared-config/        — Shared settings and environment helpers
```

## Key Design Rules

1. **Packages first** — no vertical feature code before the shared packages that support it are built
2. **Tenant isolation everywhere** — every DB query is scoped by `tenant_id`
3. **Subscription-aware** — all feature access checked against entitlements
4. **Geography-driven** — discovery, inventory, and aggregation flow through the geography hierarchy
5. **Offline-safe** — writes are queued when offline and synced on reconnect
6. **No vendor lock-in** — AI providers are swapped via the abstraction layer

## Deployment Model

- **Staging:** GitHub Actions → Cloudflare Workers (staging environment)
- **Production:** Manual promotion after staging signoff
- **DB:** Shared staging D1 + shared production D1 (no per-repo sprawl)

## Further Reading

- `docs/governance/` — non-negotiable platform rules
- `docs/architecture/decisions/` — Technical Decision Records
- `docs/product/` — product specifications
