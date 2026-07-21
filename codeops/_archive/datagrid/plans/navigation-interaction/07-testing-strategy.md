# 07: Testing Strategy — Navigation & Interaction

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.8.0

Spec-first: the ST cases below derive from RD-10 acceptance + the AR decisions, never from imagined
implementation. A `*.spec.test.ts` is an immutable oracle. **Verify command: `yarn verify`** (AR-16).

Test files: `keymap.spec.test.ts` (§A), `body-dispatch.spec.test.ts` (§B), `navigation.spec.test.ts`
(§C), `double-click.spec.test.ts` (§D), plus impl tests per phase and the kitchen-sink/showcase smoke.

## §A — Keymap model (`keymap.spec.test.ts`)

| ST | Input | Expected | AR/AC |
|----|-------|----------|-------|
| ST-1 | `resolveGridAction` over each `DEFAULT_KEYMAP` chord (`left`,`down`,`ctrl+home`,`f2`,`f4`,`alt+down`,`shift+up`,…) | each yields its documented `GridAction` (table in 03-01) | AR-1 |
| ST-2 | `mergeKeymap({ 'ctrl+e': 'beginEdit' })`, resolve `ctrl+e` and `f2` | `ctrl+e`→`beginEdit` **and** `f2`→`beginEdit` (original survives) | AC-2 |
| ST-3 | `mergeKeymap({ 'f2': 'valueHelp' })`, resolve `f2` | `valueHelp` (caller wins on conflict) | AR-10 |
| ST-4 | `resolveGridAction('ctrl+j', merged)` (unmapped) | `undefined` — no throw | AC-2 |
| ST-5 | `mergeKeymap({ 'ctrl+e': 'frobnicate' as GridAction })` (unknown **action**) | entry skipped + `devWarn`; no throw; `ctrl+e`→`undefined` | AC-8, AR-10 |
| ST-5b | `mergeKeymap({ 'ktrl+e': 'beginEdit', 'ctrl+notakey': 'beginEdit' })` (malformed **chords**) | both entries skipped + `devWarn`; **no throw** (createKeymap would throw — mergeKeymap must catch); other defaults intact | AC-8, PF-002 |
| ST-6 | `Object.isFrozen(DEFAULT_KEYMAP)`; attempt mutation | frozen; the shared default is not mutated by a caller | AR-10 |

## §B — Body dispatch (`body-dispatch.spec.test.ts`)

Mount a headless grid; focus `grid.rows`; dispatch key events; assert cursor/edit/selection state.

| ST | Input | Expected | AR/AC |
|----|-------|----------|-------|
| ST-7 | `left`/`right`/`up`/`down`/`home`/`end`/`ctrl+home`/`ctrl+end`/`pageup`/`pagedown` | column/row cursor moves per the table (up/down/page delegate to base) | AC-1, AR-4 |
| ST-8 | `f2`, then (fresh) a printable, then `f4` — all on an editable cell | editor opens; printable opens+replaces; `f4` opens the value-help dropdown | AC-1 |
| ST-9 | `enter` on a **read-only** cell | base row-activate fires; **no** editor | AR-9 |
| ST-10 | `space` on a read-only cell; `shift+down` | `toggleSelect` toggles the row; range extends one row | AC-1 |
| ST-11 | `alt+down` on the focused column | `onOpenFilter` fires for that column | AR-15 |
| ST-12 | grid with `keymap: { 'ctrl+e': 'beginEdit' }`: dispatch `ctrl+e`, then `f2`, then `ctrl+j` | `ctrl+e` opens the editor; `f2` still opens it; `ctrl+j` ignored (no throw/effect) | AC-2 |
| ST-13 | **Regression:** no `keymap` option — a representative RD-02…09 gesture matrix (edit F2/Enter/printable, Space edit-vs-toggle, Shift+arrows range, Alt+Down filter, arrows/Home/End cursor) | key behavior byte-identical to pre-refactor (the single-body single-click column move of ST-20b is the one intended delta, out of scope here) | non-goal invariant |
| ST-13b | **Frozen-panel:** a two-panel grid; dispatch an edit/selection key while the **other** panel owns the global cursor (`localCol() < 0`) | the non-owning panel no-ops (no `onToggleRow`/`onRangeToRow` double-fire, no edit of its own column 0) | PF-006 |

## §C — Tab traversal (`navigation.spec.test.ts`)

| ST | Input | Expected | AR/AC |
|----|-------|----------|-------|
| ST-14 | `nextCellIndex` mid-row; at last column | `col+1`; wraps to `{col:0,row:row+1}` | AR-5 |
| ST-15 | `prevCellIndex` mid-row; at column 0 | `col−1`; wraps to `{col:cols−1,row:row−1}` | AR-5 |
| ST-16 | `nextCellIndex` at last cell of last row; `prevCellIndex` at `(0,0)`; empty grid | `'exit'` in all three | AR-6 |
| ST-17 | `grid.nextCell()` while editing: a committing edit; a vetoed edit | commit then advance one cell; vetoed → editor stays open, cursor does not advance | AR-7 |
| ST-18 | `gridKeymap.lookup({key:'tab'})` / `{key:'tab',shift:true}` | `'grid.nextCell'` / `'grid.prevCell'` | AR-2 |
| ST-19 | `installGridNavigation(loop,grid)`: emit `grid.nextCell` with the body focused; with no grid focused; with two grids (only one focused) | focused grid advances; else `loop.focusNext`; only the focused grid advances (no double focusNext) | AR-2, AR-6, AR-12 |
| ST-19b | `grid.nextCell` while a cell is being edited (commit succeeds): run the handler, then dispatch a `down` arrow | the editor closes, the cursor advances one cell, **and `grid.rows` holds focus** so the arrow moves the cursor (no dead grid after Tab-commit) | AR-7, PF-003 |

## §D — Mouse double-click & scroll (`double-click.spec.test.ts`)

Use `createEventLoop({ now })` with a controllable clock to drive `ev.clickCount`.

| ST | Input | Expected | AR/AC |
|----|-------|----------|-------|
| ST-20 | two mouse-downs on the same editable cell within 500 ms; a single down | double-click opens the editor on that cell; single click is cursor-only (no edit) | AC-3, AC-4 |
| ST-20b | single click on a cell in column C of a **single-body** grid | `focusedCol === C` and the row focuses (the click moves the column cursor to the clicked cell); no edit; then `F2` edits that same cell | AC-4, PF-001 |
| ST-21 | double-click on a **read-only** cell | base row-activate; **no** editor | AR-3 |
| ST-22 | two downs on the same cell >500 ms apart (advance the fake clock) | `clickCount` resets to 1 → no edit | AC-3 |
| ST-23 | `ctrl+end` on a grid taller than its viewport; click a partially-visible row | the focused row scrolls fully into view; the cursor cell is not painted off-screen | AC-6 |
| ST-24 | move the cursor to an off-screen column (center panel) | the panel scrolls to reveal it | AC-6 |

## §E — Security & showcase

| ST | Input | Expected | AR/AC |
|----|-------|----------|-------|
| ST-25 | unknown **or malformed** keymap chords/actions (integration level via a mounted grid); confirm no `eval`/dynamic dispatch in the router | ignored, no throw; actions routed via `switch` only | AC-8, AR-14, PF-002 |
| ST-26 | mount `navigation-interaction.story.ts` headlessly | renders; unique id; required metadata (kitchen-sink smoke) | AC-7 |
| ST-27 | datagrid-showcase `navigation-interaction/` cluster demos; placeholder-count oracle | demos render; RD-10 placeholder removed; count oracle re-based | AC-7 |

## Coverage map

- AC-1 → ST-7,8,10,11 · AC-2 → ST-2,3,4,5,12 · AC-3 → ST-20,21,22 · AC-4 → ST-20,20b (+ inherited RD-07/08 row focus) ·
  AC-5 → inherited (base wheel/scrollbar; AR-11) · AC-6 → ST-23,24 · AC-7 → ST-26,27 · AC-8 → ST-4,5,5b,25.
- Regression invariant → ST-13 · frozen-panel per-panel guard → ST-13b.
- Preflight fixes → PF-001 ST-20b · PF-002 ST-5b · PF-003 ST-19b · PF-006 ST-13b.
