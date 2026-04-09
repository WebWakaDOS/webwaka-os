# WebWaka OS — Master Continuation Prompt: All 157 Vertical Execution Prompts

**Document type:** Master agent execution driver  
**Purpose:** Reference index for all 10 execution prompt document sets (Sets A–J); track progress and resume automatically after interruption  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Total verticals documented:** 157 unique slugs across 10 output documents (Sets A–J) — **ALL GAPS CLOSED ✅**  
**Tracking file:** `docs/execution-prompts/PROGRESS.md`  
**Gap analysis:** `docs/execution-prompts/UNIMPLEMENTED_TASKS.md`

---

## HOW TO USE THIS DOCUMENT

You are an agent executing this master prompt. Follow every instruction exactly in the sequence given.  
**Do not skip any step. Do not batch sets. Execute one set at a time, push to GitHub, update the tracker, then proceed to the next set.**

### On first run
1. Read this document from top to bottom.
2. Read the `## TRACKING SYSTEM` section and create `docs/execution-prompts/PROGRESS.md` with the initial state.
3. Read the `## CONTEXT FOUNDATION` section fully before generating any content.
4. Read `## THE TASK BLOCK TEMPLATE` section — this is the mandatory format for every task block you generate.
5. Process Set A. Push. Update tracker. Process Set B. Push. Update tracker. Continue until Set I is complete.

### On resume after interruption
1. Read `docs/execution-prompts/PROGRESS.md` to determine which sets are `DONE` and which are `PENDING`.
2. For each `DONE` set, verify the corresponding file exists on GitHub at the path listed in the tracker.  
   - If the file exists on GitHub → confirmed done, skip it.  
   - If the file does NOT exist on GitHub → mark it `PENDING` and re-execute it.
3. Begin executing from the first `PENDING` set.
4. Continue until all 10 sets (A–J) are `DONE`.

### GitHub verification command (use during resume)
```bash
git fetch origin main
git log --oneline origin/main | head -20
ls docs/execution-prompts/
```
Compare the file list to the tracker. Any expected file missing from the repo = that set is pending.

---

## TRACKING SYSTEM

### File: `docs/execution-prompts/PROGRESS.md`

Create this file immediately before processing Set A. Use this exact format:

```markdown
# WebWaka OS — Vertical Execution Prompt Generation Progress

**Last updated:** [ISO timestamp]
**Executing agent session:** [session identifier or "unknown"]
**Total sets:** 10
**Completed:** 0 / 10

---

## Set Status

| Set | Output File | Verticals | Status | GitHub Commit |
|-----|-------------|-----------|--------|---------------|
| A | webwaka_verticals_commerce_p2_batch1_execution_prompts.md | 9 | ⏳ PENDING | — |
| B | webwaka_verticals_commerce_p2_batch2_execution_prompts.md | 12 | ⏳ PENDING | — |
| C | webwaka_verticals_commerce_p3_execution_prompts.md | 15 | ⏳ PENDING | — |
| D | webwaka_verticals_transport_extended_execution_prompts.md | 8 | ⏳ PENDING | — |
| E | webwaka_verticals_civic_extended_execution_prompts.md | 10 | ⏳ PENDING | — |
| F | webwaka_verticals_health_extended_execution_prompts.md | 6 | ⏳ PENDING | — |
| G | webwaka_verticals_education_agricultural_extended_execution_prompts.md | 13 | ⏳ PENDING | — |
| H | webwaka_verticals_professional_creator_execution_prompts.md | 11 | ⏳ PENDING | — |
| I | webwaka_verticals_financial_place_media_institutional_execution_prompts.md | 13 | ⏳ PENDING | — |
| J | webwaka_verticals_set_j_missing_execution_prompts.md | 28 | ⏳ PENDING | — |

---

## Completion Log

*(Add one entry per completed set)*
```

### Tracker update protocol
After successfully pushing each set to GitHub:
1. Open `docs/execution-prompts/PROGRESS.md`.
2. Change the set's status from `⏳ PENDING` to `✅ DONE`.
3. Record the GitHub commit SHA in the `GitHub Commit` column.
4. Update `Last updated` timestamp and `Completed` count.
5. Append to `## Completion Log`:
   ```
   - Set [X] DONE — [ISO timestamp] — commit [SHA] — [N] task blocks written
   ```
6. Commit and push PROGRESS.md with message: `docs(progress): Set [X] complete — [output filename]`

---

## CONTEXT FOUNDATION

**Read all of the following files before generating any task block. These are mandatory.  
You are NOT allowed to generate content for any vertical without having read this foundation.**

### Architecture and governance
- `docs/governance/3in1-platform-architecture.md` — **READ FIRST** — canonical pillar map; every vertical must declare its primary_pillars; SuperAgent is NOT a fourth pillar
- `docs/governance/verticals-master-plan.md` — category counts, P1/P2/P3 framework, milestone allocation, pillar classification per vertical
- `docs/governance/verticals-dependency-dag.md` — dependency ordering between verticals
- `docs/governance/platform-invariants.md` — P2 (no duplication), P9 (integer kobo), P10 (NDPR), P12 (USSD exclusion), P13 (no raw PII to AI), T3 (tenant isolation), T4 (typed errors)
- `docs/governance/entitlement-model.md` — plan tiers, `requireKYCTier()`, `aiRights` gate
- `docs/governance/ai-integration-framework.md` — how verticals wire to SuperAgent (cross-cutting AI, not a pillar)
- `docs/governance/ai-capability-matrix.md` — which AI capabilities are available per tier
- `docs/governance/ai-provider-routing.md` — the 5-level key resolution chain

### SuperAgent architecture
- `docs/governance/superagent/02-product-spec.md` — SuperAgent product capabilities and exclusions
- `docs/governance/superagent/03-system-architecture.md` — type contracts, routing engine, WakaCU burn
- `docs/governance/ai-architecture-decision-log.md` — ADL-001 through ADL-010

### Codebase structure
- `packages/verticals/src/` — FSM engine, base vertical types, state transition guards
- `infra/db/migrations/0036_verticals_table.sql` — verticals table definition and 160 seeds
- `infra/db/seeds/0004_verticals-master.csv` — complete vertical metadata (slug, category, FSM states, KYC tier, dependencies)
- `packages/payments/` — payment flows, kobo enforcement
- `packages/community/` — community spaces, courses, events
- `packages/auth/src/guards.ts` — KYC tier guards, auth middleware
- `packages/superagent/` — WakaCU burn engine, AI rights enforcement

### All execution prompt documents (pre-M9 base + Sets A–J)

**Pre-M9 base documents (34 verticals — already implemented):**
- [`docs/execution-prompts/webwaka_verticals_commerce_pos_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_pos_execution_prompts.md)
- [`docs/execution-prompts/webwaka_verticals_civic_government_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_government_execution_prompts.md)
- [`docs/execution-prompts/webwaka_verticals_transport_logistics_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_logistics_execution_prompts.md)
- [`docs/execution-prompts/webwaka_verticals_health_education_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_education_execution_prompts.md)
- [`docs/execution-prompts/webwaka_verticals_creator_professional_financial_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_creator_professional_financial_execution_prompts.md)
- [`docs/execution-prompts/webwaka_verticals_agricultural_place_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_agricultural_place_execution_prompts.md)

**Sets A–J (123 verticals — prompts written, code implementation pending):**
- **Set A** (9 verticals — Commerce P2 Batch 1): [`webwaka_verticals_commerce_p2_batch1_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md)
- **Set B** (12 verticals — Commerce P2 Batch 2): [`webwaka_verticals_commerce_p2_batch2_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md)
- **Set C** (15 verticals — Commerce P3 Tail): [`webwaka_verticals_commerce_p3_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md)
- **Set D** (8 verticals — Transport Extended): [`webwaka_verticals_transport_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md)
- **Set E** (10 verticals — Civic Extended): [`webwaka_verticals_civic_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md)
- **Set F** (6 verticals — Health Extended): [`webwaka_verticals_health_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md)
- **Set G** (13 verticals — Education + Agricultural Extended): [`webwaka_verticals_education_agricultural_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md)
- **Set H** (11 verticals — Professional + Creator Extended): [`webwaka_verticals_professional_creator_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md)
- **Set I** (13 verticals — Financial + Place + Media + Institutional): [`webwaka_verticals_financial_place_media_institutional_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md)
- **Set J** (28 verticals — Gap Fill: all previously missing slugs): [`webwaka_verticals_set_j_missing_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_set_j_missing_execution_prompts.md)

---

## THE TASK BLOCK TEMPLATE

Every task block you generate must follow this exact structure. Do not omit any section. Do not invent a shorter version.

---

```
## TASK V-[CATEGORY]-[N]: [Display Name] Vertical

- **Module / vertical:** `packages/verticals` + vertical slug `[slug]`
- **Priority:** [P1-Original | P2-Top100 | P3-Specialist] — [brief justification]
- **Milestone target:** [M8b | M8c | M8d | M8e | M9 | M10 | M11 | M12]
- **Primary pillars:** [e.g. Pillar 1 (Ops) + Pillar 2 (Branding) + Pillar 3 (Marketplace) — from verticals-master-plan.md and 3in1-platform-architecture.md]
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - 3-in-1 platform architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/3in1-platform-architecture.md
  - Verticals FSM engine: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/verticals/src/
  - Verticals seed: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/seeds/0004_verticals-master.csv
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - Entitlement model: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/entitlement-model.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - SuperAgent product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md
  - [+ any domain-specific package links relevant to this vertical]

---

You are an expert **Senior Full-Stack Engineer** specialising in [domain] operations software and multi-tenant SaaS platforms, working on WebWaka OS.

**Skills required:**
- [domain-specific skill 1 — must be Nigeria-market specific]
- [domain-specific skill 2]
- Cloudflare Workers + Hono + D1 TypeScript strict mode
- WebWaka SuperAgent integration — all AI features route through `packages/superagent`
- Verticals FSM lifecycle engine — extend base FSM, never replace it
- Nigerian regulatory context: [list relevant body — CAC, FRSC, IT, NAFDAC, CBN, etc.]

---

**1. Mandatory context reading (100% before execution):**

Read and fully internalize ALL of the following before writing any code:

- `docs/governance/verticals-master-plan.md` — section on [category] verticals; entry for `[slug]`
- `docs/governance/platform-invariants.md` — P2, P9, P10, P12, P13, T3, T4 in full
- `infra/db/seeds/0004_verticals-master.csv` — row for `[slug]`: FSM states, KYC tier, required dependencies
- `packages/verticals/src/` — FSM engine API: `registerVertical()`, `transition()`, `getVerticalState()`
- `packages/auth/src/guards.ts` — `requireKYCTier()`, `requireAiRights()`
- `docs/governance/ai-integration-framework.md` — how verticals call SuperAgent; WakaCU burn pattern
- `docs/governance/entitlement-model.md` — which plan tiers unlock which capabilities
- [+ domain-specific package or migration to read]

---

**2. Online research and execution plan:**

Act as a **Senior Product Researcher** with deep Nigerian SME market expertise.

Research tasks (search online before writing the plan):
- Nigerian market size for [sector] — SMEDAN / NBS data, number of registered operators
- Top 10 Nigerian and African competitors in [sector] (web, mobile, USSD-based)
- The 30–50 features these competitors offer that matter most to Nigerian [sector] SMEs
- Regulatory requirements specific to [sector] in Nigeria — which body licenses or registers operators
- Common operational pain points reported by Nigerian [sector] operators online

Execution plan must specify:
- **Objective:** One-sentence summary of what this vertical delivers
- **Schema additions:** Table name(s), columns, migration number to assign
- **API routes:** All new Hono route handlers with HTTP methods and path prefixes
- **FSM states:** Confirm from seed CSV; specify what triggers each transition
- **SuperAgent integration point:** Which AI capability (from ai-capability-matrix.md) this vertical uses and under which plan tier
- **Regulatory hook:** Which platform dependency (CAC lookup, FRSC, IT, NAFDAC, etc.) is required at which FSM state
- **KYC tier gate:** Which tier is required to activate monetary offerings

---

**3. Implementation workflow:**

Branch: `feat/vertical-[slug]` from `main`.

**3a. Schema migration:**

Create `infra/db/migrations/[NEXT_NUMBER]_vertical_[slug].sql`:
- Primary table: `[slug_underscored]_profiles` (vertical-specific columns + `tenant_id`, `workspace_id`, `created_at`, `updated_at`)
- JOIN table if needed (e.g., staff, schedule, inventory items)
- All integer monetary columns in kobo (P9)
- `tenant_id TEXT NOT NULL` on every table (T3)
- Migration number must be the next unused number after 0045; check `infra/db/migrations/` before assigning

**3b. Package implementation:**

Create `packages/verticals-[slug]/src/index.ts`:
- Export: `register[DisplayName]Vertical(): VerticalRegistration`
- FSM states from seed CSV, implemented via `registerVertical()` from `packages/verticals/src/`
- Transition guards: regulatory verification at correct state (e.g., CAC check before `cac_verified`)
- Monetary offering activation gated by `requireKYCTier([tier])`
- AI capability call: `packages/superagent/src/` burn engine with `aiRights` check + NDPR consent gate (P10) + USSD exclusion (P12)
- No raw PII fields passed to AI layer (P13)

**3c. API routes:**

Create `apps/api/src/routes/verticals/[slug].ts`:
- Registration route: `POST /v1/verticals/[slug]/register`
- Profile route: `GET /v1/verticals/[slug]/:id`
- Lifecycle route: `POST /v1/verticals/[slug]/:id/transition` — triggers FSM state change
- Offering route: `POST /v1/verticals/[slug]/:id/offerings` — creates vertical-specific service/product
- AI advisory route (if applicable): `POST /v1/verticals/[slug]/:id/ai-advisory` — gated by aiRights + NDPR consent
- Mount in `apps/api/src/index.ts` under the existing verticals router

**3d. Tenant isolation (T3 — non-negotiable):**
- All D1 queries include `WHERE tenant_id = ?` bound to the authenticated tenant
- No cross-tenant data accessible via any route

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with domain expertise in [sector] and fintech.

**Test file:** `apps/api/src/routes/verticals/[slug].test.ts`

Positive test cases (at minimum):
- Vertical registers successfully with valid data
- FSM transition from `seeded` to `claimed` succeeds with correct actor
- Regulatory verification transition (e.g., `cac_verified`) succeeds with mock CAC response
- Offering created with integer kobo price (P9)
- AI advisory returns response when `aiRights: true` and NDPR consent present

Negative / edge cases (at minimum):
- Registration rejected with missing required fields
- FSM transition to invalid state returns typed error (T4)
- Monetary offering rejected with fractional kobo value (P9)
- Cross-tenant access attempt returns 403 (T3)
- AI advisory blocked when `aiRights: false`
- AI advisory blocked when NDPR consent absent (P10)
- AI advisory on USSD session blocked (P12)

Security tests:
- Unauthenticated request to all routes → 401
- Insufficient KYC tier for offering activation → 403

**Minimum test count: 15 tests.**

---

**5. Finalize and push to GitHub:**

```bash
git add .
git commit -m "feat(vertical/[slug]): [Display Name] vertical — [2-3 word feature summary] ([milestone])"
git push origin feat/vertical-[slug]
```

PR description must reference:
- Verticals master plan entry for `[slug]`
- Platform invariants enforced (list which: P2, P9, T3, etc.)
- AI integration framework section used
- Migration number and table(s) created

PR checklist:
- [ ] Vertical registered in FSM via `packages/verticals/src/`
- [ ] Migration created and numbered correctly (no gap, no collision)
- [ ] `primary_pillars` field set correctly in `VerticalRegistration` (matches 3in1-platform-architecture.md)
- [ ] PR labeled with correct `3in1:pillar-N` GitHub label(s)
- [ ] All routes protected by correct KYC tier guard
- [ ] AI routes use SuperAgent burn engine (SuperAgent is cross-cutting, not a pillar)
- [ ] Cross-tenant isolation enforced on all D1 queries
- [ ] Tests ≥ 15, all passing
- [ ] Zero typecheck errors (`pnpm -r typecheck`)
- [ ] Zero lint errors (`pnpm -r lint`)
```
---

## OUTPUT DOCUMENT TEMPLATE

Each set produces one Markdown file in `docs/execution-prompts/`. Every file must open with this header:

```markdown
# WebWaka OS — Verticals Execution Prompts: [Set Title]

**Document type:** Agent execution prompt set  
**Scope:** [category list] verticals — [N] verticals covered  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone targets:** [list milestone range]  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged  
**Generated by:** MASTER_CONTINUATION_PROMPT.md — Set [X]

---

### General rules for all agents using these prompts

- Never make assumptions about WebWaka's architecture, API contracts, or business logic. Always read the referenced documents and code first.
- Research deeply before executing. When encountering domain-specific patterns, do online research first and synthesise with Nigeria market context.
- Thoroughness is far more important than speed.
- All work must be pushed to GitHub. No local partial work should remain outside the repo.
- SuperAgent is the AI layer — all AI features in verticals route through `packages/superagent`. Never call AI providers directly from vertical code.
- Platform Invariants are non-negotiable. Read `docs/governance/platform-invariants.md` in full before implementing any vertical.
- The verticals FSM engine in `packages/verticals/` governs lifecycle states. All verticals must use it — no custom state machines.
- Every monetary value stored in the database must be an integer in kobo (P9). No decimals, no floats.
- No cross-tenant data leakage (T3). Every D1 query scopes to `tenant_id`.

---
```

Then include one task block per vertical, using the `## THE TASK BLOCK TEMPLATE` format above.

---

## THE 10 SETS — COMPLETE VERTICAL ASSIGNMENTS (Sets A–J)

---

### SET A — Commerce P2 Batch 1 (9 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md`  
**Milestone range:** M9–M10  
**Task ID prefix:** V-COMM-EXT-A

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-COMM-EXT-A1 | `auto-mechanic` | Auto Mechanic / Garage | P2 | M9 | SON, VIO (roadworthiness) |
| V-COMM-EXT-A2 | `bakery` | Bakery / Confectionery | P2 | M9 | NAFDAC (food production license) |
| V-COMM-EXT-A3 | `beauty-salon` | Beauty Salon / Barber Shop | P2 | M9 | NASC (cosmetology), state business permit |
| V-COMM-EXT-A4 | `bookshop` | Bookshop / Stationery Store | P2 | M9 | CAC (business registration) |
| V-COMM-EXT-A5 | `catering` | Catering Service | P2 | M9 | NAFDAC (food handler certification) |
| V-COMM-EXT-A6 | `cleaning-service` | Cleaning Service | P2 | M9 | State environmental agency |
| V-COMM-EXT-A7 | `electronics-repair` | Electronics Repair Shop | P2 | M9 | CAC, SON (standards compliance) |
| V-COMM-EXT-A8 | `florist` | Florist / Garden Centre | P2 | M9 | CAC, state agriculture dept |
| V-COMM-EXT-A9 | `food-vendor` | Food Vendor / Street Food | P2 | M9 | Local government permit, NAFDAC |

**Domain focus for Set A:** SME commerce operations — appointment scheduling, inventory, staff management, loyalty programmes, digital menus, order tracking. Nigeria-specific: local government permits, market association membership, NAFDAC food handler cards, informal sector onboarding patterns.

**AI capability for Set A verticals (where applicable):** `SALES_FORECAST`, `DEMAND_PLANNING`, `CUSTOMER_SEGMENTATION` — all gated by `aiRights` and NDPR consent; L2 autonomy maximum (human review before acting on AI output).

---

### SET B — Commerce P2 Batch 2 (12 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md`  
**Milestone range:** M9–M10  
**Task ID prefix:** V-COMM-EXT-B

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-COMM-EXT-B1 | `construction` | Construction Firm / Contractor | P2 | M9 | COREN, CORBON (contractors registration) |
| V-COMM-EXT-B2 | `fuel-station` | Fuel / Filling Station | P2 | M9 | DPR (now NUPRC) license |
| V-COMM-EXT-B3 | `print-shop` | Printing & Branding Shop | P2 | M9 | CAC, SON |
| V-COMM-EXT-B4 | `property-developer` | Property Developer | P2 | M9 | SURCON, TOPREC, state land use |
| V-COMM-EXT-B5 | `real-estate-agency` | Real Estate Agency | P2 | M9 | NIESV, ESVARBON |
| V-COMM-EXT-B6 | `restaurant-chain` | Restaurant / Food Chain Outlet | P2 | M9 | NAFDAC, CAC, state food safety |
| V-COMM-EXT-B7 | `security-company` | Security Company / Guard Service | P2 | M9 | PSC (Private Security Companies board) |
| V-COMM-EXT-B8 | `solar-installer` | Solar / Renewable Energy Installer | P2 | M9 | NERC, NEMSA |
| V-COMM-EXT-B9 | `spa` | Spa / Massage Parlour | P2 | M10 | State health authority, NASC |
| V-COMM-EXT-B10 | `tailor` | Tailoring / Fashion Designer | P2 | M10 | State trade union, fashion guild |
| V-COMM-EXT-B11 | `travel-agent` | Travel Agent / Tour Operator | P2 | M9 | NANTA, NTA (Nigeria Tourism Development Corp) |
| V-COMM-EXT-B12 | `welding-fabrication` | Welding / Fabrication Shop | P2 | M10 | SON, state trade assoc |

**Domain focus for Set B:** Project-based and licensed commerce — project quotation, contractor scheduling, DPR permit tracking, property listing, reservation management, tour itinerary building. Emphasis on formal compliance workflows and digital document management.

**AI capability for Set B verticals (where applicable):** `PROJECT_COST_ESTIMATION`, `PROPERTY_VALUATION_ASSIST`, `MENU_OPTIMIZATION`, `ENERGY_AUDIT` — L2 autonomy; NDPR consent required; USSD excluded (P12).

---

### SET C — Commerce P3 Tail (15 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md`  
**Milestone range:** M10–M12  
**Task ID prefix:** V-COMM-EXT-C

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-COMM-EXT-C1 | `artisanal-mining` | Artisanal Mining Operator | P3 | M12 | MMSD (Mining Cadastre Office) |
| V-COMM-EXT-C2 | `borehole-driller` | Borehole Drilling Company | P3 | M12 | State water board, COREN |
| V-COMM-EXT-C3 | `building-materials` | Building Materials Supplier | P3 | M12 | SON, state trade assoc |
| V-COMM-EXT-C4 | `car-wash` | Car Wash / Detailing | P3 | M12 | Local government permit |
| V-COMM-EXT-C5 | `cleaning-company` | Cleaning & Facility Management Co. | P3 | M11 | CAC, FMENV compliance |
| V-COMM-EXT-C6 | `electrical-fittings` | Electrical Fittings Dealer | P3 | M12 | SON, NEMSA |
| V-COMM-EXT-C7 | `generator-dealer` | Generator Sales & Service Centre | P3 | M11 | SON, NEMSA, DPR |
| V-COMM-EXT-C8 | `hair-salon` | Hair Salon / Barbing Salon | P3 | M10 | NASC, local business permit |
| V-COMM-EXT-C9 | `petrol-station` | Petrol Station (DPR/NUPRC-licensed) | P3 | M11 | DPR / NUPRC, SON |
| V-COMM-EXT-C10 | `phone-repair-shop` | Phone Repair & Accessories Shop | P3 | M10 | NCC (type approval awareness), SON |
| V-COMM-EXT-C11 | `shoemaker` | Shoe Cobbler / Shoe Maker | P3 | M12 | State artisan association |
| V-COMM-EXT-C12 | `spare-parts` | Spare Parts Dealer (Ladipo/Nnewi) | P3 | M12 | SON, CAC |
| V-COMM-EXT-C13 | `tyre-shop` | Tyre Shop / Vulcanizer | P3 | M12 | SON |
| V-COMM-EXT-C14 | `used-car-dealer` | Used Car Dealer / Auto Trader | P3 | M12 | FRSC (VIN verification), state motor dealers assoc |
| V-COMM-EXT-C15 | `water-vendor` | Water Tanker / Sachet Water Producer | P3 | M11 | NAFDAC (sachet water permit), state water board |

**Domain focus for Set C:** Informal and semi-formal micro-SME commerce — lightweight FSM (3 states: seeded → claimed → active), minimal KYC (Tier 1 for most), appointment/booking, inventory, receipt generation. P3 verticals must be fully functional at Tier 1 to serve the informal economy.

**AI capability for Set C verticals (where applicable):** `DEMAND_FORECAST`, `INVENTORY_REORDER_ALERT` — L1 autonomy only (informational, no automated action); NDPR consent required; USSD excluded (P12).

---

### SET D — Transport Extended (8 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md`  
**Milestone range:** M9–M12  
**Task ID prefix:** V-TRN-EXT

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-TRN-EXT-1 | `clearing-agent` | Clearing & Forwarding Agent | P2 | M9 | NCS (Nigeria Customs), NAGAFF |
| V-TRN-EXT-2 | `courier` | Courier Service | P2 | M9 | NCC (e-commerce), NPC (if data collected) |
| V-TRN-EXT-3 | `dispatch-rider` | Dispatch Rider Network | P2 | M9 | FRSC, VIO (rider licence verification) |
| V-TRN-EXT-4 | `airport-shuttle` | Airport Shuttle Service | P3 | M12 | FAAN, FRSC, VIO |
| V-TRN-EXT-5 | `cargo-truck` | Cargo Truck Owner / Fleet Operator | P3 | M12 | FRSC (roadworthiness), RMAFC |
| V-TRN-EXT-6 | `container-depot` | Container Depot / Logistics Hub | P3 | M12 | NCS, NPA (Nigerian Ports Authority) |
| V-TRN-EXT-7 | `ferry` | Ferry / Water Transport Operator | P3 | M12 | NIMASA (maritime authority) |
| V-TRN-EXT-8 | `nurtw` | Road Transport Workers Union (NURTW) | P3 | M12 | NURTW national body, state chapters |

**Domain focus for Set D:** Logistics and transport operations — shipment tracking, route management, manifest logging, fleet registration, rider onboarding, Customs entry workflows. FRSC and NCS compliance are the primary regulatory integration points.

**AI capability for Set D verticals (where applicable):** `ROUTE_OPTIMIZATION`, `FLEET_EFFICIENCY_REPORT`, `DELIVERY_ETA_PREDICTION` — L2 autonomy; NDPR consent required; USSD excluded (P12).

---

### SET E — Civic Extended + Politics Remaining (10 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md`  
**Milestone range:** M8d–M12  
**Task ID prefix:** V-CIV-EXT

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-CIV-EXT-1 | `mosque` | Mosque / Islamic Centre | P2 | M8d | IT (Incorporated Trustees), NSCIA |
| V-CIV-EXT-2 | `youth-organization` | Youth Organization / Student Union | P2 | M8d | CAC (assoc registration), NYSC, state youth board |
| V-CIV-EXT-3 | `womens-association` | Women's Association / Forum | P3 | M8d | CAC, NWEC |
| V-CIV-EXT-4 | `waste-management` | Waste Management / Recycler | P2 | M11 | FMENV, LASEPA (state env agency) |
| V-CIV-EXT-5 | `book-club` | Book Club / Reading Circle | P3 | M12 | CAC (association), NLN (Nigerian Library Network) |
| V-CIV-EXT-6 | `professional-association` | Professional Association (NBA/NMA/ICAN) | P3 | M12 | Respective professional regulatory body |
| V-CIV-EXT-7 | `sports-club` | Sports Club / Amateur League | P3 | M12 | State sports council, NSF |
| V-CIV-EXT-8 | `campaign-office` | Campaign Office | P3 | M8b | INEC (party nomination filing, campaign finance rules) |
| V-CIV-EXT-9 | `constituency-office` | Constituency Development Office | P3 | M12 | INEC, NASS (National Assembly Services) |
| V-CIV-EXT-10 | `ward-rep` | Ward Representative / Polling Unit | P3 | M12 | INEC (ward delineation), LGA administration |

**Domain focus for Set E:** Community governance and civic operations — membership registers, meeting minutes, donation tracking, campaign finance disclosure, INEC filing integration, faith community schedules. Political content autonomy cap: L3 HITL maximum (no AI output published without human review).

**AI capability for Set E verticals:** `MEMBER_ENGAGEMENT_REPORT`, `CAMPAIGN_INSIGHT` (political: L3 HITL only — ADL political autonomy cap applies), `DONATION_TREND` — NDPR consent required; USSD excluded (P12).

---

### SET F — Health Extended (6 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md`  
**Milestone range:** M9–M12  
**Task ID prefix:** V-HLT-EXT

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-HLT-EXT-1 | `dental-clinic` | Dental Clinic / Orthodontist | P2 | M9 | MDCN (dental registration), ADSN |
| V-HLT-EXT-2 | `sports-academy` | Sports Academy / Fitness Centre | P2 | M10 | State sports council, fitness assoc |
| V-HLT-EXT-3 | `vet-clinic` | Veterinary Clinic / Pet Shop | P2 | M10 | VCNB (Veterinary Council of Nigeria) |
| V-HLT-EXT-4 | `community-health` | Community Health Worker (CHW) Network | P3 | M12 | FMOH, NPHCDA, state CHO boards |
| V-HLT-EXT-5 | `elderly-care` | Elderly Care Facility | P3 | M12 | FMHSW, state social welfare |
| V-HLT-EXT-6 | `rehab-centre` | Rehabilitation / Recovery Centre | P3 | M12 | NDLEA (drug rehab licensing), FMHSW |

**Domain focus for Set F:** Healthcare service operations — appointment scheduling, patient record reference IDs (no raw clinical data to AI — P13 is critical here), prescription records, CHW visit logs, therapy session booking. Clinical documents AI autonomy cap: L3 HITL maximum.

**Critical P13 enforcement for health verticals:** AI prompts may receive de-identified reference IDs and aggregate statistics only. Patient names, diagnoses, medications, and identifiers must never be passed to the AI layer. Any implementation that passes raw patient data to SuperAgent is a blocking violation.

**AI capability for Set F verticals:** `APPOINTMENT_OPTIMIZATION`, `PATIENT_FLOW_REPORT`, `HEALTH_FACILITY_BENCHMARK` — L2 for operational data; L3 HITL for any patient-adjacent output; NDPR consent required.

---

### SET G — Education + Agricultural Extended (13 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md`  
**Milestone range:** M9–M12  
**Task ID prefix:** V-EDU-EXT / V-AGR-EXT

**Education (4 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-EDU-EXT-1 | `driving-school` | Driving School (FRSC-licensed) | P2 | M9 | FRSC (VIO registration, test booking) |
| V-EDU-EXT-2 | `training-institute` | Training Institute / Vocational School | P2 | M9 | NBTE, NABTEB, ITF (SIWES) |
| V-EDU-EXT-3 | `creche` | Crèche / Day Care Centre | P3 | M12 | SUBEB, state social welfare, LASG |
| V-EDU-EXT-4 | `private-school` | Private School Operator | P3 | M12 | SUBEB, WAEC, NECO, state MOE |

**Agricultural (9 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-AGR-EXT-1 | `agro-input` | Agro-Input Dealer | P2 | M10 | NAFDAC (agrochemicals), FMARD |
| V-AGR-EXT-2 | `cold-room` | Cold Room / Storage Facility | P2 | M10 | NAFDAC, SON (cold chain standards) |
| V-AGR-EXT-3 | `abattoir` | Abattoir / Meat Processing | P3 | M12 | NAFDAC, NVRI, state animal health |
| V-AGR-EXT-4 | `cassava-miller` | Cassava / Maize / Rice Miller | P3 | M12 | NAFDAC, FMARD, SON |
| V-AGR-EXT-5 | `cocoa-exporter` | Cocoa / Export Commodities Trader | P3 | M12 | NAFDAC, CRIN, CBN (FX repatriation) |
| V-AGR-EXT-6 | `fish-market` | Fish Market / Fishmonger | P3 | M12 | NAFDAC, NIFDA, state agriculture dept |
| V-AGR-EXT-7 | `food-processing` | Food Processing Factory | P3 | M12 | NAFDAC (manufacturing permit), SON, FMARD |
| V-AGR-EXT-8 | `palm-oil` | Palm Oil / Vegetable Oil Producer | P3 | M12 | NAFDAC, NIFOR, state agric dept |
| V-AGR-EXT-9 | `vegetable-garden` | Vegetable Garden / Horticulture | P3 | M12 | FMARD, state agriculture extension |

**Domain focus for Set G:** Education: student enrollment, lesson scheduling, FRSC test booking integration, WAEC results management. Agricultural: commodity pricing (kobo per kg), cold chain monitoring, input dealer inventory, export documentation. Nigeria-specific: FMARD e-wallet for anchor borrowers, commodity exchange integration readiness.

**AI capability for Set G verticals:** `STUDENT_PROGRESS_REPORT`, `YIELD_FORECAST`, `COMMODITY_PRICE_ALERT`, `COLD_CHAIN_ANOMALY` — L2 autonomy for advisory; NDPR consent required; USSD excluded (P12). Agricultural advisory cap: L2 maximum (ADL-010 applies).

---

### SET H — Professional Extended + Creator Extended (11 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md`  
**Milestone range:** M9–M12  
**Task ID prefix:** V-PRO-EXT / V-CRT-EXT

**Professional (7 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-PRO-EXT-1 | `accounting-firm` | Accounting Firm / Audit Practice | P2 | M9 | ICAN, ANAN (IFRS compliance), FIRS |
| V-PRO-EXT-2 | `event-planner` | Event Planner / MC | P2 | M9 | State event licence, CAC |
| V-PRO-EXT-3 | `law-firm` | Law Firm / Legal Practice | P2 | M9 | NBA (practising certificate), NJC |
| V-PRO-EXT-4 | `funeral-home` | Burial / Funeral Home | P3 | M12 | State health authority, local govt permit |
| V-PRO-EXT-5 | `pr-firm` | Public Relations Firm | P3 | M12 | NIPR (Nigerian Institute of PR), CAC |
| V-PRO-EXT-6 | `tax-consultant` | Tax Consultant / Revenue Agent | P3 | M12 | FIRS (tax practitioner registration), CITN |
| V-PRO-EXT-7 | `wedding-planner` | Wedding Planner / Celebrant | P3 | M12 | CAC, state court (for legal celebrant cert) |

**Creator (4 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-CRT-EXT-1 | `music-studio` | Music Studio / Recording Studio | P2 | M10 | COSON, MCSN (royalty bodies) |
| V-CRT-EXT-2 | `photography-studio` | Photography Studio / Videography | P2 | M10 | NUJ / APCON (advertising compliance) |
| V-CRT-EXT-3 | `recording-label` | Record Label / Music Publisher | P3 | M12 | COSON, MCSN, CAC |
| V-CRT-EXT-4 | `talent-agency` | Talent Agency / Model Agency | P3 | M12 | CAC, state entertainment commission |

**Domain focus for Set H:** Professional services — client matter management (legal), engagement billing, court calendar, tax filing calendars, ICAN CPD tracking, event booking pipeline. Creator: studio session booking, royalty split tracking (COSON integration readiness), content release scheduling, talent roster management.

**Critical for law firm vertical:** Client matter data must never pass to the AI layer (P13 + legal privilege). AI usage restricted to `BILLING_PATTERN_ANALYSIS` and `COURT_SCHEDULE_CONFLICT_DETECTION` on anonymised data only. L3 HITL maximum for any legal content output.

**AI capability for Set H verticals:** `ENGAGEMENT_PIPELINE_REPORT`, `BILLING_FORECAST`, `STUDIO_UTILIZATION_REPORT`, `TALENT_BOOKING_OPTIMIZATION` — L2 autonomy; NDPR consent required; USSD excluded (P12).

---

### SET I — Financial + Place + Media + Institutional + Transport Tail (13 verticals)
**Output file:** `docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md`  
**Milestone range:** M9–M12  
**Task ID prefix:** V-FIN-EXT / V-PLC-EXT / V-MED-EXT / V-INST-EXT

**Financial (4 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-FIN-EXT-1 | `airtime-reseller` | Airtime / VTU Reseller | P3 | M12 | NCC, CBN (agent banking overlap) |
| V-FIN-EXT-2 | `bureau-de-change` | Bureau de Change / FX Dealer | P3 | M12 | CBN (BDC licence categories) |
| V-FIN-EXT-3 | `hire-purchase` | Hire Purchase / Asset Finance | P3 | M12 | CBN, SEC (consumer credit rules) |
| V-FIN-EXT-4 | `mobile-money-agent` | Mobile Money Agent | P3 | M12 | CBN (super-agent / sub-agent framework) |

**Place (4 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-PLC-EXT-1 | `event-hall` | Event Hall / Venue | P2 | M10 | State event licence, fire safety cert |
| V-PLC-EXT-2 | `water-treatment` | Water Treatment / Borehole Operator | P2 | M11 | NAFDAC, state water board |
| V-PLC-EXT-3 | `community-hall` | Community Hall / Town Hall | P3 | M12 | LGA, community development assoc |
| V-PLC-EXT-4 | `events-centre` | Events Centre / Hall Rental | P3 | M12 | State event licence, fire safety cert |

**Media (3 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-MED-EXT-1 | `advertising-agency` | Advertising Agency | P2 | M9 | APCON (advertising practitioners registration) |
| V-MED-EXT-2 | `newspaper-dist` | Newspaper Distribution / Media House | P3 | M12 | NPC (press council), NUJ |
| V-MED-EXT-3 | `podcast-studio` | Podcast Studio / Digital Media | P3 | M12 | NBC (if broadcasting), NCC |

**Institutional (2 verticals):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-INST-EXT-1 | `government-agency` | Government Agency / MDAs | P3 | M11 | OAGF, IPPIS, BPP (procurement) |
| V-INST-EXT-2 | `polling-unit` | Polling Unit / Electoral District | P3 | M12 | INEC (ward and unit delineation) |

**Domain focus for Set I:** Financial verticals must enforce CBN regulations at every monetary operation — BDC FX rates, mobile money sub-agent caps (₦300,000 daily transaction limit), hire-purchase repayment schedules in kobo (P9). Government Agency vertical: procurement tracking, appropriation line items, budget utilisation reports — all amounts in kobo, no fractional values. Media: content scheduling, advertiser campaign management, APCON registration verification.

**Critical for financial verticals:** All transaction amounts in integer kobo (P9). BDC and mobile money agent operations require KYC Tier 3 minimum. No AI autonomy above L2 for any financial transaction suggestion. CBN regulatory data must not be stored beyond consent scope (NDPR P10).

**AI capability for Set I verticals:** `CASH_FLOW_FORECAST`, `VENUE_UTILIZATION_REPORT`, `AD_CAMPAIGN_PERFORMANCE`, `BROADCAST_SCHEDULING_ASSIST` — L2 autonomy maximum; NDPR consent required; USSD excluded (P12).

---

### SET J — Gap Fill: All Previously Missing Verticals (28 verticals)
**Output file:** [`docs/execution-prompts/webwaka_verticals_set_j_missing_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_set_j_missing_execution_prompts.md)  
**Milestone range:** M9–M12  
**Task ID prefix:** V-COMM-J / V-HLT-J / V-TRN-J / V-PRO-J / V-CIV-J / V-EDU-J  
**Status:** ✅ DONE — commit `4aff35c` (2026-04-09)

**Identified by:** Full gap analysis against `infra/db/seeds/0004_verticals-master.csv` — 28 slugs that existed in the seed but had no prompt in Sets A–I.

**P2 verticals (11 — M9–M10):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-COMM-J1 | `hotel` | Hotel / Guesthouse / Shortlet | P2 | M9 | NIHOTOUR, state tourism board |
| V-COMM-J2 | `furniture-maker` | Furniture Maker / Wood Workshop | P2 | M10 | SON (timber), LCCI |
| V-COMM-J3 | `gas-distributor` | Gas / LPG Distributor | P2 | M10 | DPR/NUPRC, LPGASSOC |
| V-COMM-J4 | `generator-repair` | Generator Repair / HVAC Technician | P2 | M10 | COREN, SON |
| V-COMM-J5 | `handyman` | Plumber / Electrician / Handyman | P2 | M9 | COREN, state artisan card |
| V-COMM-J6 | `it-support` | IT Support / Computer Repair | P2 | M10 | NCC (awareness), CAC |
| V-COMM-J7 | `laundry` | Laundry / Dry Cleaner | P2 | M10 | CAC, NAFDAC (dry cleaning chemicals) |
| V-COMM-J8 | `tailor` | Tailoring / Fashion Designer (P2 general) | P2 | M10 | CAC, state trade union |
| V-COMM-J9 | `logistics-delivery` | Logistics & Delivery (Last-Mile) | P2 | M9 | NIPOST, CAC |
| V-COMM-J10 | `pharmacy-chain` | Pharmacy Chain / Drugstore | P2 | M9 | PCN (multi-branch), NAFDAC |
| V-HLT-J1 | `optician` | Optician / Eye Clinic | P2 | M10 | OONL, MDCN (ophthalmologist) |

**P3 verticals (17 — M11–M12):**

| Task ID | Slug | Display Name | Priority | Milestone | Key Regulatory Body |
|---------|------|--------------|----------|-----------|-------------------|
| V-COMM-J11 | `printing-press` | Printing Press / Design Studio | P3 | M11 | APCON, NAN, CAC |
| V-COMM-J12 | `laundry-service` | Laundromat / Laundry Service | P3 | M11 | CAC |
| V-COMM-J13 | `iron-steel` | Iron & Steel / Roofing Merchant | P3 | M12 | SON (steel grade), COREN |
| V-COMM-J14 | `internet-cafe` | Internet Café / Business Centre | P3 | M12 | NCC (registration) |
| V-COMM-J15 | `motorcycle-accessories` | Motorcycle Accessories Shop | P3 | M12 | SON, LCCI |
| V-COMM-J16 | `paints-distributor` | Paints & Coatings Distributor | P3 | M12 | SON (quality cert), brand authorisation |
| V-COMM-J17 | `plumbing-supplies` | Plumbing Supplies Dealer | P3 | M12 | SON (pipe standards), CAC |
| V-CIV-J1 | `ministry-mission` | Ministry / Apostolic Mission / Outreach | P3 | M12 | IT (CAMA 2020), CAC |
| V-CIV-J2 | `market-association` | Market Leaders / Traders Association | P3 | M12 | CAC (cooperative), LGA |
| V-CIV-J3 | `motivational-speaker` | Motivational Speaker / Training Firm | P3 | M12 | NITAD, CIPM (awareness) |
| V-EDU-J1 | `govt-school` | Government School Management | P3 | M12 | SUBEB, UBEC, LGA Education Secretary |
| V-EDU-J2 | `nursery-school` | Nursery / Crèche (SUBEB-regulated) | P3 | M12 | SUBEB, state MOE, NERDC |
| V-HLT-J2 | `gym-fitness` | Gym / Fitness Centre (P3 fitness-first) | P3 | M11 | FAFA, CAC |
| V-HLT-J3 | `orphanage` | Orphanage / Child Care NGO | P3 | M12 | FMWASD, state Social Development |
| V-COMM-J18 | `oil-gas-services` | Oil & Gas Service Provider | P3 | M12 | NCDMB, DPR/NUPRC, NAPIMS |
| V-PRO-J1 | `land-surveyor` | Land Surveyor / Registry Agent | P3 | M11 | SURCON, NIS |
| V-TRN-J1 | `okada-keke` | Okada / Keke Rider Co-op | P3 | M11 | NURTW, OAAN, FRSC |

**Special invariants for Set J:**
- `gas-distributor`: cylinder sizes stored as integer grams (never float kg)
- `optician`: prescription dioptre powers as integer ×100 (sphere −2.50 = −250)
- `gym-fitness`: body weight as integer grams; body fat as integer ×10
- `oil-gas-services`: contract values use 64-bit INTEGER kobo (can reach billions) — NEVER REAL column
- `iron-steel`, `plumbing-supplies`: dimensions as integer mm/cm (never float)
- `laundry-service`, `hotel`: double-booking conflict check required at route level
- `orphanage`, `nursery-school`: absolute L3 HITL — no child data to AI under any circumstances
- `optician`: L2 max for scheduling; L3 HITL for any clinical output
- `govt-school`: L2 max for AI; student_ref_id always opaque
- `land-surveyor`: L2 max AI; L3 HITL for any land-identity output

**Domain focus for Set J:** Fills every remaining gap in the seed — hospitality, trades, logistics, specialist health, specialist education, civic bodies, and industrial commerce. Enforces the same 5-section template and platform invariants as all other sets.

---

## EXECUTION WORKFLOW (PER SET)

Follow this exact sequence for each set, without skipping any step:

### Step 1: Verify resume state
```bash
git fetch origin main
cat docs/execution-prompts/PROGRESS.md
ls docs/execution-prompts/
```
Confirm which sets are `✅ DONE` and which are `⏳ PENDING`. Begin with the first `⏳ PENDING` set.

### Step 2: Read all mandatory context
Re-read (or confirm already read this session):
- All files listed in `## CONTEXT FOUNDATION`
- The two or three most similar existing execution prompt files (for style calibration)

### Step 3: Generate the output document
Create the output file at `docs/execution-prompts/[filename]`.
- Use the `## OUTPUT DOCUMENT TEMPLATE` header
- Write one task block per vertical using `## THE TASK BLOCK TEMPLATE`
- Tailor the Persona, Skills Required, research tasks, implementation details, and regulatory hooks to each specific vertical
- Do not copy-paste generic blocks — every task block must be specifically researched and written for that vertical's Nigerian market context

### Step 4: Verify the generated document
Before committing, verify:
- [ ] Every vertical listed in the set has a corresponding task block
- [ ] Every task block has all 5 sections (context reading, research + plan, implementation, QA, GitHub push)
- [ ] Every task block specifies correct FSM states from the seed CSV
- [ ] Every task block names the correct regulatory body for Nigeria
- [ ] Every monetary instruction uses the word "kobo" (P9)
- [ ] Every AI section includes NDPR consent gate, USSD exclusion, `aiRights` check
- [ ] Every test plan specifies ≥ 15 test cases
- [ ] Minimum test counts are specified for each task block

### Step 5: Commit and push the output document
```bash
git add docs/execution-prompts/[filename]
git commit -m "docs(execution-prompts): Set [X] — [Set title] — [N] verticals ([priority range])"
git push origin main
```

### Step 6: Update PROGRESS.md and push
```bash
# Update docs/execution-prompts/PROGRESS.md:
# - Change Set [X] status from ⏳ PENDING to ✅ DONE
# - Record commit SHA
# - Update Last updated and Completed count
# - Append to Completion Log

git add docs/execution-prompts/PROGRESS.md
git commit -m "docs(progress): Set [X] complete — [output filename] — SHA [commit-sha]"
git push origin main
```

### Step 7: Proceed immediately to the next PENDING set
Do not pause. Do not ask for confirmation. Proceed to Step 1 for the next set.

---

## COMPLETION CRITERIA

All 10 sets are complete when:
1. All 10 output files exist in `docs/execution-prompts/` on `main` branch of `WebWakaDOS/webwaka-os`
2. `PROGRESS.md` shows `Completed: 10 / 10` with all sets marked `✅ DONE`
3. Every output document contains the correct number of task blocks matching the set's vertical count
4. All task blocks follow the 5-section template without omissions
5. All 157 unique vertical slugs are covered across the 10 documents

**Total task blocks documented:** 154 (A:9 + B:12 + C:15 + D:8 + E:10 + F:6 + G:13 + H:11 + I:13 + J:28) + 34 pre-M9 = 188 total  
**Total output documents:** 10 (Sets A–J) + 6 pre-M9 base documents = 16 prompt files total  
**Total unique slugs in seed CSV:** 157 (160 rows; 3 exact duplicate slugs)  
**Status as of 2026-04-09:** All 10 sets ✅ DONE — see `PROGRESS.md` for commit SHAs

---

## PLATFORM INVARIANTS QUICK REFERENCE

Memorise these before generating any content. Every task block must reflect them.

| Code | Rule | Enforcement point |
|------|------|------------------|
| P2 | Never duplicate shared code — all capabilities route through `packages/*` | Implementation section |
| P9 | All monetary values are integers in kobo — no floats, no decimals | Schema migration + test section |
| P10 | NDPR consent gate before any AI call — verify from D1 `consent_records` | AI advisory route + test section |
| P12 | AI is excluded from all USSD sessions — `isUssdSession: true` → deny | AI advisory route + test section |
| P13 | No raw PII to AI layer — de-identify before any AI prompt | AI integration section |
| T3 | Tenant isolation — `WHERE tenant_id = ?` on every D1 query | All routes + test section |
| T4 | Typed errors — no silent fallbacks, all error paths return typed responses | Implementation + test section |

**AI autonomy caps (from ADL + SuperAgent product spec):**
- Political content: L3 HITL maximum (no publish without human review)
- Clinical / legal documents: L3 HITL maximum
- Agricultural advisory: L2 maximum
- General commerce: L2–L3 (plan-dependent)

---

## GITHUB AUTHENTICATION PATTERN

When pushing to `WebWakaDOS/webwaka-os`, use:
```bash
git remote set-url origin "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/WebWakaDOS/webwaka-os.git"
git push origin main
git remote set-url origin https://github.com/WebWakaDOS/webwaka-os.git
```
Always reset the remote URL after pushing (to avoid storing the token in git config).

---

*Generated by: Replit Agent — WebWaka OS M8 Planning Phase*  
*Last updated: 2026-04-09 — Set J authored, all 157 gaps closed*  
*Source: `infra/db/seeds/0004_verticals-master.csv` (160 rows, 157 unique slugs)*  
*Coverage: 16 total prompt files — 6 pre-M9 base (34 verticals implemented) + 10 sets A–J (123 verticals prompt-documented, pending code implementation)*
