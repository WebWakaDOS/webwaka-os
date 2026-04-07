# TDR-0003: GitHub as Source of Truth

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

Multiple agents (Base44, Perplexity, Replit, Cursor) and the Founder will participate in design, implementation, review, and deployment. Without a single authoritative store, project state fragments across agent contexts and becomes unrecoverable.

## Decision

All code, prompts, governance documents, architecture decisions, workflows, and infrastructure templates must be stored in GitHub at `WebWakaDOS/webwaka-os`.

No agent may treat its own session context, a local environment, or an external tool as the source of truth. GitHub is canonical.

## Consequences

- Creates a fully auditable, continuous record of all changes and decisions
- Enables any future agent to resume work from a known state
- Branch protection and PR reviews enforce quality gates regardless of which agent produces the change
- All agents must push to GitHub before claiming a task complete — no in-memory-only deliverables accepted
