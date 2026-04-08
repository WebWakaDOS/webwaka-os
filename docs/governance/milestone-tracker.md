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

## Milestone 7 — Full Platform + Community + Social

**Goal:** Launch Community Platform (Skool-style) and Social Network (Twitter+IG+FB style) as full vertical modules. All 57 pre-vertical enhancements must be complete before M7 coding begins (M6a+M6b+M6c done).
**Owner:** Replit Agent (implementation) + Base44 Super Agent (architecture, QA, PR review)
**Overall status:** 🔲 NOT STARTED — depends on M6a + M6b + M6c

**Governance docs:** Created in `feat/m7-docs-update` (PR #19) — see below
**Baseline:** Requires 360+ tests, all 12 migrations (0013–0024), packages/identity, packages/otp

### M7.1 — Community Platform

| Task | Status | Notes |
|---|---|---|
| packages/community — CommunitySpace, Membership, Channel, Post, Event entities | NOT STARTED | See docs/community/community-model.md |
| Community migrations (0025–0028) | NOT STARTED | |
| Community API routes (/community/*) | NOT STARTED | See docs/community/skool-features.md |
| Course modules + lesson progress | NOT STARTED | |
| Community membership payment + KYC gating | NOT STARTED | See docs/community/community-entitlements.md |
| Member leaderboard | NOT STARTED | |
| Community event RSVP + SMS reminders | NOT STARTED | |
| Invite link system | NOT STARTED | |
| Community broadcast DMs | NOT STARTED | |
| Offline lesson cache (Service Worker) | NOT STARTED | |
| NDPR consent at community join | NOT STARTED | |
| Community moderation integration | NOT STARTED | |
| Tests: 60+ covering all community items | NOT STARTED | |

### M7.2 — Social Network Platform

| Task | Status | Notes |
|---|---|---|
| packages/social — SocialProfile, Follow, Post, Group, DM, Reaction | NOT STARTED | See docs/social/social-graph.md |
| Social migrations (0029–0034) | NOT STARTED | |
| Feed algorithm — home + explore + trending | NOT STARTED | See docs/social/feed-algorithm.md |
| Social API routes (/social/*) | NOT STARTED | |
| Stories (24hr TTL posts) | NOT STARTED | |
| Group creation + membership | NOT STARTED | |
| Direct messaging | NOT STARTED | |
| Verification badge (NIN/BVN-gated blue tick) | NOT STARTED | |
| Moderation pipeline (AI classifier + human queue) | NOT STARTED | See docs/social/social-moderation.md |
| NITDA Code of Practice compliance | NOT STARTED | |
| Boosted content / sponsored feed placement | NOT STARTED | |
| Offline feed cache (last 50 posts in IndexedDB) | NOT STARTED | |
| USSD trending feed (*384# → 3) | NOT STARTED | |
| Naija Pidgin (pcm) post labelling | NOT STARTED | |
| Tests: 60+ covering all social items | NOT STARTED | |

### M7.3 — QA + Launch Gate

| Task | Status | Notes |
|---|---|---|
| All M7 packages typecheck clean | NOT STARTED | |
| Total tests ≥ 500 (360 baseline + M7 additions) | NOT STARTED | |
| Lighthouse PWA score ≥ 80 | NOT STARTED | |
| NITDA Code of Practice self-assessment | NOT STARTED | |
| CBN KYC compliance audit (all tiers enforced) | NOT STARTED | |
| NDPR consent records audit | NOT STARTED | |
| Security penetration test (OTP replay, BVN enumeration) | NOT STARTED | |
| Base44 full QA audit | NOT STARTED | |
| Founder approval — Milestone 7 | NOT STARTED | |
