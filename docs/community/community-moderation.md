# Community Moderation

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Full Platform + Community/Social
**Date:** 2026-04-08

---

## Overview

WebWaka community moderation is a multi-layered system combining AI-assisted classification, community self-governance tools, and human moderator review queues. All moderation is tenant-scoped — community owners are the primary moderation authority within their space.

---

## Moderation Role Hierarchy

| Role | Permissions |
|---|---|
| **Super Admin** | Override any moderation decision, access all tenant moderation queues |
| **Community Owner** | Full moderation rights, promote/demote admins and moderators |
| **Community Admin** | Pin/unpin, lock threads, remove content, temporary ban |
| **Moderator** | Flag content, hide posts, issue warnings, temporary mute (72h max) |
| **Member** | Report content via flag button — triggers moderator review |
| **Guest** | View-only — cannot flag or interact |

---

## Content Flag Categories

| Flag Type | Description | Auto-escalation |
|---|---|---|
| `spam` | Repeated or low-quality promotional content | 3 flags → auto-hide |
| `profanity` | Explicit language (locale-aware: English + Pidgin) | AI score ≥ 0.85 → auto-hide |
| `harassment` | Targeted personal attacks | 1 flag → moderator queue |
| `nsfw` | Adult or sexually explicit content | AI score ≥ 0.7 → auto-hide |
| `misinformation` | Factually disputed claims | Moderator queue only |
| `illegal` | Potential legal violation (fraud, hate speech, NDPR breach) | Immediate escalation to owner |

---

## Moderation Pipeline

```
User posts content
  → AI classifier scores (profanity, NSFW, spam)
    → Auto-hide threshold met? → Hide + notify author
    → Not threshold → Publish
  → User flags reported?
    → 3+ same-category flags → Auto-hide + moderator queue
    → 1 flag (harassment/illegal) → Moderator queue
  → Moderator reviews queue
    → Dismiss: content restored, flag count reset
    → Warn: content visible, member receives warning
    → Remove: content hidden, member notified
    → Temporary ban: member suspended (1/7/30 days)
    → Permanent ban: member removed, cannot rejoin
  → Permanent ban / illegal content → Owner notified
```

---

## Ban Types

| Ban Type | Duration | Re-entry |
|---|---|---|
| Content removal | Permanent (content) | Member remains active |
| Warning | Informational | No impact on access |
| Temporary mute | 1–72 hours | Auto-lifts |
| Temporary ban | 1 / 7 / 30 days | Auto-lifts |
| Permanent ban | Indefinite | Owner override only |

Bans are scoped to the CommunitySpace. A banned user is not banned platform-wide unless a Super Admin acts.

---

## NDPR / NITDA Compliance

- Content moderation decisions affecting user data must be logged in `moderation_log` with: `moderator_id`, `action`, `content_id`, `reason`, `timestamp`.
- Users must be notified of moderation actions that affect their content or access.
- Appeals: users may submit an appeal within 7 days of a permanent ban.
- Content removal requests under Nigerian law (court order / NITDA directive) are escalated to `legal@webwaka.com` and processed within 24 hours.
- NITDA Code of Practice self-assessment required before M7 launch gate. See milestone-tracker.md.

---

## AI Classifier Integration

The moderation AI runs through `@packages/ai` (TDR-0009 abstraction). Community moderation uses:

```typescript
interface ModerationScore {
  profanity: number;    // 0–1
  nsfw: number;         // 0–1
  spam: number;         // 0–1
  toxicity: number;     // 0–1
}
```

Thresholds are configurable per tenant. Default thresholds are defined in `packages/community/moderation-config.ts`.

Naija Pidgin (pcm) support: classifier must be calibrated for common Pidgin terms that are culturally neutral but may false-positive on generic English profanity filters.
