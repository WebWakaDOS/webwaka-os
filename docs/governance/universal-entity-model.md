# Universal Entity Model

**Status:** Approved — Milestone 1 Governance Baseline | Updated M7
**Author:** Perplexity (Milestone 1) | Extended by Base44 Super Agent (M7)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026
**M7 Updated:** 2026-04-08

---

## Root Entities

### Individuals

Person entities such as politicians, creators, professionals, founders, sole traders, agents, and office holders.

### Organizations

Collective entities such as businesses, political parties, NGOs, schools, churches, clinics, firms, and partner operators.

### Places

Physical or territorial entities such as markets, motor parks, offices, wards, LGAs, states, zones, communities, and households.

### Offerings

The units of value or participation exposed by downstream entities, including products, services, routes, seats, donations, memberships, subscriptions, tickets, campaigns, and appointments.

### Profiles

Public discovery records for Individuals, Organizations, Places, and sometimes Offerings.

### Workspaces

Tenant-scoped management contexts for operations, teams, data, settings, and workflows.

### Brand Surfaces

Dedicated branded digital experiences such as websites, stores, portals, booking pages, and campaign sites.

---

## M7 Extension: Community Entities

These entities are introduced in Milestone 7 and live in `packages/community`.

### CommunitySpace

The root entity for a Skool-style community. Owned by an Organisation or Individual workspace.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `workspace_id` | FK → Workspaces | Owner workspace |
| `tenant_id` | TEXT NOT NULL | Tenant isolation key |
| `name` | TEXT | Display name |
| `slug` | TEXT UNIQUE | URL identifier |
| `visibility` | ENUM | `public` \| `private` \| `invite_only` |
| `created_at` | INTEGER | Unix epoch |

### CommunityMember

Relationship between a User and a CommunitySpace.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `community_id` | FK → CommunitySpace | Parent community |
| `user_id` | FK → Users | Member |
| `role` | ENUM | `owner` \| `admin` \| `moderator` \| `member` \| `guest` |
| `tier` | TEXT | Maps to subscription or one-time access plan |
| `joined_at` | INTEGER | Unix epoch |
| `kyc_tier` | INTEGER | CBN KYC tier at join (required for paid tiers) |
| `tenant_id` | TEXT NOT NULL | Tenant isolation key |

### SocialPost

A user-generated content item for the social feed.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `author_id` | FK → Users | Post author |
| `tenant_id` | TEXT NOT NULL | Tenant isolation key |
| `content` | TEXT | Post body (max 2000 chars) |
| `media_urls` | JSON | Array of CDN URLs (images/video) |
| `reactions` | JSON | `{ like: n, fire: n, clap: n }` aggregate |
| `visibility` | ENUM | `public` \| `followers` \| `community` \| `draft` |
| `is_story` | BOOLEAN | 24h TTL ephemeral post |
| `expires_at` | INTEGER \| NULL | Unix epoch — set for stories |
| `created_at` | INTEGER | Unix epoch |

### ForumThread

A discussion thread inside a CommunityChannel.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `community_id` | FK → CommunitySpace | Parent community |
| `channel_id` | FK → CommunityChannel | Parent channel |
| `title` | TEXT | Thread title |
| `author_id` | FK → Users | Thread creator |
| `posts_count` | INTEGER | Cached reply count |
| `is_pinned` | BOOLEAN | Pinned by moderator |
| `is_locked` | BOOLEAN | No new replies |
| `tenant_id` | TEXT NOT NULL | Tenant isolation key |
| `created_at` | INTEGER | Unix epoch |

---

## M7 Extension: Social Graph Entities

These entities are introduced in Milestone 7 and live in `packages/social`.

### SocialProfile

Public identity for a user in the social network layer.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | FK → Users | One-to-one with User |
| `handle` | TEXT UNIQUE | @handle |
| `bio` | TEXT | Profile bio |
| `avatar_url` | TEXT | CDN URL |
| `is_verified` | BOOLEAN | NIN/BVN blue-tick |
| `tenant_id` | TEXT NOT NULL | Tenant isolation key |

### Follow

Directed follow relationship between two SocialProfiles.

| Field | Type | Notes |
|---|---|---|
| `follower_id` | FK → SocialProfile | Who is following |
| `following_id` | FK → SocialProfile | Who is being followed |
| `created_at` | INTEGER | Unix epoch |
| **Constraint** | PRIMARY KEY | `(follower_id, following_id)` — no duplicate follows |

---

## Key Rules

**Model what something _is_ before modeling what it _does_.**

Roles, claims, subscriptions, and political assignments are layered on top of root entities, not substituted for them.

## Access Rule

Existence in the system does not automatically grant access to all capabilities. Subscription and entitlements determine what each entity can activate and manage.

## KYC Rule (M7)

Any entity that participates in a monetary transaction or paid community must have a `kyc_tier` evaluated at the point of action. See `docs/governance/entitlement-model.md` for CBN tier definitions.

---

## ContactChannels (M7a — Multi-Channel Contact)

**Purpose:** Stores all verified contact channels for an entity (SMS/WhatsApp/Telegram/Email).

**Key Rule:** `primary_phone` is mandatory (Platform Invariant P13). All other channels are optional.

```typescript
ContactChannels {
  entity_id            string    // FK → entities.id (1:1 unique)
  tenant_id            string

  primary_phone        string    // E.164 (+234...) — MANDATORY
  primary_phone_verified boolean
  primary_phone_verified_at number | null

  whatsapp_phone       string | null
  whatsapp_verified    boolean
  whatsapp_same_as_primary boolean   // UI checkbox

  telegram_handle      string | null  // @handle
  telegram_chat_id     string | null  // server-populated via bot
  telegram_verified    boolean

  email                string | null
  email_verified       boolean

  notification_preference  "sms" | "whatsapp" | "telegram" | "email"
  otp_preference           "sms" | "whatsapp" | "telegram"
}
```

**Package:** `@webwaka/contact` (`packages/contact/`)
**Spec:** `docs/contact/multi-channel-model.md`
**Migration:** `0036_contact_channels.sql`
