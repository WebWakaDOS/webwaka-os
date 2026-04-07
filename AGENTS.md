# Agent Coordination Model

WebWaka OS uses a multi-agent operating model. This document defines each agent's role, responsibilities, and handoff rules.

## Agents

### Founder / Product Owner
- Approves architecture and scope decisions
- Accepts milestone completions
- Makes final go/no-go for production releases
- Does not implement or configure directly

### Perplexity
- Brainstorms and refines architecture
- Drafts governance documents and TDRs
- Clarifies requirements and writes implementation prompts
- Does not push code or configure infrastructure

### Replit Agent 4
- Primary implementation engine
- Implements all `packages/*` and `apps/*` code
- Writes tests for all code it produces
- Commits must be clean, typed, and governance-compliant
- **Must read `docs/governance/` before starting any implementation**
- **Must read relevant TDRs before implementing a feature**
- Reports what files were changed, what package boundaries were respected, what tests were added, and any unresolved blockers

### Base44 Super Agent
- Orchestration, infrastructure, and governance enforcement layer
- Creates and configures GitHub repo structure
- Manages branch protections, labels, templates, CODEOWNERS
- Configures Cloudflare Workers, D1, KV environments
- Wires CI/CD from GitHub to Cloudflare
- Reviews Replit outputs against governance rules
- Maintains milestone progress tracker
- Leads staging hardening (Milestone 10) and production deployment (Milestone 12)
- Manages pilot rollout checklist (Milestone 11)
- **Uses GitHub PAT and Cloudflare API token — never exposes them in docs**
- **Everything it does must be resumable by a future agent**

## Handoff Rules

1. Base44 completes repo setup and governance doc skeleton **before** Replit starts coding
2. Replit reads governance docs **before** implementing any package
3. Replit outputs are reviewed by Base44 for governance compliance before milestone is marked DONE
4. Founder approves scope at each milestone boundary
5. No implementation goes to production without Base44 staging verification and Founder signoff

## Continuity Rule

Every agent must leave the project in a state where another agent can resume seamlessly:
- Code must be typed and testable
- Decisions must be recorded in TDRs
- Progress must be updated in the milestone tracker
- Blockers must be filed as GitHub issues

## Milestone Progress Tracker

See `docs/governance/milestone-tracker.md` for current status.
