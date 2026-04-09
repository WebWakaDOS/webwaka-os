# WebWaka SuperAgent — Synthesis and Gap Analysis Report

**Status:** APPROVED — Supersedes scattered M8-AI planning references on SuperAgent  
**Date:** 2026-04-09  
**Authority:** Extends `docs/governance/ai-policy.md` (M1), TDR-0009, ADL-001–ADL-009  
**New Source of Truth for:** WebWaka's AI service-provider layer, SuperAgent architecture, partner AI resale  

---

> **3-in-1 Platform Position Statement:**  
> WebWaka SuperAgent is the **cross-cutting intelligence layer** — it is NOT a fourth platform pillar.  
> SuperAgent enhances Pillar 1 (Ops), Pillar 2 (Branding), and Pillar 3 (Marketplace) but does not constitute an independent product surface.  
> All AI capabilities are exposed through the UI of one of the three pillars, and are gated by subscription tier and NDPR consent.  
> See `docs/governance/3in1-platform-architecture.md` for the full pillar map.

---

## 1. Synthesis Objective

This document captures the complete pre-existing WebWaka AI landscape, maps every artifact to the SuperAgent introduction, and produces a structured gap analysis. It is the **mandatory first reading** for any agent implementing AI features.

---

## 2. Internal Audit: What Already Exists

### 2.1 Infrastructure and Type Contracts (Executed)

| Artifact | Location | Status | SuperAgent Relevance |
|---|---|---|---|
| AI provider abstraction interface | `packages/ai-abstraction/src/types.ts` | ✅ Executed (M3) | Core — SuperAgent builds on top of this |
| `AIAdapter` interface (`complete`, `embed`) | `packages/ai-abstraction/src/types.ts` | ✅ Executed | SuperAgent routing engine wraps this |
| `aiRights: boolean` in plan-config | `packages/entitlements/src/plan-config.ts` | ✅ Executed | Retained as master on/off switch (ADL-003) |
| TDR-0009: AI Provider Abstraction | `docs/architecture/decisions/0009-*.md` | ✅ Accepted | All SuperAgent traffic routes through this abstraction — no violation |
| AI Policy (M1) | `docs/governance/ai-policy.md` | ✅ Approved | SuperAgent is consistent: provider-neutral, BYOK-capable, governed |

### 2.2 Planning Documents (Planned, Not Yet Implemented)

| Document | Location | Status | What SuperAgent Changes |
|---|---|---|---|
| AI Platform Master Plan | `docs/governance/ai-platform-master-plan.md` | Planning baseline | **Section 2 (hierarchy)** must add SuperAgent layer. **Section 5/6 (platform keys)** must reflect aggregator-only sourcing |
| AI Provider Routing | `docs/governance/ai-provider-routing.md` | Planning baseline | **Section 1 (platform keys)** must change: platform keys are NOW ONLY aggregator keys. Remove direct OpenAI/Anthropic/Google as platform-side relationships |
| AI Billing and Entitlements | `docs/governance/ai-billing-and-entitlements.md` | Planning baseline | **Credit pricing must be economically viable for SuperAgent margin**. Add partner resale model. Add user-level wallet concept |
| AI Capability Matrix | `docs/governance/ai-capability-matrix.md` | Planning baseline | Add SuperAgent default key column per capability |
| AI Agent Autonomy | `docs/governance/ai-agent-autonomy.md` | Planning baseline | SuperAgent is the execution layer for autonomy levels L3–L5 |
| AI Integration Framework | `docs/governance/ai-integration-framework.md` | Planning baseline | All vertical AI must route through SuperAgent layer, not raw provider |
| AI Context Map | `docs/governance/ai-context-map.md` | Planning baseline | Add SuperAgent as a new touchpoint category |
| AI Repo Wiring | `docs/governance/ai-repo-wiring.md` | Planning baseline | Add `packages/superagent/` as new package |
| M8-AI Phase Plan | `docs/implementation/m8-ai-phase-plan.md` | Planning baseline | Phases M8a-AI-1–4 must incorporate SuperAgent key issuance and wallet primitives |
| ADL-001–ADL-009 | `docs/planning/m8-ai-architecture-decision-log.md` | Planning baseline | Add ADL-010: SuperAgent Aggregator-Only Platform Architecture |
| M8-AI Phase 0 Repo Audit | `docs/planning/m8-ai-phase0-repo-audit.md` | Planning baseline | Gap list must add: no SuperAgent key issuance, no user credit wallets, no partner resale engine |
| M8-AI Gap Analysis | `docs/planning/m8-ai-gap-analysis.md` | Planning baseline | Add SuperAgent-specific gaps as Priority 0 (must implement before M8a-AI-2) |
| Vertical AI Research Template | `docs/templates/vertical-ai-research-template.md` | Planning baseline | Add SuperAgent routing declaration section |
| M9–M12 Framework | `docs/milestones/m9-m12-framework.md` | Planning baseline | All verticals in M9–M12 use SuperAgent as the AI layer |
| Entitlement Model | `docs/governance/entitlement-model.md` | Approved | Add SuperAgent tier dimensions |
| Partner Model | `docs/governance/partner-and-subpartner-model.md` | Approved | Add partner AI credit resale rights |

### 2.3 Implemented Code (Executed, M7 and below)

| Code Artifact | Location | Status | SuperAgent Impact |
|---|---|---|---|
| Float ledger (agent wallet pattern) | `packages/pos/src/float-ledger.ts` | ✅ Executed | **Reusable pattern** — SuperAgent credit wallet mirrors this pattern |
| Paystack payment webhook | `packages/payments/src/subscription-sync.ts` | ✅ Executed | **Reusable** — credit pack purchases use same Paystack webhook flow |
| AES-GCM key encryption | `packages/social/src/encryption.ts` | ✅ Executed | **Reusable** — BYOK key encryption uses this pattern (ADL-004) |
| KV-based rate limiting | `apps/api/src/middleware/rate-limit.ts` | ✅ Executed | **Reusable** — SuperAgent request throttle uses same KV sliding window |
| JWT auth middleware | `apps/api/src/middleware/auth.ts` | ✅ Executed | SuperAgent API key auth supplements (does not replace) JWT |
| D1 migration infrastructure | `infra/db/migrations/` | ✅ Executed | SuperAgent needs migrations 0037–0044 |

---

## 3. What Was Already Aligned with SuperAgent

The following elements of the existing plan are fully compatible with and supportive of SuperAgent:

| Element | Why Already Aligned |
|---|---|
| Provider-neutral abstraction (TDR-0009) | SuperAgent routes through `AIAdapter` — no violation |
| BYOK model | SuperAgent issues a managed key; users can still override with their own aggregator key |
| Credit unit (CU) accounting model | CU is the right unit; pricing calibration is needed but structure is correct |
| Five-level resolution chain (ADL-002) | Level 3 (platform key) now means "SuperAgent-issued aggregator key" — chain is identical |
| Autonomy levels L0–L5 | SuperAgent enforces these at the routing layer — compatible |
| NDPR / CBN compliance gates | SuperAgent is bound by the same compliance requirements |
| D1 + KV storage patterns | SuperAgent uses the same infrastructure |
| Vertical integration framework | Verticals call `resolveAdapter()` — SuperAgent is behind that call |
| Rate limiting pattern | Identical — SuperAgent adds spend-cap enforcement on top |

---

## 4. What Needs to Change

### 4.1 Critical Changes (Block Implementation)

| Change | Why | Affects |
|---|---|---|
| **Platform keys = aggregator keys ONLY** | SuperAgent does not have direct vendor relationships; all platform AI sourced from OpenRouter, Together, Groq, Eden AI | `ai-provider-routing.md` §1, `ai-platform-master-plan.md` §5, `m8-ai-phase-plan.md` |
| **SuperAgent managed key as user default** | Every AI-enabled user gets a WebWaka-issued API key backed by SuperAgent; this IS their BYOK default | `ai-provider-routing.md` §2, `ai-billing-and-entitlements.md` |
| **Credit pricing calibration** | Existing ₦0.05/CU is economically unviable; revised model: ₦1.50/CU retail, ₦1.00/CU bulk | `ai-billing-and-entitlements.md` §1, `ai-capability-matrix.md` |
| **ADL-010 must be written** | Documents the aggregator-only platform architecture decision | `docs/planning/m8-ai-architecture-decision-log.md` |
| **Partner AI resale** | Partners buy credit bundles at wholesale; resell to tenants at own margin | `ai-billing-and-entitlements.md` (new section) |
| **User-level credit wallet** | Current model is workspace-only; SuperAgent adds per-user credit wallet for consumer AI use | `ai-billing-and-entitlements.md`, migrations |

### 4.2 Important Additions (Should Not Block Phase 1)

| Addition | Why | Affects |
|---|---|---|
| SuperAgent API gateway routes | `/v1/superagent/*` is the external-facing API | New file: `apps/api/src/routes/superagent.ts` |
| SuperAgent SDK | Client-side helper for verticals to call SuperAgent consistently | New: `packages/superagent-sdk/` |
| Partner resale console | Admin UI for partners to manage credit pool and tenant allocations | New: `apps/partner-admin/` extensions |
| Eden AI as fourth aggregator | Eden AI provides image, STT, TTS, translation via one API — fills gaps | `ai-provider-routing.md` §5c additions |
| Credit auto-top-up for consumers | Consumer tier: auto-recharge wallet when below threshold | `ai-billing-and-entitlements.md` §8 |

### 4.3 What Was Missing Entirely

| Gap | Description | Phase to Address |
|---|---|---|
| WebWaka as AI service provider | No existing plan described WebWaka issuing AI API keys to users | Phase 1 |
| SuperAgent key issuance and lifecycle | No key generation, key rotation, key revocation flow for WebWaka-managed keys | Phase 1 |
| Aggregator-only sourcing policy | Existing plan assumed direct provider relationships for platform keys | Phase 1 |
| User-level credit wallet (consumer) | Existing model is workspace-only; consumer users need personal AI wallets | Phase 1 |
| Partner AI credit resale console | Partners need to buy wholesale + allocate to tenants | Phase 2 |
| Eden AI integration | Not in existing provider registry | Phase 2 |
| SuperAgent SDK package | Verticals need a typed client for SuperAgent routes | Phase 2 |
| Multi-aggregator cost routing | Cost comparison across OpenRouter/Together/Groq per request | Phase 3 |
| Observability dashboard | Per-workspace, per-user, per-vertical AI spend analytics | Phase 3 |

---

## 5. Document and Artifact Inventory

### 5.1 Files That Must Be Updated BEFORE Phase 1 Implementation

| File | Owner | Change Required |
|---|---|---|
| `docs/governance/ai-platform-master-plan.md` | Platform team | Add SuperAgent layer (§2), change platform key model (§5), add SuperAgent section (new §12) |
| `docs/governance/ai-provider-routing.md` | Platform team | §1: aggregator-only platform keys. §2–3: SuperAgent managed key concept |
| `docs/governance/ai-billing-and-entitlements.md` | Platform team | Reprice CU model. Add partner resale. Add user wallet. |
| `docs/planning/m8-ai-architecture-decision-log.md` | Platform team | Add ADL-010 |

### 5.2 Files That Must Be Updated BEFORE Phase 2 Implementation

| File | Owner | Change Required |
|---|---|---|
| `docs/governance/ai-integration-framework.md` | Platform team | Add SuperAgent routing declaration per vertical domain |
| `docs/governance/entitlement-model.md` | Platform team | Add SuperAgent tier dimensions |
| `docs/governance/partner-and-subpartner-model.md` | Platform team | Add partner AI credit resale rights |
| `docs/templates/vertical-ai-research-template.md` | Platform team | Add SuperAgent routing declaration section |
| All M8b–M8e framework docs | Vertical teams | Add SuperAgent routing requirement per vertical |

### 5.3 New Files to Create

| File | Purpose | Phase |
|---|---|---|
| `docs/governance/superagent/01-synthesis-report.md` | This document | Immediate |
| `docs/governance/superagent/02-product-spec.md` | Product and feature spec | Immediate |
| `docs/governance/superagent/03-system-architecture.md` | Technical RFC | Immediate |
| `docs/governance/superagent/04-execution-roadmap.md` | 12–24 month roadmap | Immediate |
| `docs/governance/superagent/05-document-update-plan.md` | Detailed update mandates | Immediate |
| `docs/governance/superagent/06-governance-rules.md` | Governance and consistency | Immediate |

---

## 6. Key Architectural Shift Summary

```
BEFORE (M8-AI original plan):
  Platform keys = Direct API keys to OpenAI, Anthropic, Google
  BYOK = User/workspace brings their own key to any provider
  Billing = WebWaka charges workspace credits (opaque to end user)
  Partner AI = Not defined

AFTER (SuperAgent):
  Platform keys = ONLY aggregator keys (OpenRouter, Together, Groq, Eden AI)
  SuperAgent key = WebWaka-managed key issued to each AI-enabled user/workspace
                   backed by aggregator pool; default BYOK if user brings nothing
  User BYOK = User can override with own OpenRouter/Together/etc key
  Billing = WebWaka Credits (WC) — prepaid, NGN-denominated, Paystack-powered
             User wallet + workspace wallet + partner pool
  Partner AI = Partners buy wholesale credits; allocate to tenant workspaces
```

---

## 7. What Is Deprecated or Replaced

| Deprecated Concept | Replaced By | Notes |
|---|---|---|
| Direct OpenAI/Anthropic/Google platform keys | Aggregator keys (OpenRouter, Together, Groq, Eden) | WebWaka does not hold direct vendor relationships for platform-side traffic |
| Workspace-only credit model | User wallet + workspace wallet + partner pool | Hierarchical credit model |
| ₦0.05/CU pricing | ₦1.50/CU retail, ₦1.00/CU bulk, ₦0.60/CU wholesale (partner) | Economically viable pricing |
| No managed API key for users | SuperAgent key issued on AI enablement | Default BYOK experience |

---

*This document is the authoritative starting point for all SuperAgent planning. Read it before reading any other SuperAgent document.*
