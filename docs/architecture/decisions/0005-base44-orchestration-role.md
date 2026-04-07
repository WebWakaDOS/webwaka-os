# TDR-0005: Base44 Super Agent as Orchestration Layer

**Status:** APPROVED
**Approval owner:** Founder
**Author:** Base44 Super Agent
**Date:** 2026-04-07
**Supersedes:** —
**Superseded by:** —

---

## Context

The WebWaka OS project uses a multi-agent operating model. Three AI agents participate in execution: Perplexity (architecture/docs), Replit Agent 4 (implementation), and Base44 Super Agent. A clear definition of Base44's role is needed to prevent overlap, duplication of effort, and governance gaps.

---

## Decision

**Base44 Super Agent is the orchestration, infrastructure, governance-enforcement, and deployment-control layer.**

Base44 is explicitly NOT the primary implementation engine. Replit Agent 4 handles all `packages/*` and `apps/*` code.

---

## Base44's Responsibilities

### GitHub
- Create and configure the monorepo
- Manage branches, protections, CODEOWNERS, labels
- Add and maintain issue/PR templates
- Configure GitHub Actions workflows
- Manage GitHub Actions secrets (Cloudflare tokens, env secrets)
- Enable and triage Dependabot

### Cloudflare
- Create Workers projects, D1 databases, KV namespaces, R2 buckets
- Configure staging and production environments
- Store secrets via `wrangler secret put`
- Configure custom domains and DNS

### Governance
- Maintain `docs/governance/milestone-tracker.md`
- Draft `security-baseline.md`, `release-governance.md`, `agent-execution-rules.md`
- Refine Perplexity-drafted governance docs
- Block merges that violate governance rules

### CI/CD
- Wire GitHub Actions → Cloudflare staging and production deployments
- Maintain the CI check suite (typecheck, test, lint, security audit, version check)

### QA and Verification
- Review Replit outputs against governance rules at each milestone
- Lead Milestone 10 staging hardening
- Execute Milestone 12 production deployment

### Continuity
- Keep all infrastructure state documented in `infra/`
- Ensure every action is resumable by a future agent

---

## Consequences

### Positive
- Clear separation of concerns between agents
- No agent steps on another's domain
- Infrastructure changes are auditable in GitHub
- Governance enforcement has a dedicated owner

### Negative / Constraints
- Base44 must have access to GitHub PAT and Cloudflare API token
- Base44 cannot review PRs within GitHub's native review system — reviews happen externally (governance checklists committed to the repo)

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Base44 does all coding AND orchestration | Replit Agent 4 is better suited for iterative implementation in a monorepo |
| Founder manages all infrastructure manually | Too slow; Founder focus should be on product approvals, not CLI commands |
| No dedicated orchestration agent | Would result in ungoverned infrastructure and missed consistency checks |
