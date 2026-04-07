# Release Process

> Full policy: `docs/governance/release-governance.md`

## Environments

| Environment | Branch | Deployment | Approval |
|---|---|---|---|
| Staging | `staging` | Automatic on merge | Auto |
| Production | `main` | Automatic on merge to `main` | Founder signoff required |

## Promotion Flow

```
feat/* branch
  → PR to staging
  → CI passes
  → Code review
  → Merge to staging
  → Staging CI deploys to Cloudflare staging
  → QA verification
  → Founder staging signoff
  → PR from staging to main
  → Merge to main
  → CI deploys to Cloudflare production
```

## Rollback

- Revert the merge commit and push to `main` — CI will redeploy the previous version
- For D1 migrations: each migration must be reversible; rollback scripts live in `infra/cloudflare/migrations/`

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Tags are created on every production release: `v1.0.0`, `v1.1.0`, etc.
- Changelog maintained in `CHANGELOG.md` (generated from commit history)

## Release Checklist

Before promoting to production:
- [ ] All CI checks pass on `staging`
- [ ] Governance alignment verified
- [ ] Tenant isolation verified
- [ ] Entitlement enforcement verified
- [ ] Geography correctness verified
- [ ] Mobile QA passed
- [ ] Staging deploy successful
- [ ] Founder signoff received
- [ ] Rollback plan documented
