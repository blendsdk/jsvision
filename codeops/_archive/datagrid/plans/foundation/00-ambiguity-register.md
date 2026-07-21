## Ambiguity Register: Foundation & Grid-Engine Exposure (datagrid/RD-01 plan)

> **Status**: ✅ GATE PASSED — all 8 items resolved
> **Last Updated**: 2026-07-12 22:41
> **Scope**: This is the **plan-level** register for the `foundation` implementation plan. It records
> only decisions that arose while planning RD-01 (deliverable shape, naming, file structure, tooling,
> phasing) — **not** the requirement-level decisions, which live in
> [`../../requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md) (AR-01…AR-32,
> gate passed + preflighted). Where a plan document reasons from a requirement-level decision it cites the
> requirements register (e.g. "req AR-31") or the owning RD section; plan-local entries below are cited as
> "AR #N (plan)".
> **Session note**: Items 1–3 decided by the user via `AskUserQuestion` on 2026-07-12; item 4 confirmed from
> the project verify command in `CLAUDE.md`; items 5–8 are grounded plan-authoring resolutions (repo
> convention / the requirements glossary / an acceptance criterion) surfaced for the user's veto in the plan
> summary.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope / Technical | RD-01 is "the substrate", but AC-3 (renders/orders cells) + AC-9 (a story) need something renderable. What does RD-01 actually ship? | (A) Also ship a minimal **read-only** public grid container · (B) Substrate-only (contracts + adapter + source + overlay + engine promotion); story renders the promoted `GridRows` directly | (A) Minimal read-only container — RD-02 adds the cursor/editing to it; gives AC-3/AC-9 a representative home and lands RD-02's container-owned shared cursor in an existing shell | ✅ Resolved |
| 2 | Integration / Scope | Where does the mandated "datagrid kitchen-sink story registration point" (AC-9) live? The existing showcase + smoke test are in `@jsvision/examples`. | (A) `@jsvision/examples` gains a `@jsvision/datagrid` dep; story joins the shared `STORIES` registry · (B) In-package harness — a datagrid-local story registry + a local smoke test; examples stays independent | (B) In-package harness — datagrid owns a local story registry + `test/**` smoke test; `@jsvision/examples` stays independent of datagrid for now (shared-showcase integration is a documented later follow-up) | ✅ Resolved |
| 3 | Scope | Two borderline RD-01 scope items — include now or defer? | `defineColumns<T>()` (Should-Have) · `commitCell` tested primitive (proves AC-6 in RD-01) | Include **both** — `defineColumns<T>()` and the `commitCell` primitive land in RD-01 (the helper's shape was corrected to a per-column `column<T,V>()` during preflight — see Preflight amendments) | ✅ Resolved |
| 4 | Non-functional / Technical | The verify command that fills every `Verify` line. | Project's `yarn verify` (per `CLAUDE.md`) · other | `yarn verify` for phase/done gates; per-task scoped `yarn workspace @jsvision/datagrid <script>` + `yarn workspace @jsvision/ui check:docs` for the ui promotion (from `CLAUDE.md`) | ✅ Resolved |
| 5 | Naming / Technical | The `packages/datagrid/src/` module layout (single-barrel, 200–500-line files). | Proposed layout: `index.ts` · `column.ts` · `data-source.ts` · `commit.ts` · `overlay.ts` · `grid.ts` | The proposed layout, mirroring `@jsvision/files`/`@jsvision/ui` single-barrel convention (explicit named re-exports) | ✅ Resolved |
| 6 | Naming | The public read-only container's name (item 1). | `EditableDataGrid<T>` (the README glossary term) · a neutral `DataGridView` renamed later | `EditableDataGrid<T>` from RD-01 (read-only until RD-02) — the name is fixed by the requirements README **Domain Glossary**, so this is the single consistent interpretation | ✅ Resolved |
| 7 | Naming | The cell-overlay helper's public name/shape (RD-01 §Cell-overlay helper). | `mountCellOverlay(host, loop, rect, view) => dispose` · other | `mountCellOverlay(...)` returning a `dispose()` that removes the view + disposes its reactive root | ✅ Resolved |
| 8 | Technical | RD-01 AC-2 lists `sortRows` in the ui promotion set, but preflight PF-002 noted it may be superseded by RD-05's value-aware `sortRowsMulti`. Promote it or drop it? | Keep `sortRows` on the ui barrel · drop it from the promotion list | Keep — it is named in AC-2, `@jsvision/ui`'s own `DataGrid` uses it, and promotion is additive (single-key engine sort stays useful); RD-05's `sortRowsMulti` is a separate datagrid path, not a replacement of the engine helper | ✅ Resolved |

### Resolution Notes

**AR #1 (plan):** The read-only `EditableDataGrid<T>` composes `GridHeader` + one-or-more `GridRows`
panels over a `GridDataSource<T>` using the `GridColumn → Column` adapter. It carries **no** cell cursor,
editor overlay wiring, dirty tracking, sort UI, or filtering — those are RD-02…RD-14. Its value here is
(a) a real home for the AC-3 render/order proof and the AC-9 story, and (b) the container onto which RD-02
hoists the **container-owned shared cursor/selection** (the requirements register's PF-001 resolution / RD-02
§body). The pull-forward is bounded: read-only composition only.

**AR #2 (plan):** The in-package harness is a small `Story`-style contract + registry + a headless smoke
test, all under the package's `test/` tree (test infrastructure, never on the public barrel, so `check:docs`
does not require an `@example`). This satisfies AC-9's "registration point … passes the headless smoke test"
without a new cross-package dependency. When datagrid ships genuinely user-facing visual components (RD-02+),
promoting a story into the shared `@jsvision/examples` kitchen-sink showcase (the project's non-negotiable
showcase gate) is a documented follow-up, out of this plan's scope.

**AR #3 (plan):** the type-inferred column authoring helper — a per-column `column<T,V>()` (the original
per-array `defineColumns<T>()` was corrected during preflight because a per-array helper cannot infer
per-column `V`, so a typed `format`/`parse` is uncheckable) — infers `V` from `value` so `format`/`parse` are typed;
`commitCell(source, change, onCommit)` applies the parsed value to the in-memory record immediately, invokes
`onCommit`, and reverts to `previous` when it returns `false`/rejects — the tested primitive that makes AC-6
real in RD-01 and gives RD-02's editor a clean stay-open-on-veto seam. Both are small and unblock later RDs.

**AR #4 (plan):** From `CLAUDE.md` → Commands: full `yarn verify` = `yarn lint` then
`turbo run typecheck build test check:docs` (fans out across the new package + the ui change). Per-task, the
scoped `yarn workspace @jsvision/datagrid <build|typecheck|test|check:deps|check:docs>` and
`yarn workspace @jsvision/ui check:docs` (for the promotion's `@example`s) are the fast inner loop. A single
interpretation from the project config — recorded for traceability.

**AR #5 (plan):** One concern per file: `column.ts` (the `GridColumn<T,V>` type + the `column` helper +
`toEngineColumn` adapter + `defaultCompare`), `data-source.ts` (`GridDataSource<T>` + `fromRows`),
`commit.ts` (`CellCommit`/`OnCommit` + `commitCell`), `overlay.ts` (`CellRect` + `mountCellOverlay` +
`absoluteRect`), `grid.ts` (`EditableDataGrid<T>` read-only + its options type), `index.ts` (explicit named
re-exports). Files stay 200–500 lines per the repo convention.

**AR #6 (plan):** The README **Domain Glossary** already defines `EditableDataGrid<T>` as "The public grid
component (a `Group`) composing header, editable body, and optional footer bands." Introducing the container
under that name in RD-01 (read-only) and adding editing in RD-02 keeps the glossary term stable across RDs —
renaming later would churn every downstream RD reference. No genuine second option survives that constraint.

**AR #7 (plan):** `mountCellOverlay` mirrors the spike-proven mechanism from public `@jsvision/ui`
primitives: translate a body-local `CellRect` to an absolute position, `host.add(view)` an
absolutely-positioned child, `loop.focusView(view)`, mount inside a fresh `createRoot` so binding effects are
owned, and return a `dispose()` that `host.remove(view)`s and disposes the root. No frame/border chrome (unlike
the dropdown popup); it never touches the ui-internal `openAnchoredPopup` (requirements register PF-004).

**AR #8 (plan):** Keeping `sortRows` promoted costs only its `@example` (the same `check:docs` obligation the
other promoted symbols carry) and preserves `@jsvision/ui`'s ability to expose single-key sort. RD-05's
`sortRowsMulti` reads the typed `value` directly and lives in the datagrid; it does not remove the engine's
single-key helper.

### Preflight amendments (2026-07-12)

The plan-level preflight ([`00-preflight-report.md`](00-preflight-report.md)) surfaced 6 findings
(0 critical · 2 major · 4 minor); all were accepted and applied to these plan docs. The design-affecting ones:

- **PF-002 (major):** the per-array `defineColumns<T>()` helper became a per-column `column<T,V>()` helper — a
  per-array helper collapses each element to `GridColumn<T, unknown>`, which leaves a typed `format`/`parse`
  uncheckable (confirmed with `tsc`: the original signature failed to type its own examples).
- **PF-001 (major):** the read-only container mounts a sort-suppressed `ReadonlyGridHeader` (the reused
  `GridHeader`'s built-in click-to-sort would otherwise paint a `▲`/`▼` arrow the read-only body never
  reorders), and 03-05 now specs the header's required `sort` signal.
- **PF-003 (minor):** `@jsvision/ui`'s `stringWidth` measure is added to the promotion set so the container
  measures with exactly the function the engine draws with (no wide-glyph misalignment).
- **PF-004/005/006 (minor):** corrected the `createEventLoop` example arity; documented the `rowAt` `T | undefined`
  → `display: () => T[]` coercion + the RD-11 reconciliation; scoped `defaultCompare` to number/string/`Date`/null
  (deferring `CalendarDate` to RD-05's `sortRowsMulti`).

See the report for the full findings, options, and resolutions.
