# M7c QA Brief — Community Platform + Social Network

**Date:** 2026-04-08
**Milestone:** M7c — Community Platform (Skool-style) + Social Network
**Repository:** https://github.com/WebWakaDOS/webwaka-os
**Commit:** `324659820a0c657be49931e4044ff8f5e38e666d`
**QA Lead:** Expert QA Engineer
**Environment:** Cloudflare Workers + Hono + D1 + TypeScript strict mode

---

## 1. Scope

This QA pass covers everything introduced in M7c:

| Deliverable | Files | Test Count |
|---|---|---|
| `packages/community` — spaces, channels, courses, events, moderation, entitlements | `packages/community/src/*.ts` | 45 unit tests |
| `packages/social` — profiles, follows, posts, feed, DMs, stories, moderation | `packages/social/src/*.ts` | 41 unit tests |
| `apps/api` — community + social HTTP routes | `apps/api/src/routes/community.ts`, `social.ts` | 43 integration tests |
| `apps/ussd-gateway` — Branch 3 (trending) + Branch 5 (community) | `apps/ussd-gateway/src/*.ts` | 82 unit tests |
| `packages/offline-sync` — Dexie v2 + feedCache + courseContent | `packages/offline-sync/src/db.ts`, `service-worker.ts` | 29 unit tests |
| D1 Migrations | `infra/db/migrations/0026_*.sql` – `0034_*.sql` | 9 migration files |

**Total tests expected to pass: ≥ 240** (current automated count: 349 across all packages including unchanged M7b packages).

---

## 2. Environment Setup

### 2.1 Prerequisites

```bash
node --version   # must be 20.x or 22.x
pnpm --version   # must be 9.x or 10.x
```

### 2.2 Install and verify

```bash
git clone https://github.com/WebWakaDOS/webwaka-os.git
cd webwaka-os
pnpm install
```

### 2.3 Run all tests

```bash
# Run everything in one command
pnpm --filter @webwaka/community test
pnpm --filter @webwaka/social test
pnpm --filter @webwaka/api test
pnpm --filter @webwaka/ussd-gateway test
pnpm --filter @webwaka/offline-sync test
```

Expected output for each: all tests pass with zero failures.

### 2.4 Typecheck

```bash
pnpm --filter @webwaka/community typecheck
pnpm --filter @webwaka/social typecheck
pnpm --filter @webwaka/api typecheck
pnpm --filter @webwaka/ussd-gateway typecheck
pnpm --filter @webwaka/offline-sync typecheck
```

Expected: zero TypeScript errors in strict mode.

### 2.5 Lint

```bash
pnpm --filter @webwaka/community lint
pnpm --filter @webwaka/social lint
```

---

## 3. Platform Invariants to Verify

These are non-negotiable platform invariants that must hold across all M7c code. Any violation is a **P0 bug**.

| ID | Rule | Where Enforced | How to Verify |
|---|---|---|---|
| **T3** | Every D1 query carries `tenant_id` predicate | All repository functions in `packages/community` and `packages/social` | Grep for `SELECT` queries missing `tenant_id =` in WHERE clause |
| **T4** | All monetary amounts stored as integer kobo — never floats | `createEvent`, `createMembershipTier` | Pass `99.99` as `ticketPriceKobo` — must throw with `non-negative integer` |
| **T5** | Paid tiers / courses gated by entitlement plan | `assertPaidTiersEnabled`, `assertCoursesEnabled`, `assertMaxSpaces` | Confirm FREE tier throws on paid-tier creation |
| **P10** | NDPR consent required before `joinCommunity` | `packages/community/src/membership.ts` | Call `joinCommunity` with no consent row — must throw `NDPR_CONSENT_REQUIRED` |
| **P14** | `DM_MASTER_KEY` must throw at startup if absent | `packages/social/src/dm.ts::assertDMMasterKey` | Call `assertDMMasterKey(undefined)` — must throw; call `assertDMMasterKey('')` — must throw |
| **P15** | `classifyContent` called unconditionally before every post insert | `packages/community/src/channel.ts::createChannelPost`, `packages/social/src/social-post.ts::createPost` | Inspect call graph — moderation must precede `INSERT` in both functions |
| **P7** | No direct OpenAI/Anthropic SDK imports anywhere | All `packages/` and `apps/` | `grep -r "openai\|anthropic" packages/ apps/` — must return zero matches |

---

## 4. D1 Migrations QA

### 4.1 Migration files to verify

| File | Table(s) Created |
|---|---|
| `0026_community_spaces.sql` | `community_spaces`, `community_membership_tiers` |
| `0027_community_channels.sql` | `community_channels`, `channel_posts` |
| `0028_community_courses.sql` | `course_modules`, `course_lessons`, `lesson_progress` |
| `0029_community_events.sql` | `community_events`, `event_rsvps` |
| `0030_community_moderation.sql` | `community_moderation_log` |
| `0031_social_profiles.sql` | `social_profiles`, `social_follows` |
| `0032_social_posts_groups.sql` | `social_posts`, `social_reactions`, `social_groups`, `social_group_members` |
| `0033_social_dms.sql` | `dm_threads`, `dm_thread_participants`, `dm_messages` |
| `0034_feed_meta.sql` | `feed_impressions` |

### 4.2 Checks per migration

For each file:
- [ ] Has `-- Migration: NNNN_description` header comment
- [ ] All tables include `tenant_id TEXT NOT NULL` column (T3)
- [ ] All monetary columns are `INTEGER` not `REAL` or `FLOAT` (T4)
- [ ] `CREATE TABLE IF NOT EXISTS` used (idempotent)
- [ ] Relevant indexes on `tenant_id`, `created_at`, and foreign key columns
- [ ] No `AUTO_INCREMENT` — uses `TEXT` primary keys (UUID pattern from M7a)

### 4.3 Specific checks

**`0031_social_profiles.sql`:**
- `phone_number` column exists (required by USSD Branch 5 lookup: `SELECT id FROM social_profiles WHERE phone_number = ?`)

**`0032_social_posts_groups.sql`:**
- `like_count INTEGER DEFAULT 0` column exists (required by USSD Branch 3 trending query)
- `post_type TEXT NOT NULL DEFAULT 'post'` column exists
- `is_deleted INTEGER NOT NULL DEFAULT 0` column exists

**`0033_social_dms.sql`:**
- `encrypted_content TEXT` — content stored encrypted (P14)
- `iv TEXT` — AES-GCM initialisation vector stored per message
- NO plaintext `content` column (would be a P14 violation)

---

## 5. packages/community QA

### 5.1 Run tests

```bash
pnpm --filter @webwaka/community test --reporter=verbose
```

Expected: 45 tests, 0 failures.

### 5.2 Manual test cases

#### Community Space

```typescript
// T3 — tenant_id isolation
const space = await createCommunitySpace(db, {
  name: 'Lagos Devs',
  slug: 'lagos-devs',
  tenantId: 'tenant-a',
});
// Must NOT appear in getCommunitySpace(db, 'lagos-devs', 'tenant-b')
```

#### Membership / P10

```typescript
// Must throw NDPR_CONSENT_REQUIRED if no consent row for userId
await joinCommunity(db, {
  communityId: 'c-1',
  userId: 'user-1',
  tierId: 'tier-free',
  kycTier: 0,
  tenantId: 'tenant-a',
});
// Expected: Error('NDPR_CONSENT_REQUIRED')
```

#### Channel Post / P15

```typescript
// moderation must run BEFORE insert
// Inject spy on classifyContent and confirm it is called before run()
const post = await createChannelPost(db, {
  channelId: 'ch-1',
  authorId: 'user-1',
  content: 'buy cheap watches follow me', // spam heuristic
  tenantId: 'tenant-a',
});
// Expected: post.moderationStatus === 'auto_hide' (not 'published')
```

#### Course / T4

```typescript
// Float ticketPriceKobo must throw (T4)
await createEvent(db, {
  communityId: 'c-1',
  title: 'Paid Workshop',
  type: 'live',
  startsAt: Date.now(),
  ticketPriceKobo: 29.99,   // ← float
  tenantId: 'tenant-a',
});
// Expected: Error matching /non-negative integer/i
```

#### Entitlements / T5

```typescript
// FREE tier cannot have paid tiers
assertPaidTiersEnabled(FREE_COMMUNITY_ENTITLEMENTS);
// Expected: Error('ENTITLEMENT_DENIED: ...')

// ENTERPRISE tier has unlimited spaces (maxCommunitySpaces = -1)
assertMaxSpaces(9999, ENTERPRISE_COMMUNITY_ENTITLEMENTS);
// Expected: no throw
```

---

## 6. packages/social QA

### 6.1 Run tests

```bash
pnpm --filter @webwaka/social test --reporter=verbose
```

Expected: 41 tests, 0 failures.

### 6.2 Manual test cases

#### P14 — DM encryption

```typescript
// assertDMMasterKey must throw when key is missing
assertDMMasterKey(undefined);     // throw
assertDMMasterKey('');            // throw
assertDMMasterKey('valid-key');   // no throw

// sendDM must encrypt content — inspect the stored dm_messages row:
// encrypted_content should NOT equal the plaintext
// iv column must be a non-empty hex/base64 string
```

#### P15 — Post moderation

```typescript
// Social post moderation runs before insert
const post = await createPost(db, {
  authorId: 'user-1',
  content: 'buy cheap watches click now', // spam
  tenantId: 'tenant-a',
});
// Expected: post.moderationStatus === 'auto_hide'
```

#### Self-follow guard

```typescript
await followProfile(db, {
  followerId: 'user-1',
  followeeId: 'user-1',  // same ID
  tenantId: 'tenant-a',
});
// Expected: Error('SELF_FOLLOW')
```

#### Stories TTL

```typescript
// Story created 25h ago should be expired
const hoursAgo25 = Math.floor(Date.now() / 1000) - (25 * 3600);
const remaining = storyTimeRemaining(hoursAgo25);
// Expected: remaining === 0
```

#### Handle uniqueness

```typescript
// Duplicate handle must throw
await setupSocialProfile(db, { profileId: 'u1', handle: 'amaka', tenantId: 'tenant-a' });
await setupSocialProfile(db, { profileId: 'u2', handle: 'amaka', tenantId: 'tenant-a' });
// Expected: second call throws Error('HANDLE_TAKEN')
```

#### Feed isolation (T3)

```typescript
// user-1's feed from tenant-a must NOT include posts from tenant-b
const posts = await getUserFeed(db, 'user-1', { tenantId: 'tenant-a', limit: 20, offset: 0 });
// All returned posts must have tenant_id === 'tenant-a'
```

---

## 7. apps/api — Community + Social Routes QA

### 7.1 Run tests

```bash
pnpm --filter @webwaka/api test --reporter=verbose
```

Expected: 152 tests, 0 failures (includes all existing M7b tests + 43 new M7c tests).

### 7.2 Route contract verification

#### Community routes

| Method | Path | Auth Required | Expected Success | P10/P15/T3 |
|---|---|---|---|---|
| GET | `/community/:slug` | No | 200 `{ space }` | T3 via X-Tenant-Id header |
| POST | `/community/join` | Yes | 201 `{ membership }` | P10 — 403 if no NDPR consent |
| GET | `/community/:id/channels` | No | 200 `{ channels: [] }` | T3 |
| GET | `/community/channels/:id/posts` | No | 200 `{ posts: [] }` | T3 |
| POST | `/community/channels/:id/posts` | Yes | 201 `{ post }` | P15 — moderation called |
| GET | `/community/:id/courses` | No | 200 `{ modules: [] }` | T3 |
| GET | `/community/lessons/:id` | No | 200 `{ lesson }` | P6 — offline-cacheable |
| POST | `/community/lessons/:id/progress` | Yes | 200 `{ progress }` | T3 |
| GET | `/community/:id/events` | No | 200 `{ events: [] }` | T3 |
| POST | `/community/events/:id/rsvp` | Yes | 201 `{ rsvp }` | 402 if PAYMENT_REQUIRED, 409 if EVENT_FULL |

#### Social routes

| Method | Path | Auth Required | Expected Success | Invariants |
|---|---|---|---|---|
| GET | `/social/profile/:handle` | No | 200 `{ profile }` | T3 via X-Tenant-Id |
| POST | `/social/profile/setup` | Yes | 201 `{ profile }` | 409 if HANDLE_TAKEN |
| POST | `/social/follow/:id` | Yes | 201 `{ follow }` | 400 if SELF_FOLLOW |
| GET | `/social/feed` | Yes | 200 `{ posts: [] }` | T3 |
| POST | `/social/posts` | Yes | 201 `{ post }` | P15 — moderation called |
| POST | `/social/posts/:id/react` | Yes | 201 `{ reaction }` | T3 |
| GET | `/social/dm/threads` | Yes | 200 `{ threads: [] }` | T3 |
| POST | `/social/dm/threads` | Yes | 201 `{ thread }` | 400 if <2 participants |
| POST | `/social/dm/threads/:id/messages` | Yes | 201 `{ message }` | P14 — assertDMMasterKey called |
| GET | `/social/stories` | Yes | 200 `{ stories: [] }` | T3 |

#### Validation error cases to confirm

```bash
# 400 on empty content
POST /community/channels/ch-1/posts  body: { "content": "" }

# 400 on invalid progressPct
POST /community/lessons/ls-1/progress  body: { "progressPct": 150 }

# 400 on invalid handle
POST /social/profile/setup  body: { "handle": "UPPERCASE" }

# 400 on invalid reaction type
POST /social/posts/p-1/react  body: { "type": "dislike" }

# 400 on <2 DM participants
POST /social/dm/threads  body: { "participantIds": ["user-001"] }
```

### 7.3 Auth middleware coverage

Confirm these routes return 401 when `Authorization` header is missing (auth middleware must be registered before route handler):

```
POST /community/join
POST /community/channels/:id/posts
POST /community/lessons/:id/progress
POST /community/events/:id/rsvp
POST /social/profile/setup
POST /social/follow/:id
GET  /social/feed
POST /social/posts
POST /social/posts/:id/react
GET  /social/dm/threads
POST /social/dm/threads
POST /social/dm/threads/:id/messages
GET  /social/stories
```

---

## 8. apps/ussd-gateway QA

### 8.1 Run tests

```bash
pnpm --filter @webwaka/ussd-gateway test --reporter=verbose
```

Expected: 82 tests (session: 6, menus: 36, processor: 40), 0 failures.

### 8.2 Branch 3 — Trending (*384*3#)

**FSM flow to verify:**

```
main_menu → "3" → trending_feed (posts from session.data.trendingPosts)
trending_feed → "1" → trending_post_detail (selectedPostIndex=0)
trending_post_detail → "1" → END "Post liked!"
trending_post_detail → "0" → trending_feed
trending_feed → "0" → main_menu
```

**Checks:**

- [ ] When session contains `trendingPosts` array, the menu shows numbered `@handle: content` lines
- [ ] Content is truncated to 40 characters
- [ ] At most 5 posts shown
- [ ] Selecting "1"–"5" transitions to `trending_post_detail` with correct `selectedPostIndex`
- [ ] Out-of-range selection (e.g. "9") returns `END Invalid selection`
- [ ] When no posts in session, shows `CON ... No trending posts yet`
- [ ] "0" always returns to parent menu

**D1 query (in `apps/ussd-gateway/src/index.ts::fetchTrendingPosts`):**

```sql
SELECT p.content, sp.handle
FROM social_posts p
JOIN social_profiles sp ON sp.id = p.author_id AND sp.tenant_id = p.tenant_id
WHERE p.tenant_id = ? AND p.is_deleted = 0 AND p.post_type = 'post'
ORDER BY p.like_count DESC
LIMIT 5
```

Verify:
- [ ] T3 — `tenant_id = ?` binding present
- [ ] Filters `is_deleted = 0` and `post_type = 'post'` (no stories or reposts)
- [ ] Ordered by `like_count DESC`
- [ ] Gracefully returns `[]` on D1 error (try/catch present)

### 8.3 Branch 5 — Community (*384*5#)

**FSM flow to verify:**

```
main_menu → "5" → community_list (communities from session.data.communities)
community_list → "1" → community_detail (selectedCommunityId, selectedCommunityName)
community_detail → "1" → END "Latest announcements..."
community_detail → "2" → END "Upcoming events..."
community_detail → "3" → END "View all members..."
community_detail → "0" → community_list
community_list → "0" → main_menu
```

**Checks:**

- [ ] When session contains `communities` array, shows numbered community names
- [ ] At most 5 communities shown
- [ ] Selecting "1"–"5" transitions to `community_detail` with correct community name and ID
- [ ] Out-of-range selection (e.g. "9") returns `END Invalid selection`
- [ ] When no communities in session, shows `CON ... You have no communities yet`
- [ ] `communityDetailMenu` shows Announcements / Upcoming Events / Members / Back
- [ ] Community name in `communityDetailMenu` truncated to 30 chars

**D1 queries (in `apps/ussd-gateway/src/index.ts::fetchUserCommunities`):**

1. Phone → userId lookup:
```sql
SELECT p.id FROM social_profiles p
WHERE p.phone_number = ? AND p.tenant_id = ? LIMIT 1
```

2. Communities lookup:
```sql
SELECT cs.id, cs.name
FROM community_memberships cm
JOIN community_spaces cs ON cs.id = cm.community_id AND cs.tenant_id = cm.tenant_id
WHERE cm.user_id = ? AND cm.tenant_id = ? AND cm.status = 'active'
ORDER BY cm.joined_at DESC
LIMIT 5
```

Verify:
- [ ] T3 — `tenant_id = ?` binding in both queries
- [ ] Returns `[]` when profile not found (graceful)
- [ ] Returns `[]` on D1 error (try/catch present)
- [ ] Only `status = 'active'` memberships included

### 8.4 Legacy `community_menu` state

The old `community_menu` state must still work (backward compat with persisted KV sessions):

```
session.state === 'community_menu' → handleCommunityList is called → correct behaviour
```

Verify processor.ts switch statement routes `community_menu` to `handleCommunityList`.

---

## 9. packages/offline-sync QA

### 9.1 Run tests

```bash
pnpm --filter @webwaka/offline-sync test --reporter=verbose
```

Expected: 29 tests, 0 failures.

### 9.2 Dexie v2 schema checks

In `packages/offline-sync/src/db.ts`:

- [ ] `super('webwaka_offline_v1')` — database name unchanged (same store, different version number)
- [ ] `version(1)` block present and only defines `syncQueue` (no changes to v1 schema)
- [ ] `version(2)` block adds `feedCache` and `courseContent` tables
- [ ] `feedCache` indexed on `postId` and `authorId`
- [ ] `courseContent` indexed on `lessonId`
- [ ] `cacheFeedPosts` function evicts entries beyond 50 (offline budget P5)
- [ ] `getCachedFeed` + `getCachedLesson` exported from `packages/offline-sync/src/index.ts`

### 9.3 Type checks

```typescript
// FeedCacheItem must have these fields:
interface FeedCacheItem {
  postId: string;
  authorId: string;
  content: string;
  mediaUrls: string;   // JSON array string
  createdAt: number;
  tenantId: string;
  cachedAt: number;
}

// CourseContentItem must have:
interface CourseContentItem {
  lessonId: string;
  title: string;
  body: string | null;
  contentType: string;
  tenantId: string;
  cachedAt: number;
}
```

### 9.4 Service Worker — lesson caching

In `packages/offline-sync/src/service-worker.ts`:

- [ ] `SW_CACHE_NAME` exported (used by `public/sw.js`)
- [ ] `SW_COMMUNITY_POST_SYNC_TAG` exported
- [ ] `registerSyncServiceWorker` registers BOTH `'webwaka-sync'` AND `'webwaka-community-posts'` sync tags
- [ ] The JSDoc comment block contains the correct `public/sw.js` template covering:
  - Cache-first strategy for `/community/lessons/` GET requests
  - Background Sync handler for `'webwaka-community-posts'` tag

---

## 10. Cross-Cutting Regression Checks

Run the full test suite to confirm M7c did not break M7a/M7b:

```bash
pnpm --filter @webwaka/pos test          # POS float ledger
pnpm --filter @webwaka/identity test     # BVN/NIN identity
pnpm --filter @webwaka/otp test          # OTP channels
pnpm --filter @webwaka/contact test      # Multi-channel contact
```

Also verify the API's existing test files still pass:

```bash
# In apps/api/:
pnpm --filter @webwaka/api test          # should show 152 tests (7 pre-M7c files + 2 new files)
```

---

## 11. Known Issues / Watch Points

The following areas were identified during implementation and should receive extra scrutiny:

### 11.1 Hono route ordering conflict (HIGH risk)

In `apps/api/src/routes/community.ts`, the catch-all `GET /:slug` is registered **first**. Routes like `GET /channels/:id/posts`, `GET /lessons/:id`, and `GET /:id/courses` are registered **after** it.

In Hono, the first matching route wins. For a request like `GET /community/channels/ch-1/posts`:

- Does Hono match `/:slug` with `slug = "channels"` first? Or does it correctly match `/channels/:id/posts`?

**Test this manually:**

```bash
curl -H "X-Tenant-Id: test" http://localhost:5000/community/channels/ch-1/posts
# Expected: 200 { posts: [] } (listChannelPosts called)
# Bug: 404 { error: 'Community not found' } (getCommunitySpace called with slug="channels")
```

If the bug manifests, reorder routes so specific paths (`/channels/`, `/lessons/`, `/events/`) are registered before the `/:slug` catch-all.

### 11.2 DM_MASTER_KEY absence at startup (P14)

`assertDMMasterKey` is called inside the route handler, not at Worker startup. This means a Worker without `DM_MASTER_KEY` bound will accept all DM requests up until the first message send (returning 500 instead of refusing at startup).

**Recommended fix:** Call `assertDMMasterKey(env.DM_MASTER_KEY)` in `apps/api/src/index.ts` in the app initialisation block, outside route handlers, so it throws immediately on Worker cold start if the secret is missing.

**Test:** Deploy without `DM_MASTER_KEY` bound → first request to any route should fail (not just `/social/dm/threads/:id/messages`).

### 11.3 USSD session data type narrowing

`USSDSession.data` is typed as `Record<string, unknown>`. The processor casts `session.data['trendingPosts'] as TrendingPost[]` without runtime validation. If KV returns a session with corrupted data, this will cause a silent undefined-read error.

**Test:** Manually corrupt the KV session to set `trendingPosts: "not-an-array"`, then call `*384*3*1#`. The processor should return `END Invalid selection` (it does for a missing array) but may panic on `posts.length` if `posts` is a string.

**Recommended fix:** Add a runtime check: `if (!Array.isArray(posts)) return { text: endSession('Session error. Dial *384# again.'), ... }`.

### 11.4 Social stories — static import (fixed)

The original implementation of `GET /social/stories` used a dynamic import (`await import('@webwaka/social')`). This has been fixed to use the already-imported static `getActiveStories`. Verify the fix is in place:

```bash
grep -n "dynamic import\|await import" apps/api/src/routes/social.ts
# Expected: no output (dynamic import has been removed)
```

### 11.5 Offline-sync Dexie migration

The Dexie database name is still `webwaka_offline_v1` (unchanged intentionally). The **version number** goes from 1 to 2. Confirm that no old data is lost on upgrade: v2's `stores()` call for `syncQueue` must be identical to v1's definition.

**Test in browser:**
1. Open the PWA with v1 schema (M7b build)
2. Queue 3 offline sync items
3. Upgrade to v2 (M7c build)
4. Confirm the 3 items still exist in IndexedDB `syncQueue`
5. Confirm `feedCache` and `courseContent` tables now exist

---

## 12. Issue Reporting Format

For each issue found, create a GitHub issue with:

```
Title: [M7c][SEVERITY] Short description

## Invariant / Rule violated
(T3, T4, P10, P14, P15, P6, or None)

## Steps to Reproduce
1. ...
2. ...

## Expected
...

## Actual
...

## Suggested Fix
(Optional — include if obvious)

## Files
- path/to/file.ts:line
```

Severity levels:
- **P0** — Platform invariant violated (T3/T4/P10/P14/P15), data exposure risk, or data corruption
- **P1** — Route returns wrong status code, FSM enters invalid state, or test failure
- **P2** — Cosmetic, documentation, or non-critical behaviour
