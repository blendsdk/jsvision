# RD-15: DataGrid Showcase App

> **Document**: RD-15-showcase-app.md
> **Status**: Draft
> **Created**: 2026-07-15
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-06 (the shipped surface each demo exercises)
> **CodeOps Skills Version**: 3.7.0

---

## Feature Overview

A standalone, datagrid-centric **showcase application** — a "Storybook-for-TUI" dedicated to
`@jsvision/datagrid` — where **each and every shipped capability is its own runnable demo** you can
navigate and test one at a time. It lives in `packages/examples/datagrid-showcase/` and runs via a new
`demo:datagrid` script; `@jsvision/examples` gains a dependency on `@jsvision/datagrid`.

It is seeded from the proven `packages/examples/kitchen-sink/shell.ts` navigator pattern (a persistent
sidebar `ListBox` + per-category menu + clickable status hints + welcome catalog, all driven by the
same `Story` contract), focused into a dedicated shell so it can grow datagrid-specific chrome. The
first cut demonstrates the shipped **RD-01…RD-06** surface as ~38 granular demos, plus a **per-RD
"coming soon" panel** for each unbuilt RD-07…RD-14 — a drop-in slot that fills in as that RD lands.

The showcase is the datagrid's **living acceptance surface**: a capability is not "shown" until its
demo exists here, renders in the smoke test, and survives the headless walkthrough. It is dev-only
example code (not part of any published package), imported by name exactly as a consumer would.

---

## Functional Requirements

### Must Have

- [ ] **Standalone runnable app** — `packages/examples/datagrid-showcase/main.ts` launched by a new
      `demo:datagrid` script (`tsx datagrid-showcase/main.ts`), TTY-gated with a helpful non-TTY notice
      (mirrors `kitchen-sink/main.ts`). `@jsvision/examples` depends on `@jsvision/datagrid`. *(AR #33)*
- [ ] **Dedicated shell** — seeded from the `kitchen-sink/shell.ts` pattern: a persistent left sidebar
      navigator (category → demo tree), a per-category menu bar, a clickable status line with per-demo
      key hints, `Ctrl`+←/→ demo cycling, and a welcome/overview landing screen. Owns all chrome; a demo
      never touches the desktop or host. *(AR #35, #41)*
- [ ] **Granular demo inventory — the shipped surface** — one demo per capability across RD-01…RD-06
      (the ~38-entry inventory in §Demo Inventory), each a `Story` (`{ id, category, title, blurb, rd?,
      build(ctx) }`) returning a `Group` of absolutely-positioned children within `ctx.width × ctx.height`.
      *(AR #34, #37)*
- [ ] **Per-demo "shine" contract** — every demo shows a one-line blurb, the live datagrid component, a
      visible **bound-state echo** where relevant (e.g. focused/selected cell, active sort, filtered
      "N of M"), and interaction hints; keyboard **and** mouse both work; faithful TV theming; no clipped
      text. *(AR #41)*
- [ ] **Placeholder slots for the roadmap** — one navigator entry per unbuilt RD-07…RD-14 that opens a
      **description panel**: the RD title, a short blurb of what it will demonstrate, and a "coming soon"
      status chip. Each slot is the drop-in target when its RD ships. *(AR #34, #36)*
- [ ] **Per-demo smoke test** — every registered demo mounts headlessly, paints ≥1 non-blank cell, and
      carries unique id + required metadata (mirrors the existing `kitchen-sink.smoke.spec.test.ts`).
      *(AR #40)*
- [ ] **Headless walkthrough test** — a bespoke headless driver (like theme-designer's `runWalkthrough`,
      `theme-designer/src/main.ts:16,19`, separate from the interactive `app.run()`) that drives the
      **shell** through every demo — sidebar-select → canvas swap → dispose-previous — without a TTY and
      without throwing. Its distinct job from the smoke test: it exercises the shell's navigation +
      story-swap lifecycle, not merely that each story mounts in isolation. *(AR #40, PF-021)*
- [ ] **Registry hygiene** — an explicit aggregation registry (`stories/index.ts`): adding a demo is one
      import + one array entry. Ids unique; categories preserve first-seen order for the sidebar.

### Should Have

- [ ] **Datagrid-specific chrome** — a data-source-size toggle (small ⇄ large row set) and/or a theme
      switcher in the shell, to exercise the same demo under different conditions. *Phase B.*
- [ ] **Web dogfood** — surface the showcase in the `web-xterm` browser harness (free once `examples`
      depends on `@jsvision/datagrid`). *Phase B.*

### Won't Have (Out of Scope)

- Demos of capabilities that are not yet implemented — RD-07…RD-14 appear **only** as "coming soon"
  description panels, never as live-but-fake components. *(AR #34)*
- Retiring or rewriting the datagrid package's own `test/kitchen-sink` smoke stories — they stay as the
  *isolated* render guard (the datagrid package must not depend on `@jsvision/examples`). *(AR #39)*
- Extracting a shared showcase-shell module or refactoring the general `kitchen-sink` — the dedicated
  shell is a focused copy; any shared-shell consolidation is a separate, later decision. *(AR #35)*
- A persistent home for the app outside `packages/examples/` (it is dev-only example code, never a
  published package). *(AR #33)*

---

## Technical Requirements

### Folder & run wiring

```
packages/examples/
  datagrid-showcase/
    main.ts            # TTY guard + caps + createDatagridShowcase(caps).run()
    shell.ts           # dedicated shell (sidebar nav + menu + status + welcome), seeded from kitchen-sink
    story.ts           # the Story contract + at()/firstFocusable() helpers (trimmed copy precedent)
    window.ts          # the grey story canvas (as kitchen-sink/window.ts)
    stories/
      index.ts         # explicit STORIES registry (one import + one entry per demo)
      <cluster>/*.story.ts   # the granular demos, grouped per RD cluster
      placeholders.ts  # the RD-07…RD-14 "coming soon" description panels
```

- `packages/examples/package.json`: add `"demo:datagrid": "tsx datagrid-showcase/main.ts"` and
  `"@jsvision/datagrid": "0.2.0"` to dependencies (private, workspace-resolved). *(AR #33)*
- Root convenience script (optional, matching `yarn designer`): a `datagrid-showcase` alias may be
  added to the root `package.json` — decided at plan time, not required by this RD.

### Story contract

Reuse the established `Story` shape (`{ id, category, title, blurb, rd?, build(ctx): Group }`) and the
`at()` / `firstFocusable()` helpers from `kitchen-sink/story.ts` (the datagrid `test/kitchen-sink/story.ts`
is already a trimmed copy of it). `build(ctx)` returns an absolutely-positioned `Group` within
`ctx.width × ctx.height`; the shell owns navigation and chrome.

### Demo Inventory

The approved first-cut inventory (≈38 shipped demos + welcome + 8 placeholders). *(AR #37)*

| Category (RD) | Demos |
|---|---|
| **Foundation** (RD-01) | column model & sizing (auto/fixed/`fr` + align) · value/format/parse split · data source (`fromRows` + `rowKey`, reactive `Signal<T[]>`) · read-only render · theming & zebra |
| **Editing** (RD-02) | per-cell edit (F2 / Enter / type-to-replace) · `onCommit` veto + revert · dirty `•` tracking (`createDirtyRegistry`/`cellKey`) · two-axis cursor navigation · overlay lifecycle (`mountCellOverlay`/`absoluteRect`) |
| **Cell editors** (RD-03) | one demo each: text · integer · decimal · boolean · date · enum · lookup (+F4 value help) · readonly · custom (`createCellEditor` seam) |
| **Formatting** (RD-04) | `fmt.number` · `fmt.currency` · `fmt.percent` · `fmt.date`/`datetime` · `fmt.boolean` · `fmt.enumLabel`/`lookupLabel` · inverse-parse round-trip (+ `PARSE_FAILED` reject) · custom `render` + conditional `cellStyle` |
| **Sorting** (RD-05) | single-column tri-state · multi-key + priority digits (`Ctrl`+click) · value-aware sort · case-insensitive collator · push-down (`setSort`) + row-key re-anchor |
| **Filtering** (RD-06) | quick-filter row (live contains) · condition popup (text ops) · condition popup (number/date ops + `between`) · value-list (distinct + search + Select All + truncation) · N-of-M readout (`filteredCount`/`totalCount`) · push-down (`setFilter`) + clear |
| **Roadmap** (RD-07…RD-14) | one "coming soon" description panel each: columns & layout · rows & selection · footer/aggregation/master-detail · navigation & interaction · data at scale · validation & lifecycle · export/import/personalization · non-functional |

Each shipped demo is a focused, self-contained scenario over a small typed row set; where a capability
has a natural "before/after" (e.g. commit veto, inverse parse, push-down), the demo makes both states
visible via the bound-state echo.

The two **push-down** demos (Sorting §5.5, Filtering §6.6) use a small **bespoke in-memory
`GridDataSource`** that implements the optional `setSort`/`setFilter` seams (`data-source.ts:31,33`) —
a spy that sorts/filters in memory but proves the delegation path. `fromRows` omits those seams
(`data-source.ts:60-63`), so the grid takes the client path and `fromRows` alone cannot demonstrate
push-down. *(PF-020)*

### Placeholder panel

A single reusable `placeholderStory(rd, title, blurb)` factory builds each RD-07…RD-14 slot: a `Group`
with the RD title, the planned-capability blurb, and a "coming soon" chip. Registered in the same
registry under a `Roadmap` category so the sidebar shows the whole datagrid roadmap. *(AR #36)*

### Testing

- **Smoke** (`*.smoke.spec.test.ts`) — the registry is non-empty, ids are unique, metadata is present,
  and every demo mounts headlessly and paints ≥1 non-blank cell (the `kitchen-sink.smoke.spec.test.ts`
  pattern over the datagrid-showcase registry). *(AR #40)*
- **Walkthrough** — a bespoke headless driver (separate from `app.run()`, per theme-designer's
  `runWalkthrough`) that navigates the shell through every demo (no TTY), asserting no throw and that
  each canvas swap paints. Distinct from the smoke test: it guards the shell's navigation + swap +
  dispose-previous lifecycle, not per-story rendering. *(AR #40, PF-021)*
- Both live under `packages/examples/` test config; neither requires a TTY.

---

## Integration Points

### With `@jsvision/datagrid` (RD-01…RD-06)
- The showcase imports the public barrel (`column`, `fromRows`, `EditableDataGrid`, `fmt`, the sort/filter
  models, and the exported header/popup views) exactly as a consumer would; the barrel enumerates the
  demo-able surface. No datagrid internals are reached into.

### With `@jsvision/examples` (kitchen-sink)
- The dedicated shell is seeded from `kitchen-sink/shell.ts` but is a focused copy — the general
  kitchen-sink is left untouched (no shared-shell refactor in this RD). *(AR #35)*

### With the datagrid package's `test/kitchen-sink`
- Independent tier: the datagrid package keeps its 6 in-package smoke stories as the isolated render
  guard; the rich granular demos are authored fresh here. No cross-dependency (examples → datagrid only,
  never the reverse). *(AR #39)*

### With future RD-07…RD-14
- Each ships its own demo cluster into this showcase as it lands, replacing that RD's placeholder panel
  — the kitchen-sink-gate's per-component story obligation is satisfied here for datagrid. Reconciling
  the NON-NEGOTIABLE gate doc (`codeops/kitchen-sink-gate.md`) to route datagrid stories to this app is
  an **explicit plan task** (not incidental). The general kitchen-sink's existing `data-grid.story.ts`
  — which demos ui's **read-only** `DataGrid`, a different component — is intentionally retained. *(PF-022)*

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Location | new package / examples subfolder / promote test in place | Examples subfolder + `demo:datagrid` | Standalone yet consistent with the demo idiom; free web dogfood; honors kitchen-sink-gate | AR #33 |
| Coverage | shipped-only+grow / also placeholders | Shipped RD-01…06 demos + RD-07…14 placeholders | Whole roadmap visible; never demos vapor | AR #34 |
| Shell | dedicated copy / extract shared / import kitchen-sink | Dedicated shell, seeded from kitchen-sink | Isolated (no risk to kitchen-sink); room for datagrid chrome | AR #35 |
| Placeholder | per-RD panel / roadmap screen / greyed | Per-RD description panel | Browsable one-by-one; drop-in slot per RD | AR #36 |
| Inventory | full ~38 / leaner first cut / revise | Full ~38 as proposed | "Each and every" shipped capability | AR #37 |
| Naming | `datagrid-showcase` / `-kitchen-sink` / `-demo` | `datagrid-showcase` + `demo:datagrid` | Distinct from the general kitchen-sink | AR #38 |
| In-package stories | retire / keep | Keep as isolated render guard | datagrid must not depend on examples | AR #39 |
| Test tiers | smoke only / smoke + walkthrough | Smoke (Must) + walkthrough (Must, CI) | Guards render *and* run | AR #40 |

---

## Security Considerations

- **Dev-only, trusted code**: the showcase is example code, not a published surface; its demo data is
  static and author-controlled. No untrusted input path is introduced.
- **Sanitize boundary unchanged**: all rendered text still passes the core `sanitize` boundary via the
  datagrid/ui render path — the showcase adds no new terminal-write path that bypasses it. *(AR #25)*
- **No secrets / no network**: demos use in-memory sources only (both `fromRows` and the bespoke
  push-down source are in-process); no credentials, no external calls, no filesystem writes.
- **Injection**: demos never build queries; the push-down demos pass a structured `SortKey[]`/`FilterModel`
  to an in-memory source, illustrating (not exercising) the parameterized-source contract. *(AR grid rule)*
- **Encryption / rate limiting / infrastructure**: N/A (dev-only local TUI).

---

## Acceptance Criteria

1. [ ] `yarn workspace @jsvision/examples demo:datagrid` launches the showcase on a TTY; run without a
       TTY it prints the helpful notice and exits 0. `@jsvision/examples` depends on `@jsvision/datagrid`.
2. [ ] The sidebar navigator lists every category (Foundation, Editing, Cell editors, Formatting,
       Sorting, Filtering, Roadmap); selecting an entry swaps the canvas to that demo; `Ctrl`+←/→ cycles
       demos; the welcome screen is reachable.
3. [ ] Each of the ~38 shipped demos renders its live datagrid component, shows its blurb, and — where
       applicable — a bound-state echo that updates on interaction (e.g. the filtering demo's "N of M",
       the sorting demo's active-sort readout, the editing demo's dirty markers).
4. [ ] Each RD-07…RD-14 placeholder opens a description panel with the RD title, a planned-capability
       blurb, and a "coming soon" chip — and no live-but-fake component.
5. [ ] The smoke test passes: the registry is non-empty, all ids are unique, all metadata is present,
       and every registered demo mounts headlessly and paints ≥1 non-blank cell.
6. [ ] The headless walkthrough drives the shell through every demo without a TTY and without throwing,
       painting on each swap.
7. [ ] Adding a demo is one import + one registry entry (verified by the registry's shape); the datagrid
       package's own `test/kitchen-sink` smoke stories are unchanged and still pass.
8. [ ] `codeops/kitchen-sink-gate.md` is reconciled (as an explicit plan task) to route datagrid
       component stories to this app; the general `kitchen-sink` app is unmodified and its read-only ui
       `DataGrid` story (`data-grid.story.ts`) is intentionally retained.
9. [ ] Full `yarn verify` is green (lint + typecheck + build + test + check:docs), including the new
       showcase's typecheck and both test tiers.
