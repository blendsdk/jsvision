## Ambiguity Register: @jsvision/datagrid (editable data grid)

> **Status**: ✅ GATE PASSED — all 32 items resolved (AR-01…AR-27 + AR-31/AR-32 Resolved · AR-28…AR-30 confirmed named deferrals)
> **Last Updated**: 2026-07-12 (AR-31/AR-32 added during preflight remediation)
> **Session note**: AR-01…AR-11 decided during the design conversation of 2026-07-12 (front-loaded discovery + four AskUserQuestion forks). AR-12…AR-30 resolved 2026-07-12 by explicit bulk acceptance ("accept all") of the recommendations below; per the shared gate, bulk acceptance is an explicit user decision.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope / Technical | Where does the grid live, how coupled to Postgres? | New dedicated package / fold into `@jsvision/ui` / couple to Data Studio | New package `@jsvision/datagrid` (deps core+ui; private until ui releases); Data Studio/PG is a separate downstream app | ✅ Resolved |
| 2 | Behavioral | Edit-commit granularity | Per-cell immediate / per-row / explicit batch Save | Per-cell immediate write-through; per-row gate + BeforeSave veto govern persistence | ✅ Resolved |
| 3 | Behavioral | Primary selection model for v1 | Row-oriented / cell-range / both | Row-oriented (single/multi); cell/range is P2 | ✅ Resolved |
| 4 | Behavioral | Default row navigation over large data | Virtual scroll+pager / scroll-only / pager | Continuous virtual scroll default; classic pager is an opt-in P2 mode | ✅ Resolved |
| 5 | Scope | Grouping/pivot/tree features | Keep / drop | Drop GRP-2 (collapsible grouping), GRP-3 (drag-to-group), GRP-7 (inline tree-grid), GRP-8 (pivot) | ✅ Resolved |
| 6 | Scope | Excel value-list filter in v1? | v1 / defer | Kept in v1 | ✅ Resolved |
| 7 | Scope | Master-detail (linked child grid) in v1? | v1 / defer | Kept in v1 | ✅ Resolved |
| 8 | Scope | Frozen columns in v1? | v1 / defer | Kept in v1 | ✅ Resolved |
| 9 | Naming | Feature slug | `datagrid` / `editable-data-grid` | `datagrid` (matches the package) | ✅ Resolved |
| 10 | Technical | RD decomposition + capability / phasing inventory | The 14-RD set (RD-01…RD-14) + its P1/P2/P3 feature inventory | Approved as presented — capability inclusion and each RD's Must/Should phasing trace here | ✅ Resolved |
| 11 | Scope | Terminal-impossible / deferred capabilities | Document as constraints | Out of scope (impossible): multi-line/wrapping cells, RTL, images/raster in cells, printing, pixel animation. Deferred/skip: merged cells, cell comments, split panes, editable pivot, native OS double/right-click (synthesized instead), sub-cell drag, full screen-reader a11y, zero-dep xlsx | ✅ Resolved |
| 12 | Integration | How `@jsvision/ui` exposes its grid engine to the new package | (a) export `GridRows`/`GridHeader`/`columns.ts` helpers+types from ui's public barrel · (b) move the table module into datagrid, ui re-exports | Accepted rec: (a) export the engine from ui (additive; avoids a dependency cycle) | ✅ Resolved |
| 13 | Naming / Integration | Overlap with ui's existing read-only `DataGrid` | Keep ui.DataGrid as-is, datagrid imports it · consolidate/deprecate | Accepted rec: keep ui.DataGrid as-is; datagrid imports from ui, no re-export | ✅ Resolved |
| 14 | Data & state | Data-source interface shape | In-memory `Signal<T[]>` + a windowed `GridDataSource<T>` seam (`length`/`rowAt`/`ensureRange`/`setSort`/`setFilter`/`distinct`); both in v1, server adapters Should | Accepted rec: two-tier source (in-memory + windowed `GridDataSource<T>`) | ✅ Resolved |
| 15 | Data & state | Row identity | Require a `rowKey(row)` accessor · derive by index | Accepted rec: require a `rowKey(row): string\|number` accessor | ✅ Resolved |
| 16 | Integration | Per-cell commit sink contract | `onCommit({rowKey,column,value,previous,row}) => boolean\|Promise<boolean>`; false/reject vetoes + keeps editor open (= BeforeSave veto seam) | Accepted rec: `onCommit` sink as specified | ✅ Resolved |
| 17 | Data & state | Aggregate scope over windowed/server data | v1 aggregates over the loaded/in-memory set only; windowed source needs a caller `aggregate(col,fn)` hook (Should) | Accepted rec: loaded-set aggregates in v1; server-total hook is P2 | ✅ Resolved |
| 18 | Behavioral | Enter-key precedence | Not-editing → begin edit; editing → commit + advance to next row (same col); row-dialog NOT on Enter | Accepted rec: context-sensitive Enter as specified | ✅ Resolved |
| 19 | Behavioral | Begin-edit triggers | F2 · Enter on an editable cell · type-a-printable (replaces content) | Accepted rec: all three triggers | ✅ Resolved |
| 20 | Behavioral | Double-click behavior + threshold | 2 downs on same cell within 400 ms → begin cell edit; row-dialog is a separate opt-in command | Accepted rec: synthesized 400 ms double-click → begin edit | ✅ Resolved |
| 21 | Behavioral | Multi-row selection gestures | Space toggle · Ctrl+click toggle · Shift+click / Shift+↑↓ range · checkbox-column click · header select-all | Accepted rec: the standard gesture set | ✅ Resolved |
| 22 | UX / Behavioral | Frozen-column ↔ reorder interaction | Reorder constrained within its panel; crossing the freeze boundary needs a separate re-pin action | Accepted rec: reorder within a panel only; pin/unpin is separate | ✅ Resolved |
| 23 | UX | Formatter default locale | Formatters opt-in per column (none → `String(value)`); built-in number/currency default to host locale, overridable; no implicit currency | Accepted rec: explicit opt-in formatters, host-locale default | ✅ Resolved |
| 24 | UX / Naming | New core Theme roles | Add additive `core` roles (grid cursor / dirty / selected / frozen-divider / footer / error / funnel), TV-decoded where a counterpart exists, byte-frozen by a theme spec; exact palette at authoring | Accepted rec: additive core roles; exact bytes at authoring | ✅ Resolved |
| 25 | Security | Custom-callback trust model | Custom editors/renderers/formatters/comparators are trusted caller TS, run with draw/handler-error isolation (a throw can't crash the frame); all rendered/pasted text still passes the core `sanitize` boundary | Accepted rec: trusted callbacks, isolated execution, sanitized output | ✅ Resolved |
| 26 | Security | Paste / import sanitization | Pasted cell content + imported values pass `sanitize` + the column validator before commit | Accepted rec: sanitize + validate on ingress | ✅ Resolved |
| 27 | Scope | Row-editor dialog (form view) phase | v1 · P2 (Should) | Accepted rec: P2 (Should); inline datasheet is the v1 primary | ✅ Resolved |
| 28 | Technical | Pager backend: offset vs keyset | Decide at RD-11 Phase-B planning | ⏸ Deferred — pager backend paging strategy (LIMIT/OFFSET random-jump vs keyset/seek) · owner: user at RD-11 planning · revisit: when the opt-in pager mode is planned (Phase B). Consequence acknowledged: the pager mode can't be built until chosen; v1 virtual scroll unaffected | ⏸ Deferred |
| 29 | Scope | Cell/range selection model (Excel-style) | Defer to Phase B | ⏸ Deferred — cell/range selection + range copy/paste/fill · owner: user · revisit: Phase B, after v1 row-selection ships. Consequence acknowledged: v1 has no range copy/paste/fill | ⏸ Deferred |
| 30 | Behavioral | Undo/redo history model | Defer to Phase B | ⏸ Deferred — edit undo/redo stack semantics · owner: user · revisit: Phase B (RD-08/RD-12 Should). Consequence acknowledged: v1 edits aren't undoable (commit/cancel only) | ⏸ Deferred |
| 31 | UX / Technical | Value model: a formatted-string accessor vs a value/format/parse split | Single formatted accessor · split `value` (typed) / `format` (display) / `parse` (edit round-trip) | Split value/format/parse — sort/filter key off the typed `value`, the cell shows `format(value)`, edits round-trip via `parse` (decided in the 2026-07-12 design conversation, e.g. `10000.25` ⟷ `"$10.000,25"`) | ✅ Resolved |
| 32 | Behavioral | Lookup / value-help commit: store the key or the label? | Commit the visible label · commit the underlying key | Commit the key (the foreign-key value); display the label | ✅ Resolved |

### Resolution Notes

**AR-01…AR-11:** Resolved in the 2026-07-12 design conversation (see the seed brief). Not re-confirmed per shared-gate rule 3.

**AR-12:** Export the engine from ui — additive, no churn, ui keeps its read-only `DataGrid`. Commits `@jsvision/ui` to a public engine surface (`GridRows`/`GridHeader`/`apportionColumns`/`alignCell`/`sortRows` + `Column`/`ColumnWidth`/`ColumnAlign`/`SortState`) that must carry JSDoc `@example` (the `check:docs` gate). Moving the table module into datagrid was rejected: it inverts the layering (datagrid depends on ui for `View`/`Group`) and forces ui→datagrid, a cycle.

**AR-13:** Keep ui.DataGrid unchanged (ships today; kitchen-sink + docs use it, zero-dep). `@jsvision/datagrid` is purely additive on the same engine and imports what it needs; it does not re-export the read-only grid. Consolidation revisitable post-v1.

**AR-14:** Two-tier source. (1) in-memory over `Signal<T[]>` (client-side sort/filter/slice); (2) `GridDataSource<T>`: `length()`, `rowAt(i)`, `ensureRange(start,end)`, `setSort(keys)`, `setFilter(model)`, `distinct(col)`. Both in v1; concrete server adapters (PG/REST) are Should (Phase B). Grounded in spike Probe 3b/7.

**AR-15:** Require `rowKey(row): string|number`. Selection, dirty tracking, reactive reconcile (keyed `For`), commit targeting, and optimistic concurrency all break on reorder/sort/filter without stable identity. Index-keying is an opt-in with the documented caveat that selection/edits don't survive reordering.

**AR-16:** `onCommit({ rowKey, column, value, previous, row }) => boolean | Promise<boolean>`. The in-memory record updates immediately (AR-02); `onCommit` governs persistence and is the per-cell veto point (false/reject keeps the editor open and reverts). The per-row gate + BeforeSave veto layer above it.

**AR-17:** v1 footer aggregates (sum/avg/min/max/count) compute over the in-memory / loaded rows. A windowed/server source supplies an `aggregate(col, fn): Promise<value>` hook (Should) for true whole-dataset totals. A partial-window total is never presented as a grand total.

**AR-18:** Enter is context-sensitive. Not editing → begin edit on the focused editable cell (no-op if read-only). Editing → commit and auto-advance to the next row, same column. The row dialog binds to double-click / a command / a configurable key, never Enter.

**AR-19:** F2 and Enter edit in place (cursor at end); a printable character starts the edit and replaces content (spreadsheet convention).

**AR-20:** Two `down`s on the same cell within 400 ms (configurable) synthesize a double-click → begin cell edit. Opening the row dialog on double-click is an app-wired opt-in.

**AR-21:** Space toggles the focused row; Ctrl+click toggles; Shift+click and Shift+↑/↓ extend a contiguous range; the checkbox column toggles; the header checkbox selects/clears all loaded rows.

**AR-22:** Reorder is within a band (frozen vs scrolling); moving a column across the freeze boundary is a separate pin/unpin action, because a cross-boundary drag would silently change the frozen width.

**AR-23:** No formatter → `String(value)`. Built-in number/currency/percent/date formatters default to host locale (`Intl` default), overridable per column; no implicit currency. `Intl` is pure-JS (no dep).

**AR-24:** Add core Theme roles: cursor / dirty-marker / selected-row / frozen-divider / footer-band / error-marker / filter-funnel. Decode against the list-viewer palette where a TV counterpart exists, else the DOS-16 palette; freeze the bytes with a theme spec. Exact attribute bytes at RD-authoring / implementation.

**AR-25:** Custom editors/renderers/formatters/comparators are the caller's trusted TS (spike Probe 6 model), run under draw/handler-error isolation so a throw degrades one cell/frame rather than crashing the loop (mirrors `RenderRoot` isolation). Independently, ALL screen writes and pasted content pass the core `sanitize` boundary — no control-byte injection reaches the terminal regardless of origin.

**AR-26:** Pasted and imported (CSV/paste-append) values pass `sanitize` then the destination column's validator before commit; invalid values are rejected at the boundary.

**AR-27:** Inline datasheet is the v1 primary; the form-view dialog (spike Probe 5) is a Should in RD-02/RD-08 (Phase B).

**AR-31:** The value/format/parse split is the load-bearing column contract (RD-01) — sort (RD-05) and filter (RD-06) key off the typed `value`, never the formatted string; the cell renders `format(value)`; editing round-trips through `parse`. Recorded here because it is the set's central architectural decision (approved in the design conversation but not previously captured as its own register item). Note the reused engine `Column.accessor` is a *string* accessor, so the datagrid adapts each `GridColumn` to an engine `Column` (accessor = `format∘value`, comparator synthesized from `value`) — see RD-01 §Column adaptation.

**AR-32:** A lookup / value-help editor commits the selected item's `key` (the stored foreign-key value), not its human `label`; the label is shown, the key is written to the field (RD-03).

**AR-28 / AR-29 / AR-30:** Confirmed named deferrals (Phase-B forks); consequences acknowledged in the table.
