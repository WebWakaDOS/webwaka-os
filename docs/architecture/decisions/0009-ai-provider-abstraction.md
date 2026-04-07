# TDR-0009: AI Provider Abstraction

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka is AI-embedded across multiple features and modules. The AI market is rapidly evolving and locking to one provider creates commercial, geographic, and compliance risk, particularly in African markets where provider availability and pricing vary.

## Decision

Implement AI access through a provider abstraction layer with BYOK (Bring Your Own Key) capability.

No app or package may call an AI provider's API directly. All AI calls must route through `packages/ai`, which exposes a provider-neutral interface.

## Abstraction Contract

```typescript
interface AIProvider {
  complete(prompt: AIPrompt, options: AIOptions): Promise<AIResponse>;
  embed(text: string, options: AIOptions): Promise<number[]>;
}
```

Supported providers are registered at runtime. The active provider is resolved from:
1. Tenant BYOK config (if provided and valid)
2. Platform default provider
3. Fallback provider (if configured)

## Consequences

- Provider switching requires no app-level code changes
- BYOK reduces AI cost burden on tenants who bring their own credentials
- Abstraction layer must be kept thin — it routes, it does not transform logic
- Provider-specific features (e.g. function calling, vision) are exposed as optional capability checks
- See `docs/governance/ai-policy.md` for governance rules that apply on top of this architecture
