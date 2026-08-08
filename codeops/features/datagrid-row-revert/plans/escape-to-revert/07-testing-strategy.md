# Testing Strategy: Data Grid Escape-to-Revert

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Testing separates the user-visible oracle from controller bookkeeping. Specification tests drive
real `EditableDataGrid` instances and controllable host callbacks before implementation exists;
implementation tests then cover maps, tokens, registry transitions, and repaint ordering. The
concurrent/async lens requires late-completion and serialization cases. The compatibility lens
requires untouched grids, keymap fallthrough, public exports, locales, generated API, and plugin
artifacts to remain valid.

### Evidence Goals

Every acceptance criterion maps to at least one immutable specification case below. Implementation
tests cover internal state, failure containment, and repaint behavior that is not part of the public
oracle. The repository has no maintained feature-level coverage threshold, so this plan makes no
unverifiable percentage claim.

- Test names use `should [expected behavior] when [condition]`.
- Real grid, row, column, error, and dirty objects are preferred; only persistence and deferred time
  are controlled external seams.
- Specification expectations below are immutable. A mismatch is fixed in implementation, not by
  weakening these rows.

## 🚨 Specification Test Cases

### Session Eligibility and Baselines

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | Commit row 1 `start: 1→10`, attempt Down while `end=9`, then press body Escape | `start` returns to `1`, `end` stays `9`, active message becomes `null`, focus remains row 1, and the next Down focuses row 2 | R1–R4; C1; 03-01 § Row-Gate Integration |
| ST-2 | In one visit commit `start: 1→10` and `end: 9→8`, trap, then Escape | Both cells restore together to `{start: 1, end: 9}`; no intermediate mixed row is present after the event settles | R2, R4, R13; C2; AR-6, AR-9 |
| ST-3 | Commit one column `1→10→12` in the same session, trap, then Escape | The column restores to the earliest value `1`, not the intermediate value `10` | R2; C2; 03-01 § Controller Surface |
| ST-4 | Trap a committed row, open an editor with an uncommitted value, press Escape twice | First Escape closes the editor and retains committed row/session; second Escape restores the trapped committed session | R3; C3; AR-4 |
| ST-5 | Press Escape on an untouched row, a touched-but-never-trapped row, and a session after successful leave | Values, cursor, message, and callback count remain unchanged; the key remains unhandled by the revert action | R3; C4–C5; 03-02 § Keymap and Event Routing |
| ST-6 | Trap a row, correct it with a within-row commit, then press Escape; repeat but complete a successful row leave before Escape | First run restores the whole trapped session; second run retains corrected values because successful leave discarded the session | R1, R3; C5; AR-3 |
| ST-7 | Trap a session, sort rows and hide/reorder the changed column without replacing the row object, then Escape | The same stable-key row and column restore; no other row or column changes | R8; C9; 03-01 § Identity and Cleanup |
| ST-8A | Trap row object A, then replace it with object B using the same key before Escape and, separately, while rollback is pending | Object B remains unchanged; pending presentation owned by A is removed; no stale callback completion mutates B | R8; C9; AR-7 |
| ST-8B | Trap a row, then republish a new collection containing the same key and exact row object | The session remains eligible and Escape restores that original row; collection identity or source revision alone does not invalidate it | R8; C9; AR-7 |
| ST-8C | Replace A with same-key B through a custom non-reactive source while rollback is pending, so settlement is the first replacement observer; run accept and veto cases | Attempt-owned dirty/pending state is removed, one live-grid reconciliation reveals B, B's data/focus/session remain unchanged, and veto compensates only captured A | R6–R8; C7, C9; 03-01 § Identity and Cleanup |
| ST-9A | Delete the trapped row while rollback is pending and, separately, dispose the grid; then accept the callback | The captured original row remains at its restored baseline; a live grid idempotently removes attempt-owned presentation, while a disposed grid receives no registry, message, focus, session, or repaint work | R7–R8; C9; 03-01 § Identity and Cleanup |
| ST-9B | Delete the trapped row while rollback is pending and, separately, dispose the grid; then veto/reject the callback | The captured original row compensates to its committed pre-revert values; a live grid idempotently removes attempt-owned presentation, while no replacement data or disposed grid state is mutated | R6–R8; C7, C9; 03-01 § Identity and Cleanup |
| ST-9C | Externally move focus while rollback is pending but keep captured A displayed, then veto | A compensates, attempt-owned presentation detaches, exactly one repaint reveals A's committed values, and stale focus/session/failure feedback is not restored | R6–R9; C7, C9; 03-01 § Identity and Cleanup |

### Atomic Transaction, Input, and Feedback

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-10 | Use `validateRow` and `onRevertRow` without `beforeSave`/`onCommit`; trap two changed columns and start rollback | Callback runs once with matching `rowKey`, original row already holding both baselines, a frozen `cells` array in first-commit order, and frozen cells `{columnId, value: baseline, previous: pre-revert}` | R4; C6; 03-02 § Public Transaction Contract |
| ST-11 | Use `validateRow` with no `onRevertRow`, `beforeSave`, or `onCommit`; trap, then Escape | Rollback succeeds internally without a host callback and clears the session/message | R5; C1; 03-02 § Transaction Flow |
| ST-12 | Configure `onCommit` or `beforeSave` without `onRevertRow`, trap, then Escape | No cell changes, no dirty marker, session remains trapped, and active message is exactly `Row changes cannot be reverted` | R5, R10; C8; AR-8, AR-13 |
| ST-13 | Start rollback with a deferred callback and attempt Escape, edit, navigation, Tab, selection, filter/value-help, cross-row click, and row deletion before it resolves | Affected cells show pending/dirty state, message is exactly `Reverting row…`, callback count stays one, and every grid-owned competing action leaves data/focus/session unchanged | R7, R10; C7; 03-02 § Pending Input Guards |
| ST-14 | Deferred callback returns `false` | Every cell compensates to its committed pre-revert value, dirty state clears, focus/session remain trapped, and message is exactly `Could not revert row changes` | R6–R7; C7; AR-10, AR-13 |
| ST-15 | Callback throws synchronously and, separately, returns a rejected promise | Each case has the same observable result as ST-14 and exposes neither exception text nor stack data | R6; C7; AR-10, AR-11 |
| ST-16 | First rollback vetoes, then a second Escape callback accepts | Second attempt receives the same baseline/current transaction, succeeds, clears the session/message/dirty state, and the next navigation leaves | R6; C7; 03-01 § Controller Surface |
| ST-17 | Revert a trapped detail row backed by `fromReactiveRows` inside `masterDetail` | The restored values are visible through the owning rows signal and the detail grid after one settled repaint; master focus/link remains intact | R9; C9; AR-9 |
| ST-18 | Resolve plain Escape and a caller-defined alternate chord against merged keymaps | Default plain Escape resolves to `revertRow`; caller replacement of Escape wins; alternate chord resolves to `revertRow`; unrelated defaults remain unchanged | R11; C10; 03-02 § Keymap and Event Routing |
| ST-19 | Press default Escape with no eligible session inside a focus host that handles bubbled Escape | Grid revert returns unconsumed and the host receives Escape exactly as before | R3, R11; C4, C10; AR-12 |
| ST-20 | Use empty and read-only grids and press Escape | No exception, mutation, callback, dirty marker, message, or focus change occurs | R12; C4; AR-12 |

### Security, Localization, Documentation, and Distribution

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-21 | Trap with validation text containing terminal control bytes under English i18n | Rendered band contains sanitized caller text followed by ` · Esc reverts row changes`; raw control bytes are absent | R10; C11; AR-11, AR-13 |
| ST-22 | Validate every official Data Grid locale catalog | All four new keys exist, `datagrid.validation.row-trapped` declares exactly the `message` placeholder, and catalog construction passes | R10, R12; C11; 03-03 § Locales, Canonical Skill, and Plugin |
| ST-23 | Callback throws an error containing row values/secrets while a warning/log spy observes output | No row value, rollback payload, host error message, or stack is logged; only package-owned failure feedback is rendered | R6, R10; C7; AR-11 |
| ST-24 | Drive the standalone showcase: invalid commit → leave trap → Escape success → next navigation; then drive veto mode | Success restores values and releases navigation; veto retains values/session and shows retryable failure; instructions and feedback remain visible | R12; C11–C12; 03-03 § Standalone Data Grid Showcase |
| ST-25 | Drive the docs `data-grid/validation` contract through trap/revert success and failure actions | Probes report trapped, reverting/settled, restored values, released navigation, and retryable failure matching the real grid | R12; C11; 03-03 § Docs-Site Validation Laboratory |
| ST-26 | Render the validation lab at 80×24, restore from approved maximized startup, maximize again, and exercise feedback | Classic dialog surface remains correct; grid and messages use the available space without clipping; keyboard actions stay reachable and states have text cues | R10, R12, R14; C11–C12; AR-13 |
| ST-27A | Before implementation, add public type/snippet checks for the new source API; rerun them after Phase 1 implementation | `OnRevertRow`, `RowRevert`, `RowRevertCell`, `onRevertRow`, and `revertRow` fail as missing in the red run, then are importable and source-documented with the approved timing/vocabulary in the green run | R11–R12; C11; AR-14 |
| ST-27B | After public behavior is final, run generated API/reference checks before and after regeneration | Generated surfaces initially report the stale contract, then document the approved types, option, action, payload timing, and messages without obsolete wording | R11–R12; C11; AR-14 |
| ST-28 | Run source-impact generation and plugin validation after source/docs updates | Every reported canonical reference is reviewed, generated plugin content matches it, and `yarn plugin:check` reports no drift | R12; C11–C12; 03-03 § Locales, Canonical Skill, and Plugin |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|-----------|------------------|-----------|
| `packages/datagrid/test/row-revert.spec.test.ts` | ST-1–ST-7, ST-8A–ST-9C, ST-11, ST-16–ST-17, ST-20 | Session lifecycle and integration |
| `packages/datagrid/test/row-revert-transaction.spec.test.ts` | ST-10, ST-12–ST-15 | Atomic callback and async behavior |
| `packages/datagrid/test/keymap.spec.test.ts` | ST-18–ST-19 | Default/remapped input compatibility |
| `packages/datagrid/test/security.spec.test.ts` | ST-21, ST-23 | Sanitization and diagnostic privacy |
| `packages/datagrid/test/i18n.spec.test.ts` | ST-22 | Locale/placeholder completeness |
| `packages/examples/test/datagrid-showcase.walkthrough.spec.test.ts` | ST-24 | Standalone showcase workflow |
| `packages/docs-site/test/contracts/data-grid/interaction.ts` plus contract runner | ST-25 | Docs laboratory behavior |
| `packages/docs-site/test/data-grid-docs.resizable-dialog.spec.test.ts` | ST-26 | Template1 layout and Classic surface |
| Existing public API and plugin specification gates | ST-27A–ST-28 | Source and distribution integrity |

### Implementation Tests

| Test File | Description | Priority |
|-----------|-------------|----------|
| `packages/datagrid/test/row-revert.impl.test.ts` | Map/session bookkeeping, earliest values, identity, attempt tokens, cleanup | High |
| `packages/datagrid/test/row-revert-transaction.impl.test.ts` | Setter order, payload freezing, callback serialization, attempt-owned dirty/error/version transitions, apply-throw recovery, and secondary compensation failure | High |
| `packages/datagrid/test/keymap.impl.test.ts` | Merge/cache behavior including the additive action | Medium |
| Focused docs/showcase implementation tests | Probe wiring, translated layout, generated-reference ownership | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Trap-to-revert | editor + session + row gate + body + errors | Full keyboard recovery and subsequent leave |
| Atomic persistence | session + callback + dirty + version | Success, unavailable, veto, throw, rejection, retry |
| Reactive master-detail | source + setters + version + link | Same stable row state observed across owner/detail |
| Lifecycle invalidation | source/focus/mutations + attempt token | Sort/filter/delete/replace/key reuse/dispose safety |
| Consumer surfaces | showcase/docs/i18n/plugin | Real API behavior and synchronized teaching artifacts |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| 80×24 recovery | Start showcase, make row invalid, leave, read hint, Escape, navigate | Baseline restored and normal navigation resumes without clipping |
| Persistence retry | Trap, choose veto mode, Escape, observe failure, choose accept, Escape again | First attempt compensates; second restores and releases |
| Docs laboratory | Run contract actions across maximize/restore | Probes and visible text agree with the real grid in every layout |

## Test Data

### Fixtures Needed

- Two or more stable-key rows with numeric `start`/`end` columns and `end > start` validation.
- A row that receives repeated commits to one column and commits to multiple columns.
- Deferred callback controls for accept, false, synchronous throw, rejection, and late completion.
- Replacement row sharing a deleted key, a republished collection retaining exact row objects, and
  a reactive master/detail owned collection.
- Conforming setters, a setter that mutates its cell and then throws during optimistic apply, and a
  recovery setter that throws. The apply-failure oracle proves the failing cell is registered before
  invocation and included in reverse best-effort recovery.
- Validation/error strings containing ESC, BEL, and safe visible text.
- Complete official locale catalogs and deterministic 80×24 docs/showcase contexts.

### Mock Requirements

- Use spies only for the external persistence callback, warning/log sinks, and explicit deferred
  promise control.
- Do not mock the row session controller, grid, column setters, row gate, error/dirty registries,
  `fromReactiveRows`, or `masterDetail` in integration/specification tests.

## Verification Checklist

- [ ] All ST-1–ST-28 cases, including lettered ST-8/ST-9 lifecycle cases, have immutable
      specification coverage.
- [ ] Specification tests are written and observed failing before source implementation.
- [ ] Every ST case passes after implementation without changing its expected behavior.
- [ ] Implementation tests cover internal edges separately from specification files.
- [ ] Existing row-gate, editing, keymap, validation, master-detail, mutation, and security tests pass.
- [ ] Data Grid typecheck, unit tests, and JSDoc checks pass.
- [ ] Examples and docs-site focused tests/typechecks pass; `yarn docs:build` passes.
- [ ] Locale completeness and digest-bound review checks, `yarn plugin:update`,
      `yarn plugin:check`, and `yarn verify:local` pass.
- [ ] Manual 80×24 acceptance evidence is recorded.
