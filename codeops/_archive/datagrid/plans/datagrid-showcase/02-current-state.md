# Current State — DataGrid Showcase App

> **Parent**: [Index](00-index.md)

Grounded analysis of what already exists (the reusable substrate) and the delta this plan adds. All
claims cite primary source.

## The reusable substrate

### The showcase machinery (`packages/examples/kitchen-sink/`)

- **`shell.ts`** (320 LOC) — `createShowcase(caps)` builds a `createApplication({ caps, menuBar,
  statusLine })` desktop, a persistent sidebar `ListBox` navigator (category headers + story rows),
  a per-category menu, a clickable status line, `NavKeys` (`Ctrl`+←/→ cycling), a welcome catalog,
  and `showStory`/`disposePrevious` swap logic. `run: () => app.run()` (`shell.ts:184,319`). Its
  import surface is just `@jsvision/ui`, `./window.js` (`StoryWindow`, `CommandSink`), `./story.js`
  (`Story`, `at`, `firstFocusable`), `./stories/index.js` (`STORIES`) (`shell.ts:12-35`).
- **`main.ts`** — TTY guard (`process.stdout.isTTY !== true` → notice + exit 0), caps resolve, then
  `createShowcase(caps).run()`.
- **`story.ts`** — the `Story` contract + `at()` / `firstFocusable()` helpers. Already trimmed-copied
  into `packages/datagrid/test/kitchen-sink/story.ts` ("a trimmed copy of the examples showcase
  model"), so the copy-and-focus precedent (AR #7 / RD AR #35) is established.
- **`window.ts`** — the grey `StoryWindow` canvas.

A **dedicated copy** of these four files, focused for the datagrid, is the Phase-1 scaffold.

### The demo-able surface (`packages/datagrid/src/index.ts`)

The public barrel exports every capability the inventory names. Verified seams:

- `column`, `fromRows`, `EditableDataGrid` + `EditableDataGridOptions` — the options carry `zebra?`
  and `quickFilter?` (`grid.ts:47,52`).
- Reactive counts + filter API: `filteredCount()`, `totalCount()`, `setFilter`, `clearFilter`,
  `filterModel()` (`grid.ts:454-503`).
- `fmt` / `PARSE_FAILED` — `fmt.number/currency/percent/date/datetime/boolean/enumLabel/lookupLabel`.
- Cell editors: `createCellEditor`, `CellEditorKind` = `text|integer|decimal|boolean|date|enum|lookup|readonly|custom`
  — exactly the nine the inventory demos (`cell-editor.ts:35`).
- Sort/filter models, `SortHeader`, `QuickFilterRow`, `FilterPopup`, `ValueList`,
  `createDirtyRegistry`, `cellKey`, `mountCellOverlay`, `absoluteRect`, `render`/`cellStyle` hooks.
- **Push-down gap (drives AR #5 / PF-020):** `GridDataSource` declares `setSort?`/`setFilter?` as
  optional (`data-source.ts:31,33`); `fromRows` **omits** them (`data-source.ts:60-63`), so the grid
  takes the client path (`grid.ts:233,248`). The two push-down demos therefore need a bespoke
  in-memory source implementing those seams.

### Examples test + typecheck infra

- `test` = `vitest run --project unit`; `typecheck` = `tsc --noEmit`. Smoke + walkthrough are
  `*.spec.test.ts` under the unit project (AR #6).
- `packages/examples/tsconfig.json` `include` is an **allowlist** — `['capability-probe','resize-demo',
  'keyboard-mouse-playground','chrome-bars-demo','recipes']` — so `kitchen-sink/` is **not**
  typechecked today (the known "standalone demos aren't in the typecheck include" gotcha). Adding
  `datagrid-showcase` to `include` (AR #2) makes `tsc --noEmit` cover every demo.
- `packages/examples/package.json` dependencies: `@jsvision/core`, `@jsvision/files`, `@jsvision/ui`,
  `@jsvision/web` — **not** `@jsvision/datagrid` (this plan adds it). `demo:datagrid` is free (no
  script collision).

### The smoke-test precedent

`packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` is the pattern to mirror: registry
non-empty, unique ids, required metadata, and each story mounts headlessly over a fixed-caps
`RenderRoot` and paints ≥1 non-blank cell.

## The delta this plan adds

| Area | Delta |
|------|-------|
| New app | `packages/examples/datagrid-showcase/` — `main.ts`, `shell.ts`, `story.ts`, `window.ts` (dedicated copies), `stories/index.ts`, `stories/<cluster>/*.story.ts` (38), `stories/placeholders.ts` (8), `stories/lib/` (demo data + `spy-source.ts`) |
| Wiring | `demo:datagrid` script; `@jsvision/datagrid` dependency; `datagrid-showcase` added to `tsconfig.json` `include` |
| Tests | `test/datagrid-showcase.smoke.spec.test.ts`, `test/datagrid-showcase.walkthrough.spec.test.ts` |
| Governance | `codeops/kitchen-sink-gate.md` reconciled (route datagrid stories here; retain the ui `DataGrid` story) |

No datagrid or ui source changes; no dependency cycle (examples → datagrid → ui/core).
