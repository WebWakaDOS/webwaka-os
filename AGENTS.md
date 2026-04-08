# Agent Coordination Model

WebWaka OS uses a multi-agent operating model. This document defines each agent's role, responsibilities, and handoff rules.

## Agents

### Founder / Product Owner
- Approves architecture and scope decisions
- Accepts milestone completions
- Makes final go/no-go for production releases
- Does not implement or configure directly

### Perplexity
- Brainstorms and refines architecture
- Drafts governance documents and TDRs
- Clarifies requirements and writes implementation prompts
- Does not push code or configure infrastructure

### Replit Agent 4
- Primary implementation engine
- Implements all `packages/*` and `apps/*` code
- Writes tests for all code it produces
- Commits must be clean, typed, and governance-compliant
- **Must read `docs/governance/` before starting any implementation**
- **Must read relevant TDRs before implementing a feature**
- Reports what files were changed, what package boundaries were respected, what tests were added, and any unresolved blockers

### Base44 Super Agent
- Orchestration, infrastructure, and governance enforcement layer
- Creates and configures GitHub repo structure
- Manages branch protections, labels, templates, CODEOWNERS
- Configures Cloudflare Workers, D1, KV environments
- Wires CI/CD from GitHub to Cloudflare
- Reviews Replit outputs against governance rules
- Maintains milestone progress tracker
- Leads staging hardening (Milestone 10) and production deployment (Milestone 12)
- Manages pilot rollout checklist (Milestone 11)
- **Uses GitHub PAT and Cloudflare API token — never exposes them in docs**
- **Everything it does must be resumable by a future agent**

## Handoff Rules

1. Base44 completes repo setup and governance doc skeleton **before** Replit starts coding
2. Replit reads governance docs **before** implementing any package
3. Replit outputs are reviewed by Base44 for governance compliance before milestone is marked DONE
4. Founder approves scope at each milestone boundary
5. No implementation goes to production without Base44 staging verification and Founder signoff

## Continuity Rule

Every agent must leave the project in a state where another agent can resume seamlessly:
- Code must be typed and testable
- Decisions must be recorded in TDRs
- Progress must be updated in the milestone tracker
- Blockers must be filed as GitHub issues

## Milestone Progress Tracker

See `docs/governance/milestone-tracker.md` for current status.

---

## M7 Implementation Guide for Replit Agent

### Before starting M7 code, read these docs in order:

1. `docs/governance/platform-invariants.md` — P9 (float ledger), P10 (NDPR consent), P11 (Dexie.js sync)
2. `docs/governance/security-baseline.md` — R5 (rate limiting), R6 (webhook idempotency), R7 (PII hashing)
3. `docs/governance/entitlement-model.md` — CBN KYC tier definitions + enforcement
4. `docs/governance/universal-entity-model.md` — CommunityMember, SocialPost, ForumThread, Follow entities
5. `docs/governance/relationship-schema.md` — follows, blocks, community_membership, forum_reply
6. `docs/enhancements/m7/kyc-compliance.md` — Full KYC implementation spec
7. `docs/enhancements/m7/agent-network.md` — POS agent + float ledger spec
8. `docs/enhancements/m7/offline-sync.md` — Dexie.js + USSD gateway spec
9. `docs/enhancements/m7/ndpr-consent.md` — Consent record model + enforcement
10. `docs/enhancements/m7/cbn-kyc-tiers.md` — Transaction limit table + requireKYCTier API
11. `docs/identity/bvn-nin-guide.md` — Prembly/Paystack BVN/NIN API integration
12. `docs/identity/otp-channels.md` — OTP delivery channels + phone validation
13. `docs/identity/frsc-cac-integration.md` — Transport + business verification
14. `docs/community/` (all 5 files) — Community platform spec
15. `docs/social/` (all 5 files) — Social network spec
16. `docs/architecture/decisions/0009-ai-provider-abstraction.md` — M7 extension to payments/otp/identity
17. `docs/architecture/decisions/0010-offline-pwa-standard.md`
18. `docs/contact/multi-channel-model.md` — ContactChannels entity + D1 schema
19. `docs/contact/contact-verification.md` — per-channel verification flows
20. `docs/contact/otp-routing.md` — preference + fallback routing algorithm — M7 Dexie.js + USSD requirements

### M7 Phase Order (STRICT — T9: No Skipped Phases)

```
M7a (3 days) → M7b (3 days) → M7c (4 days) → M7d (4 days) → M7e (2 days)
    ↓                ↓                ↓               ↓              ↓
identity+otp    offline+ussd     community        social         ux polish
```

Each phase must pass CI and Base44 QA before the next phase begins.

### New Package Stubs (scaffolded — implement in order)

| Package | Phase | Stub Location |
|---|---|---|
| `@webwaka/identity` | M7a | `packages/identity/src/index.ts` |
| `@webwaka/otp` | M7a | `packages/otp/src/index.ts` |
| `@webwaka/community` | M7c | `packages/community/src/index.ts` |
| `@webwaka/social` | M7d | `packages/social/src/index.ts` |
| `@webwaka/ussd-gateway` | M7b | `apps/ussd-gateway/src/index.ts` |
| `@webwaka/contact` | M7f | `packages/contact/src/index.ts` |
