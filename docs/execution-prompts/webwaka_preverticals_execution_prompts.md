# WebWaka OS — Pre-Verticals Execution Prompts

**Document type:** Agent execution prompt set  
**Scope:** Pre-vertical infrastructure — SuperAgent core, AI routing, wallets, auth, metering, observability  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Status:** ⛔ SUPERSEDED — DO NOT USE FOR EXECUTION  
**Superseded by:** `docs/execution-prompts/webwaka_preverticals_unified_implementation_plan.md`

---

> ## ⛔ SUPERSESSION NOTICE
>
> **This document has been superseded as of 2026-04-09.**
>
> The unified pre-verticals implementation plan replaces this document in full:
> **`docs/execution-prompts/webwaka_preverticals_unified_implementation_plan.md`**
>
> This document (SA-only plan) was **missing** the following critical work:
> - Phase 0: 3-in-1 alignment foundation (5 tasks — PV-0.1 through PV-0.5)
> - Phase 1: Pillar 2 app scaffolding — `apps/brand-runtime/` (PV-1.1)
> - Phase 1: Pillar 3 app scaffolding — `apps/public-discovery/` (PV-1.2)
> - Phase 1: White-label theming wiring (PV-1.3)
>
> It also omitted pillar labels on all SA task blocks and lacked the migration number registry.
>
> **Any agent reading this document must stop here and switch to the unified plan.**  
> This document is retained for historical reference only.

---

### General rules for all agents using these prompts

- **Never make assumptions** about WebWaka's architecture, API contracts, or business logic.
  Always read the referenced documents and code first.
- **Research deeply** before executing:
  When you do not know the best practice (e.g., for credit-based AI pricing, wallet design, or LLM orchestration via aggregators), do online research and synthesize with WebWaka's context before designing anything.
- **Thoroughness is far more important than speed.**
  You may spend extra time reading, planning, and validating. Do not rush implementation at the cost of correctness or alignment.
- **All work must be pushed to GitHub.**
  No important local work should remain outside the repo. Every task ends with a PR.
- **Follow the SuperAgent-centered plan as the source of truth.**
  Any outdated AI-related instructions or documents must be ignored or explicitly updated — never followed.
- **TypeScript strict mode throughout.** The stack is Cloudflare Workers + Hono + D1 + TypeScript strict. No `any` escapes, no `// @ts-ignore`, no silent fallbacks.
- **Platform Invariants are non-negotiable.** Read `docs/governance/platform-invariants.md` before any implementation. Violations are blocking.

---

## TASK SA-1.1: Expand AI Provider Union Type and Capability Types

- **Module:** `packages/ai-abstraction`
- **Roadmap ref:** SA-1.1, SA-1.2 — SuperAgent Phase 1
- **GitHub context:**
  - Types: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/types.ts
  - Index: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/index.ts
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md
  - Synthesis: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/01-synthesis-report.md
  - Architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - Provider routing: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-provider-routing.md
  - Capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md

---

You are an expert **Senior TypeScript Platform Engineer** specializing in AI infrastructure and provider-neutral type systems, working on WebWaka OS.

**Skills required:**
- TypeScript strict mode — discriminated unions, branded types, type narrowing
- AI provider API contracts (OpenAI-compatible, Anthropic, Google Vertex)
- Cloudflare Workers runtime constraints (no Node.js built-ins)
- WebWaka platform architecture — entitlements, BYOK, credit-based billing

---

**1. Mandatory context reading (100% before execution):**

Read and fully internalize ALL of the following before writing a single line of code:

- `packages/ai-abstraction/src/types.ts` — existing `AIProvider`, `AIAdapter`, `AIRequest`, `AIResponse` types
- `packages/ai-abstraction/src/index.ts` — current exports
- `docs/governance/superagent/01-synthesis-report.md` — section 2 (what already exists) and section 3 (gap analysis)
- `docs/governance/superagent/03-system-architecture.md` — section on type contracts
- `docs/governance/ai-architecture-decision-log.md` — ADL-001 (provider union), ADL-003 (aiRights gate)
- `docs/governance/ai-capability-matrix.md` — full capability list per tier
- `docs/governance/ai-provider-routing.md` — aggregator selection logic
- `docs/governance/platform-invariants.md` — P10 (NDPR consent), P12 (no AI on USSD)

Your understanding must be **100% grounded in these documents**. If any information is missing, contradictory, or unclear, flag it in the PR description before proceeding.

---

**2. Online research and execution plan:**

After reading the context above:

- Research best practices for:
  - Extensible provider union types in TypeScript (discriminated union vs. string literal union)
  - Capability-gating patterns in AI gateway services (OpenRouter, Together, Eden AI architecture)
  - Runtime provider resolution with fallback chains
- Prepare an execution plan covering:
  - **Objective:** Expand `AIProvider` to include all 15 aggregator-accessible provider IDs plus `byok_custom`. Add `AICapabilityType`, `AICapabilitySet`, and `evaluateAICapability()` without breaking any existing callers.
  - **Key steps** (numbered)
  - **Risks and open questions**

---

**3. Implementation workflow:**

Branch: `feat/sa-1-ai-abstraction-types` from `main`.

Implement in `packages/ai-abstraction/src/`:

1. **Expand `AIProvider` union** in `types.ts`:
   - Add all aggregator-routable providers: `openrouter`, `together`, `groq`, `eden`, `fireworks`, `deepinfra`, `perplexity`, `cohere`, `mistral`, `deepseek`, `qwen`, `yi`, `gemini_via_agg`, `claude_via_agg`, `gpt_via_agg`
   - Add `byok_custom` as the BYOK escape hatch
   - Retain `openai`, `anthropic`, `google` for BYOK-only direct paths (ADL-010)
   - Do NOT remove any existing provider IDs — additive only
2. **Create `capabilities.ts`** (new file):
   - `AICapabilityType` union: `text_generation | summarization | classification | translation | embedding | image_generation | image_understanding | stt | tts | web_search | agent_run | automation_run`
   - `AICapabilitySet` — maps each vertical/use-case to required capabilities
   - `evaluateAICapability(cap: AICapabilityType, entitlement: PlanConfig): boolean` — returns true if the current plan grants access; references `packages/entitlements/src/plan-config.ts`
   - `USSD_EXCLUDED_CAPABILITIES: readonly AICapabilityType[]` — all capabilities (P12 invariant)
3. **Update `index.ts`** to export all new types and functions
4. Ensure TypeScript strict mode — zero errors on `pnpm --filter @webwaka/ai-abstraction typecheck`
5. All new types must have JSDoc comments referencing the ADL that governed the decision

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with deep TypeScript type-system expertise.

- Verify that all existing callers of `AIProvider` in the repo still compile (`pnpm -r typecheck`)
- Write tests in `packages/ai-abstraction/src/capabilities.test.ts`:
  - `evaluateAICapability` returns false for all capabilities when `aiRights: false`
  - `evaluateAICapability` returns false for agent/automation capabilities on Growth tier
  - `USSD_EXCLUDED_CAPABILITIES` covers all capability types (P12 invariant)
  - At least 8 test cases
- Confirm zero lint errors (`pnpm --filter @webwaka/ai-abstraction lint`)

---

**5. Finalize and push to GitHub:**

- Commit all changes with message: `feat(ai-abstraction): expand AIProvider union + add AICapabilityType/Set (SA-1.1, SA-1.2)`
- Push branch and open PR against `main`
- PR description must reference ADL-001, ADL-003, and the capability matrix doc
- Checklist in PR: types expanded ✓ | capabilities.ts created ✓ | zero typecheck errors ✓ | tests written ✓

---

## TASK SA-1.2: Build SuperAgent AI Routing Engine

- **Module:** `packages/ai-abstraction` — new `router.ts`
- **Roadmap ref:** SA-1.3 — SuperAgent Phase 1
- **GitHub context:**
  - Types: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/types.ts
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md
  - Provider routing doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-provider-routing.md
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - Entitlements: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/entitlements/src/plan-config.ts
  - Auth: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/auth/src/guards.ts

---

You are an expert **Senior Backend Platform Engineer** specializing in AI gateway routing systems, working on WebWaka OS.

**Skills required:**
- AI gateway and routing patterns (OpenRouter-style aggregator selection, fallback chains)
- Cloudflare Workers + Hono middleware patterns
- TypeScript strict mode — generics, conditional types, narrowing
- Security-first API key resolution (never log, never expose in responses)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/ai-provider-routing.md` — the 5-level resolution chain (user BYOK → workspace BYOK → SuperAgent key → platform aggregator key → deny)
- `docs/governance/superagent/03-system-architecture.md` — routing engine design and aggregator selection matrix
- `docs/governance/ai-architecture-decision-log.md` — ADL-001, ADL-002, ADL-009, ADL-010
- `docs/governance/superagent/02-product-spec.md` — section 2 (capability families) and platform-enforced exclusions
- `packages/ai-abstraction/src/types.ts` — existing interfaces
- `docs/governance/platform-invariants.md` — P10 (NDPR consent gate), P12 (USSD exclusion), P13 (no raw PII to AI)

---

**2. Online research and execution plan:**

- Research: how OpenRouter, Together AI, and Eden AI implement routing and fallback across providers
- Research: secure API key resolution patterns in multi-tenant SaaS (vault patterns, KV-backed secrets)
- Execution plan must cover:
  - **Objective:** Build `resolveAdapter(ctx: RoutingContext): Promise<AIAdapter>` implementing the 5-level chain
  - NDPR consent gate at step 0 — short-circuit if no consent record
  - USSD detection at step 0 — always deny before any resolution
  - SuperAgent key injection at level 3 (from Workers KV `SA_KEY_KV`)
  - Aggregator selection (OpenRouter as primary, Together/Groq as fallback by latency)

---

**3. Implementation workflow:**

Branch: `feat/sa-1-routing-engine` from `main` (or stack on SA-1.1 branch).

Create `packages/ai-abstraction/src/router.ts`:

1. **`RoutingContext` type:**
   - `userId`, `tenantId`, `workspaceId`
   - `userByokKey?: string` (from user-level KV)
   - `workspaceByokKey?: string` (from workspace-level KV)
   - `superagentKey?: string` (from platform KV `SA_KEY_KV`)
   - `capability: AICapabilityType`
   - `isUssdSession: boolean` — derived from `X-USSD-Session` header
   - `hasNdprConsent: boolean` — verified from D1 `consent_records` table
   - `entitlement: PlanConfig`
2. **`resolveAdapter(ctx: RoutingContext, env: Env): Promise<AIAdapter>`** — implements 5-level chain:
   - Level 0: if `ctx.isUssdSession` → throw `AIRoutingError('USSD_EXCLUDED')` (P12)
   - Level 0: if `!ctx.hasNdprConsent` → throw `AIRoutingError('CONSENT_REQUIRED')` (P10)
   - Level 1: if `ctx.userByokKey` → return BYOK adapter
   - Level 2: if `ctx.workspaceByokKey` → return workspace BYOK adapter
   - Level 3: if SuperAgent key in KV → return managed adapter with aggregator selection
   - Level 4: platform fallback aggregator key (env var `PLATFORM_AGG_KEY`)
   - Level 5: throw `AIRoutingError('NO_ADAPTER_AVAILABLE')`
3. **`selectAggregator(capability: AICapabilityType, env: Env): AggregatorConfig`** — returns best-fit aggregator based on capability type and env-configured preferences
4. **`AIRoutingError`** class with typed error codes
5. Export all from `index.ts`

---

**4. QA and verification:**

Write `packages/ai-abstraction/src/router.test.ts` with at minimum:

- USSD session → `USSD_EXCLUDED` error (P12)
- No NDPR consent → `CONSENT_REQUIRED` error (P10)
- User BYOK present → returns user BYOK adapter (highest priority)
- Workspace BYOK present, no user BYOK → returns workspace adapter
- SuperAgent key in KV → returns managed adapter
- No keys at all → `NO_ADAPTER_AVAILABLE` error
- `evaluateAICapability` blocks agent_run on Growth tier
- At least 10 test cases covering the full resolution chain

---

**5. Finalize and push to GitHub:**

- Commit: `feat(ai-abstraction): implement 5-level AI routing engine (SA-1.3)`
- PR references: ADL-002, ADL-009, ADL-010, `docs/governance/ai-provider-routing.md`
- Checklist: routing engine ✓ | USSD gate ✓ | NDPR gate ✓ | BYOK chain ✓ | tests ✓

---

## TASK SA-1.3: Build OpenAI-Compatible and Native Provider Adapters

- **Module:** `packages/ai-adapters` (new package)
- **Roadmap ref:** SA-1.4, SA-1.5, SA-1.6 — SuperAgent Phase 1
- **GitHub context:**
  - AI abstraction types: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/types.ts
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md (ADL-009, ADL-010)
  - Env config: https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/api/src/env.ts
  - Repo wiring doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-repo-wiring.md

---

You are an expert **Senior Backend Engineer** specializing in API adapter patterns and AI provider integrations, working on WebWaka OS.

**Skills required:**
- OpenAI API v1 format — chat completions, embeddings, streaming
- Anthropic Messages API — `/v1/messages` native format
- Google Vertex/Gemini REST API
- Cloudflare Workers `fetch()` with proper timeout and retry patterns
- TypeScript strict mode — generics, `satisfies` operator

---

**1. Mandatory context reading (100% before execution):**

- `packages/ai-abstraction/src/types.ts` — `AIAdapter` interface (what must be implemented)
- `docs/governance/superagent/03-system-architecture.md` — adapter patterns and baseUrl override design
- `docs/governance/ai-architecture-decision-log.md` — ADL-009 (OpenAI-compat serves all aggregators), ADL-010 (native adapters for BYOK-only providers)
- `docs/governance/ai-provider-routing.md` — aggregator baseUrl table
- `docs/governance/platform-invariants.md` — P13 (no raw PII to any AI provider)

---

**2. Online research and execution plan:**

- Research: OpenRouter and Together AI's OpenAI-compatible endpoints and auth patterns
- Research: Anthropic `/v1/messages` vs OpenAI-compat wrapper quirks
- Research: Google Gemini REST API latest format (not vertex SDK — Workers fetch() only)
- Execution plan: 3 adapters — openai-compat (serves all aggregators), anthropic native, google native

---

**3. Implementation workflow:**

Create new package `packages/ai-adapters/` with `package.json`, `tsconfig.json`, `vitest.config.ts`.

**`src/openai-compat.ts`** — serves OpenRouter, Together, Groq, Eden, Fireworks, DeepInfra, Perplexity and any OpenAI-compatible endpoint:
- Constructor: `{ baseUrl: string; apiKey: string; defaultModel?: string }`
- `complete(req: AIRequest): Promise<AIResponse>` — POST to `{baseUrl}/v1/chat/completions`
- `embed(req: AIEmbedRequest): Promise<AIEmbedResponse>` — POST to `{baseUrl}/v1/embeddings`
- Handle HTTP errors → throw `AIAdapterError` with typed codes
- Respect Workers 30s CPU limit — set request timeout to 28s

**`src/anthropic.ts`** — native Anthropic Messages API (BYOK-only, ADL-010):
- POST to `https://api.anthropic.com/v1/messages`
- `anthropic-version: 2023-06-01` header required
- Map `AIRequest` → Anthropic format; map response back to `AIResponse`

**`src/google.ts`** — native Google Gemini REST (BYOK-only, ADL-010):
- POST to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Map `AIRequest` → Gemini `contents` format; map response back to `AIResponse`

**`src/index.ts`** — exports all adapters.

All adapters: zero `any`, full JSDoc, no `console.log` in production paths.

---

**4. QA and verification:**

Write adapter tests using `vi.stubGlobal('fetch', ...)` to mock network calls. At minimum:
- `openai-compat`: successful completion → mapped `AIResponse`; HTTP 429 → `AIAdapterError('RATE_LIMITED')`; HTTP 401 → `AIAdapterError('INVALID_KEY')`; timeout → `AIAdapterError('TIMEOUT')`
- `anthropic`: successful completion → mapped `AIResponse`; format mismatch → typed error
- `google`: successful completion → mapped `AIResponse`
- At least 12 test cases across the three adapters
- `pnpm --filter @webwaka/ai-adapters typecheck` → 0 errors
- `pnpm --filter @webwaka/ai-adapters test` → all pass

---

**5. Finalize and push to GitHub:**

- Commit: `feat(ai-adapters): openai-compat + anthropic + google adapters (SA-1.4-1.6)`
- PR references: ADL-009, ADL-010, adapter patterns doc in architecture
- Add `@webwaka/ai-adapters` to root `pnpm-workspace.yaml` if not already present

---

## TASK SA-1.4: SuperAgent Key Service — Issuance, Storage, and Validation

- **Module:** `packages/superagent` (new), migrations `0042_superagent_keys.sql`, `apps/api/src/routes/superagent-keys.ts`
- **Roadmap ref:** SA-1.7 — SuperAgent Phase 1
- **GitHub context:**
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - Product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md
  - Governance rules: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/06-governance-rules.md
  - Env config: https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/api/src/env.ts
  - Migrations: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md (ADL-004, ADL-005)

---

You are an expert **Senior Security Engineer and Backend Platform Engineer**, working on WebWaka OS.

**Skills required:**
- API key lifecycle management (issuance, rotation, revocation)
- Cryptographic hashing for key storage (SHA-256, bcrypt patterns)
- Cloudflare KV for encrypted secrets; D1 for key metadata
- Multi-tenant isolation — keys must be strictly scoped to `(workspace_id, user_id)`
- Hono route handlers with TypeScript strict mode

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/superagent/03-system-architecture.md` — section on key format (`sk-waka-{32hex}`), storage split (hash in D1, encrypted value in KV `SA_KEY_KV`)
- `docs/governance/superagent/06-governance-rules.md` — key governance constraints
- `docs/governance/ai-architecture-decision-log.md` — ADL-004 (key format), ADL-005 (key storage)
- `apps/api/src/env.ts` — current `Env` type (must extend for `SA_KEY_KV`)
- `apps/api/src/index.ts` — how routes are registered
- `packages/auth/src/guards.ts` — `requireAuth`, `requireKYCTier` patterns (key issuance must require KYC tier)
- `docs/governance/platform-invariants.md` — T3 (tenant isolation on all operations)
- `infra/db/migrations/` — check highest migration number; use 0042 for `superagent_keys`

---

**2. Online research and execution plan:**

- Research: industry patterns for API key hashing (Stripe uses last 4 chars visible + SHA-256 hash stored)
- Research: KV-based encrypted secret storage in Cloudflare Workers
- Research: key rotation patterns without breaking in-flight requests
- Execution plan must cover:
  - Migration 0042: `superagent_keys` table schema
  - Key format: `sk-waka-{32 random hex}` — prefix + entropy
  - Storage: SHA-256 hash in D1, encrypted value in KV `SA_KEY_KV`
  - API: `POST /superagent/keys` (issue), `DELETE /superagent/keys/:id` (revoke), `GET /superagent/keys` (list metadata — never expose raw key after issuance)

---

**3. Implementation workflow:**

Branch: `feat/sa-1-superagent-keys` from `main`.

**Migration `infra/db/migrations/0042_superagent_keys.sql`:**
```sql
CREATE TABLE superagent_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  model_tier TEXT NOT NULL DEFAULT 'standard' CHECK (model_tier IN ('standard', 'premium', 'ultra')),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  revocation_reason TEXT
);
CREATE INDEX idx_sk_tenant ON superagent_keys (tenant_id, status);
CREATE INDEX idx_sk_workspace ON superagent_keys (workspace_id, status);
CREATE INDEX idx_sk_hash ON superagent_keys (key_hash);
```

**`packages/superagent/src/key-service.ts`:**
- `issueKey(ctx: { tenantId, workspaceId, userId, modelTier }, env: Env): Promise<{ keyId: string; rawKey: string }>` — generates key, stores hash in D1, stores encrypted value in `SA_KEY_KV`
- `validateKey(rawKey: string, env: Env): Promise<SuperAgentKeyRecord | null>` — hashes input, looks up in D1, returns record if active
- `revokeKey(keyId: string, ctx: AuthContext, env: Env): Promise<void>` — sets status to 'revoked' in D1, deletes from KV
- `listKeys(workspaceId: string, env: Env): Promise<SuperAgentKeyRecord[]>` — returns metadata only (never raw key)

**`apps/api/src/routes/superagent-keys.ts`:**
- `POST /superagent/keys` — requires auth + KYC tier Growth+; calls `issueKey`; returns `{ keyId, rawKey }` (raw key shown ONCE only)
- `GET /superagent/keys` — requires auth; calls `listKeys`
- `DELETE /superagent/keys/:id` — requires auth; calls `revokeKey`

Update `apps/api/src/env.ts` to add `SA_KEY_KV: KVNamespace`.

---

**4. QA and verification:**

Write `packages/superagent/src/key-service.test.ts` with at minimum:
- `issueKey` returns a key matching `sk-waka-[a-f0-9]{32}` format
- `validateKey` with correct raw key returns the record
- `validateKey` with wrong key returns null
- `validateKey` with revoked key returns null
- `revokeKey` marks key revoked in D1
- T3 invariant: `listKeys` never returns keys from another workspace
- Raw key is never stored in D1 (hash check)
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent): key issuance, validation, revocation — migration 0042 (SA-1.7)`
- PR references: ADL-004, ADL-005, system architecture doc section on key storage

---

## TASK SA-1.5: WakaCU Wallet Service — Credit Wallets and Transactions

- **Module:** `packages/superagent` + migrations `0043_wc_wallets.sql`
- **Roadmap ref:** SA-1.8 — SuperAgent Phase 1
- **GitHub context:**
  - Product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md
  - Billing doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-billing-and-entitlements.md
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md (ADL-006, ADL-007, ADL-008)
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - POS float ledger (reference pattern): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/pos/
  - Migrations: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/

---

You are an expert **Senior Backend Engineer** specializing in ledger-based wallet systems and SaaS billing, working on WebWaka OS.

**Skills required:**
- Ledger-based double-entry wallet design (credit/debit immutable transaction log)
- D1 atomic transactions — preventing balance race conditions
- WakaCU pricing: ₦1.50/WC retail; ₦1.00/WC bulk (100K pack); ₦0.60/WC wholesale
- Integer-only credit storage (P9 invariant — no floating-point credits)
- Paystack webhook integration for top-up

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/superagent/02-product-spec.md` — section 3 (access tiers, credit quotas)
- `docs/governance/ai-billing-and-entitlements.md` — full pricing table, WakaCU denominations, partner resale model
- `docs/governance/superagent/03-system-architecture.md` — wallet schema design and credit burn flow
- `docs/governance/ai-architecture-decision-log.md` — ADL-006 (credit unit economics), ADL-007 (wallet schema), ADL-008 (credits before aggregators in sequencing)
- `packages/pos/` — existing `float_ledger` pattern (analogous design, not shared code)
- `infra/db/migrations/0024_float_ledger.sql` — reference for ledger table pattern
- `docs/governance/platform-invariants.md` — P9 (integer kobo equivalent — integer WC units only)

---

**2. Online research and execution plan:**

- Research: immutable ledger patterns for prepaid credit wallets (Stripe Credits, Twilio credits)
- Research: D1 CHECK constraint patterns for non-negative balance enforcement
- Research: idempotency patterns for wallet top-up via payment webhook
- Execution plan: migration 0043, wallet service (balance read, credit burn, top-up), API routes

---

**3. Implementation workflow:**

Branch: `feat/sa-1-wc-wallets` from `main`.

**Migration `infra/db/migrations/0043_wc_wallets.sql`:**
```sql
CREATE TABLE wc_wallets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  balance_wc INTEGER NOT NULL DEFAULT 0 CHECK (balance_wc >= 0),
  trial_balance_wc INTEGER NOT NULL DEFAULT 0 CHECK (trial_balance_wc >= 0),
  total_credited_wc INTEGER NOT NULL DEFAULT 0,
  total_burned_wc INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_wc_wallet_workspace ON wc_wallets (workspace_id);
CREATE INDEX idx_wc_wallet_tenant ON wc_wallets (tenant_id);

CREATE TABLE wc_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wc_wallets(id),
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'trial_credit', 'trial_debit', 'refund', 'adjustment')),
  amount_wc INTEGER NOT NULL CHECK (amount_wc > 0),
  balance_after_wc INTEGER NOT NULL CHECK (balance_after_wc >= 0),
  reference TEXT,
  description TEXT NOT NULL,
  ai_capability TEXT,
  request_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_wc_txn_wallet ON wc_transactions (wallet_id, created_at DESC);
CREATE INDEX idx_wc_txn_tenant ON wc_transactions (tenant_id, created_at DESC);
```

**`packages/superagent/src/wallet-service.ts`:**
- `getOrCreateWallet(workspaceId: string, tenantId: string, env: Env): Promise<WcWallet>`
- `burnCredits(walletId: string, amountWc: number, meta: BurnMeta, env: Env): Promise<void>` — atomic debit with CHECK constraint; throws `InsufficientCreditsError` if balance too low
- `creditWallet(walletId: string, amountWc: number, type: TransactionType, ref: string, env: Env): Promise<void>`
- `getBalance(workspaceId: string, env: Env): Promise<{ balanceWc: number; trialBalanceWc: number }>`
- `getTransactionHistory(workspaceId: string, env: Env, opts?: PaginationOpts): Promise<WcTransaction[]>`

Trial credits burned first, then paid credits. Balance can never go below zero (D1 CHECK + application-level guard).

---

**4. QA and verification:**

Write `packages/superagent/src/wallet-service.test.ts` with at minimum:
- `burnCredits` succeeds when balance sufficient
- `burnCredits` throws `InsufficientCreditsError` when balance zero
- `burnCredits` burns trial credits first
- `creditWallet` increments balance
- `getBalance` returns accurate balance after multiple operations
- T3: `getBalance` cannot read another workspace's wallet
- Integer-only: `burnCredits` with fractional WC throws (P9 invariant)
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent): WakaCU wallet + transaction ledger — migration 0043 (SA-1.8)`
- PR references: ADL-006, ADL-007, ADL-008, billing doc

---

## TASK SA-1.6: Partner Credit Pool System

- **Module:** `packages/superagent` + migration `0044_partner_credit_pools.sql`
- **Roadmap ref:** SA-1.9 — SuperAgent Phase 1
- **GitHub context:**
  - Product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md (section 7 — partner resale)
  - Billing doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-billing-and-entitlements.md
  - Wallet service: (SA-1.5 above)
  - White-label policy: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/white-label-policy.md
  - Partner model: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/partner-and-subpartner-model.md

---

You are an expert **Senior Backend Engineer** specializing in multi-tier B2B billing and partner credit systems, working on WebWaka OS.

**Skills required:**
- Partner/reseller credit allocation patterns
- Multi-tier pricing (wholesale ₦0.60/WC → partner margin → retail ₦1.50/WC)
- D1 atomic transfers between pool and workspace wallets
- Audit trail requirements for partner credit movements

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/superagent/02-product-spec.md` — section 7 (partner resale model)
- `docs/governance/ai-billing-and-entitlements.md` — wholesale vs. retail pricing, partner margin model
- `docs/governance/partner-and-subpartner-model.md` — partner hierarchy, allocation rules
- `docs/governance/white-label-policy.md` — white-label credit attribution
- `packages/superagent/src/wallet-service.ts` (SA-1.5) — wallet primitives to build on

---

**2. Research and execution plan:**

- Research: B2B credit pool patterns (Twilio subaccounts, Stripe Connect balance transfers)
- Execution plan: migration 0044, pool creation, allocation to workspace, pool balance tracking

---

**3. Implementation workflow:**

Branch: `feat/sa-1-partner-pools` from `main`.

**Migration `infra/db/migrations/0044_partner_credit_pools.sql`:**
```sql
CREATE TABLE partner_credit_pools (
  id TEXT PRIMARY KEY,
  partner_tenant_id TEXT NOT NULL,
  total_wc INTEGER NOT NULL DEFAULT 0 CHECK (total_wc >= 0),
  allocated_wc INTEGER NOT NULL DEFAULT 0 CHECK (allocated_wc >= 0),
  available_wc INTEGER GENERATED ALWAYS AS (total_wc - allocated_wc) VIRTUAL,
  price_per_wc_kobo INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_pool_partner ON partner_credit_pools (partner_tenant_id);

CREATE TABLE partner_credit_allocations (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES partner_credit_pools(id),
  partner_tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  amount_wc INTEGER NOT NULL CHECK (amount_wc > 0),
  reference TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_alloc_pool ON partner_credit_allocations (pool_id, created_at DESC);
CREATE INDEX idx_alloc_workspace ON partner_credit_allocations (workspace_id);
```

**`packages/superagent/src/partner-pool-service.ts`:**
- `allocateFromPool(poolId: string, workspaceId: string, amountWc: number, env: Env): Promise<void>` — atomic: deduct from pool, credit workspace wallet
- `getPoolBalance(partnerTenantId: string, env: Env): Promise<PartnerPoolBalance>`
- `topUpPool(partnerTenantId: string, amountWc: number, ref: string, env: Env): Promise<void>`

---

**4. QA and verification:**

- `allocateFromPool` atomically transfers credits to workspace wallet
- `allocateFromPool` throws when pool has insufficient balance
- Partner cannot allocate to a workspace outside their tenant tree
- At least 8 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent): partner credit pool system — migration 0044 (SA-1.9)`
- PR references: partner model doc, billing doc, ADL-008

---

## TASK SA-1.7: Credit Burn Engine — Per-Request AI Cost Metering

- **Module:** `packages/superagent/src/credit-burn.ts`
- **Roadmap ref:** SA-1.10 — SuperAgent Phase 1
- **GitHub context:**
  - Product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md
  - Capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md
  - Billing doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-billing-and-entitlements.md
  - Wallet service: (SA-1.5)
  - Router: (SA-1.2)

---

You are an expert **Senior Backend Engineer** specializing in usage-based billing and AI cost metering, working on WebWaka OS.

**Skills required:**
- Token-counting and cost estimation for LLM requests
- Atomic debit-before-request patterns (reserve → execute → confirm/refund)
- Async burn recording without blocking the AI response path
- Per-capability cost tables mapped to WakaCU units

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/ai-billing-and-entitlements.md` — per-capability WakaCU cost table
- `docs/governance/ai-capability-matrix.md` — capability → cost → tier mapping
- `docs/governance/superagent/02-product-spec.md` — platform-enforced spend caps, trial quota model
- `docs/governance/superagent/03-system-architecture.md` — credit burn flow diagram
- `packages/superagent/src/wallet-service.ts` — `burnCredits()` interface

---

**2. Research and execution plan:**

- Research: pre-authorization (reserve) patterns to prevent overspend before the AI call completes
- Research: token estimation before API call (rough estimate: 1 WC per ~500 tokens)
- Execution plan: estimator → reserve → execute → finalize (refund excess reservation)

---

**3. Implementation workflow:**

Branch: `feat/sa-1-credit-burn` from `main`.

**`packages/superagent/src/credit-burn.ts`:**
- `estimateCost(capability: AICapabilityType, inputTokens: number, model: string): number` — returns WC cost estimate
- `reserveCredits(walletId: string, estimated: number, env: Env): Promise<string>` — returns reservation ID
- `finalizeburn(reservationId: string, actual: number, env: Env): Promise<void>` — burns actual amount, releases reservation difference
- `burnAndRecord(req: AIRequest, walletId: string, cap: AICapabilityType, env: Env): Promise<BurnRecord>` — convenience wrapper: estimate → reserve → call AI → finalize

**BYOK bypass:** When the routing engine resolves a BYOK adapter (levels 1–2), `burnAndRecord` must skip wallet debit and log `billing_mode: 'byok'` instead.

**Spend cap enforcement:** Before reserving, check workspace's plan cap (`entitlements.monthlyWcCap`). Throw `SpendCapExceededError` if over limit.

---

**4. QA and verification:**

- `estimateCost` for `text_generation` with known token count returns expected WC range
- `burnAndRecord` debits correct amount from wallet
- BYOK path skips wallet debit
- `SpendCapExceededError` thrown when over monthly cap
- Insufficient balance → propagates `InsufficientCreditsError`
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent): credit burn engine with reservation pattern (SA-1.10)`
- PR references: billing doc, capability matrix

---

## TASK SA-1.8: Auth Hooks for AI-Enabled Users

- **Module:** `packages/auth/src/ai-hooks.ts`, `apps/api/src/middleware/ai-auth.ts`
- **Roadmap ref:** SA-1.11 — SuperAgent Phase 1
- **GitHub context:**
  - Auth guards: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/auth/src/guards.ts
  - Auth index: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/auth/src/index.ts
  - Entitlements: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/entitlements/src/plan-config.ts
  - Env config: https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/api/src/env.ts
  - Key service: (SA-1.4)
  - Routing engine: (SA-1.2)

---

You are an expert **Senior Security Engineer** specializing in auth middleware and multi-tenant API security, working on WebWaka OS.

**Skills required:**
- Hono middleware patterns — `c.set()`, `c.get()`, middleware composition
- JWT validation and `AuthContext` enrichment
- Multi-tenant isolation — auth context must carry `tenantId`, `workspaceId`, BYOK presence flag
- NDPR consent pre-flight check before any AI call

---

**1. Mandatory context reading (100% before execution):**

- `packages/auth/src/guards.ts` — existing `requireAuth`, `requireKYCTier` guards
- `packages/entitlements/src/plan-config.ts` — `aiRights` flag, `monthlyWcCap`
- `docs/governance/superagent/03-system-architecture.md` — AI auth hook design
- `docs/governance/ai-provider-routing.md` — BYOK key resolution from headers vs. KV
- `docs/governance/platform-invariants.md` — P10 (NDPR consent), T3 (tenant isolation)

---

**2. Research and execution plan:**

- Research: Hono middleware composition for AI auth pre-flight
- Execution plan: 3 guards: `requireAiRights` (check `aiRights` entitlement), `requireNdprConsent` (check D1 consent_records), `resolveByokKey` (extract BYOK from header or KV)

---

**3. Implementation workflow:**

Branch: `feat/sa-1-ai-auth` from `main`.

**`packages/auth/src/ai-hooks.ts`:**
- `requireAiRights` — Hono middleware; reads entitlement from auth context; returns 403 if `aiRights: false`
- `requireNdprConsent(purpose: string)` — Hono middleware; queries D1 `consent_records`; returns 403 `CONSENT_REQUIRED` if none
- `resolveByokKey` — Hono middleware; checks `X-BYOK-Key` header, then user KV, then workspace KV; sets `c.set('byokKey', ...)` or null

**`apps/api/src/middleware/ai-auth.ts`:**
- Compose `requireAuth` → `requireAiRights` → `requireNdprConsent('ai_usage')` into a single `aiAuthMiddleware`
- Attach `RoutingContext` partial to Hono context for downstream use by routes

Export new guards from `packages/auth/src/index.ts`.

---

**4. QA and verification:**

- `requireAiRights` blocks request when `aiRights: false`
- `requireNdprConsent` blocks when no consent record
- `resolveByokKey` sets key from header when present
- `resolveByokKey` falls back to KV when no header
- Composed `aiAuthMiddleware` blocks USSD sessions (P12)
- At least 8 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(auth): AI auth hooks — requireAiRights, requireNdprConsent, resolveByokKey (SA-1.11)`
- PR references: platform-invariants P10, P12; ai-provider-routing doc

---

## TASK SA-1.9: Usage Metering, Observability, and AI Audit Logging

- **Module:** `packages/superagent/src/usage-meter.ts`, `apps/api/src/routes/superagent-usage.ts`
- **Roadmap ref:** SA-1.12, SA-1.13 — SuperAgent Phase 1
- **GitHub context:**
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - Billing doc: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-billing-and-entitlements.md
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - Events package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/events/
  - AI context map: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-context-map.md

---

You are an expert **Senior Platform Engineer** specializing in SaaS observability, audit logging, and compliance reporting, working on WebWaka OS.

**Skills required:**
- Structured logging patterns for audit compliance (NDPR, CBN)
- Per-request usage metering — token counts, latency, cost, provider used
- Pagination and export patterns for usage dashboards
- PII-safe logging — SHA-256 hashed identifiers only (P13)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/superagent/03-system-architecture.md` — `ai_usage_events` table schema
- `docs/governance/ai-context-map.md` — audit touchpoints across the AI lifecycle
- `docs/governance/platform-invariants.md` — P13 (no raw PII in logs), T3 (tenant scope)
- `packages/events/` — existing `publishEvent` pattern (AI events may extend this)
- `docs/governance/ai-billing-and-entitlements.md` — usage data requirements for billing reconciliation

---

**2. Research and execution plan:**

- Research: NDPR-compliant AI audit log schemas (what must be retained, what must be excluded)
- Research: D1 + Workers analytics for real-time usage dashboards
- Execution plan: `ai_usage_events` table, usage meter service, per-workspace dashboard API

---

**3. Implementation workflow:**

Branch: `feat/sa-1-usage-metering` from `main`.

**Migration (add to 0043 or create 0045):**
```sql
CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id_hash TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('managed', 'byok', 'trial')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_wc INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'rate_limited', 'consent_blocked')),
  error_code TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_aue_workspace ON ai_usage_events (workspace_id, created_at DESC);
CREATE INDEX idx_aue_tenant ON ai_usage_events (tenant_id, created_at DESC);
```

**`packages/superagent/src/usage-meter.ts`:**
- `recordUsageEvent(event: AIUsageEvent, env: Env): Promise<void>` — inserts row (non-blocking with `ctx.waitUntil` pattern in Workers)
- `getUsageSummary(workspaceId: string, period: 'day' | 'week' | 'month', env: Env): Promise<UsageSummary>` — aggregates tokens, cost, request count
- `exportUsageLog(workspaceId: string, from: number, to: number, env: Env): Promise<AIUsageEvent[]>` — for NDPR/CBN export

**`apps/api/src/routes/superagent-usage.ts`:**
- `GET /superagent/usage?period=month` — workspace admin only; returns summary
- `GET /superagent/usage/export?from=&to=` — workspace admin only; returns full log

---

**4. QA and verification:**

- `recordUsageEvent` stores correct fields; never stores raw userId (hash check)
- `getUsageSummary` aggregates correctly across multiple events
- `exportUsageLog` respects date range
- T3: workspace can only see own events
- Status `'consent_blocked'` recorded when NDPR gate fires
- USSD-blocked requests logged with status `'consent_blocked'` (P12)
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent): AI usage metering and audit log — migration 0045 (SA-1.12, SA-1.13)`
- PR references: NDPR audit requirements, platform invariants P13

---

## TASK SA-2.0: NDPR Consent Gate — AI-Specific Consent Records

- **Module:** `packages/contact/src/consent.ts` (extend), `apps/api/src/routes/consent.ts`
- **Roadmap ref:** SA-2.x — SuperAgent Phase 2
- **GitHub context:**
  - Consent migration: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/0017_consent_records.sql
  - Contact package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/contact/
  - AI provider routing: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-provider-routing.md
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md (P10, P12)
  - QA docs: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/qa/ndpr-consent-audit.md

---

You are an expert **Senior Backend Engineer** and **Privacy Engineer**, working on WebWaka OS.

**Skills required:**
- NDPR (Nigeria Data Protection Regulation) consent record requirements
- D1 consent_records schema — purposes, timestamps, withdrawal
- Hono middleware for consent pre-flight checks
- Double-opt-in and consent withdrawal audit trail

---

**1. Mandatory context reading (100% before execution):**

- `infra/db/migrations/0017_consent_records.sql` — existing consent table schema
- `docs/governance/ai-provider-routing.md` — NDPR consent gate description (section on P10)
- `docs/governance/platform-invariants.md` — P10 (NDPR consent gate), P12 (USSD exclusion)
- `docs/qa/ndpr-consent-audit.md` — auditor expectations and consent record requirements
- `packages/contact/src/` — existing contact service patterns

---

**2. Research and execution plan:**

- Research: NDPR 2023 guidelines on AI-specific consent (purpose limitation, retention)
- Research: GDPR Article 6 lawful basis mapping to NDPR equivalent (for reference patterns)
- Execution plan: extend consent_records with `purpose` column for AI-specific consent; API for user to grant/withdraw AI consent; middleware integration with auth hooks from SA-1.8

---

**3. Implementation workflow:**

Branch: `feat/sa-2-ndpr-consent` from `main`.

Extend `consent_records` table (new migration) with:
- `purpose TEXT NOT NULL DEFAULT 'general'` — add `ai_usage` as a valid purpose
- `withdrawn_at INTEGER` — consent withdrawal timestamp
- Ensure withdrawal is auditable (never DELETE, always soft-mark)

**`packages/contact/src/consent.ts`** (extend):
- `grantAiConsent(userId: string, tenantId: string, env: Env): Promise<void>`
- `withdrawAiConsent(userId: string, tenantId: string, env: Env): Promise<void>`
- `hasAiConsent(userId: string, tenantId: string, env: Env): Promise<boolean>` — used by SA-1.8 middleware

**`apps/api/src/routes/consent.ts`:**
- `POST /consent/ai` — grant AI consent
- `DELETE /consent/ai` — withdraw AI consent
- `GET /consent/ai` — check current status

---

**4. QA and verification:**

- `grantAiConsent` creates a consent record with `purpose: 'ai_usage'`
- `withdrawAiConsent` soft-marks (never deletes); `hasAiConsent` returns false after withdrawal
- Withdrawn consent cannot be re-granted without explicit new grant call (no silent re-enable)
- AI middleware blocks request when consent withdrawn
- USSD sessions never granted AI consent (P12)
- At least 8 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(consent): NDPR AI consent gate — grant/withdraw/check (SA-2.x)`
- PR references: platform invariant P10, NDPR audit doc

---

*End of Pre-Verticals Execution Prompts. Total task blocks: 10 (SA-1.1 through SA-2.0).*
*Each block is self-contained and executable by a dedicated agent team.*
*All blocks reference the actual WebWakaDOS/webwaka-os repository at https://github.com/WebWakaDOS/webwaka-os.*
