# WebWaka SuperAgent — Product and Feature Specification

**Status:** APPROVED — New Source of Truth for SuperAgent product definition  
**Date:** 2026-04-09  
**Depends on:** `docs/governance/superagent/01-synthesis-report.md`  
**Authority:** Extends `docs/governance/entitlement-model.md`, `docs/governance/ai-policy.md`  

---

> **3-in-1 Platform Position Statement:**  
> WebWaka SuperAgent is the **cross-cutting intelligence layer** — it is NOT a fourth platform pillar.  
> SuperAgent enhances Pillar 1 (Ops), Pillar 2 (Branding), and Pillar 3 (Marketplace) but does not constitute an independent product surface.  
> All AI capabilities are exposed through the UI of one of the three pillars, and are gated by subscription tier and NDPR consent.  
> See `docs/governance/3in1-platform-architecture.md` for the full pillar map.

---

## 1. What Is WebWaka SuperAgent

WebWaka SuperAgent is the **unified AI orchestration platform layer** for all WebWaka products. It is not a standalone product — it is a **core platform service**, equivalent in architectural role to the auth layer, billing layer, and entitlements layer.

SuperAgent provides:

1. **A managed AI API key** for every WebWaka user and workspace that enables AI — no vendor account required
2. **A prepaid credit wallet** denominated in NGN (stored as WakaCU — WebWaka Credit Units)
3. **AI routing** across best-fit aggregators (OpenRouter, Together, Groq, Eden AI) — no direct vendor relationships
4. **Policy and safety enforcement** — spend caps, NDPR consent gates, HITL triggers, content filters
5. **Usage metering and audit** — per-request logging, per-workspace dashboards, compliance export
6. **Tiered access** — Free, Growth, Pro, Business, Enterprise tiers with defined capability and quota gates
7. **Partner resale** — partners can purchase credit bundles wholesale and allocate to their tenant workspaces
8. **BYOK override** — users and workspaces can supply their own aggregator key to bypass managed credit consumption

---

## 2. Core Capabilities

SuperAgent exposes five capability families. All route through the aggregator abstraction layer — never directly to a vendor.

| Capability Family | Sub-capabilities | Min Tier |
|---|---|---|
| **Text** | Generation, summarization, classification, translation, drafting, email, product descriptions, code assist | Growth |
| **Multimodal** | Image generation (Flux, DALL-E via aggregator), image understanding (vision), STT (Whisper via aggregator), TTS (Nigerian voices) | Pro |
| **Search and Research** | Web enrichment, semantic search (embeddings), knowledge base Q&A | Pro |
| **Agents** | Single-step agents, multi-step agentic workflows, long-running batch agents, HITL-gated agents | Business |
| **Automations** | Scheduled AI tasks, trigger-response automations, CRM-style AI workflows | Business |

### 2.1 Platform-Enforced Exclusions (All Tiers)

The following are never permitted regardless of tier or BYOK status:

- AI calls on USSD path (`X-USSD-Session` header present → immediate short-circuit before AI)
- Autonomous write to financial tables (`float_ledger`, `agent_wallets`, `payments`, `subscriptions`)
- Raw BVN, NIN, or phone number sent to any AI provider (SHA-256 hash only)
- AI processing of personal data without prior NDPR consent record

---

## 3. Access Tiers

### 3.1 Tier Definitions

| Tier | Monthly Included WC | Capabilities | BYOK Override | Notes |
|---|---|---|---|---|
| **Free** | 200 WakaCU | Text only (cost tier, Nigerian models) | No | Taste-test; 30-day trial allocation |
| **Growth** | 1,000 WakaCU | Text, email gen, support chat, sales assist | Workspace only | SME entry tier |
| **Pro** | 5,000 WakaCU | Growth + embeddings, STT, TTS, analytics insights | Workspace + User | Mid-market |
| **Business** | 20,000 WakaCU | Pro + image gen, image understanding, basic agents | Workspace + User | Vertical power users |
| **Enterprise** | 100,000 WakaCU | All capabilities + advanced agents, automations, DB write assist | All BYOK types | Large orgs; negotiated pricing |
| **Partner** | 200,000 WakaCU pool | All Enterprise + resale console + sub-tenant allocation | All | Partners buy wholesale, allocate to tenants |

Monthly included WC resets on subscription billing date. Does not roll over. BYOK usage is metered but does not consume monthly WC.

### 3.2 Trial Allocation (All New Workspaces)

On workspace creation, a **one-time 30-day trial** is granted regardless of plan tier:

| Capability | Trial WakaCU | Notes |
|---|---|---|
| Text generation | 50 WC | ~50,000 tokens at cost tier |
| Embeddings | 100 WC | ~1M embedding tokens |
| STT | 150 WC | ~30 minutes audio |
| TTS | 50 WC | ~50,000 characters |
| Image generation | 250 WC | 5 images |
| Agents | 100 WC | 3–5 workflow runs |

Trial exhausts before monthly allocation. Trial expiry does not block access — it stops platform-funded trial WC.

---

## 4. The WebWaka Credit System (WakaCU)

### 4.1 What Is a WakaCU

A **WakaCU (WebWaka Credit Unit)** is the internal accounting unit for all AI usage on the SuperAgent platform.

1 WakaCU represents a normalized unit of AI compute roughly equivalent to:
- **1,000 input tokens + 500 output tokens** at the cost model tier (DeepSeek V3 / Llama 3.3 via aggregator)
- Or a scaled equivalent for other modalities (see §4.2)

WakaCU abstracts away provider pricing volatility — users always know what they are buying in WakaCU, regardless of which aggregator or model WebWaka routes through internally.

### 4.2 Capability to WakaCU Conversion Table

| Capability | Input | Output | WakaCU Cost |
|---|---|---|---|
| Text — cost tier | 1,000 tokens in | 500 tokens out | 1 WC |
| Text — best tier | 1,000 tokens in | 500 tokens out | 6 WC |
| Text — multilingual tier | 1,000 tokens in | 500 tokens out | 3 WC |
| Text — reasoning tier | 1,000 tokens in | 500 tokens out | 8 WC |
| Summarization | 2,000 tokens in | 200 tokens out | 1 WC |
| Classification | 500 tokens in | 50 tokens out | 0.5 WC (round up) |
| Embeddings | 10,000 tokens | — | 1 WC |
| STT (speech-to-text) | 1 minute audio | — | 5 WC |
| TTS (text-to-speech) | 1,000 characters | — | 2 WC |
| Image generation (1024×1024) | 1 image | — | 50 WC |
| Image understanding (vision) | 1 image analysis | 500 tokens | 25 WC |
| Video generation (per second) | 1 second | — | 100 WC |
| Video understanding (per minute) | 1 minute | 1,000 tokens | 40 WC |
| Web research / enrichment | 1 query | 2,000 tokens | 15 WC |
| AI support chat (per exchange) | 500 tokens | 300 tokens | 2 WC |
| Agentic step | Per capability | — | Capability rate |
| Automation step | Per capability | — | Capability rate |
| Database write assist | 2,000 tokens | 500 tokens | 30 WC |

### 4.3 Aggregator Cost → WakaCU Margin Model

WebWaka sources AI compute exclusively from aggregators. The margin model is:

| Provider Route | Est. Cost / WC (USD) | Est. Cost / WC (NGN @₦1,650/USD) | WakaCU Retail | Platform Margin |
|---|---|---|---|---|
| DeepSeek V3 via OpenRouter | $0.00028 | ₦0.46 | ₦1.50 | ~70% |
| Llama 3.3 via Groq | $0.00009 | ₦0.15 | ₦1.50 | ~90% |
| GPT-4o via OpenRouter (best tier) | $0.0028 | ₦4.62 | ₦9.00 | ~48% |
| Claude 3.5 via OpenRouter (best tier) | $0.0036 | ₦5.94 | ₦9.00 | ~34% |
| Flux / Recraft image via Together | $0.008/image | ₦13.20 | ₦75 (50 WC × ₦1.50) | ~82% |

*Exchange rate, aggregator pricing, and volume discounts will vary. The margin model is directionally correct. Actual rates must be revalidated quarterly.*

### 4.4 WakaCU Retail Pricing

| Unit | Price (NGN) | WC/₦ | Notes |
|---|---|---|---|
| 1 WakaCU (pay-as-you-go) | ₦1.50 | 0.67 | No minimum |
| 5,000 WC Starter Pack | ₦6,500 | 0.77 | 3% savings |
| 20,000 WC Growth Pack | ₦24,000 | 0.83 | 7% savings |
| 100,000 WC Pro Pack | ₦105,000 | 0.95 | 30% savings |
| 500,000 WC Business Pack | ₦450,000 | 1.11 | 40% savings |
| 2,000,000 WC Enterprise Pack | ₦1,500,000 | 1.33 | 50% savings |
| Custom negotiated | — | — | Enterprise and Partner tier |

*All prices in NGN. Paystack is the payment processor. Credit pack purchases are non-refundable per terms.*

---

## 5. The SuperAgent API Key

### 5.1 What It Is

When a user or workspace **enables AI** on WebWaka, the platform automatically issues a **WebWaka SuperAgent API key**. This key:

- Is managed by WebWaka (not the user)
- Draws from the user's/workspace's WakaCU balance
- Routes requests through the SuperAgent routing engine → aggregator pool → best model
- Is the **default BYOK** — if a user has not supplied their own aggregator key, the SuperAgent key is used
- Carries the platform's policy, safety, and compliance enforcement automatically

### 5.2 Key Lifecycle

```
1. User/workspace enables AI (workspace settings or onboarding)
   → Platform generates unique SuperAgent key (prefix: sk-waka-)
   → Key stored in D1 `superagent_keys` table (hashed; encrypted value in KV)
   → Key ID stored in `workspace_ai_settings.superagent_key_id`

2. User makes AI request (via vertical UI or direct API)
   → Auth middleware resolves workspace + user context
   → Router checks: user BYOK key first, workspace BYOK key second
   → If none: use SuperAgent key for this workspace
   → Deduct WC from workspace wallet (or user wallet if user-scoped request)

3. SuperAgent key rotation (quarterly or on compromise)
   → New key generated; old key invalidated after 24h grace period
   → Workspace admin notified; no action required (transparent rotation)

4. User disables AI or workspace plan downgraded below AI tier
   → SuperAgent key suspended (not deleted — 90-day retention for audit)
```

### 5.3 SuperAgent Key vs User BYOK

| Aspect | SuperAgent Key (Managed) | User BYOK Key (Self-Supplied) |
|---|---|---|
| Provider | WebWaka aggregator pool | User's own OpenRouter/Together/etc account |
| Cost | Deducted from WakaCU wallet | User pays aggregator directly; WebWaka meters only |
| Models available | All SuperAgent-configured models | All models on user's aggregator |
| Policy enforcement | Full WebWaka policy applied | WebWaka compliance gates still enforced; user responsible for aggregator-level policy |
| Setup required | None (auto-issued on AI enable) | User must register key via `POST /ai/keys` |
| Recommendation | Default for all users | Recommended for power users, high-volume workspaces, or workspaces needing specific models |

---

## 6. BYOK Model

### 6.1 Overview

BYOK remains fully supported. The **SuperAgent key is the default**, but any user or workspace admin can register their own key at any time.

Supported BYOK providers (all OpenAI-compatible via `openai-compat` adapter):
- **OpenRouter** (recommended — 200+ models, single key)
- **Together AI**
- **Groq**
- **Fireworks AI**
- **Eden AI**
- **Portkey** (with own upstream keys configured)
- **DeepSeek** (direct)
- **Qwen / Alibaba DashScope** (direct)
- **byok_custom** — any OpenAI-compatible endpoint (user declares `baseUrl`, `model`, capabilities)

Anthropic (native adapter) and Google (native adapter) are also supported for BYOK where users supply their own keys.

### 6.2 BYOK Registration Flow

```
1. Workspace admin or user calls POST /ai/keys
   Body: { provider, apiKey, capabilities[], modelPreference? }

2. Platform performs live validation (1-token completion call)
   → If validation fails → 422 with provider error message
   → If validation passes → continue

3. Platform hashes key (SHA-256) and encrypts (AES-GCM, DM_MASTER_KEY pattern)
   → Store in D1 ai_provider_keys
   → Never return raw key in API responses

4. On AI request: router checks user BYOK → workspace BYOK → SuperAgent key
   → BYOK usage: no WC deduction; platform meters usage in ai_usage_logs (funded_by: 'user_byok' | 'workspace_byok')
```

### 6.3 BYOK Override Scope

| User Action | Effect |
|---|---|
| Register personal BYOK key | All AI requests by that user use their BYOK key (highest priority) |
| Register workspace BYOK key | All workspace requests (except users with personal BYOK) use workspace key |
| No BYOK registered | SuperAgent managed key used; WC deducted |
| BYOK key fails | Router falls through to SuperAgent key; admin notified |

---

## 7. Partner Resale Model

### 7.1 Overview

Partners on the `partner` or `sub_partner` subscription tier can:
1. **Purchase credit bundles wholesale** at ₦0.60/WC (partner rate = 60% of retail)
2. **Allocate credits to tenant workspaces** within their partner hierarchy
3. **Mark up and resell** at any price up to ₦1.50/WC retail (WebWaka does not control partner resale price)
4. **Monitor usage** across all tenants via Partner Admin console

### 7.2 Partner Credit Flow

```
WebWaka sells to Partner (wholesale rate)
  → Partner credit pool funded via Paystack
  → Partner admin allocates WC to tenant workspaces
  → Tenant workspace consumes WC from partner allocation
  → Partner admin can top-up, reduce, or revoke allocation
  → WebWaka meters total partner pool consumption for billing reconciliation
```

### 7.3 Partner Credit Rules

- Partner pool is scoped: tenants cannot spend more than their partner allocation
- Tenant workspaces cannot see other tenants' allocations or usage
- Partner admin can set per-tenant soft and hard limits (WC budget caps)
- If partner pool exhausted: tenant AI requests → 402 (insufficient credits) + notification to partner admin
- Partner resale is opt-in: partner must explicitly enable AI credit resale in their partner settings
- Platform retains compliance authority over all partner-allocated AI usage (NDPR, CBN gates still enforced)

---

## 8. Compliance and Safety

All SuperAgent traffic is subject to the same compliance framework as the original M8-AI plan:

| Gate | Description | Enforced At |
|---|---|---|
| NDPR consent | Personal data requires prior consent record | `requireNDPRConsent()` before AI call |
| CBN KYC | Financial AI features require min KYC Tier 1 | `requireKYCTier(ctx, 1)` |
| USSD exclusion | USSD path is AI-excluded | `X-USSD-Session` header short-circuit |
| Sensitive sector | Politician/Clinic/Legal require HITL | `sensitiveSectorRights` + HITL flag |
| Financial write prohibition | AI cannot write to financial tables autonomously | Autonomy gate: L4+ explicitly required |
| Content moderation | All AI output subject to platform moderation | Post-processing classification |
| Spend caps | Hard limit on WC per workspace per month | WC deduction layer |
| Rate limiting | 60 req/min per workspace, 30 req/min per user | KV sliding window |

---

## 9. Roadmap of Future Capabilities (Not in Phase 1)

| Capability | Target Phase | Notes |
|---|---|---|
| Voice agents (phone call AI) | Phase 3 | NCC regulatory path required |
| On-device inference | Phase 4 | WebAssembly + Phi-4 for offline Nigerian users |
| Fine-tuned Nigerian models | Phase 4 | Hausa/Yoruba/Igbo corpus; open-weights base |
| Multi-agent orchestration | Phase 3 | Multiple specialized agents collaborating on one workflow |
| Video understanding (mobile video) | Phase 3 | Court proceedings, traffic enforcement use cases |
| SuperAgent white-label SDK | Phase 2 | Partners can embed SuperAgent in their own apps |

---

*This document defines what SuperAgent is and what it delivers. For how it is built, see `docs/governance/superagent/03-system-architecture.md`.*
