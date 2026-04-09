# WebWaka SuperAgent — Consolidated Execution Roadmap (12–24 Months)

**Status:** APPROVED — New Source of Truth for all AI and SuperAgent timelines  
**Date:** 2026-04-09  
**Merges:** M8-AI Phase Plan (M8a-AI-1–4) into SuperAgent phased structure  
**Authority:** Overrides all previous AI implementation timelines in isolation  

---

> **3-in-1 Platform Position Statement:**  
> WebWaka SuperAgent is the **cross-cutting intelligence layer** — it is NOT a fourth platform pillar.  
> This roadmap schedules SA work that enhances Pillar 1 (Ops), Pillar 2 (Branding), and Pillar 3 (Marketplace).  
> See `docs/governance/3in1-platform-architecture.md` for the full pillar map.

---

## Roadmap Governance Rules

1. **This roadmap is the single source of truth** for all AI and SuperAgent implementation work
2. All M8-AI-1–4 tasks from `docs/implementation/m8-ai-phase-plan.md` are merged below — that document is now a **Phase 1 dependency detail**, not a parallel plan
3. All M8b–M8e vertical AI tasks reference this roadmap for ordering
4. Any new AI feature must be placed in a phase of this roadmap before implementation begins
5. Outdated AI timelines in individual vertical framework docs are superseded by this document

---

## Phase 0 — Foundation Audit and Planning (COMPLETE)

**Duration:** 3 days  
**Status:** ✅ DONE — Completed 2026-04-08/09

### Deliverables (All Complete)
- [x] Phase 0 repo audit (`docs/planning/m8-ai-phase0-repo-audit.md`)
- [x] Existing context map (`docs/planning/m8-ai-existing-context-map.md`)
- [x] Gap analysis (`docs/planning/m8-ai-gap-analysis.md`)
- [x] Architecture Decision Log ADL-001–ADL-009 (`docs/planning/m8-ai-architecture-decision-log.md`)
- [x] AI Platform Master Plan (`docs/governance/ai-platform-master-plan.md`)
- [x] AI Capability Matrix (`docs/governance/ai-capability-matrix.md`)
- [x] AI Provider Routing (`docs/governance/ai-provider-routing.md`)
- [x] AI Billing and Entitlements (`docs/governance/ai-billing-and-entitlements.md`)
- [x] AI Agent Autonomy (`docs/governance/ai-agent-autonomy.md`)
- [x] AI Integration Framework (`docs/governance/ai-integration-framework.md`)
- [x] AI Context Map (`docs/governance/ai-context-map.md`)
- [x] AI Repo Wiring (`docs/governance/ai-repo-wiring.md`)
- [x] M8-AI Phase Plan (`docs/implementation/m8-ai-phase-plan.md`)
- [x] Vertical AI Research Template (`docs/templates/vertical-ai-research-template.md`)
- [x] QA Framework (`docs/qa/ai-platform-qa-framework.md`)
- [x] **SuperAgent synthesis, product spec, system architecture, roadmap, update plan, governance rules** (this set)

---

## Phase 1 — SuperAgent Core: Keys, Wallets, Routing (M8-AI-1 through M8-AI-3)

**Target Duration:** 10–14 days  
**Target Start:** Immediately after Phase 0 docs approved  
**Status:** 🔲 PLANNED  

### Pre-Vertical Tasks

| Task | Package/App | Description | ADL Reference |
|---|---|---|---|
| **SA-1.1** Expand AIProvider union type | `packages/ai-abstraction` | Expand to 15 provider IDs + `byok_custom`. Retain all existing interfaces unchanged | ADL-001, ADL-009 |
| **SA-1.2** Add capability types | `packages/ai-abstraction/src/capabilities.ts` | NEW: `AICapabilityType`, `AICapabilitySet`, `evaluateAICapability()` | ADL-001, ADL-003 |
| **SA-1.3** Build routing engine | `packages/ai-abstraction/src/router.ts` | NEW: `resolveAdapter()` with 5-level chain + SuperAgent key at level 3 | ADL-002 |
| **SA-1.4** Build openai-compat adapter | `packages/ai-adapters/src/openai-compat.ts` | Serves all OpenAI-compatible providers. `baseUrl` override pattern | ADL-009 |
| **SA-1.5** Build Anthropic adapter | `packages/ai-adapters/src/anthropic.ts` | Native `/v1/messages` format. BYOK-only (no platform Anthropic key) | ADL-010 |
| **SA-1.6** Build Google adapter | `packages/ai-adapters/src/google.ts` | Native Google REST format. BYOK-only | ADL-010 |
| **SA-1.7** Add Eden AI adapter | `packages/ai-adapters/src/edenai.ts` | NEW: Eden AI aggregator. Multimodal: STT, TTS, translation | ADL-010 |
| **SA-1.8** WakaCU wallet package | `packages/wc-wallet` | NEW: `deductWC()`, `creditWC()`, `getBalance()`, `topUpIntent()` | ADL-008 |
| **SA-1.9** SuperAgent key issuance | `packages/ai-abstraction/src/superagent-keys.ts` | NEW: Key generation, storage (KV encrypted), lifecycle management | ADL-010 |
| **SA-1.10** D1 migrations 0037–0044 | `infra/db/migrations/` | `ai_provider_keys` (0037), `ai_usage_logs` (0038), `ai_credits`→`wc_wallets`/`wc_transactions` (0039–0040), `ai_hitl` (0041), `workspace_ai_settings` (0042), `superagent_keys` (0043), `partner_credit_pools` (0044) | ADL-004, ADL-005, ADL-008 |
| **SA-1.11** Env vars | `apps/api/src/env.ts` | Add aggregator keys (OpenRouter, Together, Groq, Eden). Add SA_KEY_KV, SA_KEY_ENCRYPTION_KEY. REMOVE any planned direct OpenAI/Anthropic/Google platform keys | ADL-010 |

### API Routes

| Task | Route File | Endpoints |
|---|---|---|
| **SA-1.12** SuperAgent chat route | `apps/api/src/routes/superagent.ts` | `POST /v1/superagent/chat`, `POST /v1/superagent/embed` |
| **SA-1.13** BYOK key management | `apps/api/src/routes/ai-keys.ts` | `POST /ai/keys`, `GET /ai/keys`, `DELETE /ai/keys/:id` |
| **SA-1.14** WC credit management | `apps/api/src/routes/ai-credits.ts` | `POST /billing/ai-credits/initiate`, `GET /billing/ai-credits/balance` |
| **SA-1.15** Super-admin AI controls | `apps/api/src/routes/admin-ai.ts` | `PATCH /admin/ai/policy`, `GET /admin/ai/usage`, `POST /admin/ai/credits/grant` |

### Tests Required

| Package/App | Test File | Min Tests |
|---|---|---|
| `packages/ai-adapters` | `openai-compat.test.ts` | ≥10 |
| `packages/ai-adapters` | `anthropic.test.ts` | ≥5 |
| `packages/ai-adapters` | `google.test.ts` | ≥3 |
| `packages/ai-adapters` | `edenai.test.ts` | ≥5 |
| `packages/ai-abstraction` | `router.test.ts` | ≥15 |
| `packages/wc-wallet` | `wallet.test.ts` | ≥12 |
| `packages/ai-abstraction` | `superagent-keys.test.ts` | ≥8 |
| `apps/api` | `superagent.test.ts` | ≥10 |
| `apps/api` | `ai-keys.test.ts` | ≥8 |
| `apps/api` | `ai-credits.test.ts` | ≥6 |
| **Total Phase 1** | | **≥82 new tests** |

### Acceptance Criteria

```
[ ] pnpm -r typecheck — 0 errors across all packages
[ ] pnpm -r test — all ≥828 tests passing (746 baseline + ≥82 new)
[ ] SuperAgent key issued on workspace AI enablement
[ ] POST /v1/superagent/chat → 200 with WC deducted
[ ] POST /v1/superagent/chat → 402 when WC balance = 0
[ ] POST /ai/keys → 201 with OpenRouter BYOK key registered
[ ] BYOK key registered → subsequent chat uses BYOK (no WC deducted)
[ ] All aggregator adapters (OpenRouter, Together, Groq, Eden) health-checked in KV
[ ] Migrations 0037–0044 applied cleanly on staging D1
```

---

## Phase 2 — Vertical Integration, Agent Workflows, Partner Resale

**Target Duration:** 21–30 days  
**Target Start:** Phase 1 Acceptance complete  
**Status:** 🔲 PLANNED  

### Pre-Vertical Tasks

| Task | Description | Depends On |
|---|---|---|
| **SA-2.1** SuperAgent SDK | `packages/superagent-sdk/` — typed helpers for verticals: `chat()`, `embed()`, `agentRun()`. Eliminates raw HTTP calls from vertical packages | Phase 1 complete |
| **SA-2.2** Agent runtime | `POST /v1/superagent/agent` — multi-step workflow executor, HITL gate, step-by-step audit trail | SA-1.3, SA-1.12 |
| **SA-2.3** Automation runtime | `POST /v1/superagent/automate` — cron-triggered AI automations via Cloudflare Workers CRON | SA-2.2 |
| **SA-2.4** Partner credit console | `apps/partner-admin/` extensions — partner pool purchase, tenant allocation, usage monitoring | SA-1.14 |
| **SA-2.5** Partner credit routes | `apps/api/src/routes/partner-credits.ts` — `POST /partner/credits/purchase`, `POST /partner/credits/allocate/:workspaceId` | Migration 0044 |
| **SA-2.6** Usage dashboard API | `GET /workspaces/:id/ai/usage` — per-capability, per-day usage stats for workspace admin | SA-1.12 |
| **SA-2.7** Update document suite | All docs listed in `05-document-update-plan.md` Phase 2 list | Phase 0 planning complete |

### Vertical-Specific Tasks (All P1 Verticals)

Each P1 vertical must complete:

1. Fill `docs/templates/vertical-ai-research-template.md` for the vertical
2. Add `AI_CAPABILITY_SET` to vertical package config
3. Declare `AUTONOMY_LEVEL` per use case
4. Declare `HITL_REQUIRED` per use case
5. Import `packages/superagent-sdk` — never call AI routes directly
6. Add `ai-prompts.ts` with vertical-specific system prompts
7. Register vertical in `ai_vertical_configs` D1 table

| Vertical | Package | Target Milestone | Priority AI Feature |
|---|---|---|---|
| POS Business | `packages/verticals-pos-business` | M8b | Product description gen, inventory anomaly |
| Motor Park | `packages/verticals-motor-park` | M8c | Route demand prediction, incident report |
| Community | `packages/community` | M8b | Course outline gen, moderation assist |
| Social | `packages/social` | M8b | Caption gen, hashtag suggestion, translation |
| Market | `packages/verticals-market` | M8e | Vendor catalog enrichment, price insight |
| Church/FBO | `packages/verticals-church` | M8d | Announcement gen, sermon summary |
| NGO/Civic | `packages/verticals-ngo` | M8d | Grant application assist, report gen |
| Restaurant | `packages/verticals-restaurant` | M9 | Menu description, customer reply draft |
| Hotel | `packages/verticals-hotel` | M9 | Room description, booking confirmation |
| Pharmacy | `packages/verticals-pharmacy` | M9 | Patient safety flags (L0, read-only) |
| Logistics | `packages/verticals-logistics` | M9 | Route summary, incident report |
| Savings Group | `packages/verticals-savings-group` | M10 | Ajo schedule summary, member update |
| Legal | `packages/verticals-legal` | M8e | Document draft (L1, HITL mandatory) |
| Politician | `packages/verticals-politician` | M8d | Speech draft (L1, HITL mandatory) |
| Clinic | `packages/verticals-clinic` | M8d | Triage classification (L0, HITL mandatory) |
| School | `packages/verticals-school` | M8e | Lesson plan, student progress summary |
| Real Estate | `packages/verticals-real-estate` | M8e | Property description, market comparison |

### Acceptance Criteria (Phase 2)

```
[ ] SuperAgent SDK v1.0 released (packages/superagent-sdk)
[ ] POST /v1/superagent/agent — multi-step workflow executes with HITL gate
[ ] Partner console: partner can allocate WC to tenant workspace
[ ] Tenant workspace consumes partner WC, not own subscription WC
[ ] At least 3 P1 verticals have full AI integration (SDK + prompts + config)
[ ] Usage dashboard shows per-workspace AI spend breakdown
```

---

## Phase 3 — Multimodal, Advanced Routing, Observability (M10 timeframe)

**Target Duration:** 30–45 days  
**Target Start:** Phase 2 complete  
**Status:** 🔲 PLANNED  

### Tasks

| Task | Description |
|---|---|
| **SA-3.1** Media generation routes | `POST /v1/superagent/media` — image gen, TTS, STT. Eden AI as primary aggregator. |
| **SA-3.2** Multi-aggregator cost router | Compare cost across OpenRouter/Together/Groq per-request; pick cheapest that meets latency SLA |
| **SA-3.3** Prompt caching via Portkey | Add Portkey as optional observability + caching layer for Enterprise workspaces |
| **SA-3.4** SuperAgent white-label SDK | Partners can embed SuperAgent in their own frontend apps with custom branding |
| **SA-3.5** Advanced spend analytics | Heatmaps, cost-per-vertical, model-level breakdown; exported as CSV |
| **SA-3.6** Auto top-up | Workspace admin enables auto-recharge: triggers Paystack recurring charge when WC balance < threshold |
| **SA-3.7** Multi-agent orchestration | Multiple specialized agents collaborating on one task (e.g., researcher + writer + editor agents) |
| **SA-3.8** On-device inference PoC | Phi-4 via WebAssembly for offline-capable AI on Nigerian low-data devices |
| **SA-3.9** Voice agent PoC | STT → LLM → TTS loop for USSD-adjacent (not USSD) voice interaction |

### Vertical-Specific Phase 3

- All M10 P2 verticals adopt SuperAgent SDK
- All remaining P1 verticals complete AI integration if not done in Phase 2
- Clinic, Legal, Politician verticals: voice transcription for sensitive records (HITL mandatory)

---

## Phase 4 — Enterprise, Compliance, Fine-tuning (M11–M12 timeframe)

**Target Duration:** 45–60 days  
**Target Start:** Phase 3 complete  
**Status:** 🔲 PLANNED  

### Tasks

| Task | Description |
|---|---|
| **SA-4.1** Nigerian language fine-tuned models | Open-weights base (Llama 3.1 or Qwen 2.5) fine-tuned on Hausa, Yoruba, Igbo corpus. Self-hosted via Together/RunPod or Cloudflare AI Workers |
| **SA-4.2** SOC 2 Type II readiness | AI usage logs, access controls, and audit trail packaged for compliance export |
| **SA-4.3** NDPR Article 30 register | Automated AI processing activity register for NDPR compliance export |
| **SA-4.4** Enterprise spend controls | Per-user, per-team, per-project WC budgets within Enterprise workspace |
| **SA-4.5** Compliance-mode AI | Strict content filter mode for regulated sectors (clinic, legal, political) |
| **SA-4.6** AI audit export | Full AI interaction audit export for regulator review (anonymized) |
| **SA-4.7** SuperAgent marketplace | Curated agent templates per vertical — community-contributed and WebWaka-curated |

---

## Milestone to Phase Mapping

| WebWaka Milestone | SuperAgent Phase | Key AI Deliverables |
|---|---|---|
| M8a (current) | Phase 1 | Core: routing engine, adapters, wallets, SuperAgent key, basic chat |
| M8b | Phase 2 (start) | POS Business AI, Community AI, Social AI + SuperAgent SDK |
| M8c | Phase 2 (mid) | Transport verticals AI + Partner resale console |
| M8d | Phase 2 (end) | Civic, Political, Clinic AI (HITL) + Usage dashboard |
| M8e | Phase 2 (end) | Commerce, Creator, Legal AI |
| M9 | Phase 3 (start) | Media generation, advanced routing, P2 verticals AI |
| M10 | Phase 3 (mid-end) | Multi-agent, voice PoC, on-device PoC |
| M11 | Phase 4 (start) | Nigerian fine-tuned models, SOC 2 readiness |
| M12 | Phase 4 (end) | Enterprise compliance, AI marketplace |

---

## Dependency Graph

```
Phase 0 (DONE)
  └─→ Phase 1 (routing engine + wallets + SuperAgent key + basic routes)
        └─→ Phase 2 (SDK + agents + partner resale + vertical integration)
              ├─→ Phase 3 (multimodal + advanced routing + voice PoC)
              │     └─→ Phase 4 (fine-tuning + compliance + enterprise)
              └─→ All M8b–M8e vertical AI work (runs in parallel with Phase 2)
```

---

## Deprecated / Superseded Plans

| Superseded Document/Section | Replaced By | Action Required |
|---|---|---|
| `docs/implementation/m8-ai-phase-plan.md` tasks M8a-AI-1 to M8a-AI-4 | Phase 1 tasks SA-1.1 to SA-1.15 in this roadmap | Update status in that doc; add reference to this roadmap as authority |
| Direct OpenAI/Anthropic/Google platform keys in `ai-provider-routing.md` §1 | Aggregator keys only (ADL-010) | Update §1 immediately |
| Any vertical framework doc with standalone AI timeline | This roadmap's vertical-specific tasks | Add reference to this roadmap |

---

*For document update mandates, see `docs/governance/superagent/05-document-update-plan.md`.*
