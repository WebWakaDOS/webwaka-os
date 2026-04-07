# Seed Data

This directory contains seed data for D1 databases.

## Nigerian Geography Seed

Per TDR-0011, the following data is seeded as part of Milestone 2 bootstrap:

| Level | Count |
|---|---|
| Country (Nigeria) | 1 |
| Geopolitical Zones | 6 |
| States (incl. FCT) | 37 |
| LGAs | 774 |
| Wards | 8,814 |

### Files to be created (Milestone 2 completion):

- `nigeria_country.sql` — Nigeria root place
- `nigeria_zones.sql` — 6 geopolitical zones
- `nigeria_states.sql` — 37 states + FCT
- `nigeria_lgas.sql` — 774 LGAs (sourced from INEC official data)
- `nigeria_wards.sql` — 8,814 wards (sourced from INEC official data)

### Applying seed data:

```bash
wrangler d1 execute webwaka-os-staging --file=infra/db/seed/nigeria_country.sql --env staging
wrangler d1 execute webwaka-os-staging --file=infra/db/seed/nigeria_zones.sql --env staging
wrangler d1 execute webwaka-os-staging --file=infra/db/seed/nigeria_states.sql --env staging
wrangler d1 execute webwaka-os-staging --file=infra/db/seed/nigeria_lgas.sql --env staging
wrangler d1 execute webwaka-os-staging --file=infra/db/seed/nigeria_wards.sql --env staging
```

### Data sources:
- INEC (Independent National Electoral Commission) official constituency data
- NPC (National Population Commission) ward boundary data
- Nigerian Federal Ministry of Finance LGA records

### Note on ancestry_path:
All seed records include pre-computed `ancestry_path` JSON arrays to enable
efficient rollup queries without recursive CTE overhead in D1 (SQLite).
