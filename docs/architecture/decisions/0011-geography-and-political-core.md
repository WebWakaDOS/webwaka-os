# TDR-0011: Geography and Political Core

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka powers discovery, commerce, transport, civic, and political use cases. All of these depend on geography (where things are) and, in several cases, on political territory assignment (who is responsible for where). These are cross-cutting concerns that cannot be owned by any single vertical module.

## Decision

Treat geography taxonomy and political-territory modeling as platform-level shared capabilities.

These models must be implemented in `packages/core` before any vertical-specific module begins development.

## What This Means in Practice

- The typed geography hierarchy (Country → Zone → State → LGA → Ward → Community → Household → Place) is defined in `packages/core/geography`
- Political office types and territory assignments are defined in `packages/core/politics`
- All apps and modules import these types from `packages/core` — no local redefinition
- D1 seed data for Nigerian geography (36 states + FCT, 774 LGAs, 8,814 wards) is loaded as part of the Milestone 2 database bootstrap

## Consequences

- Milestone 2 scaffolding must include `packages/core/geography` and `packages/core/politics` as first-class deliverables
- Discovery indexing, filtering, and aggregation are built on top of this canonical model
- Political assignment records (office type + territory + person + term) derive from the same model — no parallel political-only geography tables
- See `docs/governance/geography-taxonomy.md` and `docs/governance/political-taxonomy.md` for the canonical definitions
