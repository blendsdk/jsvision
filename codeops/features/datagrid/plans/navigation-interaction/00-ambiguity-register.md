# Ambiguity Register: Navigation & Interaction

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-10
> **Gate status**: ✅ GATE PASSED
> **Last Updated**: 2026-07-17
> **CodeOps Skills Version**: 3.8.0

The Zero-Ambiguity Gate for the RD-10 plan. Every semantically-distinct decision is inventoried
here. Four load-bearing forks were decided by the user via an explicit AskUserQuestion round
(AR-1…AR-4); the residual behavior/design items are grounded single-viable defaults (AR-5…AR-16),
each recorded with its rationale and the alternative it rejects, surfaced to the user for veto.

> ⚠️ **SAME-SESSION AUTHORING** — this plan was authored in the same session that will review it at
> preflight. Consider a fresh session for `preflight navigation-interaction` for review independence.

## Legend

Status: ✅ Resolved · ⏳ Open · ❌ Deferred (not allowed at gate close)

## Register

| # | Category | Ambiguity | Options considered | Decision | Status |
|---|----------|-----------|--------------------|----------|--------|
| AR-1 | Architecture | How far does the "remappable keymap" go? | (A) full per-grid `GridAction` dispatch mirroring `ui/src/editor/keymap.ts`; (B) additive remap-only layer over the existing handlers; (C) minimal — ship the gaps, defer remappability | **(A)** — new `keymap.ts`: a `GridAction` union, a frozen+exported `DEFAULT_KEYMAP`, a merge-over-default `keymap` grid option, a pure `resolveGridAction` resolver; refactor the four hardcoded body handlers to route chord→action. **User-decided.** | ✅ |
| AR-2 | Architecture | How is `Tab`/`Shift-Tab` cell-traversal wired, given the loop keymap is `readonly`/construction-fixed and an unbound `Tab` is swallowed by `route()` before any view? | (A) app opt-in — the grid ships a `gridKeymap` fragment (`tab`→command) the app merges at `createEventLoop` + an `installGridNavigation(loop, grid)` helper that registers the command handlers; no framework change; (B) add a runtime keymap-extension seam to `@jsvision/ui` so the grid self-installs `Tab` | **(A)** — no core/ui change; the app consciously owns global `Tab` policy; the helper falls back to `loop.focusNext` when no grid is focused so global `Tab` is preserved. **User-decided.** | ✅ |
| AR-3 | Feasibility | How is double-click-to-edit implemented, now that `ev.clickCount` already exists (framework-synthesized, 500 ms, injectable clock)? | (A) reuse `ev.clickCount===2`; (B) build the RD's bespoke datagrid-local `(lastDownCell, lastDownAt)` tracker + injectable 400 ms threshold | **(A)** — reuse the framework stamp; double-click on an editable cell → `beginEdit`, read-only keeps base activate, single click stays cursor-only. **Consequence:** the threshold is the framework's 500 ms (injectable via the loop clock, `opts.now`), NOT a per-grid knob — the RD's configurable-400 ms option is dropped. **User-decided.** | ✅ |
| AR-4 | Scope | Does the keymap also cover the base-owned nav keys (`↑`/`↓`, `PgUp`/`PgDn`)? | (A) full coverage — `moveUp/moveDown/pageUp/pageDown` in `GridAction`+`DEFAULT_KEYMAP`, the grid intercepts before `super.onEvent` and delegates to the base's own helpers; (B) grid-owned actions only, base keys stay fixed/inherited | **(A)** — the whole nav table is remappable + documented in one place; the router delegates to the base's `protected` `focusBy`/`focusTo`/`viewportRows` (no re-implementation). **User-decided.** | ✅ |
| AR-5 | Edge case | `nextCell`/`prevCell` order at a row boundary. | wrap to the next/previous row; clamp (stay at the last/first column) | **Wrap** — `nextCell` past the last column → the first column of the next row; `prevCell` before the first column → the last column of the previous row. *Rejected clamp:* it makes `Tab` identical to `→` at a row end, so "nextCell" would be meaningless. Grounded default (surfaced for veto). | ✅ |
| AR-6 | Edge case | `Tab`/`Shift-Tab` at the grid's final/first cell. | contain (clamp inside the grid); exit (fall through to `focusNext`/`focusPrev`, moving to the next widget) | **Exit** — `nextCell` at the last cell of the last row returns `'exit'`, and `installGridNavigation` calls `loop.focusNext()`; `prevCell` at `(0,0)` → `focusPrev`. *Rejected contain:* trapping `Tab` inside an embedded grid is a focus-trap anti-pattern. Reuses the AR-2 `focusNext` fallback. Grounded default. | ✅ |
| AR-7 | Behavior | `Tab` while a cell editor is open. | commit-then-advance; ignore `Tab`; cancel-then-advance | **Commit-then-advance** — commit the open editor (await-close); if vetoed, stay in the cell (editor open, no move); else advance to `nextCell`. Consistent with `Enter`'s existing commit+`advanceRow`. Needs a new public `EditController.commitEdit(): Promise<boolean>` seam (Enter keeps advancing by row; Tab advances by cell). Grounded default. | ✅ |
| AR-8 | Architecture | Module layout (grid.ts is at 1206/1250 lines). | grow grid.ts; new modules | **New modules** — `keymap.ts` (the `GridAction` model + resolver + `DEFAULT_KEYMAP`) and `navigation.ts` (pure `nextCellIndex`/`prevCellIndex` cursor math + the `gridKeymap` fragment + `installGridNavigation`). The body-dispatch refactor lands in `editable-grid-rows.ts`; grid.ts gets only thin delegators (`keymap` pass-through, `nextCell`/`prevCell`/`isBodyFocused`). **The line-count guard is re-based `< 1250` → `< 1300`** (PF-004): the three new public `@example`-bearing delegators + the `keymap` option exceed the 43-line headroom at 1206, and the guard was itself re-based 1200→1250 in RD-09 on the same "legitimately new surface, never re-inlined logic" rationale. Mirrors the established RD-05…09 module pattern. | ✅ |
| AR-9 | Completeness | Type-to-edit (any printable begins an edit) — a keymap chord? | make it a chord; keep it a fallback | **Fallback** — printables can't be enumerated as chords, so after `resolveGridAction` returns `undefined` the router applies the existing printable-over-editable-cell → `beginEdit(replaceWith)` rule (unchanged from today). Not remappable; documented. | ✅ |
| AR-10 | Consistency | `keymap` option merge + validation semantics. | — | Caller map **merges over** the frozen `DEFAULT_KEYMAP` per-chord (caller wins on a conflict); the original default binding still fires unless its exact chord is overridden (AC-2). **Config-time validation:** a caller entry naming an unknown `GridAction` is `devWarn`-ed and skipped (never thrown); an unmapped/unknown chord at runtime resolves to `undefined` and falls through (AC-2). No explicit "unbind" in v1. | ✅ |
| AR-11 | Scope | Wheel "configured step" (AC-5) and scroll-into-view (AC-6). | add a `wheelStep` option; reuse the base | **Reuse the base** — the base wheel scrolls `focusBy(±3)`; AC-5's "configured step" is read as the default step, and a `wheelStep` knob is deferred to Phase B. Scroll-into-view (AC-6) is met via the base `updateTop`/`keepVisible` (rows) + the existing `autoScrollToCol` (columns); the plan adds a spec that asserts the guarantee, not new machinery. | ✅ |
| AR-12 | Edge case | `installGridNavigation` with multiple grids (e.g. master-detail). | one grid only; accept a grid or list | **Accept one grid or a list** — a single pair of command handlers picks the focused grid among those passed and advances it, else `focusNext`. Avoids the double-`focusNext` bug that per-grid handlers would cause. | ✅ |
| AR-13 | Scope creep | Should-Have / Phase-B items. | pull into v1; defer | **Defer (confirmed by the RD):** context menu, cell tooltips, global quick-search + match highlight, hotspot cells. **Out of scope:** `Delete`/`Insert` row-mutation keybindings — not in the `GridAction` union; the imperative `insertRow`/`deleteRows`/`duplicateRow` API already exists (RD-08). | ✅ |
| AR-14 | Security | Input-handling attack surface. | — | The `keymap` is validated at config time (unknown action ignored, never thrown — AC-8); actions are routed via a `switch`, never `eval`/dynamic dispatch; no data-exposure change (input handling only); rendered/echoed text keeps the inherited `ctx.text` sanitize boundary (RD-04). Tooltip sanitization is Phase B (deferred), so N/A here. | ✅ |
| AR-15 | Completeness | `GridAction` union vs the RD's proposed type. | verbatim; extend | **Extend** — add `openFilter` (the `Alt+Down` funnel opener) to `GridAction` so it is remappable + part of the one consolidated table. The RD's union predates RD-06's `Alt+Down` opener (the `filter-entry-point` follow-up, 2026-07-16). `commit`/`cancel` stay editor-host-scoped (the open editor owns `Enter`/`Esc`) and are documented, not body-resolved. | ✅ |
| AR-16 | Showcase / process | Story + showcase + verify command. | — | A `navigation-interaction` kitchen-sink story (keyboard + mouse + double-click + `Tab`, wired via `installGridNavigation`) + a datagrid-showcase `navigation-interaction/` cluster replacing the RD-10 placeholder (re-base the placeholder-count oracles). Verify command: **`yarn verify`** (from CLAUDE.md), confirmed. | ✅ |

## Gate confirmation

All rows Status = ✅ Resolved. AR-1…AR-4 carry the user's explicit AskUserQuestion decisions; AR-5…AR-16
are grounded single-viable defaults (rationale + rejected alternative recorded), surfaced to the user
for veto before execution. Zero items deferred. **✅ GATE PASSED.**

## Preflight resolutions (2026-07-17)

Amendments from `00-preflight-report.md` (iteration 1) — the user accepted all recommendations. These
refine, not overturn, the decisions above:

| PF | Amends | Decision |
|----|--------|----------|
| PF-001 | AR-4 mouse scope | AC-4's column half: a single click sets `focusedCol` in a **single-body** grid too (`mouseColumns: true` for the center/only body). An intended, ST-13-noted delta. |
| PF-002 | AR-10, AR-14 | `mergeKeymap` also guards **malformed chords** (per-entry `try/catch` compile; `devWarn`+skip, never throw — AC-8); the merged map is compiled to a core `Keymap` **once** (memoized), not per keystroke. |
| PF-003 | AR-2, AR-7 | Tab-commit closes the editor without an envelope and the loop does not auto-recover focus; `installGridNavigation` re-focuses `grid.rows` after a `'moved'` result. |
| PF-004 | AR-8 | Line-count guard re-based `< 1250` → `< 1300`; both guard tests join the Modified list. |
| PF-005 | AR-1 | The `Keymap` type renames to **`GridKeymap`** (avoids colliding with core/ui's exported `Keymap`). |
| PF-006 | AR-1, AR-4 | `runAction` preserves the `localCol() < 0` / `focused() < rowFloor` per-panel guards for edit/selection/value-help actions (frozen-panel correctness). |
| PF-007 | AR-5, AR-7 | `nextCell()`/`prevCell()` return `'moved'` on a vetoed commit (no advance) — documented in the JSDoc so the return is not read as "cursor advanced". |
