# Contributing to WebWaka OS

## Prerequisites

- Node.js 20+
- pnpm 9+
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account access (for Workers/D1)
- GitHub access to WebWakaDOS org

## Setup

```bash
git clone https://github.com/WebWakaDOS/webwaka-os.git
cd webwaka-os
pnpm install
```

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Protected. PRs only. |
| `staging` | Pre-production. Protected. PRs only. |
| `feat/*` | Feature branches. Merge into staging via PR. |
| `fix/*` | Bug fixes. |
| `docs/*` | Documentation changes. |

## Workflow

1. Create a branch from `staging`: `git checkout -b feat/my-feature`
2. Make changes in small, coherent commits
3. Open a PR to `staging` — fill in the PR template fully
4. CI must pass before merge
5. Staging signoff required before promoting to `main`

## Commit Convention

```
type(scope): short description

Types: feat, fix, chore, docs, refactor, test, ci
Examples:
  feat(auth): add tenant-scoped JWT validation
  fix(commerce): correct kobo rounding on checkout
  docs(governance): update security baseline
```

## Package Boundaries

- Never import from a sibling app directly — use shared packages
- Never import `apps/*` from `packages/*`
- Vertical-specific code lives in `apps/` — shared code in `packages/`

## Testing

```bash
pnpm test              # run all tests
pnpm test:coverage     # coverage report
pnpm typecheck         # TypeScript checks
```

## Governance Rule

**Read `docs/governance/` before implementing anything.** The platform invariants and core principles are non-negotiable. Implementations that violate them will not be merged.

## Questions

Open an issue using the appropriate template, or consult the agent coordination model in [AGENTS.md](./AGENTS.md).
