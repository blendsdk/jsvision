# Testing Strategy: DSL Hardening

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core business logic (the builders) | 90% |
| Supporting modules | 80% |
| UI / glue | 60% |

- Test names state behavior: `should [expected] when [condition]`.
- The DSL is pure and headless, so most cases are direct unit assertions on `view.layout` and on the
  layout-pass result (`solve`), mirroring the existing `layout-dsl*` / `layout.*` suites — real
  objects, no mocks.

> **Test-file naming (PF-007).** New suites use the `dsl-*` prefix (the module is renamed to `dsl/`);
> the existing DSL suites keep their `layout-dsl*` names. Renaming the existing `layout-dsl*` files to
> a single `dsl-*` convention is an optional follow-up, deliberately out of scope here to avoid
> churning immutable oracles beyond the sanctioned packaging repath (PF-002).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from `01-requirements.md`, the `03-XX` specs, and `00-ambiguity-register.md`. Immutable
> oracle: if the implementation disagrees, the implementation is wrong. In-code traceability comments
> quote behavior in plain language — never an `ST-`/`AR-`/`requirements/` id (Documentation ban).

### Refactor (03-01)

| #      | Input / Scenario | Expected Output / Behavior | Source |
|--------|------------------|----------------------------|--------|
| ST-REF | Run the behavior suites (`layout-dsl*`, `layout-dsl-stack.*`, `view.*`) after the `dsl/` split | All pass **unchanged**; the public export names from `@jsvision/ui` are identical. NOTE: `layout-dsl.packaging.spec.test.ts` is **not** in the "unchanged" set — its two `readFileSync('.../dsl.ts')` assertions are repathed to `dsl/*.ts` in Phase-1 task 1.1.7 (a sanctioned oracle edit for the file move) | 03-01 / AR-8 |

### S1 — size.min (03-02)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `grow(v, 2, { min: 12 })` | `v.layout.size` === `{ kind:'fr', weight:2, min:12 }` | R1 / 03-02 / AR-2 |
| ST-2 | `grow(v, 2)` (no opts) | `v.layout.size` === `{ kind:'fr', weight:2 }` (no `min` key) — unchanged 2-arg behavior | R1 / AR-2 |
| ST-3 | `row({ grow: { weight:1, min:12 } }, a)` then solve in a 10-cell row | `a` resolves to width 12 (floored, not 10) | R1 / 03-02 / AR-2 |
| ST-4 | Two panes `grow(a,1,{min:12})`,`grow(b,1)` in a 30-cell row | `a` ≥ 12; total = 30 | R1 / AR-2 |
| ST-5 | `grow(v, 1, { min: -5 })` | forwarded; engine normalizes `min` to 0 (no throw, no double-clamp) | R1 / AR-2 |

### S7 — falsy children (03-02)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-6 | `col(false, fixed(a,1), undefined, grow(b), null)` **and** `stack(false, canvas, undefined, place(x,{…}), null)` | each yields a Group with exactly the two real children `[a, b]` / `[canvas, x]`, in order — falsy skipped in **both** `col`/`row` and `stack` | R7 / 03-02 / AR-7 |

### S2 / S4 — at() (03-03)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-7  | `at(v, 3, 4, 20, 2)` where `v.layout = { direction:'col' }` | `v.layout` === `{ direction:'col', position:'absolute', rect:{x:3,y:4,width:20,height:2} }` (direction **preserved** — merge) | R2 / 03-03 / AR-3 |
| ST-8  | `at(v, { x:3,y:4,width:20,height:2 })` | identical result to the positional ST-7 form | R2 / AR-3 |
| ST-9  | `col(fixed(a,1), grow(b), at(c, 0,0,10,10))` solved in 40×20 | `a`/`b` fill the column (flow); `c` is placed at its absolute rect and consumes **no** flow space (a+b span the full height) | R3 / 03-03 |
| ST-10 | `at(v, …)` returns | the same `v` instance (chainable) | R2 / AR-3 |

### S3 — cover/center (03-03)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-11 | `cover(v)` | `v.layout.position` === `'fill'`; prior props preserved; returns `v` | R4 / 03-03 / AR-4 |
| ST-12 | `center(v, 40, 12)` | `v.layout` has `position:'absolute'`, `rect:{x:0,y:0,width:40,height:12}`, and `v.centered === true` | R4 / 03-03 / AR-4 |

### S5 — offsets + dev-warn (03-04)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-13 | A stack layer `place(v, { v:'end', vOffset:1, height:2 })` in a 10-tall box | `v` resolves to `y = 10 - 2 - 1 = 7` | R6 / 03-04 / AR-6 |
| ST-14 | `place(v, { v:'end', vOffset:99, height:2 })` in a 10-tall box | clamped: `y` stays in `[0, 8]` (never overflows) | R6 / 03-04 / AR-6 |
| ST-15 | `place(v, { h:'center', width:4 })` used on a view **not** added to a `stack()` (dev env) | a `console.warn` fires (via `devWarn`, guidance); the same tag inside `stack()` does **not** warn | R5 / 03-04 / AR-5 |

### S1 proof — split-view (03-05)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-16 | Build a `SplitView` with `minSize: 12`; inspect a pane's resolved `layout.size`, and pass a pane pre-set with a non-size layout prop | `{ kind:'fr', weight, min: 12 }` (the `min` reached the pane via `grow`); the pane's pre-existing non-size prop **survives** `grow`'s merge (documents the additive-merge, not a replace) | R9 / 03-05 / AR-9 |
| ST-17 | The full existing `split.spec.test.ts` (drag-against-min, container-shrink-honors-min) | passes **unchanged** | R9 / 03-05 / AR-9 |

## Test Categories

### Specification Tests (from ST-cases above) — written BEFORE implementation

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/ui/test/dsl-sizing.spec.test.ts` | ST-1…ST-5 | flex sizing (S1) |
| `packages/ui/test/dsl-falsy.spec.test.ts` | ST-6 | falsy children in `col`/`row`/`stack` (S7) |
| `packages/ui/test/dsl-absolute.spec.test.ts` | ST-7…ST-12 | at/cover/center (S2/S4/S3) |
| `packages/ui/test/dsl-offsets.spec.test.ts` | ST-13…ST-15 | placement offsets + dev-warn (S5/S3) |
| `packages/ui/test/split.spec.test.ts` (existing) + `split.impl.test.ts` (add ST-16) | ST-16, ST-17 | split-view migration |
| existing `layout-dsl*` / `view.*` suites; `layout-dsl.packaging` repathed (task 1.1.7) | ST-REF | module split (03-01) |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/ui/test/dsl-hardening.impl.test.ts` | overload dispatch (`at` numeric vs rect), `Flex.grow` object-vs-number resolution, offset on a `'fill'` axis (ignored), `center`/`cover` merge over prior props | High |
| `packages/ui/test/dsl.packaging.impl.test.ts` (or extend the existing packaging spec) | `@jsvision/ui` exports exactly `+{at,cover,center}` and nothing else new | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| solve-through | dsl + layout pass | `col`/`row` trees built with the new builders solve to the same rects as the equivalent hand-set `.layout` (parity) |

## Test Data

### Fixtures Needed
- Small synthetic view trees (a `Group` with 2–3 `View` children) sized via the builders, solved with
  the layout pass at a fixed viewport — the pattern the existing `layout.sizing.spec.test.ts` uses.

### Mock Requirements
- None — real `View`/`Group`/layout pass (mock only true externals; there are none here).

## Verification Checklist
- [ ] All ST-* defined with concrete input/output pairs
- [ ] Every ST case traces to R#/03-doc/AR
- [ ] Spec tests written BEFORE implementation and verified RED
- [ ] All spec tests GREEN after implementation
- [ ] Impl tests for overload dispatch + packaging surface
- [ ] No regressions in existing `layout*`/`view*`/`split*` suites (packaging oracle repathed per 1.1.7)
- [ ] `check:deps` + `check:docs` green
