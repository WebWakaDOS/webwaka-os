# WebWaka OS — Milestone Progress Tracker

**Last updated:** 2026-04-08 01:00 WAT
**Updated by:** Base44 Super Agent (M7 docs update — PR #19 — feat/m7-docs-update)

---

## Status Legend

| Status | Meaning |
|---|---|
| NOT STARTED | No work begun |
| IN PROGRESS | Actively being worked on |
| READY FOR REVIEW | Complete, awaiting review/approval |
| BLOCKED | Cannot proceed — see linked issue |
| APPROVED | Founder has approved |
| DONE | Fully complete, merged, deployed |

---

## Milestone 0 — Program Setup

**Goal:** Establish project control before coding starts.
**Owner:** Base44 Super Agent
**Overall status:** ✅ DONE — Founder approved 7 April 2026

| Task | Status | Notes |
|---|---|---|
| Create monorepo repository | DONE | https://github.com/WebWakaDOS/webwaka-os |
| Create base folder structure | DONE | 34 files, all directories scaffolded |
| Protect `main` and `staging` branches | DONE | 1 reviewer + CI required |
| Create 29 GitHub labels | DONE | Governance, milestone, workflow, infra, agent labels |
| Create 4 issue templates | DONE | Bug, Feature, TDR, Governance Change |
| Create PR template | DONE | Structured checklist |
| Configure Dependabot | DONE | Weekly, grouped by ecosystem |
| Create 5 GitHub Actions workflows | DONE | CI, deploy-staging, deploy-production, check-core-version, governance-check |
| Provision Cloudflare D1 databases | DONE | staging: cfa62668, production: de1d0935 |
| Provision Cloudflare KV namespaces (4) | DONE | WEBWAKA_KV + RATE_LIMIT_KV for both envs |
| Provision Cloudflare R2 buckets (2) | DONE | assets-staging, assets-production |
| Set all 7 GitHub Actions secrets | DONE | See secrets-inventory.md |
| Draft 7 root documentation files | DONE | README, CONTRIBUTING, ARCHITECTURE, SECURITY, RELEASES, ROADMAP, AGENTS |
| Draft 5 governance documents (M0 set) | DONE | security-baseline, release-governance, platform-invariants, agent-execution-rules, milestone-tracker |
| Draft 4 TDRs (M0 set) | DONE | TDR-0002, 0005, 0007, 0012 |
| Open GitHub issues for tracking | DONE | Issues #1–#5 filed |
| Founder approval — Milestone 0 | ✅ APPROVED | Closed issue #3, 7 April 2026 |
| DNS configuration | PENDING | Deferred — no Workers deployed yet (Milestone 2) |

---

## Milestone 1 — Governance Baseline

**Goal:** Complete all governance documents and TDRs before Replit scaffolding.
**Owner:** Perplexity (authoring) + Base44 Super Agent (placement, review, PR)
**Overall status:** ✅ DONE — All documents placed, PR #6 merged 7 April 2026

| Task | Status | Notes |
|---|---|---|
| Draft vision-and-mission.md | DONE | Perplexity-authored, Founder approved |
| Draft core-principles.md | DONE | Perplexity-authored, Founder approved |
| Draft universal-entity-model.md | DONE | Perplexity-authored, Founder approved |
| Draft relationship-schema.md | DONE | Perplexity-authored, Founder approved |
| Draft entitlement-model.md | DONE | Perplexity-authored, Founder approved |
| Draft geography-taxonomy.md | DONE | Perplexity-authored, Founder approved |
| Draft political-taxonomy.md | DONE | Perplexity-authored, Founder approved |
| Draft claim-first-onboarding.md | DONE | Perplexity-authored, Founder approved |
| Draft partner-and-subpartner-model.md | DONE | Perplexity-authored, Founder approved |
| Draft white-label-policy.md | DONE | Perplexity-authored, Founder approved |
| Draft ai-policy.md | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0001 (monorepo strategy) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0003 (GitHub source of truth) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0004 (Replit build workbench) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0006 (TypeScript-first) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0008 (auth + tenancy) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0009 (AI provider abstraction) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0010 (offline + PWA standard) | DONE | Perplexity-authored, Founder approved |
| Draft TDR-0011 (geography + political core) | DONE | Perplexity-authored, Founder approved |
| Open governance review PR | DONE | PR #6: https://github.com/WebWakaDOS/webwaka-os/pull/6 |
| Apply `founder-approval` label to PR | DONE | Applied 7 April 2026 |
| Founder approval — Milestone 1 | ✅ APPROVED | Closed issues #4, #5 — 7 April 2026 |

---

## Milestone 2 — Monorepo Scaffolding and Shared Core Foundations

**Goal:** Implement shared type packages, core geography/political primitives, auth scaffold, D1 schema foundations, and CI verification.
**Owner:** Replit Agent 4 (implementation) + Base44 Super Agent (review + CI coordination)
**Overall status:** ✅ DONE — Founder approved 2026-04-07 16:52 WAT

**Baseline:** `main` at commit `ef4afda7` (post PR #6 merge, 7 April 2026)
**Replit delivery:** Direct push to `main` (commits b7f0fc87, 6d69c11e) — process violation, retrospective PR #10 opened
**Required fixes:** Issue #9 — 3 Replit items + 2 Base44 items (Base44 fixes applied)
**CI:** Audit ✅ | Typecheck ✅ | Tests ✅ | Lint ✅ (all passing post-fix)

| Task | Status | Notes |
|---|---|---|
| Scaffold `packages/types` (shared TypeScript types) | DONE | Committed b7f0fc87 — all 7 entities, 11 entitlement dimensions, 15 relationship types |
| Scaffold `packages/core/geography` (typed hierarchy) | DONE | Committed b7f0fc87 — full 8-level hierarchy, rollup helpers, Nigeria seed constants |
| Scaffold `packages/core/politics` (office + territory model) | DONE | Committed b7f0fc87 — all 7 offices, exhaustive OFFICE_TERRITORY_MAP |
| Scaffold `packages/auth` (JWT + workspace-scoped auth) | DONE | Committed b7f0fc87 — Web Crypto, MissingTenantContextError, timing-safe secret compare |
| D1 schema: foundational tables and migrations | DONE | 6 migration files, 0001–0006, timestamps fixed to INTEGER |
| Seed data: pnpm-workspace + tsconfig + eslint setup | DONE | 44 seed records (1 country + 6 zones + 37 states) |
| Root scaffold: pnpm-workspace.yaml, tsconfig.base.json, vitest | DONE | Committed b7f0fc87 |
| Fix workflows: --migrations-dir infra/db/migrations | DONE | Base44 — 2026-04-07 |
| Standardise timestamps to INTEGER (unixepoch()) | DONE | Base44 — 2026-04-07 (6 migrations updated) |
| Fix #1: tsconfig paths for @webwaka/* workspace resolution | DONE | Resolved in M3 CI passes |
| Fix #3: jwt.test.ts (8 required test cases) | DONE | 34 auth tests now passing |
| Fix #4: Remove Express server from apps/platform-admin | DONE | Resolved in M3 |
| Retrospective PR: main → staging (formalise audit trail) | DONE | Base44 — PR #10 opened 2026-04-07 |
| CI passes end-to-end on monorepo structure | DONE | All 4 jobs passing — 2026-04-07 16:48 WAT |
| Base44 governance review of Replit output | DONE | Base44 — 2026-04-07 15:45 WAT — APPROVED WITH REQUIRED FIXES — Review on PR #10, Issues #11, #12 filed |
| Founder approval — Milestone 2 | DONE | ✅ Approved by Founder 2026-04-07 16:52 WAT |

---

## Milestone 3 — Vertical Package Scaffolding + First API Wiring

**Goal:** Scaffold all vertical support packages, wire the Hono API Worker, implement geography-driven discovery, and produce full Nigeria LGA + ward seed data.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit, CI)
**Overall status:** ✅ DONE — Founder approved 2026-04-07 20:31 WAT

**Delivery commit range:** `a9b94c` → `f539a6b` on `main`
**Final CI:** 11 packages typecheck ✅ | 151 tests, 0 failures ✅ | Audit ✅

| Task | Status | Notes |
|---|---|---|
| Install @cloudflare/workers-types, hono, wrangler | DONE | Added to apps/api |
| buildIndexFromD1 in @webwaka/geography | DONE | D1 → GeographyIndex map, KV-cached in API |
| CandidateRecord.id + migration 0007a | DONE | Political constraint migration |
| packages/offline-sync — scaffold (pure types) | DONE | SyncEnvelope + 4 type tests |
| packages/ai-abstraction — scaffold (pure types) | DONE | AiProvider interface |
| packages/relationships — types + D1 migration 0007 + repository + tests | DONE | 5 tests, typed link graph |
| packages/entitlements — plan config + evaluate + guards + tests | DONE | 27 tests |
| packages/entities — ID gen + repositories + pagination + tests | DONE | 30 tests |
| apps/api — Hono Worker + routes + middleware + tests | DONE | 14 tests, 12 routes |
| Issue #8 — 775 LGAs seed | DONE | `infra/db/seed/0002_lgas.sql` (775 total; Imeko-Afon LGA added) |
| Issue #8 — 8,810 ward seed | DONE | `infra/db/seed/0003_wards.sql` — 8,810/8,810 wards, zero unmatched |
| Typecheck all packages (11) | DONE | Zero errors — `pnpm -r run typecheck` |
| Test all packages (151 tests) | DONE | All passing — `pnpm -r run test` |
| Update milestone tracker + replit.md | DONE | 2026-04-07 |
| Base44 final audit — all M3 deliverables | DONE | Base44 — 2026-04-07 20:15 WAT — full spec coverage confirmed |
| Founder approval — Milestone 3 | ✅ APPROVED | Approved by Founder 2026-04-07 20:31 WAT |

---

## Milestone 4 — Discovery Layer MVP

**Goal:** Public discovery of seeded entities. Geography-filtered search. Profile pages. Claim entry point.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit, CI)
**Overall status:** ✅ APPROVED — PR #14 merged, QA complete, 3 bugs fixed post-review, 171 tests passing

**Baseline:** `main` at commit `588ea42`  
**PR:** https://github.com/WebWakaDOS/webwaka-os/pull/14 (feat/milestone-4 → main)  
**CI:** 171 tests passing · 12 packages typecheck clean  
**Test count breakdown:** 14 (apps/api M3 baseline) + 20 (discovery M4) = 34 apps/api total · 171 workspace total

| Task | Status | Notes |
|---|---|---|
| D1 migration 0008 — search index tables | DONE | `search_entries` + `search_fts` FTS5 virtual table |
| D1 migration 0009 — discovery events log | DONE | Profile views, search hits, claim intents |
| packages/search-indexing — scaffold + types | DONE | SearchEntry/SearchQuery/SearchAdapter interfaces |
| apps/api — GET /discovery/search | DONE | Full-text + geography filter + visibility + pagination |
| apps/api — GET /discovery/profiles/:subjectType/:subjectId | DONE | Public profile hydration (Individual/Org + Place + relationships) |
| apps/api — POST /discovery/claim-intent | DONE | State validation, rate-limit by IP hash, 409 on duplicate |
| apps/api — GET /discovery/nearby/:placeId | DONE | Geography subtree entity listing |
| apps/api — GET /discovery/trending | DONE | Most-viewed profiles this week via discovery_events |
| Profile hydration logic | DONE | Merged in discovery.ts profile route |
| Geography filter integration | DONE | search_entries.place_id + querystring placeId filter |
| Entitlement guard on sensitive profiles | DEFERRED | M5 — not in M4 brief deliverables |
| Test coverage ≥ 20 new tests | DONE | 20 tests in apps/api/src/routes/discovery.test.ts |
| Update milestone tracker | DONE | This entry |
| PR: feat/milestone-4 → main | DONE | PR #14 — labels: milestone-4, review-needed, base44 |
| Founder approval — Milestone 4 | NOT STARTED | Awaiting Base44 QA + Founder review |

---

## Milestones 5–13

| Milestone | Title | Status |
|---|---|---|
| 5 | Claim-First Onboarding | ✅ DONE — PR #16 merged |
| 6 | Complete Pre-Vertical Platform | IN PROGRESS — feat/milestone-6 |
| 7 | Transport Module | NOT STARTED |
| 8 | Civic & Political Module | NOT STARTED |
| 9 | Institutional Module | NOT STARTED |
| 10 | Professional Module | NOT STARTED |
| 11 | Partner & White-Label | NOT STARTED |
| 12 | Offline & PWA Baseline | NOT STARTED |
| 13 | Production Hardening & Launch | NOT STARTED |

---

## Milestone 5 — Claim-First Onboarding + Workspace Activation

**Goal:** Registration, claim submission + review lifecycle, workspace activation gated on verified claim, free-tier subscription provisioning, back-office entitlement check.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit, CI)
**Overall status:** ✅ COMPLETE — PR #16 merged to main 2026-04-07 WAT | 202 tests | CI green

**Baseline:** `main` at commit `30ad5f8` — 171 tests, 12 packages typecheck clean
**Branch:** `feat/milestone-5` → `main`
**Brief:** `docs/milestones/milestone-5-replit-brief.md`

| Task | Status | Notes |
|---|---|---|
| Migration 0010 — users + claim_requests tables | DONE | infra/db/migrations/0010_claims.sql |
| packages/claims — state machine + verification | DONE | claim-states.ts, state-machine.ts, phone/email/id helpers |
| POST /claim/intent | DONE | Formal claim request with state machine |
| POST /claim/advance | DONE | Admin: advance claim state |
| POST /claim/verify | DONE | Submit verification evidence |
| GET /claim/status/:profileId | DONE | Public claim status |
| POST /workspaces/:id/activate | DONE | Activate workspace plan |
| PATCH /workspaces/:id | DONE | Update plan/layers (admin) |
| POST /workspaces/:id/invite | DONE | Invite workspace member |
| GET /workspaces/:id/analytics | DONE | Usage metrics |
| Wire claim + workspace routes in index.ts | DONE | authMiddleware at app level |
| 31 new tests (claims 15 + workspaces 16) | DONE | 202 total workspace tests |
| replit.md updated | DONE | M5 routes + migrations |
| Governance checklist passed | DONE | T3/T4/T5/T6 compliant |
| Founder approval — Milestone 5 | ✅ APPROVED — PR #16 merged to main 2026-04-07 |
---

## Milestone 6 — Complete Pre-Vertical Platform

**Goal:** Payments (Paystack), Frontend Composition, Event Bus — all infrastructure before first vertical goes live.
**Owner:** Replit Agent (implementation)
**Overall status:** ✅ DONE — PR #17 merged to main 2026-04-07 23:55 WAT | 300 tests | 0 typecheck errors | SHA 0920b66

**Baseline:** `main` at commit `24d57cc` — 202 tests, 13 packages typecheck clean
**Branch:** `feat/milestone-6` → `main`
**Target PR:** #17

### Layer 1 — Payments

| Task | Status | Notes |
|---|---|---|
| Migration 0011 — billing_history | DONE | infra/db/migrations/0011_payments.sql |
| packages/payments — types.ts | DONE | PaymentIntent, BillingRecord, VerifiedPayment |
| packages/payments — paystack.ts | DONE | initializePayment, verifyPayment, verifyWebhookSignature |
| packages/payments — subscription-sync.ts | DONE | syncPaymentToSubscription, recordFailedPayment |
| packages/payments — 16 tests | DONE | paystack.test.ts (10) + subscription-sync.test.ts (6) |
| POST /workspaces/:id/upgrade | DONE | Paystack checkout initialisation |
| POST /payments/verify | DONE | Verify + sync Paystack payment to subscription |
| GET /workspaces/:id/billing | DONE | Billing history list |
| PAYSTACK_SECRET_KEY added to env.ts | DONE | CF Worker Secret binding |

### Layer 2 — Frontend Composition

| Task | Status | Notes |
|---|---|---|
| packages/frontend — tenant-manifest.ts | DONE | getTenantManifestBySlug/ById, buildTenantManifest |
| packages/frontend — profile-renderer.ts | DONE | renderProfile, renderProfileList |
| packages/frontend — admin-layout.ts | DONE | buildAdminLayout, plan-gated nav items |
| packages/frontend — discovery-page.ts | DONE | buildDiscoveryPage, normaliseDiscoveryQuery |
| packages/frontend — theme.ts | DONE | brandingToCssVars, validateBranding |
| packages/frontend — 45 tests | DONE | 5 test files covering all modules |
| GET /public/:tenantSlug | DONE | Tenant manifest + discovery page |
| GET /admin/:workspaceId/dashboard | DONE | Admin layout model |
| POST /themes/:tenantId | DONE | Update tenant branding (validated) |
| apps/tenant-public | DONE | White-label public discovery Worker |
| apps/admin-dashboard | DONE | Admin dashboard Hono Worker |

### Layer 3 — Event Bus

| Task | Status | Notes |
|---|---|---|
| Migration 0012 — event_log | DONE | infra/db/migrations/0012_event_log.sql |
| packages/events — event-types.ts | DONE | EventType catalogue + typed payloads |
| packages/events — publisher.ts | DONE | publishEvent, getAggregateEvents |
| packages/events — subscriber.ts | DONE | subscribe, dispatch, clearSubscriptions |
| packages/events — projections/search.ts | DONE | rebuildSearchIndexFromEvents |
| packages/events — 19 tests | DONE | publisher(6) + subscriber(9) + search(4) |
| apps/projections | DONE | Event processor Worker (rebuild/search, rebuild/analytics) |

### Security Fixes (Base44 OpenClaw — 2026-04-07)

| Task | Status | Notes |
|---|---|---|
| POST /payments/verify — webhook sig validation (W1) | DONE | verifyWebhookSignature() wired; 401 on missing/bad x-paystack-signature |
| Workspace tenant isolation (T1/T3) | DONE | auth.workspaceId checked in upgrade, verify, billing; 403 on mismatch |
| +6 security tests for the above | DONE | payments.test.ts now has 17 tests |

### CI Summary

| Metric | Value |
|---|---|
| Total tests passing | 300 |
| Typecheck errors | 0 |
| New packages | 3 (payments, events, frontend) |
| New apps | 3 (tenant-public, admin-dashboard, projections) |
| New migrations | 2 (0011, 0012) |
| New API routes | 6 (upgrade, verify, billing, public, dashboard, themes) |
| Security fixes | 2 (W1 webhook sig, T1/T3 tenant isolation) |
| Final test count | 300 (+6 security tests vs 294 baseline) |

---

## Milestone 6a — Pre-Vertical Enhancement: Security / KYC / Compliance

**Goal:** Address all 20 Priority 1 enhancements from PR #18 research. All financial features legally operable post-M6a.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit)
**Overall status:** 🔲 NOT STARTED — awaiting PR #18 synthesis approval

**Pre-requisite:** PR #18 approved and merged to staging | M6 done ✅

| Task | Status | Notes |
|---|---|---|
| DAY 0 HOTFIX: 0013_init_users.sql → merge to main | NOT STARTED | Critical — auth routes 500 without this |
| 0014_kyc_fields.sql — NIN/BVN cols on individuals/profiles | NOT STARTED | |
| 0015_otp_log.sql — replay attack prevention | NOT STARTED | Must precede OTP gateway |
| 0016_kyc_records.sql — audit trail | NOT STARTED | |
| 0017_consent_records.sql — NDPR compliance | NOT STARTED | Must precede BVN/NIN code |
| 0018_missing_indexes.sql | NOT STARTED | |
| 0019_webhook_idempotency_log.sql | NOT STARTED | |
| 0020_data_residency_tagging.sql | NOT STARTED | |
| packages/identity — bvn.ts + nin.ts + frsc.ts + cac.ts | NOT STARTED | See docs/enhancements/m7/kyc-compliance.md |
| packages/otp — gateway.ts + providers | NOT STARTED | AfricasTalking + Termii |
| CBN KYC tier gating in packages/entitlements | NOT STARTED | requireKYCTier() + transaction limits |
| Rate limiting middleware (RATE_LIMIT_KV) | NOT STARTED | Per-phone for OTP, per-IP for general |
| CAC registration number Zod validation | NOT STARTED | RC-XXXXXXX pattern |
| Audit log middleware auto-enforcement | NOT STARTED | All DELETE/PATCH routes |
| IP hashing in auth/claim logs (NDPR) | NOT STARTED | SHA-256 + daily salt |
| FRSC vehicle/operator validation | NOT STARTED | Move to M6b — transport-specific |
| requireKYCTierForWorkspaceActivation() guard | NOT STARTED | Base44 addition — workspace publish step |
| Tests: 50+ covering all M6a items | NOT STARTED | |
| Base44 QA audit | NOT STARTED | |
| Founder approval — Milestone 6a | NOT STARTED | |

---

## Milestone 6b — Pre-Vertical Enhancement: Offline / Agent Network

**Goal:** Full offline runtime, POS terminal schema, agent network, USSD gateway.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit)
**Overall status:** 🔲 NOT STARTED — depends on M6a completion

| Task | Status | Notes |
|---|---|---|
| 0021_pos_terminals.sql | NOT STARTED | |
| 0022_agent_wallets_float_ledger.sql | NOT STARTED | |
| 0023_agent_sessions_handoff_log.sql | NOT STARTED | Base44 addition — dispute resolution |
| 0024_exchange_rates.sql | NOT STARTED | |
| packages/offline-sync — Dexie.js SyncAdapter runtime | NOT STARTED | See docs/enhancements/m7/offline-sync.md |
| packages/offline-sync — Service Worker registration | NOT STARTED | |
| packages/offline-sync — exponential backoff scheduler | NOT STARTED | |
| packages/offline-sync — conflict resolution | NOT STARTED | |
| apps/ussd-gateway — AfricasTalking USSD Worker | NOT STARTED | |
| Agent registration + delegation API | NOT STARTED | See docs/enhancements/m7/agent-network.md |
| Float cash-in / cash-out API | NOT STARTED | |
| Super Agent → Sub-Agent delegation (2 levels max) | NOT STARTED | |
| FRSC validation in packages/identity | NOT STARTED | Moved from M6a |
| Offline indicator UI component | NOT STARTED | packages/design-system |
| Lighthouse PWA CI check (.github/workflows/lighthouse.yml) | NOT STARTED | Moved from M6a |
| Tests: 70+ covering all M6b items | NOT STARTED | |
| Base44 QA audit | NOT STARTED | |
| Founder approval — Milestone 6b | NOT STARTED | |

---

## Milestone 6c — Pre-Vertical Enhancement: Nigeria UX / Commerce

**Goal:** Full commerce layer, airtime top-up, multi-bank linking, Nigerian locale, 3 fully implemented packages.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (QA, audit)
**Overall status:** 🔲 NOT STARTED — depends on M6b completion

| Task | Status | Notes |
|---|---|---|
| Airtime top-up API (VTpass) | NOT STARTED | MTN, GLO, Airtel, 9mobile, EEDC |
| Multi-bank linking (Paystack /bank/resolve) | NOT STARTED | Name enquiry + bank codes |
| Exchange rate service (CBN API daily fetch) | NOT STARTED | |
| Paystack split payment (partner commissions) | NOT STARTED | |
| Flutterwave gateway (Paystack failover) | NOT STARTED | |
| Nigerian phone validation (Zod + carrier detect) | NOT STARTED | |
| Bank list endpoint | NOT STARTED | |
| Route licensing fields (transport) | NOT STARTED | |
| Recurring charge (Paystack charge_authorization) | NOT STARTED | |
| packages/workspaces — full implementation | NOT STARTED | Remove stub_${uuid} Paystack reference |
| packages/profiles — full implementation | NOT STARTED | |
| packages/search-indexing — full implementation | NOT STARTED | |
| Nigerian locale en-NG + pcm (Naija Pidgin) | NOT STARTED | |
| LGA selector UI component | NOT STARTED | |
| Dark mode | NOT STARTED | |
| USSD shortcode UI component | NOT STARTED | |
| Optimistic UI updates | NOT STARTED | |
| Tests: 70+ covering all M6c items | NOT STARTED | |
| Base44 QA audit | NOT STARTED | |
| Founder approval — Milestone 6c | NOT STARTED | |

---

## Milestone 7 — Nigeria Platform Hardening + Community + Social

**Goal:** Nigeria compliance hardening (CBN KYC, NDPR, FRSC/CAC), offline-first (Dexie.js + USSD), Community Platform (Skool-style), Social Network (Twitter+IG+FB style), Nigeria UX polish.
**Owner:** Replit Agent (implementation) + Base44 Super Agent (architecture, QA, PR review)
**Overall status:** 🔲 NOT STARTED — depends on M6a + M6b + M6c completion
**Target tests:** 360+ (300 baseline → +60 new)
**New packages:** `packages/identity`, `packages/otp`, `packages/community`, `packages/social`
**New apps:** `apps/ussd-gateway`
**New migrations:** D1 0013–0034 (12 for M6 pre-verticals + 22 for M7)
**Governance docs:** Complete in `feat/m7-docs-update` (PR #20) — all 16 governance + 12 TDRs updated + 18 new docs

---

### M7a — Regulatory Survival (3 days)

**Goal:** CBN KYC tiers, BVN/NIN/CAC/FRSC identity, NDPR consent, rate limiting hardening, webhook idempotency.

| Task | Status | Notes |
|---|---|---|
| packages/identity — BVN/NIN/CAC/FRSC via Prembly | NOT STARTED | See docs/identity/bvn-nin-guide.md + frsc-cac-integration.md |
| packages/otp — Termii SMS + WhatsApp + USSD voice | NOT STARTED | See docs/identity/otp-channels.md |
| CBN KYC tier enforcement (requireKYCTier) | NOT STARTED | See docs/enhancements/m7/cbn-kyc-tiers.md |
| NDPR consent_records table + middleware | NOT STARTED | See docs/enhancements/m7/ndpr-consent.md |
| Rate limiting R5 (RATE_LIMIT_KV sliding window) | NOT STARTED | See docs/governance/security-baseline.md R5 |
| Webhook idempotency R6 (idempotency_log table) | NOT STARTED | See docs/governance/security-baseline.md R6 |
| PII hashing in logs R7 (SHA-256 salt + ip/phone) | NOT STARTED | See docs/governance/security-baseline.md R7 |
| KYC upgrade journey UI (BVN → NIN → CAC/FRSC screens) | NOT STARTED | |
| Nigerian phone validation Zod schema | NOT STARTED | In packages/otp |
| OTP rate limiting (3 sends / 10min per phone) | NOT STARTED | R5 enforcement |
| Carrier detection (MTN/Airtel/Glo/9mobile) | NOT STARTED | In packages/otp |
| D1 migrations: consent_records, idempotency_log, kyc_tiers | NOT STARTED | Migrations 0013–0015 |
| Tests: 30+ covering identity + otp + kyc + ndpr | NOT STARTED | |
| Base44 QA audit — M7a | NOT STARTED | |
| Founder approval — M7a | NOT STARTED | |

---

### M7b — Offline + Agent Network (3 days)

**Goal:** Dexie.js offline queue, deterministic sync, USSD gateway, POS agent terminals, float double-entry ledger.

| Task | Status | Notes |
|---|---|---|
| packages/offline-sync — Dexie.js queue + sync engine | NOT STARTED | See docs/enhancements/m7/offline-sync.md |
| Deterministic conflict resolution (server-wins) | NOT STARTED | Platform Invariant P11 |
| apps/ussd-gateway — Africa's Talking USSD Worker | NOT STARTED | See apps/ussd-gateway/wrangler.toml |
| USSD session state (KV, 3-min TTL) | NOT STARTED | |
| USSD menu: wallet / trending / transport / community | NOT STARTED | See docs/enhancements/m7/offline-sync.md |
| POS agent terminal model | NOT STARTED | See docs/enhancements/m7/agent-network.md |
| Agent float ledger (double-entry, P9) | NOT STARTED | Platform Invariant P9 |
| Float top-up / cash-out flows | NOT STARTED | |
| D1 migrations: offline_queue, agent_float_ledger, ussd_sessions | NOT STARTED | Migrations 0016–0018 |
| Tests: 20+ covering offline sync + ussd + float ledger | NOT STARTED | |
| Base44 QA audit — M7b | NOT STARTED | |
| Founder approval — M7b | NOT STARTED | |

---

### M7c — Community Platform (4 days)

**Goal:** Full Skool-style community platform — spaces, channels, forums, courses, events, paid memberships.

| Task | Status | Notes |
|---|---|---|
| packages/community — CommunitySpace, Membership, Channel, Thread, Course, Event | NOT STARTED | See docs/community/community-model.md |
| Community API routes (/community/*) | NOT STARTED | See docs/community/skool-features.md |
| Forum thread + reply system (5-level threading) | NOT STARTED | |
| Course modules + lesson progress tracking | NOT STARTED | |
| Community event RSVP + SMS reminders | NOT STARTED | |
| Paid membership tiers + KYC gating | NOT STARTED | See docs/community/community-entitlements.md |
| Revenue split (Paystack Split Payment) | NOT STARTED | See docs/community/community-monetization.md |
| Invite link system | NOT STARTED | |
| Community broadcast DMs | NOT STARTED | |
| Member leaderboard | NOT STARTED | |
| AI moderation classifier (profanity/NSFW/spam) | NOT STARTED | See docs/community/community-moderation.md |
| NDPR consent at community join | NOT STARTED | P10 enforcement |
| Offline lesson cache (Service Worker) | NOT STARTED | |
| D1 migrations: community_spaces, memberships, channels, threads, courses, events | NOT STARTED | Migrations 0019–0024 |
| Tests: 60+ covering all community features | NOT STARTED | |
| Base44 QA audit — M7c | NOT STARTED | |
| Founder approval — M7c | NOT STARTED | |

---

### M7d — Social Network Platform (4 days)

**Goal:** Full social network — posts, feeds, follows, groups, DMs, stories (Twitter + IG + FB).

| Task | Status | Notes |
|---|---|---|
| packages/social — SocialProfile, Follow, SocialPost, Group, DMThread, DMMessage, Reaction | NOT STARTED | See docs/social/social-graph.md |
| Social feed algorithm (home + explore + trending) | NOT STARTED | See docs/social/feed-algorithm.md |
| Social API routes (/social/*) | NOT STARTED | |
| Stories (24h TTL, Dexie.js offline cache) | NOT STARTED | See docs/social/stories-spec.md |
| Group creation + membership | NOT STARTED | |
| Direct messaging (AES-256-GCM at rest) | NOT STARTED | See docs/social/dm-privacy.md |
| Verification badge (NIN/BVN blue-tick gated) | NOT STARTED | |
| AI moderation pipeline (classifier + human queue) | NOT STARTED | See docs/social/social-moderation.md |
| NITDA Code of Practice compliance | NOT STARTED | Self-assessment checklist |
| Boosted content / sponsored feed placement | NOT STARTED | |
| Offline feed cache (last 50 posts, IndexedDB) | NOT STARTED | |
| USSD trending feed integration (*384# → 3) | NOT STARTED | apps/ussd-gateway |
| Naija Pidgin (pcm) post labelling | NOT STARTED | |
| Block / mute / close-friends lists | NOT STARTED | See docs/social/social-graph.md |
| D1 migrations: social_profiles, follows, posts, groups, dm_threads, reactions, stories | NOT STARTED | Migrations 0025–0034 |
| Tests: 60+ covering all social features | NOT STARTED | |
| Base44 QA audit — M7d | NOT STARTED | |
| Founder approval — M7d | NOT STARTED | |

---

### M7e — Nigeria UX Polish (2 days)

**Goal:** Airtime top-up, LGA selector component, Naija Pidgin locale, dark mode.

| Task | Status | Notes |
|---|---|---|
| Airtime top-up flow (Telcos via Paystack or Termii) | NOT STARTED | |
| LGA selector UI component (all 774 LGAs from packages/geography) | NOT STARTED | |
| Naija Pidgin (pcm) locale strings (i18next) | NOT STARTED | |
| Dark mode implementation (design-system tokens) | NOT STARTED | |
| USSD shortcode UI display component (*384#) | NOT STARTED | |
| Low-data mode (compressed images, text-only option) | NOT STARTED | |
| Tests: 10+ covering UX components | NOT STARTED | |
| Lighthouse PWA score ≥ 80 (all apps) | NOT STARTED | |
| Base44 QA audit — M7e | NOT STARTED | |
| Founder approval — M7e | NOT STARTED | |

---

### M7 QA + Launch Gate

| Task | Status | Notes |
|---|---|---|
| All M7 packages typecheck clean (0 errors) | NOT STARTED | |
| Total tests ≥ 360 (300 baseline + 60 M7 target) | NOT STARTED | Stretch: 500+ |
| Lighthouse PWA score ≥ 80 on all customer-facing apps | NOT STARTED | |
| NITDA Code of Practice self-assessment complete | NOT STARTED | |
| CBN KYC compliance audit (all 4 tiers enforced + tested) | NOT STARTED | |
| NDPR consent records audit (all 11 data_types covered) | NOT STARTED | |
| Security penetration test (OTP replay, BVN enumeration) | NOT STARTED | |
| USSD shortcode NCC registration submitted (*384#) | NOT STARTED | |
| Agent float ledger reconciliation test | NOT STARTED | |
| Base44 full QA audit — M7 | NOT STARTED | |
| Founder approval — Milestone 7 | NOT STARTED | |

---

## Total M7 Deliverables

| Phase | Duration | Deliverables |
|---|---|---|
| M7a — Regulatory Survival | 3 days | Identity + OTP + KYC + NDPR + Rate Limiting |
| M7b — Offline + Agents | 3 days | Dexie.js + USSD + POS float ledger |
| M7c — Community Platform | 4 days | Skool-style: forums + courses + events + memberships |
| M7d — Social Network | 4 days | Posts + feeds + DMs + groups + stories |
| M7e — Nigeria UX | 2 days | Airtime + LGA + Pidgin + dark mode |
| **Total** | **19 days** | **84 tasks across 5 phases** |


---

### M7f — Integration + Multi-Channel Contact (3 days)

**Goal:** Cross-vertical testing, multi-channel contact rollout, final M7 docs, QA gate.

| Task | Status | Notes |
|---|---|---|
| packages/contact — ContactChannels entity + ContactService | NOT STARTED | See docs/contact/multi-channel-model.md |
| Contact verification API routes (/contact/*) | NOT STARTED | See docs/contact/contact-verification.md |
| OTP routing algorithm (preference + fallback chain) | NOT STARTED | See docs/contact/otp-routing.md |
| Multi-channel form in claim-first onboarding | NOT STARTED | See docs/governance/claim-first-onboarding.md |
| Telegram Bot (@WebWakaBot) setup + webhook | NOT STARTED | apps/ussd-gateway or standalone Worker |
| WhatsApp Business API connection (Termii/360dialog) | NOT STARTED | See docs/identity/otp-channels.md |
| D1 migration: contact_channels (0036) | NOT STARTED | |
| NDPR consent per channel (P12 enforcement) | NOT STARTED | See docs/enhancements/m7/ndpr-consent.md |
| Primary phone mandatory guard (P13 enforcement) | NOT STARTED | See packages/auth/src/guards.ts |
| Rate limiting per channel (R9 enforcement) | NOT STARTED | RATE_LIMIT_KV |
| Cross-vertical integration smoke tests | NOT STARTED | All M7a-M7e packages working together |
| docs/contact/ finalized (3 files) | NOT STARTED | |
| Tests: 20+ covering contact + OTP routing | NOT STARTED | |
| Base44 QA audit — M7f | NOT STARTED | |
| Founder approval — M7f | NOT STARTED | |


---

## Updated M7 Totals (M7f included)

| Phase | Duration | Scope |
|---|---|---|
| M7a — Regulatory Survival | 3 days | Identity + OTP + KYC + NDPR + Rate Limiting |
| M7b — Offline + Agents | 3 days | Dexie.js + USSD + POS float ledger |
| M7c — Community Platform | 4 days | Skool-style: forums + courses + events + memberships |
| M7d — Social Network | 4 days | Posts + feeds + DMs + groups + stories |
| M7e — Nigeria UX | 2 days | Airtime + LGA + Pidgin + dark mode |
| M7f — Integration + Multi-Channel Contact | 3 days | SMS/WhatsApp/Telegram contact + cross-vertical QA |
| **Total** | **22 days** | **91 deliverables** |

**Tests target:** 360+ (300 M6 baseline + 60 M7 new)
**KYC tiers target:** All 4 tiers (0–3) enforced + tested
**OTP channels target:** SMS + WhatsApp + Telegram all verified working


---

## M7 Docs Approval Record

| Item | Status | Date |
|---|---|---|
| M7 governance docs complete | ✅ DONE | 2026-04-08 |
| PR #20 merged to main | ✅ DONE | 2026-04-08 07:41 WAT |
| Founder approval | ✅ APPROVED | 2026-04-08 07:41 WAT |
| M7 docs phase | ✅ COMPLETE | Ready for M7a implementation |

**Merge SHA:** 4dec402
**Branch:** feat/m7-docs-complete → main
**Files changed:** 61
**Insertions:** 2818

All governance documents, entity schemas, platform invariants (P9-P13), security rules (R5-R10), and package stubs are now on main. Replit Agent may begin M7a implementation.

---

