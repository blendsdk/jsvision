# 03-02 — Demos & Inventory

> **Parent**: [Index](00-index.md) · **Component of**: Phase 2 (seed demo in Phase 1)

The 38 shipped demos, the placeholder factory, the shared demo lib, and the bespoke push-down source.
Every demo is one `*.story.ts` under `stories/<cluster>/` (AR #3) exporting a `Story` whose `build(ctx)`
returns an absolutely-positioned `Group` within `ctx.width × ctx.height`, with a one-line blurb, the
live component, a **bound-state echo** where relevant, and key hints. Ids are
`datagrid/<dir-slug>/<demo-slug>`, where `<dir-slug>` is the cluster **directory** (`foundation`,
`editing`, `editors`, `formatting`, `sorting`, `filtering`) — e.g. `datagrid/editors/text` — so ids stay
stable and consistent across the two build phases (only ST-3 uniqueness is enforced).

## Shared demo lib — `stories/lib/`

- **`data.ts`** — a handful of typed row sets (`Sale`, `Person`, `Task`) as `Signal<T[]>`, reused
  across demos; each with a stable `rowKey`.
- **`spy-source.ts`** — a bespoke in-memory `GridDataSource<T>` that implements the optional
  `setSort`/`setFilter`/`distinct` seams `fromRows` omits (`data-source.ts:31,33` vs `:60-63`). It
  sorts/filters its backing array in memory but records the last `SortKey[]`/`FilterModel` it received
  and exposes it as a signal, so the push-down demos can **echo** "pushed down: <model>" — proving the
  delegation path without a network (AR #5, PF-020).

## Cluster 1 — Foundation (RD-01) · 5 demos · **`foundation/`**  *(seed demo: `sizing`, built in Phase 1)*

| slug | Demonstrates | Echo |
|------|--------------|------|
| `sizing` | `column()` sizing: `auto`, fixed, `{kind:'fr'}` weights + `align` left/right/center | column widths |
| `value-format-parse` | the split: `value` (sort/filter key) vs `format(value)` (display) vs `parse` (edit round-trip) | value ⟷ display |
| `data-source` | `fromRows` + required `rowKey`; mutate the `Signal<T[]>` → grid reacts | row count |
| `read-only` | `EditableDataGrid` with all read-only columns (no editors) | — |
| `theming` | theme roles + `zebra: true` + cursor | active theme |

## Cluster 2 — Editing (RD-02) · 5 demos · **`editing/`**

| slug | Demonstrates | Echo |
|------|--------------|------|
| `per-cell-edit` | F2 / Enter / type-to-replace begin-edit on editable columns | editing cell |
| `commit-veto` | `onCommit` returning `false` → editor stays open, value reverts | last commit + veto count |
| `dirty-tracking` | `createDirtyRegistry`/`cellKey`; `•` markers on pending cells | dirty cell keys |
| `cursor-nav` | two-axis cursor: arrows / Home / End; shown **through** the live grid (PF-023) | focused row,col |
| `overlay` | the in-cell overlay lifecycle shown **through** an editable grid (PF-023) | overlay open? |

## Cluster 3 — Cell editors (RD-03) · 9 demos · **`editors/`**

One demo per `CellEditorKind` (`cell-editor.ts:35`): `text` · `integer` · `decimal` · `boolean` ·
`date` · `enum` · `lookup` (+ F4 value help) · `readonly` · `custom` (`createCellEditor` seam). Each
mounts an `EditableDataGrid` whose target column declares that `editor` kind; the echo shows the
committed value (for `lookup`, the stored **key** vs the shown **label**, RD AR #32).

## Cluster 4 — Formatting & rendering (RD-04) · 8 demos · **`formatting/`**

| slug | Demonstrates | Echo |
|------|--------------|------|
| `number` | `fmt.number` | raw ⟷ formatted |
| `currency` | `fmt.currency` | — |
| `percent` | `fmt.percent` | — |
| `date` | `fmt.date` + `fmt.datetime` | — |
| `boolean` | `fmt.boolean` | — |
| `labels` | `fmt.enumLabel` + `fmt.lookupLabel` | key ⟷ label |
| `parse-roundtrip` | matched inverse `parse`; an unparseable edit → `PARSE_FAILED` reject | last parse result |
| `render-style` | custom `render` (cell-clipped, draw-error isolated) + conditional `cellStyle` | — |

## Cluster 5 — Sorting (RD-05) · 5 demos · **`sorting/`**

| slug | Demonstrates | Echo |
|------|--------------|------|
| `single` | click header → asc/desc tri-state | active sort |
| `multi` | `Ctrl`+click multi-key + priority digits | sort keys (ordered) |
| `value-aware` | sorts the typed `value`, not the formatted string | — |
| `collator` | case-insensitive collation | — |
| `push-down` | over `spy-source` → `setSort` echoed; row-key re-anchor | pushed-down keys |

## Cluster 6 — Filtering (RD-06) · 6 demos · **`filtering/`**

| slug | Demonstrates | Echo |
|------|--------------|------|
| `quick-filter` | the opt-in quick-filter row, live contains | "N of M" |
| `condition-text` | funnel → condition popup, text operators | active filter |
| `condition-num-date` | number/date operators + `between` | active filter |
| `value-list` | distinct checkbox picker + search + Select All + truncation disclosure | selected set |
| `n-of-m` | `filteredCount()`/`totalCount()` readout | "N of M" |
| `push-down` | over `spy-source` → `setFilter` echoed; clear | pushed-down model |

## Placeholders — `stories/placeholders.ts` (RD-07…14) · 8 panels · **`category: 'Roadmap'`**

A single `placeholderStory(rd, title, blurb): Story` factory builds each panel: a `Group` with the RD
title, a one-paragraph "what this will demonstrate" blurb, and a "coming soon" chip. Registered for
RD-07 (columns & layout), RD-08 (rows & selection), RD-09 (footer/aggregation/master-detail), RD-10
(navigation & interaction), RD-11 (data at scale), RD-12 (validation & lifecycle), RD-13
(export/import/personalization), RD-14 (non-functional). Each becomes the drop-in slot when its RD
lands (AR #34/#36 / RD §Placeholder panel).

## Governance — gate reconciliation (Phase 2)

Edit `codeops/kitchen-sink-gate.md`: datagrid component stories are demonstrated in this dedicated app,
not the general kitchen-sink; record that `kitchen-sink/stories/data-grid.story.ts` (ui's **read-only**
`DataGrid`, a different component) is intentionally retained (AR #9, PF-022).

## Draw-safety

Every demo renders through the datagrid/ui path, which passes the core `sanitize` boundary; a custom
`render` in `formatting/render-style` runs under the existing draw-error isolation (RD §Security).
Demo data is static and in-process; no network, no secrets (RD §Security, AR #5).
