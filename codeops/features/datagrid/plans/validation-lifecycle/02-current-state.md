# Current State: Validation & Lifecycle

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Grounded in a full read of `packages/datagrid/src` + the relevant `@jsvision/ui` / `@jsvision/core`
seams. Every claim carries a `file:line`.

## Existing Implementation

### What exists (the seams RD-12 extends)

- **The per-cell commit pipeline** — `editing.ts:291-326` `commitValue()`: `raw = field()` →
  `nullable`-empty→`null` else `parse!(raw)` (`:301`) → **`PARSE_FAILED` → `return false`** (editor
  stays open, nothing written, `:304`) → snapshot `previous` (`:305`) → `dirty.add` (`:307`) →
  `commitCell({apply: tcol.set!, onCommit})` (`:308-316`) → `bumpVersion`/`dirty.delete` → on success
  close+idle (`:320-324`). Two entry paths build on it: `Enter` (`commit()`, `:328-335`,
  `advanceRow` + refocus) and `Tab` (`commitEdit()`, `:337-341`, commit-only, the RD-10 seam).
  Line 302-304 carries the explicit hook: *"Richer field validation layers on top of this later."*
- **The commit primitive** — `commit.ts:58-81` `commitCell()`: `apply(row, columnId, next)` (`:68`,
  the immediate write) → `await onCommit({rowKey, columnId, value, previous, row})` in a try/catch
  (a reject = veto, `:73-76`) → revert `apply(row, columnId, previous)` on veto (`:79`). The change
  shape `CellCommit<T,V>` is at `commit.ts:14-25`; `OnCommit<T>` at `:32`.
- **The keystroke filter (RD-03)** — `CellEditorSpec.validator?: Validator` at `cell-editor.ts:80`;
  numeric defaults `filter('0-9-')`/`filter('0-9.-')` at `:109-113`; applied to the `Input` at
  `:153`. The `@jsvision/ui` `Validator` (`controls/validators/types.ts:15-29`) carries **both**
  `isValidInput(s)` (live) and `isValid(s)` (completion) plus an optional `error` — but validates the
  **string**, single-field.
- **The dirty registry** — `editing.ts:53-102` `createDirtyRegistry()`: a `signal<ReadonlySet<string>>`
  publishing a **fresh** Set on `add`/`delete` so bound readers repaint; keyed by `cellKey` (the
  NUL-join at `:50`). Painted as a `•` overpaint via `paintDirtyMarkers` (`editable-grid-rows.ts:767`,
  in `gridDirty` fg `:782`). The container owns it (`grid.ts:274`) and threads it through `_bodyDeps`
  (`grid.ts:488`).
- **The cell paint precedence** — `editable-grid-rows.ts:650-651`:
  `cursor > dirty > selected-row > cellStyle > zebra > normal`; final overpaints `paintCursorCell`
  then `paintDirtyMarkers` at `:755-756`; `CellState.dirty` fed to a custom renderer at `:742`.
- **The footer widget row** — `GridFooter.widgets?: readonly View[]` (`grid-footer.ts:39`), threaded
  as `footerWidgets` (`grid.ts:494`) and rendered as a flow row at `grid-panels.ts:583-590`. The
  `@jsvision/ui` `Text(content | () => string, { severity: 'error'|'warning' })` (`controls/text.ts:110`,
  `:157`) is the reactive, severity-colored message widget (precedent: `value-list-popup.ts:144`).
- **Sanitize** — `@jsvision/core` `sanitize()` (`engine/safety/sanitize.ts:35`), auto-applied at the
  single draw boundary `draw-context.ts:108` — every drawn string is sanitized for free.
- **The theme grid roles** — `gridCursor`/`gridDirty`/`gridSelectedRow` in `core/engine/color/roles.ts:103-112`
  (derived), `theme.ts:221-236` (interface) + `:376-378` (defaultTheme literal), `presets.ts:122-124`
  (monochrome literal). `gridDirty` is deliberately **not** derived from `danger` (`roles.ts:105-108`).
- **Reactive convention** — controllers own bare `signal`s, never a `computed`; the memo lives in a
  view's `bind(...)` repaint. Examples: `GridSelection` (`grid-selection.ts:37`), `FooterController`
  (holds no reactive state, `grid-footer.ts:8-10`), the dirty registry.
- **`Spinner`** is available in `@jsvision/ui` (`src/index.ts:206`; `feedback/spinner.ts`,
  `feedback/run-spinner.ts:42`) — currently unused by datagrid.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `datagrid/src/column.ts` | typed column model | + `validate?: (value: V, row: T) => string \| null` field |
| `datagrid/src/commit.ts` | commit primitive | + optional `beforeSave?` gate in `commitCell` (post-apply, pre-`onCommit`) |
| `datagrid/src/editing.ts` | edit lifecycle / `commitValue` | wire `validate` (pre-apply) + `beforeSave` into the pipeline; `EditHost` gains `validate`/`beforeSave`/`errors` seams |
| `datagrid/src/error-registry.ts` | **new** | the invalid-cell registry (twin of dirty, with per-cell messages + active message) |
| `datagrid/src/validation.ts` | **new** | the row-gate evaluation (`validateRow` → block/refocus) + the message-band builder |
| `datagrid/src/editable-grid-rows.ts` | grid body | `gridInvalid` overpaint (twin of `paintDirtyMarkers`); row-leave interception hooks on row-changing actions |
| `datagrid/src/cell-draw.ts` | cell render context | + `CellState.invalid` |
| `datagrid/src/grid-lifecycle.ts` | **new** | `GridStatus` type + loading/empty/error view builders + the visible-region swap controller |
| `datagrid/src/grid.ts` | container | thin: new options (`validate` on columns, `validateRow`, `beforeSave`, `status`, `emptyText`) + delegators; owns the error registry + lifecycle controller |
| `datagrid/src/grid-panels.ts` | band assembly | thread the message band + let the lifecycle controller swap the body region |
| `datagrid/src/index.ts` | barrel | export new types/functions |
| `core/src/engine/color/{theme,roles,presets}.ts` | theme roles | + `gridInvalid` (AR-18) |
| `core/CHANGELOG.md` | core changelog | note the additive role |

## Gaps Identified

### Gap 1: No value-level per-cell validation

**Current:** the only per-cell gates are `parse → PARSE_FAILED` (`editing.ts:304`) and the string-only
editor `Validator` keystroke filter. `GridColumn` has no `validate`/`valid`/`required` field
(`column.ts:31-147`).
**Required:** a typed `validate(value, row) => string | null` that runs on the parsed value at commit,
blocks + marks the cell, and surfaces its message (RD-12 R1).
**Fix:** add the field (03-01); call it in `commitValue` before the apply (AR-8).

### Gap 2: No per-row cross-field gate and no row-leave trap

**Current:** commit is strictly per-cell; nothing observes "the cursor is leaving row X".
**Required:** `validateRow` on row-leave (when dirty), blocking the move + refocusing the reported
field (RD-12 R2; AC-2).
**Fix:** a row-leave interception layered over the row-changing actions (03-03).

### Gap 3: No BeforeSave veto

**Current:** only `onCommit` gates persistence.
**Required:** a `beforeSave` that decides *whether* to persist, above `onCommit` (RD-12 R3).
**Fix:** extend `commitCell` (03-01, AR-9).

### Gap 4: No error surfacing (marker + message)

**Current:** a `PARSE_FAILED`/vetoed commit silently keeps the editor open; there is no "invalid cell"
visual and no message area (grep for `message` in `src` finds only `devWarn`).
**Required:** an invalid-cell role marker + a message area; clearing the error clears the marker
(RD-12 R4).
**Fix:** the `gridInvalid` role + error registry + message band (03-02).

### Gap 5: No grid-level lifecycle state

**Current:** the source is synchronous; empty is a hardcoded `<empty>` placeholder
(`editable-grid-rows.ts:674-677`) with no hook; there is no loading/error concept.
**Required:** `loading`/`ready`/`empty`/`error` with a caller-configurable empty state and a working
`retry()` (RD-12 R5).
**Fix:** the `status` option + lifecycle controller + views (03-04).

## Dependencies

### Internal
- RD-02 (editing engine / `commitValue`), RD-03 (cell editors / keystroke `Validator`), RD-01
  (`onCommit`, `GridDataSource`), RD-04 (`sanitize` at draw), RD-06 (`filteredCount` for the empty
  distinction), RD-09 (the footer band the message area lives beside).

### External
- `@jsvision/ui`: `Text`, `Spinner`/`runSpinner`, `Button`, `signal`, `Group`, `Validator` (no ui
  change).
- `@jsvision/core`: `sanitize` (consumed); the `Theme` role set (the one **modified** dependency —
  the additive `gridInvalid` role, AR-18).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Row-leave trap traps the cursor unexpectedly (feels "stuck") | Med | High | AR-5: gate only dirty rows; AR-15: refocus a concrete field; spec ST covers an untouched invalid row leaving freely |
| `gridInvalid` core change breaks a theme role oracle | Med | Med | AR-18: enumerate the exact spots; Phase 1 runs the full core theme suite; count bump `71→72` is explicit |
| `grid.ts` crosses the `< 1300` guard | High (expected) | Low | AR-7: all logic in new modules; the added public surface (4 documented options + wiring) crosses 1299, so re-base `< 1300` → `< 1450` across all three guard tests with rationale — never by re-inlining (the plan's initial `< 1350` estimate proved low once every option carried its JSDoc; see AR-23) |
| Loading spinner needs a running clock in tests | Low | Low | AR-13: static first frame paints headless; animation is loop-timer-driven and optional |
| Message echoing malicious input | Low | High | AR-19: sanitized at draw (free); a security ST asserts a control-byte message renders clean |
| Changing `commitValue`/`commitCell` regresses RD-02…10 commit behavior | Med | High | Spec-first; the existing `editing.spec`/`parse-commit.spec` oracles stay green; additive ordering only |
