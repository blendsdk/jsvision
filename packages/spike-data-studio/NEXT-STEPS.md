# Data Studio spike — resume notes (handoff across machines)

Short, durable pickup notes so a fresh session on any computer can continue without the prior
conversation. The spike verdict + full findings are in
`codeops/features/data-studio/plans/feasibility-spike/decision-memo.md`.

## State (as of 2026-07-11)

- **Spike: DONE** — 8 probes green, verdict **GO-WITH-CAVEATS**. Committed on `master` (`fe36da4`).
- **This session added the `EditorSpec` design** — `src/editor-spec.ts` (+ tsc fixes to
  `src/04-editable-grid.ts` and `src/record-set.ts`). Typechecks clean (`npx tsc --noEmit`).

## Pending task (do next)

**Wire `createCellEditor` into the Probe 4 `EditableGrid`** so the in-cell editor is chosen
automatically from `resolveEditors()` (the introspected schema), instead of the hardcoded name/balance
editors. Concretely:

1. In `src/04-editable-grid.ts`, build `resolveEditors(source.meta, overrides)` once, keyed by column.
2. In `grid.onEdit = (col) => …`, look up the column's `EditorSpec`, `createCellEditor(spec,
   rs.field(FIELD[col]), host)`, and mount the returned `View` at the cell rect (skip when it returns
   `null` — read-only / datetime).
3. Provide a `CellEditorHost.loadLookup(cfg)` that runs a parameterized `SELECT key, label FROM
   <refTable> ORDER BY … LIMIT …` (for FK dropdowns). Use `app.order` (has an FK `customer_id`) as the
   demo table to exercise the lookup editor, or add an override on a customer column.
4. Keep Enter=commit / Esc=cancel; the adapters in `editor-spec.ts` (bool/date/enum/lookup) already
   handle the typed binding — just ensure they're created inside the overlay's reactive root.

## Bring the environment back up

Postgres is **not** carried by git — recreate it in one command, then point the spike at it:

```bash
docker run --rm -d --name data-studio-spike -e POSTGRES_PASSWORD=spike -p 5433:5432 postgres:16
export PGPASSWORD=spike
psql -h localhost -p 5433 -U postgres -d postgres \
  -f codeops/features/data-studio/plans/feasibility-spike/seed-schema.sql
export DATABASE_URL='postgres://postgres:spike@localhost:5433/postgres'
yarn install && yarn build           # from repo root (cross-package imports use built dist)
yarn workspace @jsvision/spike-data-studio probe:4   # sanity-check the editable grid still runs
```

See `README.md` for the full probe list.
