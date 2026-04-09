# WebWaka SuperAgent — Document Update Plan

**Status:** APPROVED — Authoritative list of all files requiring update for SuperAgent alignment  
**Date:** 2026-04-09  
**Authority:** Extends `docs/governance/superagent/01-synthesis-report.md`  
**Rule:** No agent may implement AI features until all Phase 1 document updates below are complete  

---

> **3-in-1 Platform Position Statement:**  
> WebWaka SuperAgent is the **cross-cutting intelligence layer** — it is NOT a fourth platform pillar.  
> SuperAgent enhances Pillar 1 (Ops), Pillar 2 (Branding), and Pillar 3 (Marketplace) but does not constitute an independent product surface.  
> All AI capabilities are exposed through the UI of one of the three pillars.  
> See `docs/governance/3in1-platform-architecture.md` for the full pillar map.

---

## How to Use This Document

1. Before beginning any AI implementation task, check this document
2. Verify that all documents tagged "Before Phase N" have been updated for your target phase
3. After updating a document, mark it with a ✅ and the date
4. If you find a conflict between a document and the SuperAgent plan, **the SuperAgent plan wins** — flag the conflict and update the older document

---

## Phase 1 Updates (Must Complete Before Any Implementation)

### DOC-001 — `docs/governance/ai-platform-master-plan.md`

**Owner:** Platform team  
**Priority:** P0 — blocks all implementation  
**Status:** 🔲 TODO

| Section | What to Change |
|---|---|
| §2 (User/Admin/Provider Hierarchy) | Add "SuperAgent Layer" between Super Admin and Workspace Admin. Show SuperAgent key issuance flow |
| §5 (Billing — Funding Sources) | Level 3 ("Platform key") now means "SuperAgent managed key backed by aggregator pool". Not a direct vendor key |
| §6 (BYOK Policy) | Add: "When AI is enabled, a SuperAgent managed key is auto-issued as the default BYOK. User-supplied BYOK keys override the managed key" |
| §9 (Model Routing — Aggregator Strategy) | Expand OpenRouter from "recommended" to "primary platform aggregator". Add Together, Groq, Eden AI as co-aggregators |
| New §12 | Add: "WebWaka SuperAgent" — brief description pointing to `docs/governance/superagent/` suite |
| §11 (Implementation Phases) | Update: M8a-AI-1–4 are now Phase 1 tasks in `docs/governance/superagent/04-execution-roadmap.md`. This section points to that roadmap |

---

### DOC-002 — `docs/governance/ai-provider-routing.md`

**Owner:** Platform team  
**Priority:** P0 — blocks all implementation  
**Status:** 🔲 TODO

| Section | What to Change |
|---|---|
| §1 (Super-Admin Platform Keys) | **CRITICAL CHANGE:** Remove `OPENAI_API_KEY_1/2`, `ANTHROPIC_API_KEY_1`, `GOOGLE_AI_API_KEY_1` as platform keys. Replace with: `OPENROUTER_API_KEY_1/2`, `TOGETHER_API_KEY_1`, `GROQ_API_KEY_1`, `EDEN_AI_KEY_1`. Add note: "Direct OpenAI/Anthropic/Google keys are user/workspace BYOK only — not platform keys (ADL-010)" |
| §2 (Workspace BYOK) | Add: SuperAgent managed key concept. When no BYOK registered, SuperAgent key (level 3 in chain) is used. Document `superagent_keys` table |
| §4 (Key Vault Design) | Add new row: "SuperAgent keys — CF KV (SA_KEY_KV) — AES-GCM (SA_KEY_ENCRYPTION_KEY) — Workspace-scoped managed keys" |
| §5a (Adapter Architecture) | Rename `openai.ts` → `openai-compat.ts` in table. Add Eden AI row (adapter: `edenai.ts`) |
| §5b (First-Party Providers) | Add note: "OpenAI, Anthropic, Google are available as BYOK providers — not as platform providers (ADL-010)" |
| §5c (Aggregators) | Add Eden AI row: `edenai` / `https://api.edenai.run/v2` / TTS, STT, Translation, Vision / "Recommended for multimodal platform capabilities" |
| §8 (Failover Ordering) | Replace "platform: openai key_1" with "platform: openrouter key_1" throughout. Replace "platform: anthropic key_1" with "platform: together key_1". Aggregator keys only |
| New §14 | Add: "SuperAgent Aggregator-Only Architecture (ADL-010)" — rationale and reference to system architecture RFC |

---

### DOC-003 — `docs/governance/ai-billing-and-entitlements.md`

**Owner:** Platform team  
**Priority:** P0 — blocks billing implementation  
**Status:** 🔲 TODO

| Section | What to Change |
|---|---|
| §1 (Metering Units) | Add WakaCU definition section. Update CU pricing to economically viable rates (see product spec §4.4). Reference: 1 CU = 1,000 input + 500 output tokens — definition unchanged; NGN price updated |
| New after §4 | Add: "Partner Resale Model" — wholesale rate ₦0.60/WC, allocation flow, partner pool tables |
| §8 (Workspace Policy Overrides) | Add: `auto_top_up: boolean`, `auto_top_up_threshold_wc`, `auto_top_up_pack` |
| D1 Schema section | Replace `ai_credits` migration schema with new `wc_wallets` + `wc_transactions` + `partner_credit_pools` + `partner_tenant_allocations` schemas |
| New section after D1 Schema | Add: "SuperAgent Key D1 Schema" — `superagent_keys` table |

---

### DOC-004 — `docs/planning/m8-ai-architecture-decision-log.md`

**Owner:** Platform team  
**Priority:** P0 — required for audit trail  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| Fix ADL ordering | ADL-009 currently appears before ADL-008. Reorder so ADL-008 (Credits) precedes ADL-009 (Aggregators + Chinese Providers) |
| Add ADL-010 | Full text: "SuperAgent Aggregator-Only Platform Architecture" (context, decision, alternatives rejected, consequences). Content is in `03-system-architecture.md` |

---

### DOC-005 — `docs/implementation/m8-ai-phase-plan.md`

**Owner:** Platform team  
**Priority:** P1 — update before implementation begins  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| Header | Add: "SUPERSEDED FOR ORDERING BY `docs/governance/superagent/04-execution-roadmap.md`. This document remains as Phase 1 technical detail reference." |
| M8a-AI-1 section | Add SA-1.9 (SuperAgent key issuance), SA-1.10 (wc_wallets migrations) as additional tasks |
| M8a-AI-1 env vars | Remove planned `OPENAI_API_KEY_1/2`, `ANTHROPIC_API_KEY_1`, `GOOGLE_AI_API_KEY_1` from env vars list. Replace with aggregator keys per ADL-010 |
| M8a-AI-2 section | Add SA-1.7 (Eden AI adapter) |
| Migration 0041 | Fix `workspace_ai_settings.model_tier` CHECK constraint: must include `multilingual` and `reasoning` (currently only `cost`/`best`) |

---

## Phase 2 Updates (Must Complete Before Vertical AI Work)

### DOC-006 — `docs/governance/ai-integration-framework.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Section | What to Change |
|---|---|
| Architectural Principle | Add: "Verticals MUST use `packages/superagent-sdk` to call AI. They must NOT import `packages/ai-abstraction` directly. The SDK is the vertical-facing contract" |
| All vertical sections | Add "SuperAgent Declaration" subsection per vertical: capability set, autonomy level, HITL requirement, which `superagent-sdk` method to call |

---

### DOC-007 — `docs/governance/entitlement-model.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| AI rights dimension | Expand to include: "SuperAgent tier (Free/Growth/Pro/Business/Enterprise)" and "Partner AI credit resale rights" |
| Add new table | "SuperAgent Tier → Included WC / Capabilities / BYOK scope" mapping (from product spec §3.1) |

---

### DOC-008 — `docs/governance/partner-and-subpartner-model.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| Rules section | Add Rule 7: "Partners on the `partner` tier may purchase AI credit bundles wholesale and allocate WC to their tenant workspaces. Credits are scoped per-tenant — no cross-tenant sharing" |
| Add new section | "Partner AI Credit Resale" — wholesale rate, allocation flow, partner console reference |

---

### DOC-009 — `docs/templates/vertical-ai-research-template.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| Add new section | "Section 13: SuperAgent Integration Declaration" — must declare: `capability_set[]`, `autonomy_level` per use case, `hitl_required` per use case, `superagent_sdk_method` per use case, `sensitive_sector: boolean` |

---

### DOC-010 — `docs/governance/ai-capability-matrix.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| All capability tables | Add row: "SuperAgent Default Key" — which aggregator route is used by the SuperAgent managed key for this capability |
| Text Generation | Update "Providers Allowed" to note: OpenAI/Anthropic/Google only available as user BYOK; platform traffic routes via aggregators |

---

### DOC-011 — M8b–M8e Framework Docs

**Owner:** Vertical teams  
**Files:** `docs/milestones/m8b-framework.md`, `m8c-framework.md`, `m8d-framework.md`, `m8e-framework.md`  
**Priority:** P1 — before respective milestone implementation begins  
**Status:** 🔲 TODO

| Change per file | What to Do |
|---|---|
| AI section | Add: "All AI features in this milestone use `packages/superagent-sdk`. Declare capability set and autonomy level per feature. See `docs/governance/superagent/04-execution-roadmap.md` for Phase 2 vertical integration checklist." |

---

### DOC-012 — `docs/planning/m8-ai-phase0-repo-audit.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| §1.8 (Env Variables) | Add note: "ADL-009 added OPENROUTER_API_KEY_1, DEEPSEEK_API_KEY_1, QWEN_API_KEY_1, GROQ_API_KEY_1, MINIMAX_API_KEY_1. ADL-010 adds EDEN_AI_KEY_1, SA_KEY_KV, SA_KEY_ENCRYPTION_KEY. OPENAI/ANTHROPIC/GOOGLE keys are user BYOK only — not platform keys." |
| §1.1 (AIProvider type) | Add note: "Current M3 state: 4 values. M8a-AI-1 expansion: 15 values (see ADL-009, ADL-010)." |

---

### DOC-013 — `docs/planning/m8-ai-gap-analysis.md`

**Owner:** Platform team  
**Priority:** P1  
**Status:** 🔲 TODO

| Change | What to Do |
|---|---|
| "Must Be Created" section | Change `packages/ai-adapters/src/openai.ts` → `openai-compat.ts`. Add `edenai.ts` row. Add `packages/superagent-sdk/` and `packages/wc-wallet/` as new P0 gaps |
| Add new P0 gap | "SuperAgent key issuance and lifecycle management — no implementation exists" |
| Add new P0 gap | "WakaCU credit wallet (user-level + workspace-level + partner pool) — no implementation exists" |

---

## Phase 3 Updates (Before Media/Agent Features)

### DOC-014 — `docs/governance/ai-repo-wiring.md`

| Change | What to Do |
|---|---|
| Adapter filename | `openai.test.ts` → `openai-compat.test.ts`; count ≥10 |
| Add new packages | `packages/superagent-sdk/`, `packages/wc-wallet/` with file trees and test counts |
| Add new routes | `apps/api/src/routes/superagent.ts`, `ai-keys.ts`, `ai-credits.ts`, `partner-credits.ts` |
| Update total test count | Recalculate after Phase 1 adds ≥82 tests |

---

### DOC-015 — `docs/governance/ai-agent-autonomy.md`

| Change | What to Do |
|---|---|
| All sections | Add: "SuperAgent is the execution layer for L3–L5 autonomy. L3+ requires `autonomy.batch` or `autonomy.autonomous` flag in `workspace_ai_settings` AND SuperAgent agent runtime enabled" |

---

### DOC-016 — `docs/governance/ai-context-map.md`

| Change | What to Do |
|---|---|
| Planned touchpoints table | Change `openai.ts` → `openai-compat.ts`. Add Eden AI. Add `superagent_keys` table. Add `wc_wallets` and `partner_credit_pools` tables |
| Add new row | SuperAgent layer as a distinct touchpoint category |

---

## Instructions for Future Implementation Agents

When you are about to implement any AI feature:

1. **Check phase** — which phase does this feature belong to per `04-execution-roadmap.md`?
2. **Verify Phase N documents** — all docs tagged "Before Phase N" must have ✅ status in this file
3. **If a doc is not updated** — update it yourself as the first task, then implement the feature
4. **Never implement using outdated plans** — if this document says a file needs to change, that file's content cannot be treated as authoritative until changed
5. **After implementing** — update `04-execution-roadmap.md` acceptance criteria checkboxes
6. **Online research** — before implementing any provider integration, search for current API documentation and pricing for that aggregator; aggregator APIs and pricing evolve frequently

---

## Conflict Resolution Rule

If any document contradicts the SuperAgent plan:

> **The SuperAgent plan wins.**  
> Update the contradicting document. Flag the conflict in a code comment or PR description.  
> Do not assume the older document is correct.  
> If genuinely ambiguous, escalate to the platform team before implementing.
