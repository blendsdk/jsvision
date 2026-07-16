# Ambiguity Register — Rows, Records & Selection

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-08
> **Status**: ✅ GATE PASSED · 🔎 preflight decisions folded in (Section D, 2026-07-16)
> **Last Updated**: 2026-07-16 (preflight)
> **CodeOps Skills Version**: 3.7.0

The Zero-Ambiguity Gate for the rows-selection plan. RD-08 is a preflighted requirement whose
top-level model is already locked (row-oriented selection keyed by `rowKey`, the standard gesture
set, a `RowMutations` CRUD seam, a per-column null policy); this register records (A) the eight
plan-level decisions the user confirmed at the gate (two AskUserQuestion rounds, 2026-07-16), (B)
the design decisions grounded in the actual code (single viable path each — no strawman
alternatives), and (C) the decisions inherited verbatim from RD-08's own requirements register.

**Same-session note:** ⚠️ This plan was authored in the same session that will review it at
preflight. A fresh-session preflight is recommended for review independence.

---

## A. User-confirmed decisions (Zero-Ambiguity Gate)

| #    | Ambiguity                                    | Options considered                                                                 | ✅ Decision                                                                                                                                                     | Status |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AR-1 | Multi-selection state representation          | (a) **`selectedKeys: Signal<ReadonlySet<Key>>` + datagrid-local paint** · (b) promote engine `GridRows.selected` to a set/predicate | **(a)** — replace the vestigial single `selected = signal(-1)` index (`grid.ts:233`) with a `ReadonlySet<Key>` + a stored anchor key; the datagrid body paints selection by `rowKey` set-membership in its **already self-contained `draw()` override** (`editable-grid-rows.ts:443`, swap `item === selected` for `selectedKeys.has(rowKey(row))`). **Zero `@jsvision/ui` engine change** (verified feasible — the body owns its row-role logic). A pure `selection.ts` model twin owns the ops; `single` mode holds ≤1 key. **⚠️ Corrected at preflight (AR-16/AR-17):** `selected` is base-owned and a **required** `GridRowsConfig` field written on every click — it is **kept** (not removed) and superseded by `selectedKeys` + a cursor-only `select()` override. | ✅ Resolved |
| AR-2 | Selection defaults + checkbox/gutter opt-in   | (a) **multi default + opt-in extras** · (b) single default · (c) selection fully opt-in | **(a)** — selection gestures always live; `selectionMode?: 'single' \| 'multi'` **defaults `'multi'`** (enterprise datasheet); the checkbox column (`checkboxColumn?`) and row-number gutter (`rowNumbers?`) are **both opt-in, default off**. | ✅ Resolved |
| AR-3 | Empty-editor commit on a nullable column       | (a) **empty→null on nullable** · (b) explicit clear-to-null only                    | **(a)** — a `null.nullable` column stores **`null`** when the editor commits an empty value (renders `null.display`, default `''`); a non-nullable column stores `''` as today. Matches the Access/DB convention. **Trade-off accepted:** a nullable column cannot also hold a literal empty string distinct from null. | ✅ Resolved |
| AR-4 | In-memory CRUD + duplicate-row key generation  | (a) **built-in splice + `assignKey` hook** · (b) caller-supplied `RowMutations` only | **(a)** — `fromRows` gains built-in `insert`/`remove` that splice the `Signal<T[]>`; `insertRow(row, at?)` requires a **caller-formed key** on the row; `duplicateRow(key)` uses an optional `assignKey(clone, original) => T` hook to mint a fresh key — **no hook ⇒ duplicate is a no-op + `devWarn`** (never a key collision). Batteries-included for the common in-memory case; key generation stays caller-owned (RD AR-15). | ✅ Resolved |
| AR-5 | Checkbox / gutter geometry + cursor            | (a) **fixed-width synthetic prefix, not cursor-navigable** · (b) real leading engine columns | **(a)** — both are fixed-width synthetic prefix cells in the **left-pinned region**, **not** caller `GridColumn`s, **not** in the `apportionColumns` sortable/filterable track, **not** reachable with `←`/`→`. `Space` toggles the focused row; a mouse-down on a checkbox cell toggles that row; the header checkbox cell is the tri-state select-all. Cleanest separation from data columns; no freeze/reorder/width-math entanglement. | ✅ Resolved |
| AR-6 | Module decomposition (700-line cap)            | (a) **new modules + thin wrappers** · (b) inline into `grid.ts`/`editable-grid-rows.ts` | **(a)** — new pure **`selection.ts`** (model twin of `sort.ts`/`filter.ts`/`column-model.ts`) + new **`synthetic-columns.ts`** (checkbox/gutter geometry & paint); `RowMutations` on the data-source seam; thin `insertRow`/`deleteRows`/`duplicateRow` + selection wrappers on `grid.ts`. **`grid.ts` is already 945 lines** — if it crosses **~1050**, extract the selection/CRUD wiring into a helper module **in the same phase**. | ✅ Resolved |
| AR-7 | Header select-all scope under an active filter | (a) **current `display()` (filtered) rows** · (b) all source rows                   | **(a)** — the header checkbox selects the current `display()` (all filtered/sorted rows in view); its tri-state reflects none/some/all of that display set. "All loaded rows" = what is shown; filtered-out rows are **not** swept in. | ✅ Resolved |
| AR-8 | Showcase coverage                             | (a) **full RD-07 treatment** · (b) kitchen-sink story only                          | **(a)** — one kitchen-sink `rows-selection.story.ts` (+ smoke) **and** a datagrid-showcase "Rows & selection" cluster replacing the RD-08 "coming soon" placeholder (`placeholders.ts`), re-basing the placeholder-count oracles to RD-09…RD-14 (as RD-07 did for RD-08…14). Keeps roadmap/showcase parity. | ✅ Resolved |

---

## B. Grounded design decisions (single viable path — cited to code)

These have one sensible realization given the existing seams; each is recorded with its grounding
(no strawman alternatives per the grounded-options rule). Open to revisit at preflight.

| #     | Decision                        | Realization & grounding                                                                                                                                                                                                                                                                          | Status |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AR-9  | Selection model module shape    | **`selection.ts`** exports **pure functions** over `ReadonlySet<Key>` (`toggleKey`, `selectRange`, `selectAll`, `triState`), not a stateful class; the container wraps them in a `selectedKeys` signal + an `anchorKey` field — the exact `sort.ts`/`filter.ts`/`column-model.ts` pattern (pure ops + container signals, RD-07 AR-13). The RD-08 `SelectionModel` interface is realized as *container state driven by pure ops*, not a separate object. | ✅ Resolved |
| AR-10 | Selection survives sort/filter for free | Because selection is a **key set** (RD AR-15), it needs **no reconcile** on re-sort/re-filter — the keys are stable; the same rows re-highlight wherever they move. This **replaces** the vestigial single `selected` index **and its by-key re-anchor logic** (`grid.ts` `snapshotAnchors`/reconcile at `:886`–`:942`, which today only ever re-anchors `-1`). Deleting rows clears their keys from the set (AR-12); the anchor key is cleared if its row is gone. **⚠️ Corrected at preflight (AR-17):** the base sets `selected` on every click (`grid-rows.ts:260`→`:330`), so the by-key re-anchor is **real** today, not a `-1` no-op; RD-08 drops only its **selection half** in favor of the stable key set (the focus half stays). | ✅ Resolved |
| AR-11 | Synthetic-prefix placement      | The checkbox + gutter prefix band renders at the **far left of the leftmost body** — the **left frozen panel** when `freeze*` is set, else the **single body** — so it never scrolls horizontally (AR-5). `buildGridBody` (`grid-panels.ts`) gains a fixed-width prefix segment prepended to that panel's header + body + any frozen-rows band, sharing the panel's row window. Grounds: RD-07 established `buildGridBody` owns band assembly and the left-pinned panel (`grid-panels.ts`). | ✅ Resolved |
| AR-12 | `insertRow` position + delete/selection | `insertRow(row, at?)`: `at` is an **index into the source array** (append when omitted); with an active **client** sort the inserted row **re-sorts to its value-determined position** on the next `display()` derive (the RD-08 AC-5 "display index 2" example assumes source order == display order — no active sort). `deleteRows(keys)` removes the rows via the seam **and clears those keys from `selectedKeys`** (RD-08 Must). A push-down source owns its own ordering. | ✅ Resolved |
| AR-13 | Selection paint precedence      | The fixed precedence **cursor > dirty > selected > cellStyle > zebra > normal** (RD-08 Must, shared with RD-04) is realized by extending the **existing** body role logic (`editable-grid-rows.ts:480`–`492` + the `rowOwns` cellStyle suppression at `:505`): `isSelectedRow` becomes a set-membership test and continues to feed `rowOwns` + `CellState.selected` (`:521`). No new precedence machinery. **⚠️ Corrected at preflight (AR-18):** `rowOwns` is at `:497` (not `:505`), and the membership test is swapped at **two** paint sites — `draw()` (`:480`) **and** `paintDirtyMarkers()` (`:581`). | ✅ Resolved |
| AR-14 | Verify command                  | `yarn verify` (from CLAUDE.md — `yarn lint` then `turbo run typecheck build test check:docs`). Fills every Verify line. Prettier is run separately (`yarn prettier --write` on touched files) before verify, per the repo convention. | ✅ Resolved |
| AR-15 | Null-policy field name (**authoring**, user-decided 2026-07-16) | RD-08 literally specifies `null?: { nullable; display? }`, but that collides visually with the existing `nulls?: 'first' \| 'last'` sort field (`column.ts:91`) — a one-character misread/typo footgun — and uses a reserved-word-ish key. **User chose: two flat fields `nullable?: boolean` + `nullDisplay?: string`** (default `nullDisplay` `''`), matching the existing flat-field style (`minWidth`/`maxWidth`/`nulls`). This is a plan-local divergence from the RD's literal shape; behavior is unchanged (nullable + a null-display string). Rejected: (b) grouped `nullPolicy?:{…}` (heavier), (c) RD-literal `null?:{…}` (collision + reserved key). Sorting of nulls stays governed by `nulls?`/`defaultCompare` — this field is render + edit only. | ✅ Resolved |

---

## C. Inherited from RD-08 (already user-decided at requirements time — cite, don't re-litigate)

| RD AR   | Decision                                                                                  |
| ------- | ----------------------------------------------------------------------------------------- |
| RD AR-3  | Selection is **row-oriented** (single + multi) for v1; cell/range is deferred (RD AR-29). |
| RD AR-15 | Row identity is a required `rowKey(row): string \| number`; selection keys off it.         |
| RD AR-16 | `onCommit` is the per-cell veto sink; inserted/duplicated rows' edits pass through it.      |
| RD AR-21 | Gesture set: `Space` toggle · `Ctrl`+click toggle · `Shift`+click / `Shift`+`↑`/`↓` range · checkbox-column click · header select-all. |
| RD AR-24 | The `selected` core theme role paints a selected row (added in RD-01's theme-role set).     |
| RD AR-25/26 | Custom callbacks run isolated; ALL rendered/pasted/imported text passes the core `sanitize` boundary, then the column validator on ingress. |
| RD AR-27 | The row-editor **form dialog** is Phase B (Should); the inline datasheet is the v1 primary. |
| RD AR-29 | Cell/range selection + range copy/paste/fill — **deferred** (Phase B).                      |
| RD AR-30 | Edit undo/redo — **deferred** (Phase B); v1 CRUD is not undoable.                           |

---

## D. Preflight decisions (2026-07-16, post-authoring audit)

Raised by the preflight audit (`00-preflight-report.md`) and user-decided. These correct code-grounding
errors and resolve two UX forks the first-pass plan left implicit.

| #     | Ambiguity / defect                                | Options                                                                 | ✅ Decision                                                                                                                                                                                                             | PF   |
| ----- | ------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AR-16 | The base `selected` contract                       | (a) **keep base `selected` + add `selectedKeys` + override `select()`** · (b) change `@jsvision/ui` to drop/loosen `selected` | **(a)** — `EditableGridRowsConfig extends GridRowsConfig`, whose `selected: Signal<number>` is **required** (`ui/…/grid-rows.ts:66`), reactively bound (`:143`), and written by the base on every click (`:260`→`:330`). It **cannot** be removed without a ui change (violates AR-1). Keep feeding the base a `selected` signal; paint from a new `selectedKeys` set alongside it; override `EditableGridRows.select()` to redirect a click into the key-set model. **(b) rejected** — breaks zero-ui-change. | PF-001 |
| AR-17 | Plain-click selection semantics (multi default)    | (a) **cursor only** · (b) click clears to just that row · (c) keep a separate single-index highlight | **(a)** — a plain (unmodified) click **moves the cursor only** and does not change `selectedKeys`; selection is driven by `Space`/`Ctrl`+click/`Shift`/the checkbox column. The `select()` override (AR-16) neutralizes the base's per-click single-index selection. Corrects the earlier "the `selected` index is never set to a real value" mischaracterization — it **is** set on every click today; RD-08 supersedes it. | PF-002 |
| AR-18 | Selection-paint change surface                     | (a) **migrate both draw sites** · (b) the single `draw()` line only | **(a)** — selection membership is read in **two** places: `EditableGridRows.draw()` (`:480`) **and** `paintDirtyMarkers()` (`:561`/`:581`, to composite the dirty `•` onto the correct row background). Both migrate to `selectedKeys.has(rowKey(row))`. Not a "two-line" change. | PF-003 |
| AR-19 | `Space` precedence on an editable cell             | (a) **edit on editable, select on read-only** · (b) Space always selects · (c) Space→checkbox only | **(a)** — `Space` keeps its begin-edit meaning on an **editable** focused cell (`tryBeginEdit`, `editable-grid-rows.ts:318`, unchanged); on a **read-only** focused cell it toggles the row's selection. AC-1 is reworded to this qualification; an ST covers Space on an editable cell. Preserves type-a-space-to-edit; selection is mainly checkbox/`Ctrl`/`Shift`-driven. | PF-004 |
| AR-20 | Null-commit hook location                          | single viable path (grounded)                                          | The empty→null lowering goes where the editor text is parsed: `editing.ts` `createEditController.commit()` (`:274`, `tcol.parse!(field())`) — **not** `commitCell` (the veto/persist sink) nor `editable-grid-rows.ts`. The typed column must expose `nullable` to that path. | PF-005 |
| AR-21 | Null render on a custom `render` column            | single viable path (grounded)                                         | `nullDisplay` is resolved in the engine accessor (`column.ts:171`), which a custom `render` column bypasses. So the default/accessor path shows `nullDisplay`; a column with a custom `render` **owns its own null handling** (it receives the raw `null`). Documented, not "a null value always shows nullDisplay". | PF-006 |

---

## Gate status

✅ **GATE PASSED** — all items Resolved. Section A confirmed by the user at the plan gate
(2026-07-16, two AskUserQuestion rounds — every recommendation accepted). Sections B/C are grounded
design decisions / inherited requirements decisions. Zero items deferred within this plan's scope
(the RD's own Phase-B/C forks stay deferred by RD AR-27/29/30).
