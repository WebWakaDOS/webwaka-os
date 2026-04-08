# Direct Messaging Privacy

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Full Platform + Community/Social
**Date:** 2026-04-08

---

## Overview

WebWaka DMs are private, direct conversations between two users or within a group. This document defines the privacy contracts, encryption approach, and data handling rules.

---

## DM Entity Model

### DMThread
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `type` | ENUM | `direct` \| `group` |
| `participant_ids` | JSON | Array of `SocialProfile.id` |
| `tenant_id` | TEXT NOT NULL | Tenant isolation |
| `created_at` | INTEGER | Unix epoch |
| `last_message_at` | INTEGER | For inbox sorting |

### DMMessage
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `thread_id` | FK → DMThread | Parent thread |
| `sender_id` | FK → SocialProfile | Message author |
| `content` | TEXT | Message body (encrypted at rest) |
| `media_urls` | JSON | Encrypted CDN references |
| `is_deleted` | BOOLEAN | Soft delete (tombstone) |
| `read_by` | JSON | `{ user_id: read_at }` receipt map |
| `created_at` | INTEGER | Unix epoch |
| `tenant_id` | TEXT NOT NULL | Tenant isolation |

---

## Encryption Contract

### At-Rest Encryption
- All DM message content is encrypted using AES-256-GCM before D1 storage.
- Encryption key derivation: per-thread symmetric key derived from a platform master key (`DM_MASTER_KEY` Cloudflare secret).
- **This is transport encryption, not end-to-end.** The platform can decrypt in-transit for moderation purposes.

### End-to-End Encryption (Future)
- Full E2EE using Signal Protocol (double-ratchet) is a post-M7 deliverable.
- When implemented, the platform will not be able to decrypt messages — moderation will rely on user reports only.
- E2EE must be opt-in initially to allow platform safety compliance with NITDA requirements.

### Key Rotation
- Per-thread keys are rotated every 90 days or on participant change.
- Old messages remain readable with archived keys. Key archive is stored in Cloudflare KV with restricted access.

---

## Privacy Rules

1. **DMs are not indexed** in the search engine or feed algorithm. Content never surfaces publicly.
2. **DM content is not used for AI training** or profiling. It is excluded from all analytics pipelines.
3. **Screenshots/forwarding** cannot be technically prevented but are prohibited in Terms of Service.
4. **Message retention:** DMs are retained for 12 months by default. Users can delete their copy (soft delete — tombstone remains for 30 days for legal hold).
5. **Legal hold:** Law enforcement requests (with valid court order) are processed within 72 hours per NDPR / NITDA rules.

---

## Who Can DM Whom

| Scenario | Allowed |
|---|---|
| Any user → Any public profile | ✅ (unless blocked) |
| Any user → Private profile | ❌ (must follow first, mutual) |
| Blocked user → Blocking user | ❌ (silent fail — 200 response, not delivered) |
| Unverified user → Verified profile | ✅ (but verified profile can filter) |
| Spam/flagged account | ❌ (rate limited — 10 DMs/hour to new recipients) |

---

## NDPR Compliance

- Users must consent to DM data being processed (`consent_records.data_type = 'dm_data'`) at account creation.
- Users may request DM data export — provided within 72 hours (NDPR Article 23).
- Users may request DM deletion — executed within 30 days (soft delete tombstone expiry).

---

## Abuse Prevention

- Unsolicited bulk DMs: rate limited to 10 new-recipient DMs/hour per account.
- Users can report DMs — flagged to moderation queue.
- Reported DMs are reviewed by human moderators within 24 hours.
- Confirmed spam accounts are suspended and DM content removed.
