# Specification: Data Grid Documentation Hub

> **Requirements**: PR-5, PR-8
> **Decisions**: AR-6, AR-7, AR-9, AR-13, AR-14, AR-15, AR-17, AR-18, AR-19

## Objective

Replace the shallow `/components/table/data-grid` page with a task-oriented hub that teaches both
`@jsvision/ui` `DataGrid` and `@jsvision/datagrid` `EditableDataGrid`. The hub uses the showcase's
67 shipped stories as evidence, not as a runtime dependency or a demand to copy every story.

## Information Architecture

| Order | Route under `/components/data-grid/` | Sidebar label | Profile | Required examples |
|---:|---|---|---|---|
| 1 | `index.md` | Overview | `landing` | `data-grid/quick-start` |
| 2 | `data-and-columns.md` | Data & columns | `capability` | `data-grid/data-sources`, `data-grid/typed-columns` |
| 3 | `layout-and-rendering.md` | Layout & rendering | `capability` | `data-grid/layout-freezing`, `data-grid/rendering` |
| 4 | `sorting-and-filtering.md` | Sorting & filtering | `capability` | `data-grid/sorting`, `data-grid/quick-filter`, `data-grid/advanced-filter` |
| 5 | `rows-selection-navigation.md` | Rows, selection & navigation | `capability` | `data-grid/selection-navigation`, `data-grid/row-mutations` |
| 6 | `editing-and-editors.md` | Editing & cell editors | `capability` | `data-grid/editing-lifecycle`, `data-grid/editor-types`, `data-grid/custom-editor`, `data-grid/dirty-commit` |
| 7 | `validation-and-lifecycle.md` | Validation & lifecycle | `capability` | `data-grid/validation`, `data-grid/lifecycle-states` |
| 8 | `footer-and-detail.md` | Footer, aggregation & detail | `capability` | `data-grid/aggregates`, `data-grid/master-detail` |
| 9 | `data-at-scale.md` | Data at scale | `capability` | `data-grid/windowed`, `data-grid/large-memory` |
| 10 | `export-and-personalization.md` | Export & personalization | `capability` | `data-grid/export`, `data-grid/variants-personalization` |
| 11 | `theming-accessibility-performance.md` | Theming, accessibility & performance | `capability` | `data-grid/theming-accessibility`, `data-grid/performance-boundaries` |
| 12 | `api.md` | API map | `api` | none |

Topic regrouping may change a label, but it cannot remove a capability or reduce the required example
set without a requirements change.

## Teaching Sequence

1. Start with the read-only UI grid and the typed editable grid decision.
2. Establish row identity, sources, and typed columns before transformations.
3. Teach layout/rendering before user interaction.
4. Teach sorting/filtering and selection/navigation before editing.
5. Teach commit, validation, dirty/error, and lifecycle as one coherent state model.
6. Cover aggregation/detail and scale after everyday interaction.
7. End with export/personalization and cross-cutting trust concerns.

## Example Design

| Example | Learning objective |
|---|---|
| `quick-start` | Compare a concise `DataGrid` with an `EditableDataGrid`; make the choice visible. |
| `data-sources` | Switch deterministic in-memory/reactive/windowed source modes and observe counts/loading. |
| `typed-columns` | Show value/format/parse/null behavior without unrelated editing complexity. |
| `layout-freezing` | Resize/reorder/freeze/show-hide columns and observe stable geometry. |
| `rendering` | Compare alignment, formatters, conditional styles, and a custom renderer. |
| `sorting` | Demonstrate single/multi/value-aware sort and priority feedback. |
| `quick-filter` | Teach per-column live text filtering. |
| `advanced-filter` | Teach condition/value-list filtering and N-of-M disclosure. |
| `selection-navigation` | Show selection modes, checkbox/gutter, cursor, keymap, and Tab traversal. |
| `row-mutations` | Insert/delete/duplicate with stable row keys. |
| `editing-lifecycle` | Enter/commit/cancel edits and show focus/overlay lifecycle. |
| `editor-types` | Compare built-in cell editor kinds in one deliberate lab. |
| `custom-editor` | Author one custom editor through the public seam. |
| `dirty-commit` | Show dirty markers, async/veto behavior, and visible feedback. |
| `validation` | Compare cell validation, row gate, and before-save behavior. |
| `lifecycle-states` | Switch loading/ready/empty/filter-empty/error states. |
| `aggregates` | Demonstrate aggregate/footer widgets, sticky state, and partial-data honesty. |
| `master-detail` | Bind detail rows to the master's focused key. |
| `windowed` | Scroll a deterministic 100k-row windowed source without full-array operations. |
| `large-memory` | Contrast the supported large in-memory tier and document its boundary. |
| `export` | Produce CSV/TSV/HTML/JSON and show safety escaping in visible output. |
| `variants-personalization` | Save/apply variants and use the personalization dialog with Cancel/OK semantics. |
| `theming-accessibility` | Compare theme roles, focus/selection/error contrast, and keyboard discoverability. |
| `performance-boundaries` | Surface lazy/windowed behavior and honest performance guidance without benchmark theater. |

Every example uses the Classic `template1` shell. The centered dialog can be larger than a simple
control lab but must retain visible desktop margins at 80×24.

The learning-objective table is a capability summary. Before implementation,
`test/contracts/data-grid/` supplies one typed behavior contract per example with its exact initial
grid state and one or more independently resettable cases containing bounded key/mouse sequences
and executable row/column/status probes. Capability-to-case parity ensures every objective in the
table is proven. The Data Grid objective specs are sharded into topology/profile, interaction, and
trust-boundary files; implementation tests are sharded by lifecycle/editing, data/scale, and
export/personalization.

## Public Symbol Placement

| Symbol | Target |
|---|---|
| `DataGrid`, `EditableDataGrid` | Overview |
| `GridRows`, `GridHeader`, `EditableGridRows` | Layout & rendering / editing anchors |
| `SortHeader`, `QuickFilterRow`, `FilterPopup`, `ValueList` | Sorting & filtering anchors |
| `FooterBand` | Footer, aggregation & detail anchor |
| `personalizeGrid` | Export & personalization anchor |

Supporting non-visual APIs are linked from their task page and API map rather than receiving catalog
component rows.

## Source Reuse Boundary

- Example fixture builders may be adapted into small docs-local helpers.
- Shared builders live under `src/example-fixtures/data-grid/`, outside the recursively scanned
  runnable example directory.
- Do not import `packages/examples/datagrid-showcase/stories/index.ts`.
- Avoid cross-workspace source imports that bypass public package entry points.
- If a showcase behavior exposes a product defect, report it; do not document the defect as intended.

## Removal and Link Migration

- Delete `packages/docs-site/components/table/data-grid.md`.
- Delete `packages/docs-site/examples/table/data-grid.ts`.
- Remove `table/data-grid` from the registry.
- Replace guide/sidebar/API-map/internal prose links with the new hub target.
- A stale-route spec must be red before deletion and green afterward.

## Verification

- Specification: ST-23 through ST-25, ST-31, ST-32.
- Each topic's example objective is covered by a Data Grid hub spec test; state-machine edge cases get
  implementation tests after the examples are green.
- Focused package checks include docs-site typecheck/test/build and Data Grid public-API compilation.
- Final: `yarn verify`.
