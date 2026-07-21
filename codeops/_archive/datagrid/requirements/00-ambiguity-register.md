## Ambiguity Register: @jsvision/datagrid (editable data grid)

> **Status**: ✅ GATE PASSED — all 57 items resolved (AR-01…AR-27 + AR-31…AR-57 Resolved · AR-28…AR-30 confirmed named deferrals)
> **Last Updated**: 2026-07-18 (AR-42…AR-57 added for RD-16 — Column & Variant Personalization Dialog; RD-16 preflight amendments PF-024…PF-031 applied)
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
| 33 | Scope / Architecture | Where the standalone datagrid showcase lives | New package `@jsvision/datagrid-showcase` · subfolder in `packages/examples` · promote datagrid's `test/kitchen-sink` in place | Subfolder `packages/examples/datagrid-showcase/` with a `demo:datagrid` script; `@jsvision/examples` gains a dependency on `@jsvision/datagrid` (RD-15) | ✅ Resolved |
| 34 | Scope | First-cut coverage of the showcase | Shipped features only, grow per RD · also scaffold placeholders for the unbuilt RDs | Granular demos for the shipped RD-01…RD-06 surface **plus** "coming soon" placeholder slots for RD-07…RD-14 (RD-15) | ✅ Resolved |
| 35 | Architecture | How the showcase gets its shell (sidebar navigator + menu + status + welcome) | Dedicated shell seeded from the kitchen-sink pattern · extract a shared `showcase-shell` module used by both · import kitchen-sink's shell directly | Dedicated shell, seeded from the proven `kitchen-sink/shell.ts` pattern — isolated (zero risk to the general kitchen-sink), room for datagrid-specific chrome; mild duplication accepted (RD-15) | ✅ Resolved |
| 36 | UX | What each unbuilt-RD placeholder slot shows | Per-RD description panel · single roadmap overview screen · greyed/disabled nav entries | Per-RD description panel: RD title + a planned-capability blurb + a "coming soon" status chip; each slot is the drop-in target when that RD lands (RD-15) | ✅ Resolved |
| 37 | Scope | The concrete demo inventory | The ~38-demo inventory across 6 clusters + 8 placeholders (tabled in RD-15) · a leaner one-per-cluster first cut · revise specific clusters | Approved as proposed — the full ~38-demo inventory (RD-15 §Demo inventory) | ✅ Resolved |
| 38 | Naming | Folder + run-script name | `datagrid-showcase` · `datagrid-kitchen-sink` · `datagrid-demo` | Folder `datagrid-showcase`, script `demo:datagrid` — distinct from the general `kitchen-sink` (RD-15) | ✅ Resolved |
| 39 | Testing / Integration | Fate of datagrid's existing `test/kitchen-sink` smoke stories | Retire the 6 coarse stories (superseded) · keep them | Keep the 6 in-package smoke stories as the *isolated* render guard (datagrid must not depend on `examples`); build the rich granular set fresh in the showcase (RD-15) | ✅ Resolved |
| 40 | Testing | Test tiers for the showcase | Per-demo smoke only · smoke + headless walkthrough | Per-demo smoke test (mounts + paints ≥1 cell) **Must** + a headless piped walkthrough auto-advancing every demo **Must**, CI-gated (RD-15) | ✅ Resolved |
| 41 | UX | The "shine" quality bar | — | Every demo: a one-line blurb + the live component + a visible bound-state echo + key hints; keyboard **and** mouse; faithful TV theming; a welcome/overview landing screen (RD-15) | ✅ Resolved |

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

**AR-42…AR-57 (RD-16 — Column & Variant Personalization Dialog):** Resolved 2026-07-18 via three AskUserQuestion rounds (11 explicit user picks: AR-43…AR-53) plus grounded defaults stated and accepted by non-objection (AR-42, AR-54…AR-57 — the standards-mandated / single-viable items). The dialog is the end-user UI over the RD-13 layout + variant APIs. Individual entries:

- **AR-42:** Document organization — a **new RD-16** (extract RD-13's deferred "Personalization dialog" Should-Have into its own RD), rather than bloating the shipped RD-13. Grounded default; user did not contest.
- **AR-43:** Apply model — **staged (OK / Cancel)**: dialog edits build a pending layout; OK applies it, Cancel discards. Chosen over live-preview (a centered modal can cover the grid, so a live preview isn't reliably visible; staged matches the `formDialog`/`FileDialog` modal precedent). User pick.
- **AR-44:** Column operations in v1 — **all four**: show/hide, reorder, freeze (left/right), and explicit width. User pick (the fuller of the offered sets).
- **AR-45:** Variant management in v1 — **full**: save-as (name the current pending layout), apply a saved variant, delete, and mark a default. Chosen over minimal (save+apply) and defer. User pick.
- **AR-46:** Open API — an **async modal helper `personalizeGrid(grid, opts): Promise<…>`** that opens the modal and resolves when closed (mirrors `formDialog()` / `openFile()`); the app wires it to a menu item / keybinding. Chosen over a mountable class or shipping both. User pick.
- **AR-47:** Variant persistence — a **caller-provided `VariantStore`** the dialog calls (`list()` / `save(variant)` / `delete(name)` / `setDefault(name)` / `getDefault()`), consistent with RD-13's grid-stays-stateless-about-persistence decision (RD-13 AR #10 / AR-12-of-that-plan). Chosen over an in-memory seeded list. User pick.
- **AR-48:** Column-metadata read — add a **public reactive `grid.columns()`** accessor returning the full column list `[{ id, title, visible, frozen, width }]` (hidden included, in full order); the helper reads it and it is independently useful to apps building column UIs. Chosen over keeping `columnMap` private + internal-only access. User pick. (Resolves the RD-13 plan's Gap 1 — "no public column-metadata accessor" — for the read side without widening the *write* surface.)
- **AR-49:** Saving over an existing variant name — **confirm overwrite** (prompt; yes replaces, no returns to name entry). Chosen over silent overwrite or hard-reject-duplicates. User pick.
- **AR-50:** "Set as default" semantics — **store a flag only**; the `VariantStore` persists which variant is default and the **app** applies it on grid load (`getDefault()` + `applyVariant`). The dialog/grid gain no load-time auto-apply hook. Chosen over auto-apply. User pick.
- **AR-51:** Reorder mechanism inside the dialog — **move up / down** (select + Alt+↑/↓ or buttons), keyboard-idiomatic and fully accessible. Chosen over in-list drag (the header already offers mouse drag-reorder from RD-07). User pick.
- **AR-52:** **Include a "Reset to defaults"** action — restores the grid's originally-constructed column layout (all visible, original order, no freeze, no width overrides). User pick.
- **AR-53:** Column-list **search/filter is deferred** to a later pass; v1 shows a scrollable list. User pick.
- **AR-54:** Package placement — **`@jsvision/datagrid`** (datagrid-specific; already depends on `@jsvision/ui`'s `Dialog`/`ListView`/`Button`). Grounded default. Stays zero-runtime-dependency.
- **AR-55:** "Save as variant" captures the dialog's **pending (staged) layout** being edited — WYSIWYG in the dialog — not the untouched live grid. Forced by the staged model (AR-43). Grounded default.
- **AR-56:** Variant-name validation — reject an empty/whitespace-only name; `sanitize` the name at the render boundary (control bytes stripped, per the SDK egress rule); cap at **64** characters. Security/data default (non-negotiable sanitize standard). Grounded default.
- **AR-57:** Accessibility & theming — the dialog is **fully keyboard-operable** (Tab/Shift+Tab between controls, arrows within the list, Space toggles visibility, Enter = OK, Esc = Cancel) and **reuses the existing `Dialog` theme roles** (no new core theme roles). Per RD-14 non-functional. Grounded default.

**Preflight amendments (2026-07-18, PF-024…PF-031):** RD-16's first preflight (`00-preflight-report.md`) surfaced two MAJOR issues; the user accepted all recommendations and RD-16 was amended:

- **PF-024 (refines AR-52 Reset / AR-44 width):** Reset-to-defaults and the width editor's clear-to-auto need grid surface the RD-07/RD-13 API lacked. RD-16 adds `grid.defaultColumnLayout()` (the construction-time column baseline the dialog seeds Reset from) and `grid.clearColumnWidth(id)`, and corrects `applyVariant`/`resolveVariant` to *remove* a named column's width override when the variant omits it (delete-then-set) — which also fixes a latent RD-13 `saveVariant`→`applyVariant` round-trip bug (ships with an RD-13 regression test).
- **PF-025 (refines AR-55 save-captures / AR-45 variant mgmt):** the sort/filter model is made single-sourced — the *pending* layout owns sort/filter from open onward (seeded from the live grid once at open; changed only by applying a saved variant), and OK restages them. "Never edits sort/filter" is narrowed to "no sort/filter *editing controls*"; Save-as captures sort/filter from pending, not the live grid.
- **Minor/observation:** PF-026 (deleting the default variant clears the store default), PF-027 (the last visible column cannot be hidden — zero-visible is never committed), PF-028 (`grid.columns()`/the pending seed report the *resolved* freeze; an over-pinned freeze can narrow on round-trip — accepted v1 limitation), PF-029 (variant name hard-capped/truncated at 64 at entry), PF-030 ("RD-13 Gap 1" re-attributed to the RD-13 *plan*), PF-031 (composition-note member names aligned to the code).

**AR-33…AR-41 (RD-15 — DataGrid Showcase App):** Resolved 2026-07-15 via four AskUserQuestion forks plus explicit bulk acceptance of the remaining recommendations. AR-33/34/35/36/37 were direct user picks; AR-38/39/40/41 were presented with grounded recommendations and bulk-accepted (per the shared gate, bulk acceptance is an explicit user decision). The showcase is a standalone, datagrid-centric kitchen-sink under `packages/examples/datagrid-showcase/`, seeded from the proven `kitchen-sink/shell.ts` navigator pattern (a sidebar `ListBox` + per-category menu + clickable status hints + welcome catalog), demonstrating each shipped RD-01…RD-06 capability as its own granular demo, with per-RD "coming soon" panels for RD-07…RD-14 that become drop-in slots as those RDs land. Grounding: the datagrid public barrel (`packages/datagrid/src/index.ts`) enumerates the demo-able surface; `test/kitchen-sink/story.ts` already established the "trimmed copy of the examples showcase model" precedent. The showcase is intended as the living acceptance surface for every future datagrid RD.
