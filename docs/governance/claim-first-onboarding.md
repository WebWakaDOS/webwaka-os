# Claim-First Onboarding

**Status:** Approved — Milestone 1 Governance Baseline
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

> **M7 Review 2026-04-08:** Reviewed by Base44 Super Agent — no structural changes required. KYC/NDPR/Community/Social references are additive layers in entitlement-model.md and universal-entity-model.md.


## Purpose

Claim-first onboarding allows WebWaka to seed discoverable records first and convert them into managed tenants later. This is the primary growth pattern for the platform.

## Lifecycle Stages

| Stage | Description |
|---|---|
| **Seeded** | Record exists in discovery, not yet claimed |
| **Claimable** | Record is open for an owner to claim |
| **Claim Pending** | Claim request submitted, awaiting verification |
| **Verified** | Claim identity confirmed |
| **Managed** | Workspace activated, entity under active management |
| **Branded** | Brand Surface activated for the entity |
| **Monetized** | Offerings are live and transactional |
| **Delegated** | Partner or sub-partner is managing on behalf of entity |

## Rules

1. Seeded records may exist before a user signs up.
2. Claim rights must be auditable at every stage.
3. Sensitive sectors (political, regulated, healthcare) may require enhanced verification.
4. Claim completion does not bypass subscription rules.
5. Claiming should unlock the path to workspace activation but not automatically activate it.

---

## M7a — Multi-Channel Contact Form Flow

The claim-first onboarding form collects contact channels in a specific order that maximises verification success while minimising friction.

### Step-by-Step Form Flow

```
Step 1: Primary Phone
  ┌─────────────────────────────────────────────────┐
  │ Phone number (SMS-capable)                       │
  │ [+234 ___ _______________________]              │
  │ → "Send verification code via SMS"               │
  │ → User enters 6-digit OTP                        │
  │ → ✅ Primary phone verified                      │
  └─────────────────────────────────────────────────┘

Step 2: WhatsApp (Optional)
  ┌─────────────────────────────────────────────────┐
  │ ☑ My WhatsApp number is the same as above       │
  │   (If unchecked):                               │
  │   WhatsApp number [+234 ___ ___________________] │
  │   → "Send WhatsApp verification message"         │
  │   → User enters 6-digit code from WhatsApp       │
  │   → ✅ WhatsApp verified                         │
  └─────────────────────────────────────────────────┘

Step 3: Telegram (Optional)
  ┌─────────────────────────────────────────────────┐
  │ + Add Telegram account (optional)               │
  │   [@ _________________________________]          │
  │   → "We will send a code to your Telegram"      │
  │   → User opens @WebWakaBot → receives code       │
  │   → User enters code in app                      │
  │   → ✅ Telegram verified                         │
  └─────────────────────────────────────────────────┘

Step 4: Email (Optional)
  ┌─────────────────────────────────────────────────┐
  │ + Add email address (optional)                  │
  │   [___________________________________@___]      │
  │   → Verification link sent                       │
  │   → ✅ Email verified                            │
  └─────────────────────────────────────────────────┘

Step 5: Notification Preference
  ┌─────────────────────────────────────────────────┐
  │ How should WebWaka reach you?                   │
  │ ◉ SMS   ○ WhatsApp   ○ Telegram   ○ Email       │
  └─────────────────────────────────────────────────┘
```

### NDPR Consent Checkbox (per channel)
Each channel verification step MUST include a consent checkbox:
> "I agree to receive account messages and OTPs via [SMS/WhatsApp/Telegram]. I can withdraw this at any time in Settings."

Consent is stored as a `consent_records` entry with `data_type = "phone" | "whatsapp" | "telegram" | "email"`.

**Spec:** `docs/contact/multi-channel-model.md`, `docs/contact/contact-verification.md`
