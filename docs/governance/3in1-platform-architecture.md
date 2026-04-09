# WebWaka OS — 3-in-1 Platform Architecture Reference

**Document type:** Governance — canonical platform architecture reference  
**Status:** Approved — replaces all scattered 3-in-1 references  
**Date:** 2026-04-09  
**Author:** Replit Agent (3-in-1 audit and remediation)  
**Founder approved:** Pending  
**Repo:** https://github.com/WebWakaDOS/webwaka-os

> **This document is the single source of truth for the 3-in-1 platform structure.**  
> All new modules, apps, packages, and verticals must be declared here before implementation begins.  
> Any agent or developer implementing WebWaka features must read this document first.

---

## 1. The 3-in-1 Core

WebWaka is a **single platform** for **any individual or organization**, sold via **reseller partners and sub-partners**, with **white-labeling opportunities**, offering three **primary, interconnected capabilities** that can be subscribed to individually or in any combination:

### Pillar 1 — Operations-Management (POS)

> **"The back office that runs the business."**

The operations layer provides turn-key management tools for any entity:

- **Point-of-Sale (POS)** — transactions, float ledger, agent network, terminal management
- **Order management** — order intake, fulfilment status, delivery tracking
- **Inventory management** — SKU-level stock, reorder alerts, wastage tracking
- **Reporting and analytics** — sales summaries, revenue trends, operational dashboards
- **Staff and scheduling** — team roles, shifts, task assignment
- **Back-office workflows** — document management, approval flows, compliance records
- **USSD operations** — airtime, micro-transactions for feature-phone users

Any entity with a WebWaka subscription gets Pillar 1 as the minimum operational foundation.

---

### Pillar 2 — Branding / Website / Portal

> **"The front of house that faces the world."**

The branding layer provides a dedicated digital presence for any entity:

- **Branded website** — entity-specific domain or subdomain, SEO-ready, mobile-first
- **Single-vendor e-commerce store** — product listings, pricing, checkout, order confirmation
- **Service portal** — appointment booking, inquiry form, quote request
- **Campaign or event site** — time-limited sites for politicians, events, product launches
- **Informational site** — about, services, contact, location, social links
- **White-label capability** — partners and entities can brand the surface as their own

The Pillar 2 runtime is `apps/brand-runtime/`. Each entity with Pillar 2 rights gets a subdomain or custom domain served from this Worker.

---

### Pillar 3 — Listing / Multi-Vendor Marketplace

> **"The public directory where every entity is discoverable."**

The marketplace layer provides discoverable, searchable, geography-aware listings:

- **Seeded directories** — 160+ vertical categories pre-seeded across Nigeria's LGAs, wards, and states
- **Claim-first onboarding** — entities are seeded before signup; owners claim them
- **Multi-vendor marketplace** — markets, wholesale hubs, and sector directories with multiple sellers
- **Geography-powered search** — `GET /lagos/motor-park`, `GET /abuja/restaurant` style discovery
- **Public profile pages** — every entity has a discoverable profile with ratings, offerings, and contact
- **Category browse** — browse by sector (Commerce, Transport, Civic, Health...) and sub-sector
- **White-label directories** — partners can spin up vertical-specific directories

The Pillar 3 runtime is `apps/public-discovery/` (marketplace frontend) and `apps/tenant-public/` (per-tenant discovery page).

---

### Cross-cutting — AI / SuperAgent (NOT a fourth pillar)

> **"The intelligence layer that runs on top of all three pillars."**

WebWaka SuperAgent is **not a product pillar** — it is the cross-cutting intelligence service that enhances every pillar:

- **On Pillar 1 (Ops):** inventory demand forecasting, sales trend summaries, staff scheduling optimization, HITL-gated operational advisories
- **On Pillar 2 (Branding):** product description generation, SEO content, customer communication drafts, campaign copy
- **On Pillar 3 (Marketplace):** directory enrichment, vendor matching, discovery ranking optimization, market insights

All AI features route through `packages/superagent` — never directly to any AI provider. SuperAgent governance rules apply: NDPR consent gate (P10), USSD exclusion (P12), no raw PII to AI (P13), WakaCU billing.

See `docs/governance/superagent/06-governance-rules.md` for binding AI governance rules.

---

## 2. How the Three Pillars Interconnect

```
┌─────────────────────────────────────────────────────────────┐
│                    WebWaka Platform                          │
├─────────────┬─────────────────────┬──────────────────────── ┤
│  Pillar 1   │     Pillar 2        │       Pillar 3          │
│  Operations │     Branding        │  Marketplace/Directory  │
│  (POS)      │  (Brand Runtime)    │  (Public Discovery)     │
├─────────────┼─────────────────────┼─────────────────────────┤
│ Inventory ──┤──→ Product catalog ─┤──→ Listed in directory  │
│ Orders ─────┤──→ Storefront       │                         │
│ Staff ops   │   checkout page    │    Multi-vendor search  │
│ Float ledger│                     │    Geography browse     │
│ USSD ops    │   Booking portal ──┤──→ Profile discovery    │
└─────────────┴─────────────────────┴─────────────────────────┘
                            ↑ ↑ ↑
                    SuperAgent AI layer
                (cross-cutting — serves all 3)
```

**Key integration points:**
1. Pillar 1 inventory data feeds Pillar 2 product catalog and Pillar 3 marketplace listings
2. Pillar 3 discovery drives claim-first onboarding into Pillar 1 workspace activation
3. Pillar 2 brand site links back to Pillar 3 directory profile and Pillar 1 ordering
4. A user can arrive via Pillar 3 (discovery), claim the listing, activate Pillar 1 (ops), and optionally activate Pillar 2 (brand site)

---

## 3. Subscription Combinations

Entities can subscribe to any combination of pillars based on their plan tier:

| Subscription | Pillars Active | Primary Use Case |
|---|---|---|
| **Starter** | Pillar 1 only | Informal SME — digital POS and back-office |
| **Discovery** | Pillar 3 only | Listed in directory, not yet operational |
| **Brand** | Pillar 1 + Pillar 2 | Full business website + POS operations |
| **Full Platform** | Pillar 1 + Pillar 2 + Pillar 3 | Complete digital presence, branded store, and marketplace listing |
| **Partner** | All pillars + white-label rights + sub-tenant allocation | Reseller operating a white-labeled platform |

SuperAgent (AI) capabilities are tier-based within any subscription (Free, Growth, Pro, Business, Enterprise) and available across all pillar combinations.

---

## 4. Module-to-Pillar Assignment (Authoritative)

### Apps

| App | Primary Pillar(s) | Status | Notes |
|-----|-------------------|--------|-------|
| `apps/api/` | Infra (all pillars served via this API) | ✅ Live | Shared API gateway |
| `apps/platform-admin/` | Pillar 1 — Ops | ✅ Live | WebWaka super-admin |
| `apps/partner-admin/` | Pillar 1 — Ops | ✅ Live | Partner/tenant management |
| `apps/admin-dashboard/` | Pillar 1 — Ops | ✅ Live | Admin dashboard |
| `apps/ussd-gateway/` | Pillar 1 — Ops | ✅ Live | USSD micro-transactions |
| `apps/brand-runtime/` | **Pillar 2 — Branding** | ❌ Not implemented | Tenant-branded websites/stores |
| `apps/public-discovery/` | **Pillar 3 — Marketplace** | ❌ Not implemented | Public directory frontend |
| `apps/tenant-public/` | Pillar 3 — Marketplace | ⚠️ Partial | Per-tenant profile listing (discovery-lite) |
| `apps/projections/` | Pillar 1 — Ops | ✅ Live | Data projection workers |

### Packages

| Package | Primary Pillar(s) | Status |
|---------|-------------------|--------|
| `packages/pos/` | [Pillar 1] Operations-Management | ✅ Live |
| `packages/offerings/` | [Pillar 1] Operations-Management | ✅ Live |
| `packages/workspaces/` | [Pillar 1] Operations-Management | ✅ Live |
| `packages/payments/` | [Pillar 1] Operations-Management | ✅ Live |
| `packages/white-label-theming/` | [Pillar 2] Branding | ✅ Scaffolded |
| `packages/design-system/` | [Pillar 2] Branding | ✅ Scaffolded |
| `packages/frontend/` | [Pillar 2] Branding | ✅ Partial |
| `packages/profiles/` | [Pillar 3] Marketplace | ✅ Live |
| `packages/search-indexing/` | [Pillar 3] Marketplace | ✅ Live |
| `packages/claims/` | [Pillar 3] Marketplace | ✅ Live |
| `packages/geography/` | [Pillar 3] Marketplace | ✅ Live |
| `packages/verticals/` | [Pillar 3] Marketplace | ✅ Live (framework) |
| `packages/ai-abstraction/` | [AI] Cross-cutting | ✅ Partial (types only) |
| `packages/ai-adapters/` | [AI] Cross-cutting | 🔲 Planned SA-1.3 |
| `packages/superagent/` | [AI] Cross-cutting | 🔲 Planned SA-1.4+ |
| `packages/auth/` | [Infra] Pre-vertical | ✅ Live |
| `packages/auth-tenancy/` | [Infra] Pre-vertical | ✅ Live |
| `packages/entities/` | [Infra] Pre-vertical | ✅ Live |
| `packages/entitlements/` | [Infra] Pre-vertical | ✅ Live |
| `packages/identity/` | [Infra] Pre-vertical | ✅ Live |
| `packages/otp/` | [Infra] Pre-vertical | ✅ Live |
| `packages/contact/` | [Infra] Pre-vertical | ✅ Live |
| `packages/community/` | [Infra/Pillar 3] Cross-pillar | ✅ Live |
| `packages/social/` | [Infra/Pillar 3] Cross-pillar | ✅ Live |
| `packages/relationships/` | [Infra] Pre-vertical | ✅ Live |
| `packages/politics/` | [Infra] Pre-vertical | ✅ Scaffolded |
| `packages/offline-sync/` | [Infra] Pre-vertical | ✅ Live |
| `packages/shared-config/` | [Infra] Pre-vertical | ✅ Live |

---

## 5. Vertical Pillar Classification

Every vertical serves **all three pillars** in some combination. The `primary_pillars` field in the `verticals` table declares the pillar combination for each vertical.

### Classification Rules

```
ALL verticals → "ops" (minimum — every vertical has a workspace and operational flows)

Add "marketplace" when:
  - The vertical benefits from being discoverable in a public directory
  - Citizens/customers find this entity type by searching (most verticals)

Add "branding" when:
  - The vertical benefits from a dedicated branded website or portal
  - Customers would visit a standalone website for this entity
  - The entity sells products or services that benefit from a storefront
```

### P1-Original Verticals — Pillar Classification

| Slug | Display Name | Primary Pillars | Rationale |
|------|--------------|-----------------|-----------|
| `politician` | Individual Politician | ops, marketplace, branding | Campaign site + public profile |
| `political-party` | Political Party | ops, marketplace, branding | Party website + member directory |
| `motor-park` | Motor Park / Bus Terminal | ops, marketplace | Operational park + transport directory |
| `mass-transit` | City Bus / Mass Transit | ops, marketplace | Route operations + transit directory |
| `rideshare` | Carpooling / Ride-Hailing | ops, marketplace, branding | Driver app ops + branded service + directory |
| `haulage` | Haulage / Logistics | ops, marketplace, branding | Fleet ops + logistics directory + branded |
| `church` | Church / Faith Community | ops, marketplace, branding | Community ops + church directory + website |
| `ngo` | NGO / Non-Profit | ops, marketplace, branding | Program ops + NGO directory + donor site |
| `cooperative` | Cooperative Society | ops, marketplace | Member ops + cooperative directory |
| `pos-business` | POS Business Management | ops, branding | POS ops + branded store (internal focus) |
| `market` | Market / Trading Hub | ops, marketplace | Multi-vendor marketplace + ops |
| `professional` | Professional (Lawyer/Doctor) | ops, marketplace, branding | Practice ops + professional directory + profile site |
| `school` | School / Educational Inst. | ops, marketplace, branding | School ops + education directory + school site |
| `clinic` | Clinic / Healthcare Facility | ops, marketplace, branding | Clinic ops + health directory + booking site |
| `creator` | Creator / Influencer | ops, marketplace, branding | Monetization ops + creator directory + branded site |
| `sole-trader` | Sole Trader / Artisan | ops, branding | Artisan ops + branded catalogue/site |
| `tech-hub` | Tech Hub / Innovation Centre | ops, marketplace, branding | Hub ops + tech directory + hub site |

---

## 6. Implementation Gaps (as of 2026-04-09)

| Item | Gap | Remediation | Phase |
|------|-----|-------------|-------|
| `apps/brand-runtime/` | Empty — no implementation | Implement Pillar 2 MVP (PV-1.1) | Phase 2 |
| `apps/public-discovery/` | Empty — no implementation | Implement Pillar 3 MVP (PV-1.2) | Phase 2 |
| `verticals` table | No `primary_pillars` column | Migration 0046 + seed update (PV-0.2) | Phase 1 |
| Execution prompt docs | No pillar labels on task blocks | PV-0.5 — update all 7 docs | Phase 1 |
| `packages/white-label-theming/` | Not wired to any surface app | PV-1.3 — wire to brand-runtime | Phase 2 |
| AI governance docs | No 3-in-1 position statement | DOC-6 — add header to each | Phase 1 |
| `package.json` descriptions | No `[Pillar N]` prefix | CODE-4 — update all descriptions | Phase 1 |

See `docs/governance/webwaka_3in1_remediation_plan.md` for full remediation details.

---

## 7. Governance Rules

1. **No new app or package** may be created without declaring its primary pillar in this document AND in the `package.json` description field.
2. **No new vertical** may be implemented without `primary_pillars` declared in the `verticals` table and `VerticalRegistration` type.
3. **SuperAgent AI** features must always be exposed through a pillar's UI surface — never as a standalone AI product page.
4. **Pillar 2 (brand-runtime)** and **Pillar 3 (public-discovery)** must have implemented apps before M9 begins — they are a gate condition for M9 vertical scaling.
5. **PRs** must be labeled with the correct `3in1:*` GitHub label before merging.
6. **Cross-pillar modules** (community, social) belong in `[Infra/Pillar 3]` — they are infrastructure that enhances Pillar 3 marketplace engagement.

---

## 8. PR Checklist (required for all PRs)

Add to `CONTRIBUTING.md` and the PR template:

```markdown
## 3-in-1 Pillar Alignment

- [ ] PR labeled with correct `3in1:*` label(s)
- [ ] New package: `[Pillar N]` prefix in `package.json` description
- [ ] New vertical: `primary_pillars` field populated in seed and VerticalRegistration
- [ ] New app: pillar assignment added to ARCHITECTURE.md and this document
- [ ] AI features: attached to a pillar's UI surface (not standalone)
```

---

*Last updated: 2026-04-09*  
*Authority: This document governs all architectural decisions regarding platform pillar structure.*  
*Companion documents: `docs/governance/webwaka_3in1_core_audit_summary.md`, `docs/governance/webwaka_3in1_remediation_plan.md`*
