# WebWaka 3-in-1 Core — Remediation and Alignment Plan

**Document type:** Remediation plan  
**Companion:** `docs/governance/webwaka_3in1_core_audit_summary.md`  
**Auditor:** Senior WebWaka Product Architect and Systems Auditor  
**Date:** 2026-04-09  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  

---

## How to Read This Plan

Items are organized into three lists:
1. **Documentation remediations** — docs, roadmaps, RFCs, governance files
2. **Code and structural remediations** — folder structure, schema, packages, apps
3. **Pre-verticals remediations** — the previously-planned 3-in-1 tagging and alignment tasks

Within each list, items are ordered by **Phase**:
- **Phase 0** — Must be done immediately; blocks correct interpretation of all other work
- **Phase 1** — Must be done before SuperAgent deep-integration begins (i.e., before SA-1.1)
- **Phase 2** — Must be done alongside M8b–M8e vertical implementations
- **Phase 3** — Must be done before M9 (first major P2 vertical wave)

---

## LIST 1: Documentation Remediations

---

### DOC-1: Align vision-and-mission.md pillar names and order with canonical 3-in-1 spec

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/vision-and-mission.md — Mission section, "3-in-1 platform model"
- **Why:** The vision document defines the three pillars using different names and a different ordering from the agreed canonical spec. It says "1. Discovery and public visibility / 2. Operational management / 3. Dedicated branded digital experience" — the canonical order is 1. Operations-Management, 2. Branding, 3. Listing/Marketplace. Any agent or developer who reads the vision uses it as a reference, and the inconsistency propagates naming drift.
- **Action:**
  1. Update the Mission section to use the exact canonical pillar names and ordering:
     - Pillar 1: **Operations-Management** (POS, transaction, inventory, reporting, back-office)
     - Pillar 2: **Branding / Website / Portal** (branded digital presence, single-vendor store, service portal)
     - Pillar 3: **Listing / Multi-Vendor Marketplace** (discovery, claim-first onboarding, multi-tenant directory)
  2. Add a note: "SuperAgent (AI) is the cross-cutting intelligence layer — not a fourth pillar."
  3. Keep existing wording for mission context but ensure pillar names and numbers match the canonical spec exactly.
- **Priority:** Phase 0 — blocks correct reading of all downstream docs

---

### DOC-2: Add 3-in-1 pillar map to ARCHITECTURE.md

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/ARCHITECTURE.md
- **Why:** ARCHITECTURE.md describes every app and package but does not label any as belonging to a pillar. A developer or agent reading the architecture has no guidance on which apps or packages serve which pillar. Platform Invariant P2 (build once) cannot be enforced without clear pillar boundaries.
- **Action:**
  1. Add a new top-level section: `## 3-in-1 Pillar Architecture` immediately after `## Platform Model`
  2. Content of the section:
     ```markdown
     ## 3-in-1 Pillar Architecture

     WebWaka's product surface is organized around three primary pillars plus a cross-cutting AI layer.

     | Pillar | Primary Apps | Primary Packages |
     |--------|-------------|-----------------|
     | Pillar 1 — Operations-Management (POS) | `apps/api` (POS, payments, workspaces routes), `apps/ussd-gateway`, `apps/platform-admin`, `apps/partner-admin` | `packages/pos`, `packages/offerings`, `packages/workspaces`, `packages/payments` |
     | Pillar 2 — Branding / Website / Portal | `apps/brand-runtime` | `packages/white-label-theming`, `packages/design-system`, `packages/frontend` |
     | Pillar 3 — Listing / Multi-Vendor Marketplace | `apps/public-discovery`, `apps/tenant-public` | `packages/profiles`, `packages/search-indexing`, `packages/claims`, `packages/geography`, `packages/verticals` |
     | Cross-cutting — AI / SuperAgent | — (all pillars route through this) | `packages/ai-abstraction`, `packages/ai-adapters`, `packages/superagent` |
     | Pre-vertical Infrastructure | `apps/api` (shared routes) | `packages/auth`, `packages/entities`, `packages/entitlements`, `packages/identity`, `packages/community`, `packages/social` |
     ```
  3. Add a sentence: "All new modules and verticals must declare their primary pillar in their package.json `description` field using the prefix `[Pillar 1]`, `[Pillar 2]`, `[Pillar 3]`, `[AI]`, or `[Infra]`."
- **Priority:** Phase 0

---

### DOC-3: Add 3-in-1 pillar cross-reference to verticals-master-plan.md

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
- **Why:** The verticals-master-plan organizes 160 verticals by sector category only. Implementers cannot determine which pillar a vertical primarily serves — operations, branding, or marketplace — which is essential for knowing which UI shell, which schema extension pattern, and which API context to use.
- **Action:**
  1. Add a new section: `## 3-in-1 Pillar Classification for Verticals`
  2. Explain the mapping rule:
     - A vertical **always** contributes to Pillar 1 (Ops) — every vertical has a workspace and operational flows.
     - A vertical's **primary customer-facing surface** determines its Pillar 2 / Pillar 3 classification:
       - Verticals whose primary public face is a **branded business site or booking portal** → Pillar 2 primary
       - Verticals whose primary public face is a **listing in a discoverable directory** → Pillar 3 primary
       - Verticals that serve both → tagged as Pillar 2+3
  3. Add a classification column to the Category Breakdown table: `| Primary Pillar(s) |`
  4. Example entries:
     - POS Business → Pillar 1 (Ops) + Pillar 2 (branded store)
     - Politician → Pillar 3 (discovery/directory) + Pillar 2 (campaign portal)
     - Motor Park → Pillar 3 (discovery) + Pillar 1 (Ops)
     - Market → Pillar 3 (multi-vendor marketplace) + Pillar 1 (Ops)
     - Creator → Pillar 2 (branded profile) + Pillar 3 (discovery)
- **Priority:** Phase 1

---

### DOC-4: Add pillar cross-reference label to all 7 existing execution prompt documents

- **Location:**
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_pos_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_government_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_logistics_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_education_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_creator_professional_financial_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_agricultural_place_execution_prompts.md
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_preverticals_execution_prompts.md
- **Why:** Every task block in the execution prompts describes implementation but does not tell the implementing agent which 3-in-1 pillar(s) the vertical primarily serves. This means an agent implementing, say, the `market` vertical has no guidance on whether to build toward the branded storefront shell (Pillar 2) or the public discovery/marketplace shell (Pillar 3).
- **Action:** For each task block in every execution prompt document:
  1. Add a `**Primary pillar(s):**` line to the task block header, immediately after `**Milestone target:**`
  2. Format: `**Primary pillar(s):** Pillar 1 (Ops) + Pillar 3 (Marketplace)` — using the canonical names
  3. Add a sentence to the Implementation section (§3): "Vertical's customer-facing UI must be built as a [Pillar 2 branded site | Pillar 3 marketplace listing | both] — mount under the correct shell app as documented in ARCHITECTURE.md."
- **Priority:** Phase 1 — before any vertical implementation begins under M8b+

---

### DOC-5: Add 3-in-1 pillar classification to MASTER_CONTINUATION_PROMPT.md and the 9 new execution prompt Sets

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/MASTER_CONTINUATION_PROMPT.md
- **Why:** The master continuation prompt does not instruct generating agents to classify verticals by 3-in-1 pillar. The SET A–I vertical tables have no `Primary Pillar` column. All 97 new task blocks being generated will inherit this omission.
- **Action:**
  1. Add `Primary Pillar(s)` column to every vertical table in Sets A–I.
  2. Add to `## THE TASK BLOCK TEMPLATE` section: a mandatory `**Primary pillar(s):**` field in the task block header.
  3. Add to `## EXECUTION WORKFLOW` Step 4 (verify before committing): "[ ] Every task block declares the vertical's primary pillar(s) using canonical pillar names."
- **Priority:** Phase 1 — before any Set A generation begins

---

### DOC-6: Add explicit cross-cutting statement to every SuperAgent/AI governance document

- **Location:**
  - `docs/governance/superagent/01-synthesis-report.md` — `docs/governance/superagent/06-governance-rules.md`
  - `docs/governance/ai-platform-master-plan.md`
  - `docs/governance/ai-architecture-decision-log.md`
  - All 8 remaining `docs/governance/ai-*.md` files
- **Why:** While SuperAgent docs claim to be cross-cutting, none of them opens with an explicit statement of its position relative to the 3-in-1 pillars. A reader encountering `docs/governance/superagent/02-product-spec.md` sees a 6,000-word product specification for a named product ("WebWaka SuperAgent") without any opening statement clarifying it is NOT a product pillar.
- **Action:** Add to the top of every SuperAgent and AI governance doc (immediately after the status block):
  ```markdown
  > **3-in-1 Position:** WebWaka SuperAgent is the **cross-cutting intelligence layer** for the platform.
  > It is NOT a fourth primary product pillar. It operates on top of and in service of:
  > - Pillar 1 — Operations-Management (POS)
  > - Pillar 2 — Branding / Website / Portal
  > - Pillar 3 — Listing / Multi-Vendor Marketplace
  > All AI features are exposed through one of these three pillars, not independently.
  ```
- **Priority:** Phase 1

---

### DOC-7: Add pillar assignment to Community and Social documentation

- **Location:**
  - `docs/community/community-model.md`
  - `docs/community/community-entitlements.md`
  - `docs/governance/universal-entity-model.md` — M7 Extension sections
- **Why:** The Community and Social packages are unclassified in the 3-in-1 structure. Implementers using these packages for vertical features do not know whether to consider them Pillar 3 (marketplace community layer), cross-cutting infrastructure, or something else. This creates ambiguity in vertical design.
- **Action:**
  1. Add to each community/social doc: "**3-in-1 classification:** Community and Social features are cross-cutting infrastructure that enhance all three pillars but are particularly integral to Pillar 3 (Listing / Marketplace) as the community engagement layer for marketplace participants."
  2. In `ARCHITECTURE.md` (see DOC-2): List community and social explicitly in the pre-vertical infrastructure row with the note "enhances Pillar 3 marketplace engagement."
- **Priority:** Phase 2

---

### DOC-8: Create a dedicated 3-in-1 platform architecture reference document

- **Location:** `docs/governance/3in1-platform-architecture.md` (new file to create)
- **Why:** There is currently no single, comprehensive document that defines the 3-in-1 architecture in full — with pillar definitions, canonical module assignments, inter-pillar integration points, and implementation status. The canonical definition exists only in the audit prompt, not in the repo.
- **Action:** Create `docs/governance/3in1-platform-architecture.md` with:
  1. Canonical pillar definitions (copy from audit prompt — these are the source of truth)
  2. Module-to-pillar mapping table (every current app and package assigned to a pillar)
  3. Inter-pillar integration points (e.g., "POS records feed into marketplace inventory views")
  4. User subscription combinations (1 pillar only, 2 pillars, all 3 — with entitlement implications)
  5. SuperAgent's role as cross-cutting layer (with diagram if possible in Markdown)
  6. Implementation status dashboard (what is live, what is planned, what is empty)
  7. Governance rules: "No new app or package may be created without declaring its pillar in this document and in its package.json description."
- **Priority:** Phase 0 — this is the primary missing governance artifact for the 3-in-1 structure

---

## LIST 2: Code and Structural Remediations

---

### CODE-1: Implement `apps/brand-runtime/` — Pillar 2 minimum viable delivery

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/brand-runtime/.gitkeep
- **Why:** Pillar 2 (Branding / Website / Portal) is a core product offer. It has no code implementation. A customer who subscribes expecting a branded digital presence for their business has nothing to activate. This is the most critical functional gap in the platform.
- **Action:**
  1. Remove `.gitkeep`, create `apps/brand-runtime/src/index.ts` (Cloudflare Workers Hono app)
  2. Minimum viable routes:
     - `GET /` — branded homepage (tenant-configured name, logo, hero, contact)
     - `GET /about` — about page
     - `GET /services` (or `/products`) — offerings catalog (reads from `packages/offerings/`)
     - `GET /contact` — contact/booking form
     - `GET /health` — liveness probe
  3. Tenant resolution via `Host` header → `packages/white-label-theming/` for brand tokens
  4. Configurable sections backed by a `brand_pages` D1 table (new migration, next available number)
  5. Rendered via `packages/frontend/` composition layer
  6. SSR-capable for SEO (Cloudflare Workers SSR pattern)
  7. Minimum 10 test cases covering route responses, tenant isolation, theming token injection
- **Phase:** Phase 2 — schedule as M8-Branding milestone, parallel to M8b verticals
- **Prerequisite:** DOC-8 (3-in-1 architecture reference doc) must exist first to confirm scope

---

### CODE-2: Implement `apps/public-discovery/` — Pillar 3 marketplace frontend

- **Location:** https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/public-discovery/.gitkeep
- **Why:** Pillar 3 (Listing / Multi-Vendor Marketplace) has a fully-implemented backend (discovery API, profiles, search, claims, geography, verticals) but zero frontend. The marketplace cannot be used by an end user without a frontend.
- **Action:**
  1. Remove `.gitkeep`, create `apps/public-discovery/src/index.ts` (Cloudflare Workers Hono app)
  2. Minimum viable routes:
     - `GET /` — directory homepage with category browse (by sector and geography)
     - `GET /search` — full-text search results (proxies to `discovery.ts` routes)
     - `GET /[entity-slug]` — public profile page (individual, org, place)
     - `GET /claim/[profile-id]` — initiate claim workflow (links to auth + claim routes)
     - `GET /health` — liveness probe
  3. Connects to existing `apps/api/src/routes/discovery.ts` and `packages/profiles/`
  4. Geography-aware: `/lagos/restaurant` style URLs using `packages/geography/`
  5. Minimum 10 test cases covering search, entity rendering, geography scoping
- **Phase:** Phase 2 — schedule as M8-Marketplace-Frontend milestone, parallel to M8b verticals
- **Prerequisite:** DOC-8 must exist first

---

### CODE-3: Add `pillar` column to the verticals table and seed

- **Location:**
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/0036_verticals_table.sql
  - https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/seeds/0004_verticals-master.csv
- **Why:** The verticals table has no `pillar` column. Queries like "list all Pillar 2 verticals" or "which verticals feed into the marketplace" cannot be answered from the schema. Vertical implementations have no schema-level pillar anchor.
- **Action:**
  1. Create a new migration (next number after 0045) to ALTER the `verticals` table:
     ```sql
     ALTER TABLE verticals ADD COLUMN primary_pillars TEXT NOT NULL DEFAULT '[]';
     -- JSON array: e.g. '["ops","marketplace"]', '["ops","branding"]', '["ops","branding","marketplace"]'
     -- Valid values: "ops", "branding", "marketplace"
     -- Constraint: primary_pillars must contain at least "ops" (all verticals are operational)
     ```
  2. Update `infra/db/seeds/0004_verticals-master.csv` — add a `primary_pillars` column to all 160 rows.
  3. Example values:
     - `pos-business` → `["ops","branding"]` (branded store + operational back-office)
     - `politician` → `["ops","marketplace","branding"]` (profile in directory + campaign portal + ops)
     - `motor-park` → `["ops","marketplace"]` (directory listing + operational management)
     - `market` → `["ops","marketplace"]` (multi-vendor marketplace + market management)
     - `creator` → `["ops","branding","marketplace"]` (branded profile + discovery + monetization)
  4. Add `primary_pillars` to the `packages/verticals/src/types.ts` type definition for `VerticalRegistration`
- **Phase:** Phase 1 — before any M8b vertical implementation begins

---

### CODE-4: Add `[Pillar N]` prefix to `package.json` description for all packages

- **Location:** All `package.json` files in `packages/` and `apps/`
- **Why:** Without a declared pillar in each package's metadata, code review and architecture review cannot enforce pillar boundaries. A developer adding a Pillar 3 dependency to a Pillar 2 package will not be flagged.
- **Action:**
  1. Add `[Pillar N]` prefix to the `"description"` field in each `package.json`:
     - `packages/pos/` → `"[Pillar 1] POS float ledger, agent network, terminals"`
     - `packages/offerings/` → `"[Pillar 1] Products, services, routes, seats, tickets"`
     - `packages/white-label-theming/` → `"[Pillar 2] Brand token system for white-label surfaces"`
     - `packages/profiles/` → `"[Pillar 3] Discovery profiles for individuals, orgs, places"`
     - `packages/search-indexing/` → `"[Pillar 3] Faceted search and marketplace indexing"`
     - `packages/ai-abstraction/` → `"[AI] Provider-neutral AI routing and type contracts"`
     - `packages/auth/` → `"[Infra] Auth, tenancy, JWT, RBAC"`
     - `packages/community/` → `"[Infra/Pillar 3] Skool-style community spaces for marketplace participants"`
     - etc.
  2. No code changes required — metadata only.
- **Phase:** Phase 1

---

### CODE-5: Create GitHub labels for 3-in-1 pillars

- **Location:** GitHub repository label settings — https://github.com/WebWakaDOS/webwaka-os/labels
- **Why:** Milestone 0 created 29 GitHub labels (governance, milestone, workflow, infra, agent categories) but none for 3-in-1 pillars. Without labels, PRs and issues cannot be tracked by pillar, making it impossible to monitor implementation balance across the three pillars.
- **Action:** Create the following GitHub labels:
  | Label | Color | Description |
  |-------|-------|-------------|
  | `3in1:ops` | `#0052CC` (blue) | Pillar 1 — Operations-Management (POS, back-office) |
  | `3in1:branding` | `#6E40C9` (purple) | Pillar 2 — Branding / Website / Portal |
  | `3in1:marketplace` | `#2DA44E` (green) | Pillar 3 — Listing / Multi-Vendor Marketplace |
  | `3in1:ai` | `#E4A835` (gold) | Cross-cutting AI / SuperAgent layer |
  | `3in1:infra` | `#8B949E` (grey) | Pre-vertical platform infrastructure |
  - Apply appropriate label(s) to every future PR and every open issue
  - Add label application as a required step in the PR template checklist
- **Phase:** Phase 0 — labels should exist before any new PRs are filed

---

### CODE-6: Wire `packages/white-label-theming/` to `apps/brand-runtime/` and `apps/tenant-public/`

- **Location:**
  - `packages/white-label-theming/src/`
  - `apps/brand-runtime/src/` (after CODE-1 is executed)
  - `apps/tenant-public/src/index.ts`
- **Why:** The white-label-theming package exists but is not confirmed to be wired into either branded surface app. `apps/tenant-public/` renders profiles without applying tenant brand tokens (colors, fonts, logo). This makes the "branding" capability non-functional even in the partial tenant-public implementation.
- **Action:**
  1. Confirm `packages/white-label-theming/` exports a `getBrandTokens(tenantId, db)` function.
  2. If not implemented, implement it: reads a `brand_settings` table row (create migration if needed) and returns a `BrandTokens` object `{ primaryColor, logoUrl, fontFamily, businessName }`.
  3. Wire `getBrandTokens()` into `apps/tenant-public/src/index.ts` so every tenant page renders with correct brand tokens.
  4. Wire `getBrandTokens()` into `apps/brand-runtime/src/index.ts` when that app is built (CODE-1).
- **Phase:** Phase 2 (alongside CODE-1)

---

## LIST 3: Pre-Verticals Remediations

The following items are the "pre-verticals 3-in-1 alignment tasks" that were planned but not implemented. They must be added to the pre-verticals execution plan.

---

### PV-1: Create `3in1-platform-architecture.md` as a mandatory pre-vertical deliverable

- **Location:** `docs/governance/3in1-platform-architecture.md` (new — see DOC-8)
- **Why:** This document was the intended output of the pre-verticals 3-in-1 alignment task. It does not exist. Without it, every vertical implementation lacks the foundational reference for pillar assignment.
- **Action:**
  1. Add task **PV-3in1-0** to `docs/execution-prompts/webwaka_preverticals_execution_prompts.md` as the **first task** before SA-1.1.
  2. Task PV-3in1-0 instructs: "Read all platform docs and create `docs/governance/3in1-platform-architecture.md` per the structure in DOC-8 above. Push to GitHub before any SA-1.x implementation begins."
- **Phase:** Phase 0 — literally the first task before any vertical or SuperAgent work

---

### PV-2: Add 3-in-1 pillar alignment task to pre-verticals execution prompt (schema migration)

- **Location:** `docs/execution-prompts/webwaka_preverticals_execution_prompts.md`
- **Why:** The 10 current pre-vertical tasks (SA-1.1–SA-2.0) are exclusively SuperAgent infrastructure. The `pillar` column in the verticals schema (CODE-3) must be added as part of pre-verticals work, before any vertical is implemented.
- **Action:**
  1. Add task **PV-3in1-1** between the existing tasks PV-3in1-0 and SA-1.1:
     - Title: "Add `primary_pillars` column to verticals table and populate all 160 seeds"
     - Implementation: creates the migration (ALTER TABLE), updates the CSV, updates VerticalRegistration type
     - Tests: seed validation (all 160 rows have valid pillar values), FSM type test
     - GitHub push: `feat(verticals): add primary_pillars column for 3-in-1 alignment`
  2. Mark this task as a blocker for SA-1.1 onward.
- **Phase:** Phase 1 — must complete before first vertical is implemented in M8b

---

### PV-3: Add brand-runtime scaffold task to pre-verticals execution plan

- **Location:** `docs/execution-prompts/webwaka_preverticals_execution_prompts.md`
- **Why:** `apps/brand-runtime/` is empty. Without a minimum viable brand surface app, no vertical can deliver Pillar 2 (Branding) capabilities. This is a pre-vertical dependency for all branding verticals.
- **Action:**
  1. Add task **PV-3in1-2**:
     - Title: "Scaffold `apps/brand-runtime/` — Pillar 2 minimum viable branded surface"
     - Implementation: per CODE-1 above
     - Tests: minimum 10 route tests
     - GitHub push: `feat(brand-runtime): scaffold Pillar 2 branded surface app (M8-Branding)`
  2. This task runs in parallel with SA-1.1 (no dependency between them).
- **Phase:** Phase 2 — can begin in parallel with M8b vertical work

---

### PV-4: Add public-discovery scaffold task to pre-verticals execution plan

- **Location:** `docs/execution-prompts/webwaka_preverticals_execution_prompts.md`
- **Why:** `apps/public-discovery/` is empty. The marketplace frontend must exist for Pillar 3 verticals to be usable by end users.
- **Action:**
  1. Add task **PV-3in1-3**:
     - Title: "Scaffold `apps/public-discovery/` — Pillar 3 marketplace frontend"
     - Implementation: per CODE-2 above
     - Tests: minimum 10 route tests covering search, entity detail, geography filtering
     - GitHub push: `feat(public-discovery): scaffold Pillar 3 marketplace frontend (M8-Marketplace)`
  2. This task runs in parallel with SA-1.1 and PV-3in1-2.
- **Phase:** Phase 2 — can begin in parallel with M8b vertical work

---

### PV-5: Add 3-in-1 pillar labels to GitHub as a pre-vertical infrastructure task

- **Location:** GitHub labels (see CODE-5)
- **Why:** GitHub labels for 3-in-1 pillars (`3in1:ops`, `3in1:branding`, `3in1:marketplace`, `3in1:ai`, `3in1:infra`) must exist before any pillar-tagged PRs are filed.
- **Action:**
  1. Add task **PV-3in1-4** (very small — can be done manually in minutes):
     - Title: "Create 5 GitHub labels for 3-in-1 pillar tracking"
     - Implementation: Create labels per CODE-5 spec
     - No test required
     - GitHub: label creation is not a commit; confirm in the labels UI
  2. Apply labels retroactively to all 27 previously merged PRs where feasible.
- **Phase:** Phase 0 — before any new PRs are filed

---

### PV-6: Apply 3-in-1 pillar classification to all 7 existing execution prompt documents

- **Location:** All 7 files in `docs/execution-prompts/` (see DOC-4)
- **Why:** The 34 already-covered verticals (across 7 docs) were written without pillar classification. Every agent that executes these prompts will implement verticals without pillar context.
- **Action:**
  1. Add task **PV-3in1-5**:
     - Title: "Add `Primary pillar(s)` to all 34 existing task blocks in 7 execution prompt docs"
     - Implementation: For each of the 34 task blocks, add pillar line per DOC-4 instructions
     - No test required (documentation update only)
     - GitHub push: `docs(execution-prompts): add 3-in-1 pillar classification to all 34 existing task blocks`
  2. This task can be delegated to a documentation-focused agent.
- **Phase:** Phase 1 — before M8b implementation begins

---

## Phased Execution Summary

### Phase 0 — Immediate (do before any other work)
| Item | Action | Effort |
|------|--------|--------|
| PV-5 / CODE-5 | Create 5 GitHub labels for 3-in-1 pillars | 15 min |
| PV-1 / DOC-8 | Create `docs/governance/3in1-platform-architecture.md` | 2 hrs |
| DOC-1 | Align vision-and-mission.md pillar names with canonical spec | 30 min |
| DOC-2 | Add 3-in-1 pillar map to ARCHITECTURE.md | 30 min |

### Phase 1 — Before SA-1.1 implementation begins
| Item | Action | Effort |
|------|--------|--------|
| PV-2 / CODE-3 | Add `primary_pillars` column to verticals table + seed | 2 hrs |
| CODE-4 | Add `[Pillar N]` prefix to all package.json descriptions | 1 hr |
| DOC-3 | Add pillar classification to verticals-master-plan.md | 2 hrs |
| DOC-4 / PV-6 | Add pillar labels to all 7 existing execution prompt documents | 3 hrs |
| DOC-5 | Add pillar column to MASTER_CONTINUATION_PROMPT.md Sets A–I | 1 hr |
| DOC-6 | Add 3-in-1 position statement to all 16 AI/SuperAgent governance docs | 1 hr |

### Phase 2 — Parallel with M8b–M8e vertical implementations
| Item | Action | Effort |
|------|--------|--------|
| PV-3 / CODE-1 | Implement `apps/brand-runtime/` — Pillar 2 MVP | 3–5 days |
| PV-4 / CODE-2 | Implement `apps/public-discovery/` — Pillar 3 marketplace frontend | 3–5 days |
| CODE-6 | Wire white-label-theming into brand-runtime and tenant-public | 1 day |
| DOC-7 | Add pillar assignment to community/social docs | 1 hr |

### Phase 3 — Before M9 begins
| Item | Action | Effort |
|------|--------|--------|
| Validate pillar coverage | Every M8b–M8e vertical has its primary pillar implemented and tested | Ongoing |
| Validate brand-runtime | At least 3 live verticals are delivering Pillar 2 experiences | M8e gate |
| Validate public-discovery | At least 10 verticals are discoverable via Pillar 3 frontend | M9 gate |

---

## PR Checklist Addition (Immediate)

Add the following to `.github/pull_request_template.md`:

```markdown
## 3-in-1 Pillar Alignment

- [ ] This PR is labeled with the correct `3in1:*` label(s)
- [ ] If this PR adds a new package: `[Pillar N]` prefix added to `package.json` description
- [ ] If this PR adds a new vertical: `primary_pillars` field populated in seed CSV and type definition
- [ ] If this PR adds a new app: pillar assignment documented in ARCHITECTURE.md and `3in1-platform-architecture.md`
- [ ] If this PR adds AI features: features are attached to a pillar's UI surface (not standalone)
```

---

*Remediation plan author: Replit Agent — Senior WebWaka Product Architect*  
*Date: 2026-04-09*  
*Evidence base: `webwaka_3in1_core_audit_summary.md` findings*
