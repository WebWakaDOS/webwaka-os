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
