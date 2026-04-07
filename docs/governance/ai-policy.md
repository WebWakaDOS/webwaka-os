# AI Policy

**Status:** Approved — Milestone 1 Governance Baseline
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Core Rule

WebWaka is fully AI-embedded but must remain vendor-neutral and BYOK-capable.

See also: [TDR-0009](../architecture/decisions/0009-ai-provider-abstraction.md)

## Policy Principles

| Principle | Description |
|---|---|
| No single-provider lock-in | The platform must not depend on one AI vendor |
| Provider abstraction layer | All AI access routes through a shared abstraction |
| BYOK support | Users or partners may supply their own API keys where permitted |
| Controlled governance | Prompts and outputs are subject to platform governance rules |
| Auditable AI usage | AI feature use must be logged and attributable |
| Entitlement-governed features | AI capabilities are plan-aware and module-aware |

## Implementation Rules

1. AI providers must be accessed through a platform-level abstraction layer, never directly from app code.
2. BYOK support must not weaken tenancy or security — key isolation is mandatory.
3. AI rights are plan-aware and module-aware; no AI feature may activate outside its entitled scope.
4. Sensitive workflows (legal, political, medical, financial) require human-in-the-loop review before AI output is actionable.
5. AI usage logs must be retained for platform audit and compliance purposes.
