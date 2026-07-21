# 07 — Testing Strategy

> **Parent**: [Index](00-index.md) · **CodeOps Skills Version**: 3.7.0

Specification-first: each ST-* below is written from the requirement/AR (never from imagined
implementation) and is locked as a `*.spec.test.ts` **before** the code exists. Impl tests
(`*.impl.test.ts`) cover edges. Verify command: **`yarn verify`** (AR-14).

> **IMMUTABLE ORACLE RULE:** do not modify an ST expectation to match the implementation — if the
> code disagrees, the code is wrong. The one sanctioned exception is the RD-15 showcase
> placeholder-count oracle, which changes because a requirement changed (RD-08 ships), exactly as it
> did when RD-07 shipped — see ST-23.

Test files: `selection.spec.test.ts` / `.impl.test.ts`, `grid-selection.spec.test.ts`,
`synthetic-columns.spec.test.ts`, `row-crud.spec.test.ts`, `null-policy.spec.test.ts`, additions to
`security.spec.test.ts`, plus the kitchen-sink + showcase smoke suites.

## Selection model — pure (Phase 1)

| ST | Input | Expected | Source |
| -- | ----- | -------- | ------ |
| ST-1 | `toggleKey({}, 'a', 'multi')` then `toggleKey({a}, 'a', 'multi')` | `{a}` then `{}` — add, then remove | RD-08 Must / AR-9 |
| ST-2 | `toggleKey({a}, 'b', 'single')` | `{b}` — single replaces (≤1 key) | AR-2 / AR-9 |
| ST-3 | `selectRange({}, 'a', 'c', ['a','b','c','d'], 'multi')` | `{a,b,c}` — contiguous, display order | RD AR-21 |
| ST-4 | `selectRange({}, 'c', 'a', ['a','b','c','d'], 'multi')` | `{a,b,c}` — order-independent (anchor after target) | RD AR-21 |
| ST-5 | `selectAll(['a','b','c'])` ; then `new Set()` (clear) | `{a,b,c}` ; `{}` | RD-08 Must / AR-7 |
| ST-6 | `triState({a,b}, ['a','b','c'])` / `triState({a,b,c}, [...])` / `triState({}, [...])` | `'some'` / `'all'` / `'none'` | RD-08 Must |
| ST-7 | `selectRange({}, 'a', 'c', [...], 'single')` ; `selectRange({}, 'x', 'b', ['a','b'], 'multi')` (stale anchor) | `{c}` (single collapses to target) ; `{b}` (stale anchor → just target) | AR-2 / AR-10 |

## Container selection — state, gestures, paint (Phase 2)

| ST | Setup / Gesture | Expected | Source |
| -- | --------------- | -------- | ------ |
| ST-8 | `Space` on a **read-only** focused cell (multi) then again ; same in `single` after selecting another | multi: key added then removed ; single: the new selection **replaces** the prior | **AC-1** / AR-19 |
| ST-8b | `Space` on an **editable** focused cell | begins the cell edit (`replaceWith: ' '`); `selectedKeys()` is **unchanged** (begin-edit precedence preserved) | AR-19 |
| ST-8c | a plain (unmodified) mouse click on a row | moves the cursor; `selectedKeys()` is **unchanged** (cursor-only click, `select()` override) | AR-17 |
| ST-9 | anchor on row 1, `Shift`+`↓` twice | `selectedKeys()` = the 3 contiguous keys in display order | **AC-2** |
| ST-10 | select keys {k1,k3}, then re-sort the grid | the **same keys** {k1,k3} stay selected (not the same indices) | **AC-2** / AR-10 |
| ST-11 | a selected (non-focused) row painted ; the focused row is also selected ; a dirty selected cell | selected row → `selected` role ; focused wins over selected ; dirty cell wins over selected (precedence cursor > dirty > selected > cellStyle > zebra > normal) | **AC-4** / AR-13 |
| ST-12 | `Ctrl`+click a row (multi) | the row is toggled into `selectedKeys()` and becomes the cursor row/anchor | RD AR-21 |

## Synthetic columns — checkbox + gutter (Phase 3)

| ST | Setup | Expected | Source |
| -- | ----- | -------- | ------ |
| ST-13 | `checkboxColumn: true` ; click a per-row box ; scroll body horizontally | per-row `[ ]`/`[x]` + tri-state header box ; the click toggles that row ; the box stays in the left-pinned region (does not H-scroll) | **AC-3** / AR-5 |
| ST-14 | `checkboxColumn: true` with an active filter ; click the header box | select-all selects only the **displayed (filtered)** rows ; the header tri-state reflects the display set | **AC-3** / AR-7 |
| ST-15 | `rowNumbers: true` ; then re-sort | gutter shows 1-based, right-aligned display numbers ; after sort they renumber 1..N by display order | **AC-7** / AR-5 |

## Row CRUD (Phase 4)

| ST | Action | Expected | Source |
| -- | ------ | -------- | ------ |
| ST-16 | `insertRow(row, 2)` on an unsorted in-memory grid | length grows by 1; the row appears at source index 2 (`display()` shows it there absent a sort) | **AC-5** / AR-12 |
| ST-17 | select {k}, then `deleteRows([k])` | the row is removed via the seam **and** `k` is no longer in `selectedKeys()` | **AC-5** / AR-12 |
| ST-18 | `duplicateRow(k)` with `assignKey` ; then without `assignKey` | with: an adjacent clone with the fresh key is inserted ; without: no-op + one `devWarn`, no key collision | **AC-5** / AR-4 |

## Null policy (Phase 5)

| ST | Setup | Expected | Source |
| -- | ----- | -------- | ------ |
| ST-19 | a `nullable` column whose value is `null`, `nullDisplay: '—'` | the cell renders `'—'` ; the model round-trips null vs `''` distinctly (a null is not `''`) | **AC-6** / AR-3/AR-15 |
| ST-20 | commit an empty editor value on a `nullable` column ; on a **non**-nullable text column | nullable → stores `null` (renders `nullDisplay`) ; non-nullable → stores `''` | AR-3 |

## Security (Phase 4 + Phase 6)

| ST | Input | Expected | Source |
| -- | ----- | -------- | ------ |
| ST-21 | a header/cell text with control chars, after `insertRow`/`duplicateRow`/select-all/reorder ; a read-only source (no `insert`/`remove`) asked to `insertRow`/`deleteRows` | rendered text stays `sanitize`d after any CRUD/selection change ; the read-only source is not mutated (no insert/delete happens outside `RowMutations`) | **AC-9** / AR-4/AR-9 |

## Story & showcase (Phase 6)

| ST | Artifact | Expected | Source |
| -- | -------- | -------- | ------ |
| ST-22 | `rows-selection.story.ts` kitchen-sink story (multi-select + checkbox column + a selection echo) | passes `kitchen-sink.smoke.spec.test.ts` — mounts headlessly, paints, unique id + metadata | **AC-8** |
| ST-23 | datagrid-showcase "Rows & selection" cluster replacing the RD-08 placeholder | passes the showcase smoke + walkthrough tiers ; the placeholder-count oracle re-bases to RD-09…14 (one fewer placeholder; +1 category cluster) | AR-8 |

## Test Categories

### Specification Tests (from ST-cases above) — written BEFORE implementation

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `selection.spec.test.ts` | ST-1…ST-7 | pure selection model |
| `grid-selection.spec.test.ts` | ST-8…ST-12 | container selection + gestures + paint |
| `synthetic-columns.spec.test.ts` | ST-13…ST-15 | checkbox + gutter |
| `row-crud.spec.test.ts` | ST-16…ST-18 | CRUD seam |
| `null-policy.spec.test.ts` | ST-19…ST-20 | null policy |
| `security.spec.test.ts` (additions) | ST-21 | security |
| kitchen-sink + showcase smoke | ST-22, ST-23 | story + showcase |

### Implementation Tests (edges, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `selection.impl.test.ts` | absent-key toggle single vs multi; anchor == target; whole-display range; empty-set triState | High |
| `grid-selection.impl.test.ts` | anchor defaulting; select→delete prunes the set; single-mode Ctrl/Shift collapse; selection spans frozen panels | High |
| `synthetic-columns.impl.test.ts` | prefix alignment header↔body↔frozen-rows band; prefix + frozen columns compose; `prefixWidth` 0 = byte-identical body | High |
| `row-crud.impl.test.ts` | insert under an active sort lands by value; delete of a non-selected key; read-only source no-ops | Med |
| `null-policy.impl.test.ts` | null renders `''` with no `nullDisplay`; non-null unaffected; numeric non-nullable empty commit rejects | Med |

## Test Data / harness

Selection/gesture specs mount an `EditableDataGrid` through `createEventLoop` + `loop.focusView(grid.rows)`
and dispatch synthetic key/mouse envelopes (1-based terminal coords; `ev.clickCount` on the envelope),
as the existing `grid-*.spec.test.ts` do. Pure-model specs call `selection.ts` functions directly. No
mocks beyond the synthetic event harness (real objects preferred).

## Verification per phase

Every phase ends with `yarn verify` (lint + typecheck + build + test + check:docs). Prettier is run on
touched files first. `check:docs` enforces `@example` on every new public export and bans plan/RD/AR
ids from shipped `src`.

## Verification Checklist
- [ ] All ST-* defined with concrete input/output pairs (done above)
- [ ] Every ST traces to a requirement / spec doc / AR
- [ ] Spec tests written + verified RED before implementation (per phase)
- [ ] All spec tests GREEN after implementation
- [ ] Impl tests for edges/internals
- [ ] No regressions in existing datagrid/examples tests
- [ ] `check:docs` green (no banned refs; `@example` present) — verify banned refs with a plain grep too
