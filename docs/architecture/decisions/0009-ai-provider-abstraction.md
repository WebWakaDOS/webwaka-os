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

---

## M7 Extension: Abstraction Pattern Applied to Payments, OTP, and Identity

The provider-abstraction pattern established in this TDR is extended in Milestone 7 to three additional integration categories. The rationale is identical: Nigerian market requires multiple providers, no business logic should couple to a specific vendor.

### Payments Abstraction (`packages/payments`)

```typescript
interface PaymentProvider {
  initiateCharge(params: ChargeParams): Promise<ChargeResult>;
  verifyTransaction(reference: string): Promise<VerifyResult>;
  createSubscription(params: SubscriptionParams): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionCode: string): Promise<void>;
}
```

Active providers: Paystack (primary), Flutterwave (failover). Provider selection is tenant config.

### OTP Abstraction (`packages/otp`)

```typescript
interface OTPProvider {
  sendOTP(phone: string, message: string, options: OTPOptions): Promise<OTPSendResult>;
  verifyOTP(phone: string, code: string): Promise<boolean>;
}
```

Active providers: Termii (primary), Africa's Talking (failover), WhatsApp Business API (optional channel). Priority: SMS → WhatsApp → USSD (last resort). See `docs/identity/otp-channels.md`.

### Identity Abstraction (`packages/identity`)

```typescript
interface IdentityProvider {
  verifyBVN(bvn: string, consent: ConsentRecord): Promise<BVNVerifyResult>;
  verifyNIN(nin: string, consent: ConsentRecord): Promise<NINVerifyResult>;
  verifyCAC(rcNumber: string): Promise<CACVerifyResult>;
  verifyFRSC(licenseNumber: string): Promise<FRSCVerifyResult>;
}
```

Active providers: Prembly (primary), Paystack Identity (BVN secondary). All lookups require a `ConsentRecord` parameter — passing `null` throws a compile error. See `docs/identity/bvn-nin-guide.md`.

### Invariant Cross-Reference
- P7 (Vendor Neutral AI) is the source pattern — the same logic applies here.
- P8 (BYOK) — tenants may supply their own Paystack/Termii keys.
- P10 (BVN/NIN Consent) — enforced at the `IdentityProvider` interface boundary.
