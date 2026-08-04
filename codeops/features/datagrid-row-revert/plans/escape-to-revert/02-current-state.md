# Current State: Data Grid Escape-to-Revert

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The current Data Grid already implements the correct commit-then-trap half of the workflow. A
successful typed cell commit closes the editor and marks only the row key as touched. Every
row-changing keyboard, Enter, Tab-edge, and plain cross-row click path calls `RowGate.tryLeave()`;
failure refocuses the reported field and publishes the validation message. Editor Escape cancels an
editor that is still open.

The missing state is the accepted cell's earliest previous value. `markRowTouched(rowKey)` discards
that value, `RowGate` cannot identify a trapped session separately from a touched row, and the body
keymap has no Escape action. Therefore the grid can neither build an atomic rollback payload nor
restore the row after the editor closes.

### Relevant Files

| File | Current Purpose | Changes Needed |
|------|-----------------|----------------|
| `packages/datagrid/src/editing.ts` | Parses, validates, commits, cancels open editors | Report successful commit details after `commitCell` accepts |
| `packages/datagrid/src/grid.ts` | Owns touched keys, row gate, errors, version, body wiring | Own the session controller and rollback option; replace touched-only wiring |
| `packages/datagrid/src/validation.ts` | Message band and synchronous row-leave gate | Signal trapped/passed lifecycle without owning baselines |
| `packages/datagrid/src/editable-grid-rows.ts` | Resolves body keys and row-changing input | Route `revertRow` and block grid-owned races while reverting |
| `packages/datagrid/src/keymap.ts` | Public actions and default chord table | Add `revertRow` and plain `escape` |
| `packages/datagrid/src/commit.ts` | Public optimistic per-cell commit contract | Define row rollback payload/callback types |
| `packages/datagrid/src/column.ts` | Public typed column getter/setter contract | Document the synchronous, deterministic, non-throwing editable-setter precondition |
| `packages/datagrid/src/i18n/catalog.ts`, `locales.ts` | Package-owned English and official locales | Add trapped/pending/failure/unavailable messages |
| `tools/i18n-translation-reviews.json` | Digest-bound locale review evidence | Refresh every affected Data Grid catalog approval after translation review |
| `packages/datagrid/src/index.ts` | Public package barrel | Export the approved rollback types and document the action |
| `packages/datagrid/test/row-gate.spec.test.ts` | Immutable commit-then-trap oracle | Add or split focused row-revert specification coverage |
| `packages/examples/datagrid-showcase/stories/validation-lifecycle/row-gate.story.ts` | Living row-gate demonstration | Demonstrate hint, success, pending, and failure |
| `packages/docs-site/src/example-fixtures/data-grid/` | Shared Template1 Data Grid labs and probes | Make the validation scenario exercise real trapped-row recovery |
| `packages/docs-site/components/data-grid/validation-and-lifecycle.md` | Validation teaching page | Teach session lifetime and persistence requirements |
| `tools/jsvision-plugin-impact.json` | Source-to-skill impact mapping | Requires review of reported canonical skill references |

### Code Analysis

- `editing.ts:364-383` reads `previous`, awaits `commitCell`, then calls only
  `markRowTouched(rowKey)`. The grid-level layer receives neither the column id nor either value.
- `grid.ts:413-419` stores `Set<Key> touched`, with no row identity, change journal, trapped flag, or
  pending rollback token.
- `validation.ts:128-155` returns only an allow/block boolean. A pass clears touched state; a failure
  refocuses and reports a message but does not notify another controller that the row is now trapped.
- `keymap.ts:36-60` contains editor-scoped `cancel`, while `DEFAULT_KEYMAP` at `:121-139` has no Escape
  chord and the body dispatcher intentionally falls through for `cancel`.
- `commit.ts:87-117` establishes the package's optimistic timing: apply first, await trusted callbacks,
  compensate on veto. Row rollback must preserve that timing (AR-10).
- `data-source.ts:110-162` requires `fromReactiveRows` to return stable owned references. Restoring
  through the original column setters is therefore the compatible write-through path (AR-9).
- `grid.ts:1620-1651` reanchors sorting by stable key and lets filtering remove the focused row. Session
  invalidation must distinguish reorder from disappearance/replacement (AR-7).

## Gaps Identified

### Gap 1: No rollback baseline

**Current Behavior:** only a touched key survives a successful cell commit.

**Required Behavior:** R1–R2 require an earliest-value journal scoped to the current row visit.

**Fix Required:** add the session controller specified in [03-01](03-01-row-edit-sessions.md).

### Gap 2: No trapped-session signal

**Current Behavior:** a failed leave blocks navigation but does not persist a distinct trapped flag.

**Required Behavior:** R3–R4 allow body Escape only after a real failed leave.

**Fix Required:** extend row-gate dependencies with pass/trap notifications owned by the session
controller; keep validation stateless.

### Gap 3: Persistence cannot observe a coherent rollback

**Current Behavior:** only per-cell `beforeSave`/`onCommit` callbacks exist.

**Required Behavior:** R4–R6 require one atomic host decision and forbid local-only divergence.

**Fix Required:** implement the public contract and flow in
[03-02](03-02-rollback-transaction-and-input.md).

### Gap 4: Body Escape is undiscoverable and inert

**Current Behavior:** Escape is handled only by an open editor.

**Required Behavior:** R3, R10, and R11 require a remappable body action and localized feedback.

**Fix Required:** add the keymap action, body dispatch, and localized message composition in 03-02.

### Gap 5: Consumer surfaces teach only commit-then-trap

**Current Behavior:** the showcase says the value is saved and the cursor stays; the docs-site
validation lab proves cell/row/save gates but not Escape recovery.

**Required Behavior:** R12 and C11 require the complete recovery and persistence contract.

**Fix Required:** update the surfaces listed in
[03-03](03-03-documentation-and-distribution.md).

## Dependencies

### Internal Dependencies

- `GridColumn<T>` typed `value`/`set` accessors and `commitCell` optimistic semantics.
- `RowGate`, `ErrorRegistry`, dirty presentation, body keymap dispatch, and grid version repaint.
- Stable `GridDataSource.rowKey`, `fromReactiveRows`, and `masterDetail` identity contracts.
- `@jsvision/i18n` catalog validation, digest-bound review manifest, and official locale workflow.
- Shared docs-site Data Grid Template1 laboratory, probe contracts, and 80×24 harness.
- Canonical JSVision skill and generated plugin ownership enforced by `plugin:update`/`plugin:check`.

### External Dependencies

- No new runtime dependency is required.
- The host application supplies atomic persistence behind `onRevertRow` when persistence or policy
  callbacks are configured.
- Local verification is currently unavailable because this worktree has no installed dependencies;
  installation requires separate workflow authorization.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| External persistence accepts only some rollback cells | Medium | High | One frozen row-level callback; never replay cells (AR-5) |
| Late promise mutates a replacement row | Medium | High | Stable key + row identity + attempt token + disposal invalidation (AR-7, AR-10) |
| Callback veto leaves a mixed visible row | Medium | High | Optimistic batch plus compensation before clearing pending state (AR-10) |
| Setter violates its synchronous/non-throwing contract | Low | High | Document the precondition; contain failure and best-effort restore the attempted prefix (AR-10, AR-11) |
| Editor and body both process Escape | Low | Medium | Existing focus-chain editor precedence, then body action only while idle (AR-4) |
| Session history grows with navigation/source changes | Medium | Medium | Active-session/changed-column bounds and cleanup on every terminal path (AR-7, AR-12) |
| Localized hint clips or reorders caller text | Medium | Medium | One translated template with `${message}` placeholder; docs 80×24 assertions (AR-13) |
| Locale text changes leave stale review digests | High | High | Refresh review evidence and run `i18n:reviews:check` with the locale task (AR-13) |
| Public/generated/plugin surfaces drift | Medium | Medium | Source-impact review, `plugin:update`, generated API/docs gates, `plugin:check` (AR-13, AR-14) |
