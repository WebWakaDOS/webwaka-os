# WebWaka SuperAgent — Governance and Consistency Rules

**Status:** APPROVED — Binding on all agents and developers implementing AI features  
**Date:** 2026-04-09  
**Authority:** Extends `docs/governance/ai-policy.md` (M1), TDR-0009  
**Binding on:** All WebWaka code and documentation produced after this date  

---

## Rule G1: SuperAgent Is the Default AI Path

All AI features in WebWaka must route through SuperAgent unless one of the explicit exceptions in Rule G1.1 applies.

**What this means:**
- Vertical packages MUST use `packages/superagent-sdk` to call AI
- Vertical packages MUST NOT import `packages/ai-abstraction` directly
- Apps MUST NOT call aggregator APIs directly — all calls go through `resolveAdapter()` in the routing engine
- No new `fetch('https://api.openai.com/...')` or `fetch('https://api.anthropic.com/...')` calls anywhere in the codebase

**Rule G1.1 — Explicit Exceptions (all require code comment):**

```typescript
// EXCEPTION: Direct fetch allowed here because:
// [reason — e.g., "BYOK validation call — only triggered by user registering their own key"]
// SuperAgent routing does not apply to BYOK key validation.
```

Permitted exceptions:
- BYOK key validation call (one-token live test on user-supplied key)
- Health check polling of aggregator endpoints by the routing engine itself
- Test mocks in `*.test.ts` files (mocking provider responses is required for unit tests)

---

## Rule G2: Aggregator-Only Platform Traffic (ADL-010)

WebWaka does not maintain direct API relationships with OpenAI, Anthropic, or Google for **platform-level** AI traffic.

**What this means:**
- `env.ts` must NOT contain `OPENAI_API_KEY_*` as a platform-funded key
- `env.ts` must NOT contain `ANTHROPIC_API_KEY_*` as a platform-funded key
- `env.ts` must NOT contain `GOOGLE_AI_API_KEY_*` as a platform-funded key
- Platform keys in `env.ts` = aggregator keys only: `OPENROUTER_API_KEY_*`, `TOGETHER_API_KEY_*`, `GROQ_API_KEY_*`, `EDEN_AI_KEY_*`
- Users and workspaces MAY supply their own OpenAI/Anthropic/Google keys as BYOK — those are stored in D1 `ai_provider_keys`, not in `env.ts`

**Why:** Aggregator-only sourcing eliminates direct vendor contract requirements, enables instant model switching, and provides automatic 200+ model fallback via OpenRouter.

---

## Rule G3: SuperAgent Key Is the Default BYOK

When a user or workspace enables AI, the platform auto-issues a SuperAgent managed key (`sk-waka-*`). This key:

- Is the **default at resolution chain level 3** (after user BYOK and workspace BYOK)
- Consumes WakaCU from the workspace wallet
- Is NEVER exposed to the user in plaintext after initial issuance
- MUST be stored encrypted in Cloudflare KV (`SA_KEY_KV`), not in D1 plaintext

Any code that bypasses the SuperAgent key and calls an aggregator without WC deduction is a **P0 billing bug**.

---

## Rule G4: WakaCU Is the Only Internal Billing Unit

All AI usage internally is measured in WakaCU (WebWaka Credit Units). No vertical or module may:

- Define its own credit unit or AI billing model
- Charge users differently from the canonical WakaCU rates
- Apply discounts or surcharges without super-admin configuration

**Currency:** All WC prices are stored and computed in NGN kobo (integer arithmetic). No floats in financial calculations (Platform Invariant T4).

**Conversion:** `packages/wc-wallet/src/rates.ts` is the single source of truth for WC → NGN conversions. Never hardcode conversion rates anywhere else.

---

## Rule G5: Provider Neutrality Is Mandatory

All AI routing decisions are:
- **Configuration-driven** (stored in Cloudflare KV — no deployment required to switch models)
- **Aggregator-agnostic** at the adapter level (the `openai-compat` adapter serves any OpenAI-compatible endpoint)
- **Never hardcoded** (no `if (provider === 'openai') {...}` logic in vertical packages)

Any code that hardcodes a specific model name, base URL, or provider in a vertical package is a **P1 invariant violation** (Platform Invariant P7 — Vendor Neutral AI).

---

## Rule G6: NDPR Consent Gate Is Non-Bypassable

Before any AI call that processes personal data:

```typescript
await requireNDPRConsentForAI(db, userId, dataType, purpose);
```

This call MUST NOT be removed, short-circuited, or commented out. It is a legal requirement under the Nigeria Data Protection Regulation.

**Personal data types that require consent before AI processing:**
- Phone numbers (even hashed)
- BVN-derived data
- NIN-derived data
- Name + location combinations
- Health information (Clinic vertical)
- Financial transaction patterns
- Biometric data

**Exception:** Aggregated, anonymized data that cannot be re-identified does not require per-user consent. When in doubt, require consent.

---

## Rule G7: USSD Path Is AI-Excluded — No Exceptions

Any request carrying the `X-USSD-Session` header must be short-circuited before any AI call reaches the routing engine.

```typescript
// In superagent route handler — mandatory check
if (c.req.header('X-USSD-Session')) {
  return c.json({ error: 'AI not available on USSD path' }, 400);
}
```

This is Platform Invariant ADL-006 and cannot be overridden even by Enterprise plan or super-admin.

---

## Rule G8: Financial Tables Are AI Read-Only

AI at any autonomy level (L0–L5) must NEVER write to:

- `float_ledger`
- `agent_wallets`
- `ai_credit_balances` / `wc_wallets` (except via `packages/wc-wallet` — the deduction is the routing engine's job, not a vertical's)
- `payments`
- `subscriptions`
- `wc_transactions`

AI may READ financial tables for analytics and insight generation (L0 — read-only).

Any code that allows AI to write to financial tables is a **P0 integrity violation** (Platform Invariant P9 — Float Integrity, T4 — Monetary Integrity).

---

## Rule G9: Sensitive Sector AI Requires Explicit HITL

For the following verticals, every AI output that is actioned (not just generated) requires human approval:

| Vertical | Sensitive Data | Mandatory Gate |
|---|---|---|
| Politician (`packages/verticals-politician`) | Political communications | `sensitiveSectorRights` + HITL |
| Clinic (`packages/verticals-clinic`) | Medical information | `sensitiveSectorRights` + HITL |
| Legal / Professional (`packages/verticals-legal`) | Legal advice | `sensitiveSectorRights` + HITL + disclaimer injection |
| School / Education (AI grading) | Student records | HITL at L3+ |

If `sensitiveSectorRights` is not present in the workspace entitlement, the vertical must refuse to send output to the AI provider at all.

---

## Rule G10: No Parallel AI Plans

There is ONE AI plan: this SuperAgent suite (`docs/governance/superagent/`).

No agent, developer, or team may:
- Create a local or vertical-specific AI plan that contradicts this suite
- Implement AI features that diverge from the SuperAgent architecture without filing an ADL update
- Treat any older AI document as authoritative when it conflicts with this suite

If you find a conflict: **update the older document to match the SuperAgent plan**, file an ADL addendum if the conflict requires an architectural decision, and continue.

---

## Pre-Implementation Research Checklist

Before implementing any AI feature, the implementing agent MUST:

**Internal research:**
- [ ] Read `docs/governance/superagent/01-synthesis-report.md` — understand current state and gaps
- [ ] Read `docs/governance/superagent/02-product-spec.md` — understand what SuperAgent is
- [ ] Read `docs/governance/superagent/03-system-architecture.md` — understand the technical architecture
- [ ] Read `docs/governance/superagent/04-execution-roadmap.md` — confirm which phase applies
- [ ] Check `docs/governance/superagent/05-document-update-plan.md` — verify required docs are updated
- [ ] Read `docs/governance/ai-provider-routing.md` — current provider/aggregator registry
- [ ] Read `docs/governance/ai-capability-matrix.md` — capability-specific rules
- [ ] Read relevant vertical spec (`docs/templates/vertical-ai-research-template.md` filled for this vertical)

**Online research (mandatory for provider integrations):**
- [ ] Check current OpenRouter API documentation and model list (`openrouter.ai/docs`)
- [ ] Check current Together AI API documentation (`docs.together.ai`)
- [ ] Check current Groq API documentation (`console.groq.com/docs`)
- [ ] Check current Eden AI documentation (`docs.edenai.run`)
- [ ] Verify current pricing for relevant models (prices change frequently)
- [ ] Check for any aggregator outage reports or known limitations before selecting primary route
- [ ] Search for any recent changes to Nigerian AI regulation (NDPR, NCC, NITDA) affecting the feature

**Verification before writing code:**
- [ ] Confirm the aggregator for this feature has the required capability
- [ ] Confirm the model selected is available on the chosen aggregator
- [ ] Confirm WC rate for this capability is set in `packages/wc-wallet/src/rates.ts`
- [ ] Confirm NDPR consent gate applies (or document why it does not)
- [ ] Confirm USSD exclusion check is in place if the feature is on a path accessible from USSD

---

## Governance Update Process

When architectural decisions require changes to these governance rules:

1. File a new ADL (ADL-011, ADL-012, ...) in `docs/planning/m8-ai-architecture-decision-log.md`
2. Update the relevant governance document in `docs/governance/superagent/`
3. Update `docs/governance/superagent/05-document-update-plan.md` with any new document updates triggered
4. Announce the change in the PR description so all agents are notified

**Never silently change governance rules without an ADL entry.**

---

## Onboarding Checklist for New AI Features

Any new AI feature proposal must answer these questions before a single line of code is written:

| Question | Where Answered |
|---|---|
| Which SuperAgent capability family does this belong to? | `02-product-spec.md` §2 |
| Which plan tier is required? | `02-product-spec.md` §3 |
| What is the WC cost per use? | `02-product-spec.md` §4.2 |
| Does it use the SuperAgent managed key or require BYOK? | `02-product-spec.md` §5 |
| Which aggregator handles this capability? | `03-system-architecture.md` §5.2 |
| What autonomy level does it operate at? | `docs/governance/ai-agent-autonomy.md` |
| Does it require HITL? | `docs/governance/ai-capability-matrix.md` for the capability |
| Does it process personal data (NDPR gate required)? | Rule G6 |
| Is it accessible from USSD? (Must be No) | Rule G7 |
| Does it touch financial tables? (Must be read-only) | Rule G8 |
| Is the vertical a sensitive sector? | Rule G9 |
| Which phase of the roadmap does this belong to? | `04-execution-roadmap.md` |

If any question is unanswered, implementation must not begin.

---

*These governance rules are binding. Non-compliance is a P0 architectural violation requiring immediate remediation.*
