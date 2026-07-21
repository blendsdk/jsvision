# Testing Strategy: Personalization Dialog

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Pure logic (`variant.ts` helpers, `variant-store.ts`) | 90% |
| Grid delegators + dialog behaviour | 80% |
| Story / showcase glue | 60% |

- Test names state behaviour: `should [expected] when [condition]`.
- Datagrid tests import from `../src/...`; examples/showcase tests import `@jsvision/datagrid` by name
  (built dist — rebuild first).
- Headless dialog tests dispatch key/mouse events through the event loop (no TTY), the pattern used by the
  existing editing/navigation specs.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-16 (§Must/§Should/§Technical, AC#1…#15), the 03-XX specs, and the register.
> IMMUTABLE ORACLE: if the implementation disagrees with an ST case, the implementation is wrong. The
> `Source` column stays in this document — the in-code traceability comment quotes the behaviour in plain
> language, never an `ST-`/`AR-`/`RD-` id or a `codeops/` path.

### Component 1 — Grid layout API + width-restore (`03-01`)

| #    | Input / Scenario | Expected Output / Behaviour | Source |
|------|------------------|------------------------------|--------|
| ST-1 | `grid.columns()` on a 6-column grid (one hidden, one frozen-left, one width-overridden) | One entry per column in **full construction/display order (hidden included)**, each `{id,title,visible,frozen:'left'\|'right'\|'none',width}` correct | RD-16 AC#10 / 03-01 |
| ST-2 | Read `columns()` inside an effect, then hide/show/reorder/freeze/resize a column | The effect re-runs on each change (reactive) | RD-16 AC#10 |
| ST-3 | A grid constructed with more frozen columns than fit the viewport; read `columns()` | The over-pinned column reports `frozen:'none'` (the **resolved** partition, matching `grid.frozen()`) | PF-028 / 03-01 |
| ST-4 | `grid.defaultColumnLayout()` after hiding/reordering/freezing/resizing | Every column visible, **construction order**, `frozen:'none'`, `width` = declared/auto (no overrides) | RD-16 AC#6 / 03-01 |
| ST-5 | `setColumnWidth('a',20)` then `clearColumnWidth('a')`; then `clearColumnWidth('nope')` | `columnWidth('a')` returns to auto/declared; unknown id is a no-op (no throw) | RD-16 AC#5 / 03-01 |
| ST-6 | A variant naming column `x` **with** width 18 and column `y` **without** a width; `y` has a prior override 30; `applyVariant` | `x` → 18 (clamped); `y`'s override is **cleared** (delete-then-set) → `y` auto | PF-024 / RD-16 AC#6 |
| ST-7 | `setColumnWidth('n',30)` → `saveVariant('v')` → `clearColumnWidth('n')` → `saveVariant('v2')` → `setColumnWidth('n',30)` → `applyVariant('v2')` | `columnWidth('n')` returns to auto (the latent RD-13 round-trip bug is fixed) | PF-024 (RD-13 regression) |
| ST-8 | `resolveVariant` on a variant with named-with-width, named-without-width, and an unnamed current column | `clearWidths` = the named-without-width ids; the unnamed column's override is left untouched | AR-3 / 03-01 |

### Component 2 — VariantStore (`03-02`)

| #    | Input / Scenario | Expected Output / Behaviour | Source |
|------|------------------|------------------------------|--------|
| ST-9 | `createMemoryVariantStore()`: `save(v)` then `save({...v})` (same name) | `list()` contains exactly one entry for that name (overwrite in place); a returned `list()` is not aliased to the store's array | RD-16 AR-47 / 03-02 |
| ST-10 | `setDefault('c')` → `getDefault()`; then `delete('c')` → `getDefault()` | `'c'`, then `undefined` (deleting the default clears it) | PF-026 / RD-16 AC#9 |
| ST-11 | A fresh store; `getDefault()`; `delete('absent')` | `undefined`; delete is a silent no-op | 03-02 |

### Component 3 — Dialog column region + helper (`03-03`)

| #    | Input / Scenario | Expected Output / Behaviour | Source |
|------|------------------|------------------------------|--------|
| ST-12 | `personalizeGrid(grid,{store,host})`; press **OK** vs **Cancel/Esc** | OK → `{ok:true}` and the pending layout is applied; Cancel/Esc → `{ok:false}` and `grid.columns()` is **byte-identical** to before the call | RD-16 AC#1 / AR-43 |
| ST-13 | Hide a column + OK; reopen, show it + OK | Removed from `columnOrder()`, present in `columns()` `visible:false`; re-show restores it to `columnOrder()` | RD-16 AC#2 |
| ST-14 | Hide columns until one remains; attempt to hide the last | The last visible column's toggle is disabled; a zero-visible layout is never committed | PF-027 / RD-16 AC#2 |
| ST-15 | Move a column up/down N times + OK; a top column up, a bottom column down | `columnOrder()` equals the reordered sequence; top does not move up, bottom does not move down | RD-16 AC#3 |
| ST-16 | Set a column freeze to `left` (then `right`, then `none`) + OK | Appears in `frozen().left` (then `.right`); `none` removes it from both | RD-16 AC#4 |
| ST-17 | Width `1` on `minWidth:4` + OK; `999` on `maxWidth:40` + OK; clear the field + OK | `4` (clamped up); `40` (clamped down); override removed via `clearColumnWidth` → auto width | RD-16 AC#5 |
| ST-18 | **Reset** + OK, with a pre-Reset width override and an active sort/filter | All visible, construction order, `frozen()` empty, **no width overrides** (the override is cleared); `sort()`/`filterModel()` **unchanged** by Reset | RD-16 AC#6 / PF-024/PF-025 |
| ST-19 | Keyboard only: `Tab`/`Shift+Tab`, `↑`/`↓`, `Space`, `Alt+↑`/`Alt+↓`, `Enter`, `Esc` (dispatched) | Controls cycle; list selection moves; Space toggles visibility; Alt+arrows reorder; Enter = OK; Esc = Cancel — no mouse needed | RD-16 AC#11 / AR-57 |
| ST-20 | Variant name `"a\x1bb"`; type past 64 chars | Renders sanitized (no raw ESC/BEL in the frame) and stores sanitized; the field is hard-capped at 64 (truncated at entry) | RD-16 AC#12 / AR-56 |

### Component 4 — Variants panel (`03-03`)

| #    | Input / Scenario | Expected Output / Behaviour | Source |
|------|------------------|------------------------------|--------|
| ST-21 | Save-as `"mine"` (no variant applied) | `store.list()` contains one whose `name==='mine'` and whose `columns`/`freeze`/`sort`/`filter` reflect the **pending** layout (equal to the grid at open) | RD-16 AC#7 / AR-55 |
| ST-22 | Save-as a blank name; then a name already in the store, declining the prompt | Blank → nothing written; collision → confirm-overwrite, declining leaves the store unchanged | RD-16 AC#7 / AR-49 |
| ST-23 | Apply a saved variant; OK; a variant naming an absent column | The column list re-renders to the variant; OK makes `columnOrder()`/`frozen()`/`sort()`/`filterModel()` reproduce it; the unknown id is skipped without throwing | RD-16 AC#8 |
| ST-24 | Apply a variant carrying a sort+filter, OK; vs OK with **no** variant applied | Applied → the variant's sort/filter are restaged on OK; not applied → `sort()`/`filterModel()` unchanged | PF-025 |
| ST-25 | Delete the selected variant (confirm); delete the default; mark a variant default | Removed from `list()`; deleting the default clears `getDefault()`; `setDefault` → `getDefault()` returns the name and the **grid layout does not change** (no auto-apply) | RD-16 AC#9 / AR-50 / PF-026 |

### Component 5 — Security + story/showcase (`03-04`)

| #    | Input / Scenario | Expected Output / Behaviour | Source |
|------|------------------|------------------------------|--------|
| ST-26 | Security sweep | Name sanitize + 64-cap + empty-reject; width digit-filter + clamp; unknown-column-id skip on apply; **no new core theme roles** (role count unchanged) | RD-16 AC#14 |
| ST-27 | The kitchen-sink story + the showcase demo mount headlessly | Both paint ≥1 non-blank cell (smoke gates); `check:deps` reports zero runtime dependencies | RD-16 AC#13 |

> **⚠️ AUTHORING RULE:** every expectation above derives from RD-16 / the 03-XX specs / the register —
> never from imagined implementation output.

## Test Categories

### Specification Tests (written BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/datagrid/test/variant.spec.test.ts` (extend) | ST-6, ST-7, ST-8 | width-restore + RD-13 regression |
| `packages/datagrid/test/personalize.spec.test.ts` | ST-1…ST-5, ST-12…ST-25 | grid read API + dialog |
| `packages/datagrid/test/variant-store.spec.test.ts` | ST-9…ST-11 | store |
| `packages/datagrid/test/security.spec.test.ts` (extend) | ST-20, ST-26 | security oracle |
| `packages/datagrid/test/kitchen-sink.smoke.spec.test.ts` (existing) | ST-27 (story half) | kitchen-sink gate |
| `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` (extend) | ST-27 (showcase half) | showcase gate |

### Implementation Tests (edge cases, internals — written AFTER)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/datagrid/test/variant.impl.test.ts` (extend) | `clearWidths` with all-named / none-named; width clamp edges | High |
| `packages/datagrid/test/personalize.impl.test.ts` | nested-confirm focus restore; freeze-cycle wraparound; count-echo; reorder boundary no-ops; body `fill` non-collapse | High |
| `packages/datagrid/test/variant-store.impl.test.ts` | seed defensive-copy; overwrite ordering; setDefault of an absent name | Med |
| three grid.ts line-guard tests | re-based `< 1680` → projected final | — |

### Integration / E2E
- Integration: `personalizeGrid` end-to-end against a real `EditableDataGrid` + `createMemoryVariantStore` (no mocks) — open → edit → OK → assert grid state (covered by ST-12…ST-25).
- E2E: none new (the dialog is exercised headlessly; the live-TTY showcase remains a manual tuning step, consistent with sibling plans).

## Test Data

### Fixtures
- A 6-column `EditableDataGrid` over `fromRows` with a mix of `minWidth`/`maxWidth`, one initially hidden, one frozen — reused across ST-1…ST-25.
- A `createMemoryVariantStore` seeded with two variants (one set as default) — ST-9…ST-11, ST-21…ST-25.
- A headless `ModalDialogHost` (an `Application` from `createApplication()` satisfies it) for the dialog specs.

### Mocks
- None. Real grid, real store, real event loop (mock only true externals — there are none).

## Verification Checklist
- [ ] All ST-1…ST-27 defined with concrete input/output pairs, each traced to an RD AC / 03-doc / AR
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red) per phase
- [ ] All spec tests pass after implementation (green)
- [ ] Impl tests written for edges/internals
- [ ] No regression in RD-01…15 (full `CI=1 yarn verify`)
- [ ] Coverage meets goals
