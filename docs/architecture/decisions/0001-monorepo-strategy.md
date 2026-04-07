# TDR-0001: Monorepo Strategy

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka is being redesigned from scratch across multiple sectors, shared packages, and agent-authored implementations. The platform requires one canonical domain model, shared type packages, strong governance enforcement, and agent-friendly continuity across handoffs.

## Decision

Use a single monorepo as the default repository strategy for the redesign.

All platform code — apps, shared packages, tests, infrastructure templates, governance documents, and architecture decisions — resides in `WebWakaDOS/webwaka-os`.

## Consequences

**Positive:**
- One source of truth for all code, types, contracts, and governance
- Atomic changes across multiple packages are possible in a single PR
- Shared packages can be imported without resolving external registries
- Governance workflows apply uniformly across all modules

**Negative / Mitigations:**
- Requires strong internal package boundaries to prevent coupling — enforced by package scope rules in Milestone 2
- CI must be efficient to avoid long runtimes — enforced via affected-package-only job filters
- All agents must respect monorepo layout conventions — enforced via `CONTRIBUTING.md` and `AGENTS.md`
