# OTP Routing

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7a — Regulatory Survival
**Date:** 2026-04-08

---

## Overview

WebWaka OS implements a **preference-aware OTP routing algorithm** with automatic fallback. The goal is maximum delivery success while respecting user preferences (NDPR P10/P12).

---

## Channel Priority Algorithm

```typescript
// packages/otp/src/channel-router.ts

export type OTPPurpose = 
  | 'verification'    // onboarding channel verification
  | 'login'           // session authentication
  | 'transaction'     // payment/agent float confirmation
  | 'kyc_uplift'      // BVN/NIN submission confirmation
  | 'password_reset'; // account recovery

export async function routeOTP(
  contact: ContactChannels,
  purpose: OTPPurpose,
  overrideChannel?: OTPPreference
): Promise<OTPDeliveryResult> {
  
  // 1. Determine candidate channels (ordered by preference)
  const candidates = buildCandidateList(contact, purpose, overrideChannel);
  
  // 2. Try each candidate until success or exhausted
  for (const channel of candidates) {
    const result = await attemptDelivery(channel, contact, purpose);
    if (result.success) return result;
    await logFailure(channel, result.error);
  }
  
  throw new OTPDeliveryExhaustedError('All channels failed', { candidates });
}
```

### Candidate List Construction

```typescript
function buildCandidateList(
  contact: ContactChannels,
  purpose: OTPPurpose,
  override?: OTPPreference
): OTPChannel[] {
  
  // High-security purposes always use SMS first
  if (purpose === 'transaction' || purpose === 'kyc_uplift') {
    return ['sms', 'whatsapp'].filter(c => isChannelAvailable(contact, c));
  }
  
  // User preference → then fallback chain
  const preferred  = override ?? contact.otp_preference ?? 'sms';
  const available  = getAvailableChannels(contact);  // verified channels only
  const chain      = buildFallbackChain(preferred, available);
  
  return chain;
}

// Default fallback chain:
// SMS → WhatsApp → Telegram → (voice for accessibility)
const FALLBACK_ORDER: OTPPreference[] = ['sms', 'whatsapp', 'telegram'];

function buildFallbackChain(preferred: OTPPreference, available: OTPPreference[]): OTPPreference[] {
  const chain = [preferred, ...FALLBACK_ORDER.filter(c => c !== preferred)];
  return chain.filter(c => available.includes(c));
}
```

---

## Provider Routing

| Channel | Primary Provider | Fallback Provider |
|---|---|---|
| SMS | Termii | Africa's Talking |
| WhatsApp | Termii (WhatsApp Business) | 360dialog |
| Telegram | WebWaka Bot (self-hosted) | — |
| Voice | Termii Voice | — |

Provider selection is handled by `packages/otp/src/provider-factory.ts` (TDR-0009 abstraction).

---

## Purpose-Specific Rules

| Purpose | Primary Channel | Can Use WhatsApp? | Can Use Telegram? | Fallback to Voice? |
|---|---|---|---|---|
| `verification` | User preference | ✅ | ✅ | ❌ |
| `login` | User preference | ✅ | ✅ | ❌ |
| `transaction` | SMS (mandatory) | ✅ (fallback) | ❌ | ✅ (accessibility) |
| `kyc_uplift` | SMS (mandatory) | ✅ (fallback) | ❌ | ❌ |
| `password_reset` | SMS preferred | ✅ | ✅ | ❌ |

**Note:** Transaction OTPs may not use Telegram — Telegram delivery cannot guarantee real-time delivery for financial security.

---

## USSD Fallback for Feature Phones

When no smart-channel (WhatsApp/Telegram) is available and SMS fails:
```
1. System detects feature phone (no app, USSD session active)
2. USSD gateway pushes OTP via Africa's Talking USSD push notification
3. User reads OTP from USSD screen → enters via USSD menu
4. apps/ussd-gateway handles this flow
```

USSD OTP routing is only used for `login` and `verification` purposes (not transactions — too high risk on feature phones without TLS).

---

## Monitoring + Alerting

KPIs tracked in `discovery_events`:
```
otp.delivered   — channel, purpose, provider, latency_ms
otp.failed      — channel, purpose, provider, error_code
otp.fallback    — from_channel, to_channel, reason
otp.exhausted   — entity_id (hashed), purpose
```

Alert thresholds (Cloudflare Workers Analytics):
- SMS delivery rate < 95% → alert
- Fallback rate > 10% → investigate provider
- Exhaustion rate > 1% → incident

---

## Related Docs
- `docs/contact/multi-channel-model.md` — ContactChannels entity
- `docs/contact/contact-verification.md` — Per-channel verification flows
- `docs/identity/otp-channels.md` — Provider configuration
- `docs/enhancements/m7/agent-network.md` — USSD gateway integration
