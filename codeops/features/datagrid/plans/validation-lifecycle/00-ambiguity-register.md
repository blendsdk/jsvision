# Ambiguity Register: Validation & Lifecycle

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Implements**: datagrid/RD-12
> **Status**: ✅ GATE PASSED
> **Last Updated**: 2026-07-17 19:21

The Zero-Ambiguity Gate for the RD-12 (Validation & Lifecycle) plan. Every semantically-weighted
decision is resolved with an explicit user decision (the six `AskUserQuestion` forks AR-1…AR-6) or a
code-grounded default confirmed against the actual source (AR-7…AR-21). No item is deferred.

RD-12 is preflighted (🔎), so the RD owns feature scope; this register records only the **plan-level
design decisions** the RD leaves open.

## Legend

Status: ✅ Resolved · ⏳ Open (none may remain for the gate to pass).

## Register

### User-decided forks (AskUserQuestion, 2026-07-17)

| # | Category | Question | Options | Decision | Status |
|---|----------|----------|---------|----------|--------|
| AR-1 | Design / API | How is per-cell commit-time validation declared on a column? (The keystroke filter `CellEditorSpec.validator` is unaffected — it stays the live per-keystroke gate.) | (a) new typed `validate(value,row)` predicate · (b) reuse ui `Validator` on the column · (c) both | **(a)** A new column field `validate?: (value: V, row: T) => string \| null` — runs on the **parsed typed value** at commit; the returned string is the surfaced message, `null` = valid. Typed, row-aware, message built in. | ✅ |
| AR-2 | Architecture | How does the grid learn it is loading / errored, given the source is synchronous today (RD-11 windowing not built)? | (a) caller reactive `status` input on the grid · (b) extend `GridDataSource` | **(a)** A grid option `status?: () => GridStatus` (reactive getter the caller drives). `empty` is auto-derived from the filtered count. Keeps the grid source-agnostic; RD-11's windowed source can feed it later without changing the contract. | ✅ |
| AR-3 | Design / API | What does the `beforeSave` veto receive, and when does it fire? | (a) per-cell `change` · (b) per-row on row-leave | **(a)** `beforeSave?(change: CellCommit) => boolean \| Promise<boolean>`, fired on each cell commit immediately before `onCommit` (mirrors `onCommit`; RD says it "layers above `onCommit`"). A veto reverts the cell and surfaces the reason. | ✅ |
| AR-4 | Design / theming | How is an invalid cell styled, distinct from the `gridDirty` `•` pending marker? | (a) new `gridInvalid` theme role · (b) reuse the existing `danger` alias | **(a)** A new grid-prefixed core role beside `gridCursor`/`gridDirty`/`gridSelectedRow`, composited into the cell precedence stack. Theme-tunable and consistent with the grid role family (`gridDirty` is deliberately not derived from `danger`). Accepts the known ~4-spot role addition + the `71→72` count bump. | ✅ |
| AR-5 | Behavior / UX | Does the per-row `validateRow` gate fire on **every** attempt to leave the current row, or only when the row has unsaved edits? | (a) only when the row was edited · (b) every row-leave | **(a)** `validateRow` runs on leave only when the leaving row has pending/edited (dirty) cells. Cursor movement across untouched rows is never trapped. Matches enterprise datasheets; avoids trapping the user on pre-existing-invalid seed data. | ✅ |
| AR-6 | Behavior / UX | How configurable is the empty state (shown when the filtered row count is 0)? | (a) one message + filter-aware built-in · (b) single fixed message · (c) full custom view builder | **(a)** A single `emptyText?: string` option (default e.g. `'No rows'`), plus a built-in distinct `'No matching rows'` when the zero count is caused by an active filter vs. a truly empty source. | ✅ |

### Code-grounded design defaults (confirmed against source)

| # | Category | Decision | Grounding | Status |
|---|----------|----------|-----------|--------|
| AR-7 | Placement | All new logic lands in **new modules** — `validation.ts` (per-cell `validate` call + `beforeSave` composition wiring + the row-gate evaluation/refocus), `error-registry.ts` (the invalid-cell registry), `grid-lifecycle.ts` (the `GridStatus` state + loading/empty/error views + swap). `grid.ts` gains only thin option-wiring + delegators. **The `< 1300` guard WILL be re-based** — grid.ts is at 1298 (real ceiling 1299) and the irreducible public surface this plan adds to the container (4 new documented grid options `validateRow`/`beforeSave`/`status`/`emptyText` + their mandatory JSDoc, the error-registry + lifecycle + row-gate construction/wiring) crosses it with certainty (the risk table rates this High). Re-base to **`< 1350`** with this rationale, updating **all three** guard tests in lockstep; never meet the guard by re-inlining logic that belongs in the new modules. | grid.ts 1298 (`toBeLessThan(1300)`); the three guards at `grid-selection.impl.test.ts:185`, `grid-footer.impl.test.ts:70`, `navigation.impl.test.ts:137`; the RD-08/09/10 extraction pattern | ✅ |
| AR-8 | Pipeline ordering | Per-cell commit pipeline (in `commitValue`): `raw = field()` → `parse` → **on `PARSE_FAILED` or a non-null `validate` message: mark the cell invalid, surface the message, keep the editor open, apply nothing** → else `commitCell(apply → beforeSave → onCommit)`; any post-apply veto reverts to `previous`. `validate` runs **before** the in-memory apply; `beforeSave`/`onCommit` are post-apply vetoes. | `editing.ts:291-326` (`commitValue`), `commit.ts:68-80`; RD AC-4 ordering | ✅ |
| AR-9 | Commit primitive | Extend `commitCell` (`commit.ts`) with an optional `beforeSave?` gate that runs **after** the optimistic `apply` and **before** `onCommit`, sharing the single revert-on-veto path. A `beforeSave` veto reverts and `onCommit` is never called. | `commit.ts:58-81` | ✅ |
| AR-10 | Error surfacing | A new `createErrorRegistry()` — the reactive twin of `createDirtyRegistry` (`editing.ts:77-102`) — keyed by `cellKey`, storing a message per invalid cell and exposing the current active message reactively. Distinct from the dirty registry (invalid = blocked/never-committed; dirty = commit in flight). | `editing.ts:53-102`; the `cellKey` NUL-join at `editing.ts:50` | ✅ |
| AR-11 | Message area | The active validation/veto message surfaces via a grid-owned reactive `Text(() => activeMessage, { severity })` rendered as a **dedicated one-line message band** in the footer region — present whether or not the caller configured footer aggregates/widgets (validation must surface with no footer). Sanitized for free at the draw boundary. | `grid-panels.ts:583-590` (footer widget row), ui `Text` `text.ts:110/157`, `sanitize` at `draw-context.ts:108` | ✅ |
| AR-12 | Lifecycle shape | `GridStatus = { kind: 'loading' } \| { kind: 'ready' } \| { kind: 'error'; message: string; retry?: () => void }`. Effective render: `loading` → spinner view; `error` → error panel (sanitized message + a `retry` Button when provided); `ready` → (filtered count 0 ? empty view : the grid). A lifecycle controller computes the effective state and swaps the visible region between the grid body+footer and a placeholder. | `data-source.ts` (synchronous); `Spinner` `ui/feedback/spinner.ts`; `filteredCount()` `grid.ts:714` | ✅ |
| AR-13 | Loading widget | Compose the `@jsvision/ui` `Spinner` + `runSpinner` for the loading placeholder (a caller/grid-owned `frame` signal advanced by the loop timer). Headless-safe: a static first frame paints without a running clock. | `ui/feedback/run-spinner.ts:42`, `Spinner` exported `ui/src/index.ts:206` | ✅ |
| AR-14 | Parse failure | A `PARSE_FAILED` commit now **additively** marks the cell invalid and surfaces a generic message (default `'Invalid value'`, or a column-provided message), while preserving the existing behavior (value unchanged, `onCommit` not reached, editor stays open). The existing parse spec asserts only those three facts, so the marker/message is a non-breaking addition. | `editing.ts:304`; `parse-commit.spec.test.ts:33,71-72` | ✅ |
| AR-15 | Row-leave trap | `validateRow` gates row-changing actions (row nav, `Enter`-advance, `Tab` row-edge exit, click on a different row) **only when the leaving row has dirty cells** (AR-5). On `!ok`: block the move, refocus the reported `field` (its cell) — or the first dirty/invalid cell when `field` is absent — and surface `message`. The gate logic lives in `validation.ts`; the body/grid/nav delegate to it at each row-leave point. | `editable-grid-rows.ts:401` (`runAction`), `grid.ts:1192` (`advanceCell`), `editing.ts:328-335` (`Enter` advance); RD AC-2 | ✅ |
| AR-16 | Row-gate signature | `validateRow?: (row: T) => { ok: boolean; message?: string; field?: string }` grid option (`field` = the `columnId` to refocus). | RD Must-Have (per-row cross-field gate) | ✅ |
| AR-17 | Paint precedence | Cell paint precedence becomes `cursor > gridInvalid > gridDirty > gridSelectedRow > cellStyle > zebra > normal` — invalid overpaints above the dirty `•`. | `editable-grid-rows.ts:650-651`, `paintDirtyMarkers:767` | ✅ |
| AR-18 | Core footprint | `gridInvalid` touches: `theme.ts` `Theme` interface + `defaultTheme` literal; `roles.ts` derived-role builder (covers every `createTheme` preset); the `monochromeTheme` literal in `presets.ts`; and the `severity-text-theme.spec.test.ts` role count `71 → 72`. Additive to published `@jsvision/core` → a CHANGELOG entry + lockstep (the first datagrid→core touch since RD-05). | `theme.ts:221-236/376-378`, `roles.ts:103-112`, `presets.ts:42/66-124`, `severity-text-theme.spec.test.ts:28-32` | ✅ |
| AR-19 | Security | Client validation is documented as **UX only**; server-side validation in the caller's `onCommit`/source is authoritative. Messages + echoed input are sanitized at draw; no persistence bypasses `onCommit`. A security `.spec` oracle asserts a control-byte message renders sanitized and that a vetoed commit never persists. | RD Security §; `sanitize` `draw-context.ts:108`; `security.spec.test.ts` pattern | ✅ |
| AR-20 | Tooling | Verify command is `yarn verify`. | CLAUDE.md → Commands | ✅ |
| AR-21 | Showcase | A kitchen-sink `datagrid` story (a rejected validator edit + a row-gate veto) plus a `datagrid-showcase` **validation & lifecycle** cluster (replacing the RD-12 placeholder; placeholder-count oracles re-based, a category added). Both smoke- and walkthrough-gated. | RD AC-7; the kitchen-sink gate (CLAUDE.md); RD-15 living-surface convention | ✅ |

### Runtime decisions (recorded during execution)

| # | Category | Decision | Grounding | Status |
|---|----------|----------|-----------|--------|
| AR-22 | Theming (runtime) | **The derived `gridInvalid` role is NOT seeded from `danger`.** Plan doc 03-02 point 3 originally derived `gridInvalid: { fg: c.background, bg: c.danger }` in `rolesFromAliases`. That violates a deliberate, immutable core invariant: a `danger`/`warning` seed override must move **only** `dangerText`/`warningText` and leak into no other role. So `gridInvalid` is pinned to a fixed deep-red band `{ fg: PALETTE.white, bg: PALETTE.red }` (identical to the hand-authored `defaultTheme` byte), exactly mirroring how `gridDirty` deliberately avoids `danger`. A theme may still override the role directly. | Two guarding oracles: `create-theme.spec.test.ts:180-191` + `accelerator-aliases.impl.test.ts:63-84`; the existing precedent + rationale in `roles.ts:104-108` (`gridDirty` "deliberately NOT derived from the `danger` alias"); the plan's own `02-current-state.md:45` note | ✅ |

## Gate statement

All 21 gate items are ✅ Resolved with an explicit user decision or a source-grounded default confirmed
against the actual code. Zero items deferred. **✅ GATE PASSED** — plan documents may be written.
AR-22 was added during execution (Phase 1) when a plan-prescribed derivation was found to conflict with
an immutable core oracle; it is resolved by the single code-consistent path and the plan doc corrected.
