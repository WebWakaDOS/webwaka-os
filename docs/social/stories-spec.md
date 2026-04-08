# Stories Specification

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Full Platform + Community/Social
**Date:** 2026-04-08

---

## Overview

Stories are 24-hour ephemeral posts that appear in a horizontal story rail at the top of the home feed. Inspired by Instagram/WhatsApp Stories. They do not persist in the main feed after expiry.

---

## Story Entity

Stories are a sub-type of `SocialPost` with `is_story = true` and `expires_at` set.

```typescript
interface Story extends SocialPost {
  is_story: true;
  expires_at: number;        // Unix epoch — now() + 86400 seconds
  view_count: number;        // Incremented on each unique view
  viewers: string[];         // Array of SocialProfile.id (author can see)
  background_color?: string; // Hex — for text-only stories
  text_overlay?: string;     // Optional caption
  link_url?: string;         // Optional link-out (Scale+ plans only)
}
```

---

## Lifecycle

```
User creates story (photo / video / text)
  → Content moderation scan (AI classifier)
    → Fail → Rejected, author notified
  → Story published with expires_at = now + 86400s
  → Appears in story rail for followers / public (per visibility setting)
  → Views recorded (unique per viewer per story)
  → At expires_at:
    → Story removed from feed and story rail
    → Soft-deleted in DB: is_deleted = true
    → Author retains access via "Your Stories" archive for 7 days
    → After 7 days: hard delete from D1
```

---

## Story Rail Algorithm

Stories are ordered in the rail by:
1. **Unviewed stories from followed accounts first** (priority queue)
2. **Most recent posted first** within unviewed
3. **Viewed stories** at the end (dimmed indicator)

A user with 0 followers sees their own story first, then public stories from top creators (curated by engagement).

---

## Media Constraints

| Type | Max Size | Supported Formats |
|---|---|---|
| Photo | 10 MB | JPEG, PNG, WebP |
| Video | 50 MB | MP4 (H.264), WebM |
| Text-only | — | UTF-8, max 280 chars |
| GIF | 5 MB | GIF (auto-looped) |

Video duration: 15 seconds maximum per story. Multiple story segments allowed (up to 10 per 24h period per user).

---

## Privacy Controls

| Setting | Description |
|---|---|
| `public` | Visible to all users |
| `followers` | Visible to followers only |
| `close_friends` | Visible to a manually curated list |
| `community` | Visible within a specific CommunitySpace |

Close friends list is stored as a `SocialGroup` with `type = 'close_friends'`.

---

## Offline Behaviour

Stories cannot be created offline (requires media upload + moderation scan). However:
- Recently viewed stories are cached in IndexedDB (Dexie.js) for replay during offline periods.
- Cache limit: last 20 stories from followed accounts, 24h TTL in cache.

---

## NDPR / Data Retention

- Story content (media + metadata) is hard-deleted 7 days after expiry.
- View data (who viewed your story) is hard-deleted at the same time.
- Users may delete their story early at any time — immediate hard delete.
- Story analytics aggregates (total view count) may be retained for workspace analytics dashboards (anonymised — no viewer PII).

---

## USSD Limitation

Stories require visual media — USSD interface does not support stories. USSD users see only the text feed. This is documented in `docs/enhancements/m7/offline-sync.md`.
