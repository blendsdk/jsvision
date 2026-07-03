# Preflight Report — RD-16 (Table / DataGrid)

> **Artifact**: `requirements/RD-16-table.md` (a single requirement doc)
> **Reviewed**: 2026-07-03 · **Skill**: preflight 3.1.0
> **Reviewer**: fresh session (RD-16 authored 2026-07-02 in a prior session — **review independence OK**, not a same-session review)
> **Scope**: RD-16 requirement doc + its Ambiguity Register entries (AR-151…AR-161), grounded in the real `@jsvision/ui`/`@jsvision/core` code and the Turbo Vision source (`/home/gevik/workdir/github/tvision`).

---

## Outcome

**✅ PASSED — all findings resolved** (scanned 0 🔴 / 0 🟠 / 7 🟡 / 2 🔵; all 7 MINOR fixed + both observations folded in, 2026-07-03).

The core design is sound and the **TV GATE-1 fidelity findings hold under independent verification** (see Codebase Context Summary). No blocking issues were found. The 7 MINOR findings were wording/grounding inaccuracies and small completeness/consistency gaps that would otherwise have propagated into the plan; the 2 observations are clarifications now carried for the plan's GATE-1 decode. RD-16 is ready for `make_plan`.

---

## Codebase Context Summary (what recon established)

**Reuse surfaces — verified present and usable:**

| RD-16 claim | Reality | Verdict |
|---|---|---|
| Vertical + **horizontal** `ScrollBar` reuse | `ScrollBar` takes `orientation: 'vertical' \| 'horizontal'` with a two-way `value` signal (`scroll/scroll-bar.ts:77-78,107`) | ✅ grounded |
| Virtual-scroll helpers `clampIndex`/`keepVisible` | Present, pure, TV-decoded (`list/virtual.ts:11,29`) | ✅ grounded |
| Column widths via RD-02 integer `solveTrack` | `solveTrack(total, items, gap)` exists (`layout/apportion.ts:73`) — but `TrackItem = fixed \| flex` only; **no `auto` kind** (`:18-20`) | ⚠️ see PF-003 |
| Row/divider theme roles already shipped | `listNormal`/`listFocused`/`listSelected`/`listDivider` exist (interface `theme.ts:131-146`, defaults `:284-287`) — **not** `:222-225` as cited | ⚠️ see PF-001 |
| Reuse RD-11 `sorted` computed for click-to-sort | `list-rows.ts:110-116` `sorted` is a **fixed ascending single-field boolean toggle**, not parameterizable by column/dir/comparator | ⚠️ see PF-002 |
| `DataGrid` = "a focusable View that owns a V ScrollBar as ListView does" | Only a `Group` owns children; both `ListView` and the shipped `Tree` are `extends Group` composing a focusable `*Rows extends View` + owned bar (`list/list-view.ts`, `tree/tree.ts:50,54,56`) | ⚠️ see PF-004 |
| New `src/table/`, explicit named re-exports | `table/` absent; `src/index.ts` uses explicit named re-exports throughout (`:88-116`) | ✅ grounded |

**TV fidelity (independent C++ re-verification against `/home/gevik/workdir/github/tvision`):**
- No table/grid/spreadsheet class exists; `TListViewer::numCols` is the only multi-column mechanism (all subclasses are single-field lists). ✅
- Newspaper flow `item = j*size.y + i + topItem` exact (`tlstview.cpp:110`). ✅
- `│` = `\xB3` divider drawn via `getColor(5)`; `cpListViewer` (`:30` `"\x1A\x1A\x1B\x1C\x1D"`) index 5 = `0x1D` = divider colour. ✅
- Row colours: normal `getColor(1)`/`(2)`, focused `getColor(3)`, selected `getColor(4)` (`:86-97`). ✅
- `hScrollBar` → `indent = hScrollBar->value` horizontal offset (`:99-102`). ✅
- `showMarkers` gated **monochrome-only** (`tprogram.cpp:253/264`), markers `»«`/`→←`/spaces. ✅ (→ PF-005)
- TV also **selects on Space** (`:282-286`). (→ PF-006)
- TV pages `±(size.y*numCols)` (`:309-314`), not `±size.y`. (→ PF-009, plan-GATE reconciliation)

---

## Findings

### 🟡 PF-001 — `listDivider`/row roles cited at the wrong line (`theme.ts:222-225`)
**Dimension:** 13 (Codebase Alignment — stale reference).
RD-16 cites the row/divider roles at `theme.ts:222-225` (Technical Requirements §Cross-package edits, and AR-159). The roles are actually declared in the `Theme` interface at **`theme.ts:131-146`** and defined in `defaultTheme` at **`theme.ts:284-287`**; line 222-225 is mid-JSDoc. A plan author following the cite to GATE-1-decode the header role beside them would land in a comment.
**Recommendation:** correct both cites to `theme.ts:131-146` (interface) / `284-287` (defaultTheme). Trivial.

### 🟡 PF-002 — "reuse RD-11's `sorted` computed" overstates the reuse
**Dimension:** 13 (Dependency Reality) / 4 (Completeness).
The existing `sorted` (`list/list-rows.ts:110-116`) is a **boolean toggle** producing a *fixed* ascending, case-insensitive, single-field `getText` sort — no direction, no column selection, no comparator hook. RD-16's sort is per-column, asc/desc-toggle, with an optional typed `compare` (AC-6/AR-158). That is a **new** parameterized computed, not a reuse of the existing one. Calling it "reuse the `sorted` computed/machinery" (Feature Overview, Technical Requirements §Sort, AR-158) risks the plan under-scoping the work or trying to force-fit the non-parameterizable toggle.
**Recommendation:** reword to "follow the RD-11 **sorted-display pattern** (a `computed` reordering the display) with a *new* comparator parameterized by `{col, dir}` + the column's optional `compare` (default locale-aware string compare); the existing `list-rows.ts` `sorted` toggle is single-field/ascending-only and is not itself reused." Keeps the intent, fixes the grounding.

### 🟡 PF-003 — `auto` column sizing isn't a `solveTrack` capability; measurement scope + cap unspecified
**Dimension:** 13 (Architecture Mismatch) / 1 (Ambiguity).
`solveTrack`'s `TrackItem` is `fixed | flex` (`layout/apportion.ts:18-20`) — there is **no `auto`**. So "widths … apportioned with … `solveTrack`" (fixed/fr/auto, AR-153/AC-3) can't be literally true for `auto`: the DataGrid must first **pre-measure** each `auto` column (its "widest rendered cell, capped") into a `fixed` `TrackItem`, then call `solveTrack`. Two things are then unpinned: (a) the **measurement scope** — widest over *all* rows (stable but O(rows) and re-runs on data change) vs. the *visible window* (cheap but width jitters as you scroll); (b) the **cap** value (`Should-Have` adds `maxWidth?`, but base `auto` says only "capped"). Also note **fr ⟂ horizontal-scroll**: `fr` columns always fill the viewport, so AC-7's H-scroll only engages when columns are all `fixed`/`auto` and exceed the viewport — worth stating so the two features aren't assumed to combine.
**Recommendation:** state that `auto` is pre-resolved to a `fixed` track item (widest cell) *before* `solveTrack`, and pin the measurement scope + cap at plan GATE-1. Recommended default: **widest cell over the current rows, clamped by the optional `maxWidth`, recomputed on data change** (predictable, no scroll jitter). Note the fr/overflow interaction in AC-7.

### 🟡 PF-004 — `DataGrid` framed as "a focusable View that owns bars"; contradicts the Group+renderer idiom
**Dimension:** 13 (Convention Violation) / 12 (Consistency).
RD-16 describes `DataGrid<T>` as "**a focusable `View`** that virtual-scrolls its rows … plus **owns a vertical `ScrollBar`** (as `ListView` does) and an owned horizontal `ScrollBar`" (§Must Have). But a bare `View` owns no children, and `ListView` is **not** a `View` — the established, twice-shipped idiom is a **`Group`** container composing a focusable **`*Rows extends View`** renderer + owned bar(s): `ListView extends Group` (`list/list-view.ts`) and `Tree extends Group` (`tree/tree.ts:50`) with `TreeRows extends View` (`tree/tree-rows.ts:71`). RD-16's DataGrid additionally needs a **sticky header** child and a **second (H) bar**. The AR-160 file split (`data-grid.ts` = grid + `Column` type, `columns.ts` = helpers, `index.ts`) omits the renderer file the pattern uses and likely **undercounts** against the ≤500-line rule (container + multi-column renderer + header + sort + column math).
**Recommendation:** reframe `DataGrid<T>` as a **`Group`** composing (a) a focusable multi-column **rows-renderer** (a `View`, its own file e.g. `grid-rows.ts`), (b) a non-scrolling **header** row, and (c) owned **V + H** `ScrollBar`s sharing the focus/indent signals — exactly the `ListView`/`Tree` shape. Update AR-160's file list to include the renderer file (and header, if split). This is the plan's job to detail, but the RD framing should not contradict the pattern.

### 🟡 PF-005 — `showMarkers` "preserved" is moot in a colour-first grid
**Dimension:** 13 (Stale Assumption) / 12 (Consistency).
RD-16 lists `showMarkers` among the *faithful, preserved* `TListViewer` behaviours (GATE-1 finding table §"the item focus/select model … `showMarkers`"; Row rendering AR-159 "`showMarkers` behaviour is preserved"). But TV gates `showMarkers` **monochrome-only** (`tprogram.cpp:253` sets it `False` in colour/BW; verified), and the existing renderer already omits markers in colour (`list-rows.ts:11` "`showMarkers` … monochrome-only and omitted in colour"). `@jsvision/ui` is colour-first, so there is **no colour-path marker behaviour to preserve**.
**Recommendation:** drop `showMarkers` from the "preserved faithful" list, or scope it explicitly to "mono-mode only, as `ListRows` (off in colour)". Prevents a spec author from asserting phantom `»«`/`→←` markers on a colour grid.

### 🟡 PF-006 — Select trigger omits **Space** (TV + sibling `ListView` bind it)
**Dimension:** 13 (Test Impact) / 12 (Consistency).
AC-8/AR-155 lists the select trigger as "**Enter or double-click**". TV `TListViewer` also selects on **Space** (`tlstview.cpp:282-286`, verified), and the sibling `ListView` activates on **Enter/Space** (`list-view.ts` `onSelect` JSDoc "Activation (Enter/Space)"). Omitting Space diverges from both the oracle and the shipped sibling.
**Recommendation:** add **Space** to the select triggers in AC-8/AR-155 ("Enter/**Space**/double-click emits the select command"), matching `TListViewer` and `ListView`.

### 🟡 PF-007 — No empty-state (no-rows) rendering specified
**Dimension:** 4 (Completeness) / 9 (Edge Cases) / 12 (Consistency).
RD-16 has no AC or mention of the **empty grid** (rows `Signal<T[]>` = `[]`) case. Both siblings render a placeholder: `ListRows` draws `<empty>` (`list-rows.ts:11`), and RD-15's preflight (PF-003) explicitly pinned `Tree` to `<empty>` for this exact consistency. A grid with a header but no rows is a normal state (filtered-to-nothing, pre-load).
**Recommendation:** add an AC: when rows are empty, draw the header normally and an `<empty>` placeholder in the data area (matching `ListRows`/`Tree`). Optionally note the no-columns degenerate case (render nothing / clamp).

### 🔵 PF-008 — `focused` semantics across a sort (positional vs. row-tracking)
**Dimension:** 9 (Edge Cases).
`focused: Signal<number>` is "row index into the **sorted** view" (AC-1/AC-8), clamped on data change (AC-9). Implication: after re-sorting, the same index highlights a *different* row (focus is **positional**, not identity-tracking). TV has no sort, so no oracle. Positional is the simplest and is consistent with the clamp semantics — but it's an unstated design choice.
**Recommendation (non-blocking):** document the positional-index choice explicitly in AC-8/AC-9 (focus stays at the same *visual position* across a sort), or, if row-identity-tracking is wanted, say so. Recommend positional (simplest, consistent).

### 🔵 PF-009 — Plan GATE-1 should reconcile TV's `size.y*numCols` paging with the grid's one-row-per-item model
**Dimension:** 7 (Testability) / 13 (Test Impact).
RD-16 cites `tlstview.cpp handleEvent` as the nav oracle for "PgUp/PgDn ±viewport" (AR-155/AC-1). TV actually pages `±(size.y*numCols)` (`:309-314`, verified). Because RD-16's grid is **one row per item** (not TV's newspaper multi-column-of-one-field), `numCols` in the flow sense is 1, so `±size.y` = `±viewport rows` **is** the correct decode — but a spec author transcribing the oracle literally could write `size.y*numCols`.
**Recommendation (non-blocking):** the plan's GATE-1 decode should note this reconciliation explicitly (TV pages by `size.y*numCols` in the newspaper layout; the row-per-item grid pages by viewport rows = `size.y`). No RD change required.

---

## Dimension scan summary

| # | Dimension | Result |
|---|---|---|
| 1 | Ambiguities | PF-003 (auto scope/cap) |
| 2 | Implicit Assumptions | clean |
| 3 | Logical Contradictions | PF-004 (View-owns-bars vs Group idiom) |
| 4 | Completeness Gaps | PF-002, PF-007 |
| 5 | Dependency Issues | clean (deps RD-11/02/05/04/03/01 all Done + present) |
| 6 | Feasibility | clean (sticky header + V/H bars feasible via layout + shared signals) |
| 7 | Testability | PF-009 |
| 8 | Security Blind Spots | clean (sanitize boundary + bounds-check + width-clip all covered; §Security solid) |
| 9 | Edge Cases | PF-007, PF-008 |
| 10 | Scope Creep | clean (Should/Won't/Deferred well-bounded) |
| 11 | Ordering & Sequencing | n/a (requirement doc, no task order) |
| 12 | Consistency | PF-004, PF-005, PF-006, PF-007 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-003, PF-004, PF-005, PF-006 |

---

## Resolutions

User decision (2026-07-03): **apply all 7 MINOR fixes + fold in both observations.** All applied to `RD-16-table.md`; substantive refinements also recorded in the register (AR-167…AR-171); AR-159's stale cite corrected in place.

| Finding | Resolution | Where fixed |
|---|---|---|
| PF-001 | Cite corrected to interface `131-146` / `defaultTheme` `284-287` | RD §Theme role, §Cross-package edits; register AR-159 |
| PF-002 | Reworded to "sorted-display **pattern** + new `{col,dir}`+`compare` comparator; existing toggle not reused" | RD Feature Overview, §Click-to-sort; register **AR-167** |
| PF-003 | `auto` pre-measured to `fixed` before `solveTrack`; scope/cap deferred to plan GATE-1; `fr` ⟂ overflow noted | RD §Column sizing, AC-3; register **AR-168** |
| PF-004 | `DataGrid` reframed as a `Group` = renderer(View) + header + V/H bars; AR-160 file split gains the renderer file | RD §Must Have, §New subsystem; register **AR-169** |
| PF-005 | `showMarkers` dropped from "preserved faithful"; scoped to mono-only/not-carried | RD Feature Overview (×2), §Row rendering |
| PF-006 | **Space** added to select triggers | RD §Selection, AC-8; register **AR-170** |
| PF-007 | New **AC-14** — `<empty>` placeholder + zero-row/zero-column safety | RD Acceptance Criteria; register **AR-171** |
| PF-008 🔵 | `focused` documented as a **positional** index across a sort | RD §Selection, AC-8 (folded into AR-170) |
| PF-009 🔵 | Plan GATE-1 reconciliation note (TV `size.y*numCols` vs. row-per-item `±viewport`) | RD §Navigation |

**Final status: ✅ PASSED WITH NOTES → all notes fixed.** RD-16 is ready for `make_plan`.
