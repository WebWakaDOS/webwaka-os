# WebWaka SuperAgent — System Architecture RFC

**Status:** APPROVED — Technical architecture reference for all SuperAgent implementation  
**Date:** 2026-04-09  
**RFC Type:** Architecture Decision  
**Supersedes:** Direct provider platform key model (M8-AI original planning)  
**Extends:** TDR-0009, ADL-001–ADL-009  
**New ADL:** ADL-010 (below)  

---

## ADL-010: SuperAgent Aggregator-Only Platform Architecture

**Context:** The original M8-AI plan assumed WebWaka would maintain direct API relationships with OpenAI, Anthropic, and Google as "platform keys". WebWaka SuperAgent changes this: WebWaka becomes an AI service provider, sourcing all platform-side AI exclusively from aggregators (OpenRouter, Together, Groq, Eden AI). No direct vendor contracts are required or permitted for platform-level traffic.

**Decision:** All platform-side AI (where WakaCU credits are consumed) routes through AI aggregators. WebWaka does not hold direct API relationships with OpenAI, Anthropic, or Google for platform keys. Direct provider keys are only used in BYOK context (user/workspace supplies their own OpenAI/Anthropic/Google key).

**Alternatives rejected:**
- **Keep direct provider keys as platform default** — Rejected. Aggregator-only sourcing: (1) requires no negotiated contracts per provider, (2) allows instant model switching without code changes, (3) provides automatic failover across 200+ models via OpenRouter, (4) simplifies key management to 4 aggregator accounts.
- **Single aggregator (OpenRouter only)** — Rejected. Multi-aggregator sourcing reduces single-aggregator risk and allows cost-optimized routing (Groq for latency, Together for open-source, Eden for multimodal).

**Consequences:**
- `ai-provider-routing.md` §1: Platform keys = OpenRouter_1, Together_1, Groq_1, EdenAI_1 only
- `env.ts` additions: `OPENROUTER_API_KEY_1`, `TOGETHER_API_KEY_1`, `GROQ_API_KEY_1`, `EDEN_AI_KEY_1` — no `OPENAI_API_KEY_*` at platform level
- Users/workspaces BYOK with OpenAI/Anthropic/Google keys still fully supported — those are user-supplied keys, not platform keys
- SuperAgent routing engine selects best aggregator per request based on cost, latency, capability, and health

**Evidence:** Consistent with TDR-0009 ("No app or package may call an AI provider's API directly") and ai-policy.md ("No single-provider lock-in").

---

## 1. Architectural Layers

SuperAgent is not a microservice. It is a **platform layer** implemented within the existing Cloudflare Workers monorepo, alongside auth, billing, and entitlements.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  Vertical UIs  │  Platform Admin  │  Partner Admin  │  External SDK │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    SUPERAGENT API GATEWAY                           │
│  apps/api/src/routes/superagent.ts                                 │
│  POST /v1/superagent/chat     — text generation / chat              │
│  POST /v1/superagent/embed    — embeddings                          │
│  POST /v1/superagent/agent    — agent workflow run                  │
│  POST /v1/superagent/media    — image / audio generation            │
│  GET  /v1/superagent/usage    — usage stats for caller              │
│  POST /ai/keys                — BYOK key registration               │
│  GET  /ai/keys                — list registered BYOK keys           │
│  DELETE /ai/keys/:id          — revoke BYOK key                     │
└──────┬──────────┬──────────────┬──────────────┬──────────────────────┘
       │          │              │              │
┌──────▼──┐ ┌─────▼────┐ ┌──────▼─────┐ ┌─────▼────────┐
│  Auth   │ │ Policy   │ │  Metering  │ │  Credit      │
│  Layer  │ │ Engine   │ │  + Audit   │ │  Wallet      │
│  (JWT + │ │(NDPR,CBN,│ │(WC deduct, │ │(WC balance,  │
│  SA key)│ │ HITL,    │ │ ai_usage_  │ │ transactions,│
│         │ │ content) │ │ logs)      │ │ top-up)      │
└──────┬──┘ └─────┬────┘ └──────┬─────┘ └─────┬────────┘
       │          │              │              │
┌──────▼──────────▼──────────────▼──────────────▼──────────────────────┐
│                      ROUTING ENGINE                                  │
│  packages/ai-abstraction/src/router.ts                              │
│  1. Resolve: user BYOK → workspace BYOK → SuperAgent key             │
│  2. Select aggregator + model (cost/quality/latency tier)            │
│  3. Execute via adapter (openai-compat.ts / anthropic.ts / google.ts)│
│  4. Handle failover (KV health cache, TTL-based backoff)             │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│              AGGREGATOR ABSTRACTION LAYER                            │
│  packages/ai-adapters/src/                                           │
│  ├── openai-compat.ts  → OpenRouter, Together, Groq, Eden, DeepSeek │
│  ├── anthropic.ts      → Anthropic (user BYOK only)                  │
│  └── google.ts         → Google (user BYOK only)                     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│            AGGREGATOR POOL (Platform Keys — Aggregators Only)        │
│  OpenRouter  (openrouter.ai/api/v1)      — 200+ models, primary      │
│  Together AI (api.together.xyz/v1)        — open-source, cost tier   │
│  Groq        (api.groq.com/openai/v1)    — latency-critical paths    │
│  Eden AI     (api.edenai.run/v2)         — multimodal, STT, TTS      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Identity and Tenancy Integration

SuperAgent is fully tenant-aware. Every AI request carries:

```typescript
interface SuperAgentRequestContext {
  tenantId: string;           // From JWT — T3: all D1 queries bind tenantId
  workspaceId: string;        // From JWT or URL param
  userId?: string;            // Authenticated user (optional for public AI endpoints)
  superagentKeyId?: string;   // Resolved SuperAgent managed key (if used)
  byokKeyId?: string;         // Resolved BYOK key (if user/workspace supplied)
  fundedBy: 'trial' | 'subscription' | 'credit_pack' | 'user_byok' | 'workspace_byok' | 'partner_pool' | 'admin_grant';
}
```

**Key resolution order (5-level chain, ADL-002):**
1. User BYOK key (`ai_provider_keys WHERE user_id = :uid`)
2. Workspace BYOK key (`ai_provider_keys WHERE workspace_id = :wid AND user_id IS NULL`)
3. SuperAgent managed key for this workspace (`superagent_keys WHERE workspace_id = :wid`)
4. SuperAgent platform fallback key pool (KV-cached, health-checked)
5. Disabled → 503 with `retry_after`

Level 3 is new — the "SuperAgent managed key" replaces the old "platform key" concept. The SuperAgent key for a workspace is still routed through the aggregator pool, but it is workspace-scoped for billing.

---

## 3. Data Model

### 3.1 New D1 Tables (Planned Migrations)

#### `superagent_keys` (migration 0042)

```sql
-- SuperAgent managed keys issued to workspaces on AI enablement
CREATE TABLE superagent_keys (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  workspace_id      TEXT NOT NULL UNIQUE,
  key_prefix        TEXT NOT NULL,           -- 'sk-waka-' || first 8 chars
  key_hash          TEXT NOT NULL UNIQUE,    -- SHA-256 of full key
  key_kv_ref        TEXT NOT NULL,           -- KV key where encrypted key is stored
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  issued_at         INTEGER DEFAULT (unixepoch()),
  last_used_at      INTEGER,
  suspended_reason  TEXT,
  created_at        INTEGER DEFAULT (unixepoch()),
  updated_at        INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_sak_workspace ON superagent_keys(workspace_id, status);
CREATE INDEX idx_sak_tenant    ON superagent_keys(tenant_id);
```

#### `wc_wallets` (migration 0043)

```sql
-- WakaCU credit wallets — one per workspace (workspace-funded)
-- and one per user (personal AI use outside workspace context)
CREATE TABLE wc_wallets (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  workspace_id          TEXT,               -- NULL = user wallet
  user_id               TEXT,               -- NULL = workspace wallet
  wallet_type           TEXT NOT NULL
    CHECK (wallet_type IN ('workspace', 'user', 'partner_pool')),
  trial_wc              REAL NOT NULL DEFAULT 0,
  subscription_wc       REAL NOT NULL DEFAULT 0,
  purchased_wc          REAL NOT NULL DEFAULT 0,
  partner_allocated_wc  REAL NOT NULL DEFAULT 0,   -- from partner pool
  total_consumed_wc     REAL NOT NULL DEFAULT 0,
  hard_limit_wc         REAL,               -- NULL = no limit (use balance)
  trial_expires_at      INTEGER,
  updated_at            INTEGER DEFAULT (unixepoch()),
  UNIQUE(workspace_id, wallet_type),
  UNIQUE(user_id, wallet_type)
);
CREATE INDEX idx_wcw_workspace ON wc_wallets(workspace_id);
CREATE INDEX idx_wcw_user      ON wc_wallets(user_id);
CREATE INDEX idx_wcw_tenant    ON wc_wallets(tenant_id);
```

#### `wc_transactions` (migration 0043, continued)

```sql
CREATE TABLE wc_transactions (
  id              TEXT PRIMARY KEY,
  wallet_id       TEXT NOT NULL REFERENCES wc_wallets(id),
  tenant_id       TEXT NOT NULL,
  type            TEXT NOT NULL
    CHECK (type IN (
      'trial_grant', 'subscription_reset', 'credit_purchase',
      'partner_allocation', 'usage_debit', 'admin_grant', 'admin_revoke',
      'auto_topup', 'refund'
    )),
  wc_amount       REAL NOT NULL,        -- positive = credit, negative = debit
  balance_after   REAL NOT NULL,        -- snapshot for audit
  paystack_ref    TEXT,                 -- for credit_purchase
  usage_log_id    TEXT,                 -- for usage_debit
  admin_user_id   TEXT,
  partner_id      TEXT,                 -- for partner_allocation
  reason          TEXT,
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_wct_wallet  ON wc_transactions(wallet_id, created_at);
CREATE INDEX idx_wct_tenant  ON wc_transactions(tenant_id, created_at);
CREATE INDEX idx_wct_paystack ON wc_transactions(paystack_ref) WHERE paystack_ref IS NOT NULL;
```

#### `partner_credit_pools` (migration 0044)

```sql
CREATE TABLE partner_credit_pools (
  id                    TEXT PRIMARY KEY,
  partner_workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  tenant_id             TEXT NOT NULL,
  total_purchased_wc    REAL NOT NULL DEFAULT 0,
  total_allocated_wc    REAL NOT NULL DEFAULT 0,
  total_consumed_wc     REAL NOT NULL DEFAULT 0,
  updated_at            INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_pcp_partner ON partner_credit_pools(partner_workspace_id);

CREATE TABLE partner_tenant_allocations (
  id                    TEXT PRIMARY KEY,
  pool_id               TEXT NOT NULL REFERENCES partner_credit_pools(id),
  tenant_id             TEXT NOT NULL,             -- the receiving tenant
  workspace_id          TEXT NOT NULL,             -- the receiving workspace
  allocated_wc          REAL NOT NULL DEFAULT 0,
  consumed_wc           REAL NOT NULL DEFAULT 0,
  soft_limit_wc         REAL,
  hard_limit_wc         REAL,
  created_at            INTEGER DEFAULT (unixepoch()),
  updated_at            INTEGER DEFAULT (unixepoch()),
  UNIQUE(pool_id, workspace_id)
);
CREATE INDEX idx_pta_pool      ON partner_tenant_allocations(pool_id);
CREATE INDEX idx_pta_workspace ON partner_tenant_allocations(workspace_id);
```

### 3.2 Existing Tables Leveraged (No Change)

| Table | Already In | SuperAgent Usage |
|---|---|---|
| `ai_provider_keys` | Migration 0037 (planned) | BYOK key storage — unchanged |
| `ai_usage_logs` | Migration 0038 (planned) | All SuperAgent requests logged — unchanged |
| `workspace_ai_settings` | Migration 0041 (planned) | Add `superagent_key_id` column reference |
| `workspaces` | Existing | Workspace context for billing |
| `consent_records` | M7a | NDPR gate — checked before PII-adjacent AI calls |

---

## 4. API Contracts

### 4.1 SuperAgent Chat Endpoint

```
POST /v1/superagent/chat
Auth: JWT or SuperAgent key (sk-waka-*)
Content-Type: application/json

Request:
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "capability": "text",         // AICapabilityType
  "modelTier": "cost",          // 'cost' | 'best' | 'multilingual' | 'reasoning'
  "maxTokens": 1024,
  "stream": false,
  "verticalSlug": "pos-business" // optional — for vertical-specific audit
}

Response 200:
{
  "id": "sa_...",
  "content": "...",
  "model": "deepseek/deepseek-chat",
  "provider": "openrouter",
  "tokensIn": 123,
  "tokensOut": 456,
  "wcConsumed": 0.58,
  "fundedBy": "subscription",
  "walletBalance": 4441.42
}

Response 402 (quota exhausted):
{
  "error": "wc_quota_exhausted",
  "wcBalance": 0,
  "topupUrl": "/billing/ai-credits",
  "code": 402
}

Response 429 (rate limited):
{
  "error": "rate_limit_exceeded",
  "retryAfter": 60,
  "code": 429
}
```

### 4.2 SuperAgent BYOK Key Registration

```
POST /ai/keys
Auth: JWT (workspace admin or user)

Request:
{
  "provider": "openrouter",
  "apiKey": "sk-or-...",
  "capabilities": ["text", "embed"],
  "scope": "workspace"  // 'workspace' | 'user'
}

Response 201:
{
  "id": "aipk_...",
  "provider": "openrouter",
  "capabilities": ["text", "embed"],
  "scope": "workspace",
  "isActive": true,
  "validatedAt": 1712700000
}
// Raw apiKey is never returned
```

### 4.3 WakaCU Credit Purchase (Paystack Integration)

```
POST /billing/ai-credits/initiate
Auth: JWT (workspace admin)

Request:
{
  "packName": "growth_pack",   // or custom WC amount
  "wcAmount": 20000            // if custom
}

Response 200:
{
  "paystackAuthorizationUrl": "https://paystack.com/pay/...",
  "reference": "waka_wc_...",
  "wcAmount": 20000,
  "amountKobo": 2400000       // ₦24,000 × 100 kobo
}

// Paystack webhook → POST /payments/webhook
// → syncWCPurchase(db, reference) → wc_transactions INSERT + wc_wallets UPDATE
```

### 4.4 Agent Workflow Run

```
POST /v1/superagent/agent
Auth: JWT (Enterprise/Business plan required)

Request:
{
  "workflowId": "wf_...",      // or inline definition
  "steps": [
    {
      "id": "step_1",
      "capability": "text",
      "prompt": "...",
      "hitlRequired": false
    },
    {
      "id": "step_2",
      "capability": "embed",
      "input": "{{step_1.output}}",
      "hitlRequired": false
    }
  ],
  "autonomyLevel": 2,   // L0-L5; L3+ requires autonomy.batch/autonomous flag
  "maxSteps": 10
}

Response 202 (async):
{
  "runId": "run_...",
  "status": "queued",
  "estimatedWcCost": 150,
  "statusUrl": "/v1/superagent/agent/run/run_..."
}
```

---

## 5. Routing Engine Detail

### 5.1 Resolution Algorithm

```typescript
// packages/ai-abstraction/src/router.ts

export async function resolveAdapter(
  ctx: SuperAgentRequestContext,
  db: D1Like,
  kv: KVNamespace,
  env: Env,
): Promise<{
  adapter: AIAdapter;
  fundedBy: FundingSource;
  keyId: string;
  aggregatorProvider: string;
}> {
  // Step 1: User BYOK
  const userBYOK = ctx.userId
    ? await getUserBYOKKey(db, ctx.userId, ctx.capability)
    : null;
  if (userBYOK && await isKeyHealthy(kv, userBYOK.id)) {
    return buildAdapter(userBYOK, 'user_byok');
  }

  // Step 2: Workspace BYOK
  const workspaceBYOK = await getWorkspaceBYOKKey(db, ctx.workspaceId, ctx.capability);
  if (workspaceBYOK && await isKeyHealthy(kv, workspaceBYOK.id)) {
    return buildAdapter(workspaceBYOK, 'workspace_byok');
  }

  // Step 3: SuperAgent managed key for workspace
  const saKey = await getSuperAgentKey(db, kv, ctx.workspaceId);
  if (saKey?.status === 'active') {
    const aggregator = await selectAggregator(kv, ctx.capability, ctx.modelTier);
    if (aggregator) {
      return buildAggregatorAdapter(aggregator, saKey, 'subscription');
    }
  }

  // Step 4: Platform fallback aggregator pool
  const fallback = await getFallbackAggregator(kv, ctx.capability);
  if (fallback) {
    return buildAggregatorAdapter(fallback, null, 'admin_grant');
  }

  // Step 5: Disabled
  throw new AIUnavailableError('All AI providers unavailable or quota exhausted');
}
```

### 5.2 Aggregator Selection Logic

```typescript
// Aggregator selection based on: capability, model tier, health, cost
const AGGREGATOR_PRIORITY = {
  text: {
    cost:          ['groq', 'together', 'openrouter'],   // speed first, then cost
    best:          ['openrouter', 'together'],             // quality models via aggregator
    multilingual:  ['openrouter', 'together'],             // Qwen/Mistral-multilingual via aggregator
    reasoning:     ['openrouter', 'groq'],                 // DeepSeek R1 / Llama reasoning
  },
  embed:           ['openrouter', 'together'],
  stt:             ['groq', 'openrouter', 'edenai'],       // Groq: fastest Whisper
  tts:             ['edenai', 'openrouter'],               // Eden: best African TTS
  image:           ['openrouter', 'together'],             // Flux / SDXL via aggregators
  vision:          ['openrouter'],                         // GPT-4o / Claude vision via OR
};
```

### 5.3 Health Check Cache (KV)

```
Key: ai:health:{aggregator}:{key_hash_prefix_8}
Value: 'healthy' | 'degraded' | 'failed'
TTL:
  healthy   → 300s
  degraded  → 60s  (HTTP 429 received)
  failed    → 30s  (HTTP 5xx received)
  invalid   → 3600s (HTTP 401/403 received — don't retry key)
```

---

## 6. Package Structure

### 6.1 Existing Packages (Extended)

| Package | Extension |
|---|---|
| `packages/ai-abstraction` | Add `SuperAgentRequestContext`, `resolveAdapter()` update, `WalletService` interface |
| `packages/ai-adapters` | Rename `openai.ts` → `openai-compat.ts`; add Eden AI adapter |
| `packages/entitlements` | Add `requireSuperAgentAccess()`, WC tier checks |

### 6.2 New Packages

| Package | Purpose |
|---|---|
| `packages/superagent-sdk` | Client SDK for verticals calling SuperAgent routes. Typed helpers: `chat()`, `embed()`, `agentRun()`. Avoids direct HTTP calls from vertical packages |
| `packages/wc-wallet` | WakaCU wallet operations: `deductWC()`, `creditWC()`, `getBalance()`, `topUpIntent()`. Mirrors `packages/pos/src/float-ledger.ts` pattern |

### 6.3 New App Routes

| Route File | Routes |
|---|---|
| `apps/api/src/routes/superagent.ts` | `POST /v1/superagent/chat`, `POST /v1/superagent/embed`, `POST /v1/superagent/agent`, `POST /v1/superagent/media`, `GET /v1/superagent/usage` |
| `apps/api/src/routes/ai-keys.ts` | `POST /ai/keys`, `GET /ai/keys`, `DELETE /ai/keys/:id` |
| `apps/api/src/routes/ai-credits.ts` | `POST /billing/ai-credits/initiate`, `GET /billing/ai-credits/balance`, `GET /billing/ai-credits/history` |
| `apps/api/src/routes/partner-credits.ts` | `POST /partner/credits/purchase`, `POST /partner/credits/allocate/:workspaceId`, `GET /partner/credits/usage` |

---

## 7. Environment Bindings (Updated)

```typescript
// apps/api/src/env.ts additions for SuperAgent

// Platform aggregator keys (aggregator-only — no direct OpenAI/Anthropic/Google)
OPENROUTER_API_KEY_1?: string;      // Primary aggregator — 200+ models
OPENROUTER_API_KEY_2?: string;      // Secondary (load split / rotation)
TOGETHER_API_KEY_1?: string;        // Open-source model access
GROQ_API_KEY_1?: string;            // Latency-critical paths
EDEN_AI_KEY_1?: string;             // Multimodal: STT, TTS, translation

// SuperAgent key management
SA_KEY_ENCRYPTION_KEY: string;      // AES-GCM key for SuperAgent key storage in KV
SA_KEY_KV: KVNamespace;             // KV binding for encrypted SuperAgent keys

// WakaCU credit system
WC_DEFAULT_RATE_PER_DOLLAR: string; // NGN/USD exchange rate (updated daily via admin)

// Note: OPENAI_API_KEY_*, ANTHROPIC_API_KEY_*, GOOGLE_AI_API_KEY_* are NOT platform keys.
// They may only appear as user/workspace BYOK keys stored in ai_provider_keys (D1).
```

---

## 8. Security and Compliance Architecture

### 8.1 SuperAgent Key Security

```
SuperAgent key format: sk-waka-{32 random hex chars}
Storage:
  - D1 superagent_keys: stores key_hash (SHA-256) and key_kv_ref only
  - Cloudflare KV (SA_KEY_KV): stores AES-GCM encrypted full key
  - Key NEVER appears in D1 plaintext, API responses, or logs

Key issuance:
  - Generated using crypto.getRandomValues() in CF Worker
  - Never generated client-side
  - Returned to workspace admin ONCE on issuance (or never, if auto-managed)

Key rotation:
  - Auto-rotation every 90 days
  - Grace period: 24h (old key still valid during transition)
  - No user action required for SuperAgent-managed keys
```

### 8.2 NDPR Gate (All AI Requests)

```typescript
// Before any AI call that processes personal data:
async function requireNDPRConsentForAI(
  db: D1Like,
  userId: string,
  dataType: NDPRDataType,
  purpose: string,
): Promise<void> {
  const consent = await db.prepare(
    `SELECT id FROM consent_records
     WHERE user_id = ? AND data_type = ? AND withdrawn_at IS NULL
     LIMIT 1`
  ).bind(userId, dataType).first();
  if (!consent) throw new NDPRConsentError(dataType, purpose);
}
```

---

*For the 12–24 month implementation roadmap, see `docs/governance/superagent/04-execution-roadmap.md`.*
