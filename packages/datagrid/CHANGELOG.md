# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`@jsvision/datagrid` is private-until-release; this log tracks the public surface as it lands so the
first published release has an accurate history.

> **Versioning & stability.** Pre-1.0 the public API may still change between releases and
> `[Unreleased]` is the authoritative surface; from 1.0.0 the package follows
> [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

Added:
- Makes @jsvision/datagrid publishable by dropping private and adding its LICENSE file.
- Introduced grid.saveVariant(name) and applyVariant(variant) methods for runtime variant management in the personalization dialog.
- Added grid.exportView(format) for exporting the current view in CSV/HTML/JSON/TSV formats.
- Implemented a filter customization seam allowing caller-supplied views for filter popups.
- Introduced a new quick-filter row for per-column filtering with live updates.

Changed:
- Refactored layout handling to ensure all writes route through setLayout for consistency.
- Updated the README to align with documentation styles used for other published packages.
- Improved various test structure without altering assert values, focusing on clean code practices.

Fixed:
- Resolved layout issues that surfaced during quality review, ensuring properties retain their intended values.
- Fixed the functionality of the custom-editor mount contract, ensuring it accurately reflects expected behavior.
- Addressed quick-filter band layout issues, ensuring elements align correctly and inter-column dividers are visible. 

Deprecated:
- Previous manual layout resets have been deprecated in favor of using setLayout throughout.

Removed:
- Removed old documentation references that no longer align with the application's architecture and functionality.

## [Unreleased]

### Added
- **Foundation & editing** — `EditableDataGrid` on `@jsvision/ui`: a typed column model +
  `GridDataSource`, per-cell immediate editing with a commit model and dirty tracking, and typed cell
  editors (`text`/`integer`/`decimal`/`boolean`/`date`/`enum`/`lookup`/`readonly`/`custom`) with F4
  value help.
- **Formatting & rendering** — an `Intl`-backed `fmt` registry with matched inverse parsers, a custom
  cell `render` hook (cell-clipped, draw-error isolated to a single cell), and conditional `cellStyle`.
- **Sorting & filtering** — single/multi/value-aware sort with optional push-down (`SortHeader`); a
  quick-filter row, condition + value-list filters, an always-visible column funnel with an `Alt+Down`
  opener, a `filterable` opt-out, and reactive "N of M" counts.
- **Columns & layout** — resize / reorder / hide, frozen pinned-column panels, a sticky header,
  frozen rows, compact density, and a public layout API
  (`columnOrder`/`setColumnOrder`/`setColumnVisible`/`setColumnWidth`/`autoFitColumn`/`frozen`).
- **Rows & selection** — keyed multi-selection surviving re-sort/re-filter, an opt-in checkbox column
  and row-number gutter, insert/delete/duplicate over a `GridDataSource` mutation seam, and per-column
  null policy.
- **Footer, aggregation & master-detail** — a sticky column-aligned reactive footer band with
  aggregates and honesty `(loaded)` labelling, a free-form footer widget row, reactive readouts
  (`displayedRows()`/`focusedRow()`/`focusedKey()`), and editable write-through master-detail
  (`fromReactiveRows` + `masterDetail`).
- **Navigation** — a remappable keymap (`GridAction`/`DEFAULT_KEYMAP`/`mergeKeymap`), `Tab`/`Shift-Tab`
  cell traversal (`installGridNavigation`), and single-click focus + synthesized double-click-to-edit.
- **Data at scale** — windowed virtual scroll (`isWindowed`/`windowedView`) with async `ensureRange`
  loading, muted `…` placeholders, per-frame coalescing, and O(visible) live-view memory at 100k rows.
- **Validation & lifecycle** — typed column `validate`, per-row `validateRow` cross-field gate,
  per-cell `beforeSave` veto, a reactive error message band, and caller-driven `status`
  (loading/empty/error + retry).
- **Export & variants** — `exportView('csv'|'tsv'|'html'|'json')` with RFC-4180 + CRLF, CSV/TSV
  formula-injection escaping, and `saveVariant`/`applyVariant` layout round-trip + runtime `setFrozen`.
- **Callback isolation** — a throwing on-screen `format` degrades its one cell to the raw value, and a
  throwing custom `compare` falls back to the type-aware default order, so one bad trusted callback
  never tears down a frame paint or a sort (extends the existing custom-renderer / export-path isolation).

### Non-functional
- **Golden-screen & accessibility** — a representative grid is asserted through a real terminal
  emulator across the truecolor / 256 / 16 / mono color depths, under `NO_COLOR` / mono (every theme
  role emits no color and the render stays intact), and under an ASCII-only glyph floor (box-drawing
  chrome and the decorative `•`/`▲`/`▼` degrade to legible ASCII).
- **Performance** — a 60×22 representative-grid compose+diff median is asserted within a 16 ms frame
  budget off-CI (logged under CI), and a single-cell edit re-serializes only the damaged region
  (output bytes are proportional to the damage, not the screen area).

### Security
- All rendered text passes the core `sanitize` boundary; CSV/TSV export is
  `sanitize → formula-escape → quote`; a throwing custom renderer degrades one cell, not the frame;
  zero native runtime dependencies (`check:deps`), no `eval`/dynamic require. Client-side validation
  is UX only — the caller's `onCommit`/source is the authoritative boundary.

### Not yet shipped
- CSV/paste **import** and windowed-source row export are deferred to a follow-up. A treeshake /
  bundle-size check remains a non-functional follow-on.
