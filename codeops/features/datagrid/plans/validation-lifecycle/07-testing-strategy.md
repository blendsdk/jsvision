# Testing Strategy: Validation & Lifecycle

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (commit pipeline, row gate, registries, lifecycle) | 90% |
| Glue (grid options, panel wiring, barrel) | 80% |
| Showcase / stories | 60% (smoke + walkthrough) |

Spec-first: every ST-case is a `.spec.test.ts` written and RED before the code exists; implementation
turns them GREEN; `.impl.test.ts` covers internals afterward. A `.spec.test.ts` is an immutable
oracle — a post-impl failure means the code is wrong.

Drive idioms (from `editing.spec.test.ts`): `key(k, mods)`; `tick()` = `new Promise(r => setTimeout(r,0))`
after each async commit; container mount via `new EditableDataGrid(...)` + `createEventLoop` +
`createRenderRoot`; `vi.fn<OnCommit<T>>`/`vi.fn<BeforeSave<T>>` spy sinks; assert the record + the
drawn buffer + `loop.getFocused()`.

## 🚨 Specification Test Cases

> Derived from RD-12 (AC-1…AC-8), the `03-*` specs, and the register (AR-1…AR-21). Expectations come
> from the spec, never from imagined implementation output. The `Source` ids below are plan-doc
> traceability only — the generated `.spec.test.ts` restates each behavior in **plain language**, never
> an `ST-`/`AR-`/`RD-` id or a `codeops/` path (the standards' Documentation ban).

### §A — Per-cell validation & commit pipeline (03-01)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-1 | Edit a cell whose column `validate` returns `'too big'`; press Enter | Record unchanged; editor stays open + focused; the cell is marked invalid; the message `'too big'` is active | RD AC-1 · AR-1/AR-8 |
| ST-2 | Edit a cell whose `validate` returns `null`; press Enter | Record updated; editor closes; no invalid marker | RD AC-1 · AR-1 |
| ST-3 | Commit with `beforeSave` returning `false`, `onCommit` a spy | Record reverted to `previous`; `onCommit` spy NOT called; a veto message surfaces | RD AC-3 · AR-3/AR-9 |
| ST-4 | Commit with `beforeSave` that rejects/throws | Treated as a veto (reverted), no crash; loop continues | AR-9 |
| ST-5 | `validate` ok + `beforeSave` returns `true` + `onCommit` returns `false` | Value applied then reverted to `previous` (post-apply veto); editor stays open | RD AC-4 · AR-8/AR-9 |
| ST-6 | Commit an unparseable value (`parse → PARSE_FAILED`) | Cell marked invalid + a generic message; editor stays open; `onCommit` not called; record unchanged | AR-14 |

### §B — Error surfacing (03-02)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-7 | After ST-1's failed commit, render | The cell's rect is painted in the `gridInvalid` role (bg band), above any dirty marker | RD AC-1 · AR-4/AR-17 |
| ST-8 | Correct the value to a valid one and re-commit | The `gridInvalid` marker clears AND the message clears | RD AC-1 · AR-10 |
| ST-9 | Two cells invalid in sequence, render | Both painted invalid; the message band (`Text`) shows the most-recent (active) message | RD R4 · AR-10/AR-11 |
| ST-10 | An invalid commit on a grid with **no** footer configured | The message band still renders the message | AR-11 |
| ST-24 | After ST-1's failed commit, press **Escape** to abandon the edit; render | The `gridInvalid` marker AND the message clear — the cell (whose stored value is the untouched, valid prior value) shows no stale invalid marker | RD AC-1 · AR-10 |
| ST-11 | `@jsvision/core` `defaultTheme` | `gridInvalid` is present; the total role count is **72**; `gridInvalid` encodes at every color depth without throwing | AR-18 |

### §C — Per-row gate & row-leave trap (03-03)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-12 | Edit a cell in a row, then Down-arrow, with `validateRow` returning `{ ok:false, message, field:'end' }` | The row does not change; the cursor lands on the `end` column of the same row; the message shows | RD AC-2 · AR-5/AR-15 |
| ST-13 | Correct the row so `validateRow` returns `{ ok:true }`, then Down-arrow | The cursor leaves to the next row; the message clears | RD AC-2 · AR-15 |
| ST-14 | Down-arrow off an **untouched** (not dirty) row whose `validateRow` would fail | The cursor leaves freely; no trap, no message | AR-5 |
| ST-15 | Edit a row (invalid), then press Enter | Enter does not advance; the cursor refocuses the `field`; the message shows | RD AC-2 · AR-15 |
| ST-16 | Edit a row (invalid), then click a cell in a different row | The click is blocked; focus returns to the offending field | AR-15 |

### §D — Lifecycle state (03-04)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-17 | `status: () => 'loading'`, render | The body region shows a spinner (rows hidden); the header stays visible | RD AC-5 · AR-12/AR-13 |
| ST-18 | `status: () => ({ kind:'error', message:'boom', retry: spy })`, render, then click Retry | The body shows `'boom'` + a Retry button; clicking calls the `retry` spy | RD AC-5 · AR-12 |
| ST-19 | `ready` with 0 rows: (a) no filter, `emptyText:'Nothing'`; (b) an active filter | (a) shows `'Nothing'`; (b) shows the built-in `'No matching rows'` | RD AC-5 · AR-6 |
| ST-20 | `ready` with rows, and separately a grid with **no** `status`/`emptyText` and 0 rows | With rows: the grid renders. No-config + 0 rows: the body still shows `<empty>` (no regression) | AR-2/AR-12 |

### §E — Security (03-05)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-21 | A `validate` returning a message containing ESC/BEL/C0 bytes; render | The message renders sanitized — the raw control bytes are absent from the buffer | RD AC-6/AC-8 · AR-19 |
| ST-22 | A veto (`beforeSave`/`onCommit` false) and an invalid (`validate`-failed) value | No persistence sink is called on a veto; the record is reverted; an invalid value is never applied | RD AC-8 · AR-19 |
| ST-23 | Static scan of the new modules | No `eval`/`Function`; the package-wide no-eval scan stays green | AR-19 |

> **⚠️ AUTHORING RULE:** expectations derive from the specs above, not from imagined implementation
> output. If an expectation cannot be determined from the spec, it is an ambiguity — resolve it in the
> register before writing the test.

## Test Categories

### Specification Tests (from ST-cases)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/datagrid/test/validation-pipeline.spec.test.ts` | ST-1…ST-6 | Commit pipeline |
| `packages/datagrid/test/error-surfacing.spec.test.ts` | ST-7…ST-10, ST-24 | Error registry + marker + band |
| `packages/core/test/severity-text-theme.spec.test.ts` (extend) + a `gridInvalid` assertion | ST-11 | Core `gridInvalid` role + count |
| `packages/datagrid/test/row-gate.spec.test.ts` | ST-12…ST-16 | Per-row gate + trap |
| `packages/datagrid/test/lifecycle.spec.test.ts` | ST-17…ST-20 | Lifecycle states |
| `packages/datagrid/test/security.spec.test.ts` (extend) | ST-21…ST-23 | Security posture |

### Implementation Tests

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `validation.impl.test.ts` | Row-gate field-fallback chain; within-row moves never gate; `validateRow` throw handled; multi-panel gates once | High |
| `error-registry.impl.test.ts` | `set`/`clear`/`active` last-writer-wins; `note` transient clear; `note(null)` falls back to the most-recent still-invalid keyed message (not blank); cancel clears the edited cell's entry; precedence `cursor>invalid>dirty` | High |
| `grid-lifecycle.impl.test.ts` | String-shorthand normalization; header visible across states; `status()` throw → ready; retry absent without `retry` | High |
| `commit.impl.test.ts` (extend) | `commitCell` beforeSave short-circuits onCommit; reject = veto | High |
| `grid-*.impl.test.ts` (line guards) | `grid.ts` under its guard (re-based only with the AR-7/AR-18 rationale) | High |

### Integration / E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| kitchen-sink smoke | story + grid | The `validation-lifecycle` story mounts, paints, unique id |
| showcase smoke | showcase shell | Each new demo renders; placeholder count re-based |
| showcase walkthrough | shell + loop | Every demo drives via `emitCommand` and stays green |

## Test Data

### Fixtures
- Small typed row sets (`{ id, qty, start, end }`-style) with a cross-field rule for the row gate; a
  currency/decimal column for the parse-failure + `validate` cases; a control-byte message for ST-21.
- A `status` signal fixture for the lifecycle states (`loading`/`error`/`ready`).

### Mocks
- `vi.fn` spies for `onCommit`/`beforeSave`/`retry` only. Everything else uses real objects (real
  loop, real render root, real grid) — no mocking of the grid internals.

## Verification Checklist
- [ ] Every ST-case has a concrete input→output pair traced to RD/AR/03-doc.
- [ ] Spec tests written and RED before implementation.
- [ ] All spec tests GREEN after implementation; impl tests added.
- [ ] Zero RD-01…11 regression (full datagrid + examples suites).
- [ ] Core theme suite green with count `72`; every role-enumeration oracle green.
- [ ] `yarn verify` green; `check-jsdoc` clean; no banned CodeOps IDs in `packages/*/src`.
