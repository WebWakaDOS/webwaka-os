# WebWaka OS

> **Build Once. Use Infinitely. Nigeria First. Africa First.**

WebWaka OS is a multi-tenant, multi-vertical, white-label SaaS platform operating system built for Africa — starting with Nigeria.

## Core Principles

| Principle | Meaning |
|---|---|
| Build Once Use Infinitely | Every capability is built as a reusable primitive, never duplicated |
| Nigeria First | Design for Nigerian infrastructure, regulation, connectivity, and market realities |
| Africa First | Extend outward from Nigeria across Africa |
| Mobile First | Every interface and workflow is mobile-primary |
| PWA First | All client apps are installable progressive web apps |
| Offline First | Core journeys work without a network connection |
| Vendor Neutral AI | No lock-in to a single AI provider |
| BYOK Capable | Users can bring their own API keys for AI services |

## Platform Architecture

- **Runtime:** Cloudflare Workers (Edge-first)
- **Database:** Cloudflare D1 (SQLite at edge)
- **Cache/Config:** Cloudflare KV
- **Storage:** Cloudflare R2
- **Language:** TypeScript
- **API Framework:** Hono
- **Frontend:** React + PWA
- **Offline Sync:** Dexie + Service Worker
- **Package Manager:** pnpm workspaces
- **Monorepo:** Single repo, strict package boundaries

## Repository Structure

```
webwaka-os/
  apps/           — deployable applications
  packages/       — shared platform libraries
  docs/           — governance, architecture, product, runbooks
  infra/          — Cloudflare and GitHub Actions infrastructure config
  tests/          — e2e, integration, smoke tests
  .github/        — workflows, issue templates, PR templates
```

## Getting Started

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for platform design overview.
See [docs/governance/](./docs/governance/) for non-negotiable platform rules.

## Agents

See [AGENTS.md](./AGENTS.md) for how Replit Agent 4, Base44 Super Agent, and Perplexity coordinate.

## Milestones

See [ROADMAP.md](./ROADMAP.md) for the milestone-by-milestone rollout plan.

---

*WebWaka OS is governance-driven. No implementation happens outside the rules defined in `docs/governance/`.*
