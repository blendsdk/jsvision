# @jsvision/spike-data-studio — THROWAWAY

Feasibility-spike evidence for **Data Studio** (a Paradox / MS-Access-style database front-end on
`@jsvision/ui` + PostgreSQL). This package is **not a product** — it is the runnable evidence behind
`codeops/_archive/data-studio/plans/feasibility-spike/decision-memo.md`. Delete it once the decision
is made.

## Run

```bash
# 1. Throwaway Postgres (port 5433 to avoid clobbering a local 5432)
docker run --rm -d --name data-studio-spike -e POSTGRES_PASSWORD=spike -p 5433:5432 postgres:16
export PGPASSWORD=spike
psql -h localhost -p 5433 -U postgres -d postgres \
  -f ../../codeops/_archive/data-studio/plans/feasibility-spike/seed-schema.sql

# 2. Point the spike at it
export DATABASE_URL='postgres://postgres:spike@localhost:5433/postgres'

# 3. Build the framework once (cross-package imports resolve to built dist)
yarn build   # from repo root

# 4. Probes
yarn workspace @jsvision/spike-data-studio smoke      # Probe 0 connectivity + import
yarn workspace @jsvision/spike-data-studio probe:1    # introspection + type mapping
yarn workspace @jsvision/spike-data-studio probe:2    # CRUD / txn / concurrency
yarn workspace @jsvision/spike-data-studio probe:3    # RecordSet spine + reactivity
yarn workspace @jsvision/spike-data-studio probe:3paging  # windowed-Proxy paging vs the grid
yarn workspace @jsvision/spike-data-studio probe:4    # editable grid + editor overlay
yarn workspace @jsvision/spike-data-studio probe:5    # bound form (shared spine)
yarn workspace @jsvision/spike-data-studio probe:6    # scripting / BeforeSave veto
yarn workspace @jsvision/spike-data-studio probe:7    # 100k-row scale smoke
```

All probes run **headless** (compose to an off-screen `ScreenBuffer` and dump ASCII, or read signal
state directly) — no TTY needed, so the evidence is reproducible in CI/logs.

Connection config comes from `DATABASE_URL` only; credentials are never hardcoded and never logged.
