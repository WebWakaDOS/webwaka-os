# Relationship Schema

**Status:** Approved — Milestone 1 Governance Baseline
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Core Relationships

| Relationship | Description |
|---|---|
| `owns` | Entity has ownership rights over another entity |
| `manages` | Entity has operational control over another entity |
| `claims` | User or entity has claimed a profile or place |
| `affiliated_with` | Entity is formally associated with another |
| `belongs_to` | Entity is a member of a parent collection |
| `delegates_to` | Entity passes down rights or authority to another |
| `offers` | Entity exposes an Offering to the market |
| `publishes_to` | Entity pushes content to a Brand Surface |
| `listed_in` | Entity appears in a discovery collection |
| `located_in` | Entity is physically or administratively within a Place |
| `operates_in` | Entity conducts activities in a geography |
| `serves` | Entity provides value to another entity or population |
| `hosts` | Entity is the venue or container for another |
| `holds_office` | Individual holds a political or institutional role |
| `jurisdiction_over` | Political entity has authority over a territory |

## Rules

1. Root entities must remain distinct from their relationships.
2. Geography relationships must support ancestry and rollups.
3. Political relationships must be explicit, not tag-based.
4. Publication relationships must separate neutral discovery from owned brand channels.
5. Delegation must always be constrained by entitlement.

---

## M7 Addition: Social & Community Relationships

| Relationship | Description |
|---|---|
| `follows` | SocialProfile → SocialProfile directed follow (no reciprocity implied) |
| `blocks` | SocialProfile → SocialProfile hard block — hides content, prevents DMs |
| `mutes` | SocialProfile → SocialProfile soft hide — content hidden, not notified |
| `community_membership` | User → CommunitySpace join relationship with role and tier |
| `forum_reply` | ForumPost → ForumThread reply chain |
| `reacts_to` | User → SocialPost reaction (like, fire, clap, etc.) |
| `member_of_group` | SocialProfile → SocialGroup membership |
| `dm_thread` | SocialProfile ↔ SocialProfile or Group direct message thread |

### Social Graph Rules

1. `follows` is asymmetric by default. Mutual follows create a "connection" in display logic but remain two independent records.
2. A `blocks` relationship supersedes `follows`, `mutes`, and `dm_thread` — blocked user cannot see content or send DMs.
3. `community_membership` role hierarchy: `owner > admin > moderator > member > guest`.
4. `forum_reply` chains are stored with `parent_post_id` for threading. Max depth = 5 (flat after that).
5. All social relationships are tenant-scoped (`tenant_id` is required on every record).
