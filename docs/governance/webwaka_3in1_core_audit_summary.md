# WebWaka 3-in-1 Core — Audit Summary

**Document type:** Product architecture audit  
**Scope:** Full codebase + documentation cross-repository review  
**Auditor:** Senior WebWaka Product Architect and Systems Auditor  
**Date:** 2026-04-09  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Companion:** `docs/governance/webwaka_3in1_remediation_plan.md`

---

## The 3-in-1 Core (Canonical Definition)

The agreed central core of WebWaka is:

> WebWaka is a **single platform** for **any individual or organization**, sold via **reseller partners and sub-partners**, with **white-labeling opportunities**, offering three **primary, interconnected capabilities**:
>
> 1. **Operations-Management (POS)** — transaction, order, inventory, reporting, back-office
> 2. **Branding / website / portal** — branded digital presence, single-vendor e-commerce, service portal
> 3. **Listing / multi-vendor marketplace** — listing engine, claim-first onboarding, multi-tenant discovery
>
> **SuperAgent (AI layer)** is NOT a fourth primary capability — it is the **cross-cutting intelligence layer** running on top of all three.

---

## 1. Current State

### 1.1 Is the 3-in-1 core still the central organizing principle?

**Verdict: Partially.** The 3-in-1 model is acknowledged in the vision document but is not consistently or operationally reflected across architecture, code structure, schema, verticals taxonomy, execution planning, or milestone allocation. Its presence in one document is insufficient to make it the guiding architecture when the remaining 60+ documents and all active planning milestones do not reference it by name or structure.

---

### 1.2 Module mapping by pillar

The table below classifies every major module in the repo against the three pillars. Where a module spans multiple pillars it is listed under its primary contribution.

#### Pillar 1 — Operations-Management (POS / Ops)

| Module | Location | Status | Notes |
|--------|----------|--------|-------|
| POS routes | `apps/api/src/routes/pos.ts` | ✅ Implemented | POS agent transactions, float ledger |
| Payments | `apps/api/src/routes/payments.ts` | ✅ Implemented | Subscription billing, Paystack webhook |
| Workspaces | `apps/api/src/routes/workspaces.ts` | ✅ Implemented | Tenant management context |
| Offerings | `packages/offerings/` | ✅ Implemented | Products, services, routes, seats, appointments |
| POS package | `packages/pos/` | ✅ Implemented | Float ledger, agent network, terminals |
| USSD Gateway | `apps/ussd-gateway/` | ✅ Implemented | USSD transaction flows |
| Workspaces package | `packages/workspaces/` | ✅ Implemented | Operations layer |
| Commerce verticals (planned) | `packages/verticals-pos-business/` etc. | 🔲 Planned M8b+ | POS Business, restaurant, supermarket, retail |
| Airtime / VTU | `apps/api/src/routes/airtime.ts` | ✅ Implemented | Agent airtime reselling |
| Admin dashboard | `apps/platform-admin/`, `apps/admin-dashboard/` | ✅ Implemented | Platform ops management |
| Partner admin | `apps/partner-admin/` | ✅ Implemented | Partner ops management |

**Pillar 1 health: GOOD** — The Operations-Management pillar has the strongest implementation coverage. The core POS engine, payment flows, and agent network are all live. Planned verticals extend this pillar correctly.

---

#### Pillar 2 — Branding / Website / Portal

| Module | Location | Status | Notes |
|--------|----------|--------|-------|
| Brand Runtime app | `apps/brand-runtime/` | ❌ EMPTY | `.gitkeep` only — no source files |
| Tenant Public app | `apps/tenant-public/src/index.ts` | ⚠️ Partial | Renders discovery profiles under tenant slug — not a branded website/storefront builder |
| White-label theming | `packages/white-label-theming/` | 🔲 Scaffolded | Package exists; no confirmed source implementation |
| Design system | `packages/design-system/` | 🔲 Scaffolded | Token library; no branding surface wired to it |
| Frontend composition | `packages/frontend/` | ✅ Partial | i18n, USSD shortcodes, tenant manifest rendering — not a full branded experience |
| Brand Surface entity | `docs/governance/universal-entity-model.md` | ✅ Documented | "Brand Surfaces" defined as a root entity type (websites, stores, portals, booking pages) |
| Branded e-commerce | — | ❌ Not implemented | Single-vendor e-commerce store capability does not exist |
| Website builder | — | ❌ Not implemented | No page-builder or site-generator for tenant branded sites |
| Service portal | — | ❌ Not implemented | No branded appointment / booking portal UI |

**Pillar 2 health: CRITICAL GAP** — The Brand Runtime app (`apps/brand-runtime/`) is an empty directory. The entity model documents Brand Surfaces as a root entity type, and `apps/tenant-public/` provides a minimal discovery profile page per tenant, but there is no implemented branded storefront, website builder, or service portal. This pillar is documented but not built.

---

#### Pillar 3 — Listing / Multi-Vendor Marketplace

| Module | Location | Status | Notes |
|--------|----------|--------|-------|
| Public Discovery app | `apps/public-discovery/` | ❌ EMPTY | `.gitkeep` only — no source files |
| Discovery routes | `apps/api/src/routes/discovery.ts` | ✅ Implemented | Public profile and entity search API (M4) |
| Profiles package | `packages/profiles/` | ✅ Implemented | Discovery records for Individuals, Orgs, Places |
| Search indexing | `packages/search-indexing/` | ✅ Implemented | Faceted search, indexing, aggregation |
| Claims workflow | `packages/claims/` | ✅ Implemented | Claim lifecycle FSM, verification |
| Geography | `packages/geography/` | ✅ Implemented | Place hierarchy, ward/LGA/state aggregation |
| Verticals registry | `packages/verticals/`, migration 0036 | ✅ Implemented | 160 verticals seeded, FSM engine |
| Claim-first onboarding | `docs/governance/claim-first-onboarding.md` | ✅ Documented | Growth pattern for seeded directories |
| Multi-vendor UI | — | ❌ Not implemented | No frontend for vendor-side discovery dashboard |
| Marketplace cart | — | ❌ Not implemented | No multi-vendor cart or product listing UI |
| Directory frontend | — | ❌ Not implemented | `apps/public-discovery/` is empty |

**Pillar 3 health: BACKEND STRONG, FRONTEND MISSING** — The discovery API, profiles, search, geography, and claim workflow are fully implemented on the backend. However, the `apps/public-discovery/` frontend app (which should be the public-facing marketplace/directory) is an empty directory. Users cannot browse the marketplace without a frontend.

---

#### Cross-cutting — AI / SuperAgent (NOT a core pillar)

| Module | Location | Status | Notes |
|--------|----------|--------|-------|
| AI abstraction types | `packages/ai-abstraction/src/types.ts` | ✅ Implemented | Provider-neutral type contracts (M3) |
| AI policy | `docs/governance/ai-policy.md` | ✅ Documented | M1 governance baseline |
| TDR-0009 | `docs/architecture/decisions/0009-ai-provider-abstraction.md` | ✅ Accepted | AI provider abstraction decision |
| AI rights entitlement | `packages/entitlements/` | ✅ Implemented | `aiRights` gate in plan-config |
| AI Platform Master Plan | `docs/governance/ai-platform-master-plan.md` | ✅ Documented | 6,000+ word planning doc |
| SuperAgent synthesis | `docs/governance/superagent/01-synthesis-report.md` | ✅ Documented | Phase 0 audit output |
| SuperAgent product spec | `docs/governance/superagent/02-product-spec.md` | ✅ Documented | Full product specification |
| SuperAgent system architecture | `docs/governance/superagent/03-system-architecture.md` | ✅ Documented | Type contracts, routing engine |
| SuperAgent execution roadmap | `docs/governance/superagent/04-execution-roadmap.md` | ✅ Documented | SA-1.1 through SA-2.0 |
| SuperAgent governance rules | `docs/governance/superagent/06-governance-rules.md` | ✅ Documented | Binding rules for all agents |
| AI Architecture Decision Log | `docs/governance/ai-architecture-decision-log.md` | ✅ Documented | ADL-001 through ADL-010 |
| AI capability matrix | `docs/governance/ai-capability-matrix.md` | ✅ Documented | Per-tier capabilities |
| AI integration framework | `docs/governance/ai-integration-framework.md` | ✅ Documented | Per-vertical AI patterns |
| SA Phase 1–2 implementation | `packages/ai-adapters/`, `packages/superagent/` | 🔲 Planned SA-1.x | Not yet implemented |

**AI/SuperAgent health: Documented as cross-cutting (correct), but planning-dominant (risk).**

---

#### Pre-vertical Infrastructure (platform foundation — no pillar)

| Module | Location | Status |
|--------|----------|--------|
| Auth + tenancy | `packages/auth/`, `packages/auth-tenancy/` | ✅ Implemented |
| Entities | `packages/entities/` | ✅ Implemented |
| Relationships | `packages/relationships/` | ✅ Implemented |
| Entitlements | `packages/entitlements/` | ✅ Implemented |
| Identity (KYC, BVN, NIN, CAC, FRSC) | `packages/identity/` | ✅ Implemented |
| OTP / contact channels | `packages/otp/`, `packages/contact/` | ✅ Implemented |
| Community | `packages/community/` | ✅ Implemented (M7c) |
| Social | `packages/social/` | ✅ Implemented (M7d) |
| Offline sync | `packages/offline-sync/` | ✅ Implemented |
| Migrations 0001–0035 | `infra/db/migrations/` | ✅ Implemented |
| GitHub CI/CD | `.github/workflows/` | ✅ Implemented |

---

### 1.3 Summary count by pillar

| Pillar | Implemented modules | Planned/Scaffolded | Critical gaps |
|--------|--------------------|--------------------|---------------|
| Pillar 1 — Operations-Management | 9 | 160 planned verticals | None at platform level |
| Pillar 2 — Branding / Portal | 1 (partial) | 0 | Brand Runtime app, branded storefront, website builder |
| Pillar 3 — Listing / Marketplace | 6 (backend) | 0 | Public Discovery frontend, marketplace UI |
| Cross-cutting — AI/SuperAgent | 2 (types + policy) | 14 planned SA tasks | Implementation not yet started |
| Pre-vertical infra | 14+ | — | None |

---

## 2. Observed Drift

### 2.1 Architectural Drift

#### DRIFT-A1: Vision document defines 3-in-1 with different names and different ordering
**File:** `docs/governance/vision-and-mission.md`  
**Section:** Mission > "3-in-1 platform model"

The vision document defines the three pillars as:
1. "Discovery and public visibility" (= Marketplace/Listing — Pillar 3 in canonical)
2. "Operational management and workflows" (= Operations-Management — Pillar 1 in canonical)
3. "Dedicated branded digital experience" (= Branding/Portal — Pillar 2 in canonical)

The canonical 3-in-1 spec numbers them 1=Ops, 2=Branding, 3=Marketplace. The vision document orders them differently and uses different names. This creates inconsistency when any agent, document author, or developer reads the vision to understand the pillars.

---

#### DRIFT-A2: ARCHITECTURE.md does not reference the 3-in-1 structure at all
**File:** `ARCHITECTURE.md`  
**Section:** Entire document

The monorepo layout describes every app and package but does not label any component as belonging to Pillar 1, Pillar 2, or Pillar 3. A developer reading the architecture document has no guidance on which apps or packages serve which pillar. This omission means the 3-in-1 structure cannot be enforced through code review or architecture review.

---

#### DRIFT-A3: `apps/brand-runtime/` is empty — Pillar 2 has no implementation
**File:** `apps/brand-runtime/.gitkeep`

The Brand Runtime app — which should be the primary delivery vehicle for Pillar 2 (Branding / website / portal) — contains only a `.gitkeep` file. No source, no router, no template engine, no branded storefront. The `universal-entity-model.md` defines Brand Surfaces as a root entity type and the vision lists "Dedicated branded digital experience" as a core pillar, but there is no code that delivers it. Pillar 2 exists only in documentation.

---

#### DRIFT-A4: `apps/public-discovery/` is empty — Pillar 3 frontend has no implementation
**File:** `apps/public-discovery/.gitkeep`

The Public Discovery app — the intended public-facing marketplace / directory frontend for Pillar 3 — contains only a `.gitkeep` file. The backend (discovery routes, profiles, search-indexing, claims) is well-implemented, but there is no user-facing frontend for the marketplace. `apps/tenant-public/` provides a basic per-tenant profile list, which is discovery-lite, not a full marketplace.

---

#### DRIFT-A5: Verticals schema and seed have no 3-in-1 pillar column
**Files:**  
- `infra/db/migrations/0036_verticals_table.sql`  
- `infra/db/seeds/0004_verticals-master.csv`

The verticals table has columns for `category`, `subcategory`, `priority`, `entity_type`, `requires_community`, `requires_social`, etc., but no `pillar` or `primary_capability` column. The seed CSV organizes 160 verticals by sector (Commerce, Transport, Civic...) but does not classify each vertical as primarily serving Pillar 1 (Ops), Pillar 2 (Branding), or Pillar 3 (Marketplace). This means vertical implementations have no canonical guidance on which pillar interface to build toward.

---

#### DRIFT-A6: Community and Social packages have no pillar assignment
**Files:**  
- `packages/community/` (migrations 0026–0030, Skool-style features)  
- `packages/social/` (migrations 0031–0034, social network features)

These are significant M7 additions. Community spaces, channels, courses, events, and social posts/groups/DMs are implemented but not classified under any 3-in-1 pillar in any document. They could be part of Pillar 3 (Marketplace community layer) or cross-cutting infrastructure — but this is undocumented, leaving implementers without pillar context.

---

### 2.2 Planning Drift

#### DRIFT-P1: SuperAgent planning corpus is volumetrically dominant — de-facto fourth-pillar appearance
**Files:**
- `docs/governance/superagent/01-synthesis-report.md`
- `docs/governance/superagent/02-product-spec.md`
- `docs/governance/superagent/03-system-architecture.md`
- `docs/governance/superagent/04-execution-roadmap.md`
- `docs/governance/superagent/05-document-update-plan.md`
- `docs/governance/superagent/06-governance-rules.md`
- `docs/governance/ai-platform-master-plan.md`
- `docs/governance/ai-architecture-decision-log.md` (ADL-001–010)
- `docs/governance/ai-billing-and-entitlements.md`
- `docs/governance/ai-capability-matrix.md`
- `docs/governance/ai-context-map.md`
- `docs/governance/ai-integration-framework.md`
- `docs/governance/ai-provider-routing.md`
- `docs/governance/ai-repo-wiring.md`
- `docs/governance/ai-agent-autonomy.md`
- `docs/governance/ai-policy.md`
- `docs/execution-prompts/webwaka_preverticals_execution_prompts.md` (10 SA tasks, 0 3-in-1 alignment tasks)

While every AI document correctly states that SuperAgent is the cross-cutting intelligence layer and not a primary product pillar, the cumulative planning weight of 16+ dedicated AI/SuperAgent governance documents vastly outweighs the planning depth for Pillar 2 (Branding) and Pillar 3 (Marketplace). There are zero dedicated planning documents for brand-runtime or public-discovery development. Any agent or developer reading recent planning artifacts will conclude — incorrectly — that AI is the next primary build priority, not completing the two empty platform pillars.

**Evidence of imbalance:**
- SuperAgent: 6 dedicated governance docs + 10 ADL entries + 14 planned packages + 15 planned migrations
- Pillar 2 (Branding): 1 paragraph in vision-and-mission.md, 1 empty app directory
- Pillar 3 (Marketplace frontend): 1 paragraph in vision-and-mission.md, 1 empty app directory

---

#### DRIFT-P2: Pre-verticals execution prompts contain only SuperAgent tasks — no 3-in-1 alignment task
**File:** `docs/execution-prompts/webwaka_preverticals_execution_prompts.md`

The 10 pre-vertical implementation tasks (SA-1.1 through SA-2.0) are all SuperAgent infrastructure:
- SA-1.1: AI provider union type expansion
- SA-1.2: Routing engine
- SA-1.3: Provider adapters
- SA-1.4: SuperAgent key issuance
- SA-1.5: WakaCU wallets
- SA-1.6: Partner credit pools
- SA-1.7 through SA-2.0: API routes, admin controls, metering, analytics

There is no task in the pre-verticals list for:
- Tagging verticals with 3-in-1 pillar
- Implementing brand-runtime
- Implementing public-discovery frontend
- Documenting Community and Social pillar assignment

This directly contradicts the audit prompt's statement that "there was a pre-verticals task planned to explicitly tag and structure all modules under the 3-in-1 core."

---

#### DRIFT-P3: Verticals-master-plan.md and all 7 execution prompt documents organize by sector, not by pillar
**Files:**
- `docs/governance/verticals-master-plan.md`
- All 7 files in `docs/execution-prompts/`

All 160 verticals and all 7 execution prompt documents organize verticals by sector category (Commerce, Transport, Civic, Health, etc.). None of these documents states which 3-in-1 pillar each vertical primarily serves, which makes it impossible for an implementer to know:
- Should a given vertical's API routes be mounted under an Ops context, a Branding context, or a Marketplace context?
- Should the vertical's frontend surface be a brand site (Pillar 2) or a marketplace listing (Pillar 3)?
- Which UI shell app should a vertical's customer-facing screens live in?

---

#### DRIFT-P4: Milestone plan does not schedule Pillar 2 or Pillar 3 frontend development
**File:** `docs/governance/milestone-tracker.md`, `docs/milestones/m8a-framework.md`

Scanning milestones M8a through M12, there is no milestone that targets:
- Building `apps/brand-runtime/` into a functioning branded storefront
- Building `apps/public-discovery/` into a functioning marketplace frontend

Both frontend apps appear on the milestone tracker with `.gitkeep` and no planned implementation. Meanwhile SA-1.x through SA-2.0 are explicitly scheduled for implementation immediately after M8a.

---

## 3. Overall Assessment

**Verdict: PARTIAL DRIFT**

> The 3-in-1 core is documented in the vision but is not the governing architecture of the current build plan. Pillar 1 (Operations-Management) is well-implemented. Pillar 2 (Branding) and Pillar 3 (Marketplace frontend) are empty at the application layer and are not on any implementation milestone. The SuperAgent/AI planning corpus dominates recent documentation and planning, creating a de-facto fourth-pillar perception that — while not intentional — is not corrected by the current documentation weight. The pre-verticals 3-in-1 alignment task that was planned has not been implemented. No code path, schema column, or execution prompt document applies 3-in-1 pillar tags to verticals, packages, or apps.

Specific items requiring remediation:
1. Pillar 2 (Branding) has no implementation — `apps/brand-runtime/` is empty
2. Pillar 3 (Marketplace frontend) has no implementation — `apps/public-discovery/` is empty
3. ARCHITECTURE.md does not reference the 3-in-1 structure
4. vision-and-mission.md uses different pillar names and ordering from the canonical spec
5. Verticals schema and seed have no pillar column
6. Community and Social packages have no pillar assignment
7. SuperAgent planning documentation is volumetrically dominant — requires explicit cross-cutting labeling
8. Pre-verticals execution prompts have no 3-in-1 alignment task
9. No GitHub labels for 3-in-1 pillars
10. No execution prompt document tags verticals or packages by pillar

---

*Auditor: Replit Agent — Senior WebWaka Product Architect*  
*Date: 2026-04-09*  
*Evidence base: Full review of 60+ governance docs, all migration files, all app and package source files, all execution prompt documents, seed CSV, and milestone tracker*
