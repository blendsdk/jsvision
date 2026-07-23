# Preflight Report — Rows, Records & Selection (RD-08)

> **Artifact:** `codeops/features/datagrid/plans/rows-selection/` (implementation plan, 11 docs)
> **Scanned:** 2026-07-16 · branch `feat/editable-data-grid` @ `1bc9dc0b`
> **Skills Version:** 3.7.0
> **Status:** ✅ **PASSED** — all 8 findings resolved and applied to the plan (2026-07-16). Scan-time
> status was ❌ BLOCKED (1 CRITICAL + 3 MAJOR); see the Decisions table below for how each was cleared.

⚠️ **SAME-SESSION REVIEW.** The register (`00-ambiguity-register.md`) flags that this plan was
authored in the session that is now reviewing it. Extra rigor was applied: every code claim was
verified against the actual files, and the four high-stakes findings were independently re-derived
from raw code by a fresh-context challenger agent (all four confirmed). A future fresh-session
re-scan is still recommended for full independence.

---

## Codebase Context Summary

The plan targets `@jsvision/datagrid`, which layers on `@jsvision/ui`'s `GridRows`. Verified facts:

| Claim in plan | Verified? | Evidence |
| --- | --- | --- |
| grid.ts 945 · editable-grid-rows.ts 627 · grid-panels.ts 445 · data-source.ts 65 · column.ts 200 | ✅ | `wc -l` |
| `selected = signal(-1)` at grid.ts:233; injected at :357; display derive at :293; reconcile :880–:945 | ✅ | read |
| Body draw role at editable-grid-rows.ts:480; rowOwns :497; CellState.selected :521 | ✅ | read |
| data-source read-only; `nulls?` at column.ts:91; accessor at :171; defaultCompare :190 | ✅ | read |
| `devWarn` exists (grid.ts:39); `structuredClone` (Node global) | ✅ | read |
| **"`selected` is vestigial / never set to a real value"** | ❌ **FALSE** | base sets it on every plain click — `ui/.../grid-rows.ts:260 → :330` |
| **"selection paint is a two-line change"** | ❌ **incomplete** | 2nd site in `paintDirtyMarkers` — editable-grid-rows.ts:561/:581 |
| **"body config replaces `selected` with `selectedKeys`"** | ❌ **infeasible under AR-1** | `EditableGridRowsConfig extends GridRowsConfig`; `selected` is required (:66) and base-written |
| **null-commit hook at "editable-grid-rows.ts → commitCell"** | ⚠️ **wrong location** | parse→value lowering is `editing.ts:274` (`tcol.parse!`) |

The plan is otherwise well-structured, spec-first, correctly scoped to RD-08 Must-Have, and most of
its citations are accurate. The findings below cluster around one root misreading: **the role
`@jsvision/ui`'s base `GridRows` plays in the `selected` signal.**

---

## Findings

### 🔴 PF-001 [CRITICAL] — Removing/replacing the `selected` signal breaks the immutable base contract

**Where:** `99-execution-plan.md` tasks 2.2.1 ("**remove** the vestigial `selected = signal(-1)`")
and 2.2.2 ("body config takes `selectedKeys` … **replacing** `selected: Signal<number>`");
`03-02-container-selection.md` §Container state / §Gestures / §Paint; `00-index.md` Key Decisions.

**Problem (verified + independently confirmed):**
`EditableGridRowsConfig<T> extends GridRowsConfig<T>` (editable-grid-rows.ts:43), and the base
`GridRowsConfig` declares `selected: Signal<number>` as a **required** field (grid-rows.ts:66). The
datagrid calls `super(cfg)` (editable-grid-rows.ts:187); the base stores it (grid-rows.ts:122) and
**reactively binds it** (`this.bind(() => this.selected(), …)`, grid-rows.ts:143–146). It cannot be
removed or type-swapped without editing `@jsvision/ui` — which **AR-1's "zero-ui-change"** forbids.
Following tasks 2.2.1/2.2.2 literally yields a type error and a runtime crash in the base bind.

**Options:**
- **(a) Keep a base-facing `selected: Signal<number>` and add `selectedKeys` alongside (Recommended).**
  The datagrid continues to satisfy the base contract (feed `super` a `selected` signal), paints from
  the new `selectedKeys` set, and overrides `EditableGridRows.select()` (or intercepts the mouse-down)
  to route a plain click into the key-set model instead of the base's single index. Zero ui change
  preserved. Requires rewording 2.2.1/2.2.2 and adding a `select()`-override task.
- (b) Change `@jsvision/ui`'s `GridRowsConfig`/`GridRows` to make `selected` optional or a predicate.
  Rejected — violates AR-1 (the plan's headline constraint) and RD-08's zero-engine-change scope.

**Recommendation:** (a). Update the plan to state that the base `selected` signal survives as the
base's click sink; add an explicit `EditableGridRows.select()` override task; define what a plain
click does (see PF-002). **Confidence: high** (challenger confirmed the crash path at grid-rows.ts:143–146).

---

### 🟠 PF-002 [MAJOR] — "`selected` is vestigial / never set" is factually wrong; plain-click semantics are undefined under the new model

**Where:** `00-index.md` Overview; `02-current-state.md` §"the vestigial single-index selection" +
Gap 1; `00-ambiguity-register.md` AR-1/AR-10; `03-02` §Current Architecture.

**Problem:** The plan repeatedly asserts the `selected` index "is never set to a real value" and the
reconcile "only ever re-anchors `-1`." In reality the base `GridRows` calls `this.select(newItem)` on
**every plain mouse-down** (grid-rows.ts:260) → `this.selected.set(index)` (grid-rows.ts:330), and the
datagrid reaches this via `super.onEvent` (editable-grid-rows.ts:283) with **no `select()` override**.
So today a plain click DOES set a real selected index, paints `listSelected`, and the reconcile at
grid.ts:890/913/937/942 genuinely re-anchors it across sort/filter. Consequences the plan misses:
(1) there is existing click-to-select-highlight behavior; (2) dropping the reconcile's selection half
+ ignoring the base index silently removes it; (3) in **multi** mode (default) the base still fires
`select()` on every click — the plan's "plain click … in single mode also select" table row
(03-02) never accounts for the base firing unconditionally.

**Options:**
- **(a) Decide plain-click behavior explicitly and correct the "vestigial" language (Recommended).**
  Pick one: plain click clears the multi-selection to just that row (Excel-like), or plain click only
  moves the cursor and leaves the set untouched (checkbox/Space/Ctrl drive selection). Implement it in
  the `select()` override (PF-001a). Rewrite the "never set to a real value" passages to "the base sets
  a single index on click; RD-08 supersedes it with a key set."
- (b) Leave the language as-is. Rejected — a false premise in the current-state doc misleads the executor
  and hides a behavior regression.

**Recommendation:** (a), with plain-click = "move cursor only; selection is driven by Space/Ctrl/Shift/
checkbox" (cleanest with a multi-default datasheet), but this is a **user decision** — it changes UX.

---

### 🟠 PF-003 [MAJOR] — The "two-line" paint change omits the second selection site (`paintDirtyMarkers`)

**Where:** `02-current-state.md` §2 ("RD-08 changes exactly the two lines"); `03-02` §"Paint — the
two-line change"; task 2.2.2.

**Problem:** Besides `draw()` (editable-grid-rows.ts:480), `paintDirtyMarkers()` independently reads
`this.selected()` (editable-grid-rows.ts:561) and computes `item === selected` (editable-grid-rows.ts:581)
to recompute a dirty cell's background so the `•` marker composites onto the right colour. If task 2.2.1
removes/renames `selected`, this method fails to compile; if `selected` is kept but no longer reflects
selection, a dirty `•` on a **selected** row composites onto the wrong background. It already has the row
key in scope (`rk`, editable-grid-rows.ts:568), so the fix is `keys.has(rk)` — but the plan doesn't list it.

**Options:**
- **(a) Add `paintDirtyMarkers` to the paint-migration task and stop calling it "two lines" (Recommended).**
  Update task 2.2.2 to migrate both `draw()` and `paintDirtyMarkers()` to `selectedKeys.has(rowKey(row))`;
  add an impl-test asserting the dirty marker on a selected row keeps the correct background.
- (b) Ignore it. Rejected — compile break or a visible paint bug.

**Recommendation:** (a). **Confidence: high** (challenger confirmed the second site).

---

### 🟠 PF-004 [MAJOR] — `Space` selection gesture collides with the datagrid's own `Space`=begin-edit, not just the base activate

**Where:** `03-02` §Gestures "Space precedence" note (cites only base `grid-rows.ts:302` activate);
task 2.2.3; AC-1 (committed acceptance criterion).

**Problem:** The "Space precedence" note only addresses the base's `space→activate`. But on an
**editable** focused cell, the datagrid's own `tryBeginEdit` claims `space` first
(editable-grid-rows.ts:318–320: `beginEdit(ev, { replaceWith: ' ' })`) and returns before `super.onEvent`
(editable-grid-rows.ts:273–276) — so `space` currently **types a space to start editing**, and never
reaches the base activate. Making `Space` toggle row selection therefore either (1) breaks
type-a-space-to-edit on editable cells, or (2) toggles selection only on read-only cells — which
contradicts AC-1's universal "Space toggles the focused row." AC-1 is a committed criterion, so this
must be resolved before Phase 2.

**Options:**
- **(a) Define Space precedence on an editable cell (Recommended).** e.g. Space toggles **row selection**
  only when no editor is open and the cell is read-only OR a modifier distinguishes them; keep
  Space=begin-edit on an open/printable editable cell. Or bind row-select to a non-conflicting key and
  reserve the checkbox column + Ctrl+click for selection. Whatever is chosen, spell it out and add an ST
  covering Space on an editable cell.
- (b) Leave AC-1 as "Space toggles the focused row" unqualified. Rejected — it silently regresses
  type-to-edit or is untrue on editable cells.

**Recommendation:** (a) — this is a **UX decision** for the user. My default suggestion: selection is
driven by the checkbox column + Ctrl/Shift/click; `Space` keeps its begin-edit meaning on editable
cells and toggles selection only on read-only cells — and AC-1 is reworded accordingly.

---

### 🟡 PF-005 [MINOR] — Null-commit hook points at the wrong file/function

**Where:** `03-05` §Editing ("the edit/commit path (`editable-grid-rows.ts → commitCell`)"); task 5.2.2.

**Problem:** The empty→null lowering must happen where the editor text is parsed into a value:
`editing.ts` `createEditController.commit()` at `editing.ts:274` (`const value = tcol.parse!(field())`).
`commitCell` (commit.ts) is only the veto/persist sink and never parses; `editable-grid-rows.ts` doesn't
parse either. The executor following the plan literally will look in the wrong place. Also: the typed
column the controller sees must expose `nullable` for this branch.

**Recommendation:** Retarget task 5.2.2 / 03-05 to `editing.ts:274` (empty text on a `nullable` column →
`null`, bypass `parse`), and note that `nullable` must be threaded onto the typed column. Low risk, easy fix.

---

### 🟡 PF-006 [MINOR] — Null render vs a custom `render` column contradicts the stated behavior

**Where:** `03-05` §Rendering + §Integration ("a null value shows `nullDisplay`").

**Problem:** The nullDisplay is resolved in `toEngineColumn`'s `accessor` (column.ts:171), but a column
with a custom `render` never calls `accessor` — the body's render path (editable-grid-rows.ts:513–529)
passes `tcol.value(row)` (possibly `null`) straight to `render`. So on a `render` column a null does
**not** show `nullDisplay`; it reaches the render hook as `null`. The doc's blanket "a null value shows
nullDisplay" over-promises for render columns.

**Recommendation:** Reword to "on the default (accessor) path, a null shows `nullDisplay`; a column with a
custom `render` owns its own null handling," or add null handling to the render path. Uncommon combo → MINOR.

---

### 🔵 PF-007 [OBSERVATION] — Synthetic-prefix rendering mechanism is under-specified

**Where:** `03-03` §Rendering; `99` task 3.2.2. The prefix is a fixed-width, non-column, not-cursor-
navigable band drawn inside `EditableGridRows` (which is built entirely around `columns`/geometry:
`geom.starts`, `columnAtX`, `localCol`). How the band is painted (a sibling view vs a special segment in
the panel's `draw`) and how it stays out of the column cursor's hit-test isn't spelled out. Feasible at
plan altitude; worth a concrete seam note before Phase 3 to de-risk header↔body↔frozen-band alignment.

---

### 🔵 PF-008 [OBSERVATION] — `structuredClone` in `duplicateRow` can throw on non-cloneable rows

**Where:** `03-04` §Semantics. `structuredClone` throws on rows holding functions/class instances/other
non-structured-cloneable fields. Typical grid rows are plain data, but a caller could hold methods.
Consider a documented note ("rows must be structured-cloneable") or a try/catch → devWarn fallback.

---

## Dimension coverage

All 13 dimensions scanned. Clean: Scope Creep (10) — stays within RD-08 Must-Have; Consistency (12) —
terminology consistent, the `nullable`/`nullDisplay` divergence from the RD's literal `null?:{…}` is a
documented, justified plan-local decision (AR-15). Testability (7): ST cases are concrete, but the
surfaces behind PF-002/003/004 (plain-click effect, dirty-marker-on-selected background, Space on an
editable cell) are untested — folded into those findings. The remaining findings concentrate in
Dimension 13 (Codebase Alignment): Stale Assumptions (PF-002), Architecture Mismatch (PF-001),
Impact Blindness (PF-003/004), Phantom/Imprecise Reference (PF-005).

## Decisions collected (2026-07-16)

| Finding | Decision | Resulting plan change |
| --- | --- | --- |
| **PF-001** | Keep a base-facing `selected: Signal<number>` (satisfies the immutable base contract); add `selectedKeys` alongside; override `EditableGridRows.select()`. | Reword tasks 2.2.1/2.2.2: do **not** remove `selected`; add a `select()`-override task; paint from `selectedKeys`. |
| **PF-002** | **Plain click = cursor only.** `select()` override makes a plain click change nothing in the selection set; selection is driven by Space/Ctrl/Shift/checkbox. | Rewrite the "vestigial / never set" passages (02-current-state §1, AR-1/AR-10, index) to state the base sets a single index on click, which RD-08 supersedes with a key set and a `select()` override. Update the 03-02 "plain click" gesture row. The reconcile's selection-half is now genuinely moot → removed. |
| **PF-003** | Migrate `paintDirtyMarkers` too. | Task 2.2.2 migrates **both** `draw()` and `paintDirtyMarkers()` (`:581`) to `selectedKeys.has(rk)`; add an impl-test for the dirty marker on a selected row. Stop calling it "two lines." |
| **PF-004** | **Edit on editable, select on read-only.** `tryBeginEdit` Space=begin-edit stays; Space toggles selection only on a read-only focused cell. | Reword AC-1 to qualify Space; add a Space→toggle branch on the read-only fall-through in task 2.2.3; add an ST for Space on an editable cell. |
| **PF-005** | Accepted. | Retarget task 5.2.2 / 03-05 to `editing.ts:274`; thread `nullable` onto the typed column. |
| **PF-006** | Accepted. | 03-05: reword to "default/accessor path shows `nullDisplay`; a custom `render` column owns its own null handling." |
| **PF-007** | Accepted (note). | 03-03: add a concrete synthetic-prefix draw/hit-test seam note before Phase 3. |
| **PF-008** | Accepted (note). | 03-04: note rows must be structured-cloneable, or wrap `structuredClone` in try/catch → devWarn. |

## Verdict

✅ **PASSED — all 8 findings resolved.** The agreed resolutions (Decisions table) were applied to the
plan docs on 2026-07-16 and a consistency re-scan is clean (no stale "vestigial / two-line / removed-
`selected`" language; `null?:{…}` → flat `nullable`/`nullDisplay`; commit hook → `editing.ts:274`; new
decisions recorded as AR-16…AR-21 with AR-1/AR-10/AR-13 annotated). Task count preserved at 50 (the
`select()` override was folded into tasks 2.2.1/2.2.2). The plan is cleared for `exec_plan`. Roadmap:
advance the `rows-selection` plan row to **Plan Preflighted (🔬)**.
