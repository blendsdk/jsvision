# Testing Strategy: Split Panes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The repo's four-tier strategy applies unchanged: `*.spec.test.ts` (immutable oracle) ·
`*.impl.test.ts` (internals/edges) · `*.packaging.spec.test.ts` (barrel/export surface) ·
`*.e2e.test.ts`. Tests live in each package's `test/` — never colocated with source.

| Code type | Target |
| --------- | ------ |
| `apportionMin` / `applySplitResize` (pure core logic) | 90% |
| `SplitView` / `Splitter` | 80% |
| Story / glue | 60% |

- Test names state behavior.
- **Naming convention (AR-22):** spec tests use the repo's `test('ST-N: <behavior>')` form (e.g.
  `kitchen-sink.smoke.spec.test.ts:66`). It is the **dominant** repo convention — 269 of 306 spec
  files — not a universal one; see the qualification rule below. The project CLAUDE.md scopes the
  ephemeral-ID ban to shipped source (`packages/*/src`) and explicitly exempts test files.
- 🚨 **Qualify the id in every file this plan extends (PF-006).** ST numbering is **per-plan**, and
  the files below already carry *other* plans' ST ids — so a bare `ST-8` in a shared file is
  ambiguous. Write `test('ST-8 (split-panes): …')` in any file that is not exclusively ours:
  - `layout.sizing.spec.test.ts` already numbers its own cases **ST-01 … ST-06**; this plan adds
    ST-8 and ST-9. A reader meeting a bare `ST-8` under `ST-06` would reasonably read it as the
    file's next case. It is not.
  - `theme-roles.spec.test.ts` already has two `ST-13` tests; we add ST-25.
  - `kitchen-sink.smoke.spec.test.ts` already has ST-13/16/17/24/35; we add ST-26.
  - `apportion.spec.test.ts` has **no** ST-prefixed tests at all (5 plain-named cases) — it is one
    of the 37 exceptions. Qualified ids keep the added block self-evidently a separate namespace
    rather than making the file look half-converted.
  - `split.spec.test.ts` / `split.packaging.spec.test.ts` are ours alone — bare `ST-N` there.
- **Extending an existing spec file is permitted; changing an existing expectation in one is not.**
  Several ST-cases land in `apportion.spec.test.ts` and `theme-roles.spec.test.ts` as *added* cases.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, the `03-XX` specs, and the Ambiguity Register.
> They define expected behavior BEFORE any implementation exists.
>
> **IMMUTABLE ORACLE RULE:** do NOT modify these expectations to match the implementation. If the
> implementation does not match, the implementation is wrong — not the test.

### Layout engine: minimum-size support (03-01)

Every expectation below was hand-computed from the algorithm in 03-01 §Implementation Details and
the existing `apportion` arithmetic (`apportion.ts:43-74`) — not from imagined behavior.

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `solveTrack(20, [{fixed,5}, {flex,1}, {flex,1}])` — no item carries a `min` | `[5, 8, 7]` — byte-identical to today; the **regression oracle** for the no-min fast path | R-Compat / AR-8 · `apportion.ts:93-97` |
| ST-2 | `solveTrack(20, [{flex,1,min:15}, {flex,1}])` | `[15, 5]` — the minimum binds; sums to exactly 20 | R4 / AR-8 · 03-01 §Example 1 |
| ST-3 | `solveTrack(10, [{flex,1,min:8}, {flex,1,min:8}])` — Σmin (16) > free (10), infeasible | `[5, 5]` — proportional squeeze; sums to exactly 10. **Never `[8, 8]`** (that would overflow the container and create wrong click targets) | R5 / AR-8 · 03-01 §Example 2 |
| ST-4 | `apportion(79, [37, 42])` — weights already sum to the total | `[37, 42]` returned verbatim (the identity property) | R3 / AR-6 · 02-current-state §Code Analysis |
| ST-5 | `solveTrack(30, [{flex,1,min:12}, {flex,1,min:12}, {flex,8}])` — two minimums bind at once | `[12, 12, 6]` — naive apportion gives `[3, 3, 24]`; both pin, the remainder goes to the unpinned item. Sums to exactly 30 | R4 / AR-8 · 03-01 §Algorithm |
| ST-6 | `solveTrack(5, [{flex,1,min:10}])` — a single minimum exceeding the whole track | `[5]` — squeezes to the track; sums to exactly 5, no overflow | R5 / AR-8 |
| ST-7 | `solveTrack(20, [{flex,1,min:0}, {flex,1}])` vs `solveTrack(20, [{flex,1}, {flex,1}])` | Both `[10, 10]` — `min:0` and `min:undefined` are equivalent and both take the fast path | AR-8 |
| ST-8 | `normalizeSize({kind:'fr', weight:1, min:-5})` | `{kind:'fr', weight:1, min:0}` — negative minimums floor to 0 | R11 / AR-16 · 03-01 §Integration |
| ST-9 | A container sized `auto` whose only flow child is `{kind:'fr', weight:1, min:20}` | Its main axis measures **20** (today an `fr` child contributes 0) | AR-8 · 03-01 §measure rationale |

### Theme roles (03-02)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-25 | `defaultTheme`, `monochromeTheme`, every `createTheme`-generated preset, and the derived `CANONICAL_ROLES` | All contain both `splitter` and `splitterDragging`, each a valid `ThemeRole` (defined `fg` + `bg`) | R10 / AR-15 · 03-02 |

### SplitView (03-03)

Geometry expectations are hand-computed from `solveTrack` + `apportion`; each splitter occupies
exactly 1 cell on the main axis.

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-10 | A `row` `SplitView`, 2 children, `sizes: signal([1,1])`, mounted 21 × 5 | 1 splitter; free = 20 → panes `width 10` at `x=0` and `width 10` at `x=11`; splitter `x=10, width 1, height 5` | R1 / AR-1, AR-5 |
| ST-11 | A `row` `SplitView`, 3 children, `sizes: signal([1,1,1])`, mounted 22 × 5 | 2 splitters; free = 20 → panes `7, 7, 6`; splitters at `x=7` and `x=15`; the row fills exactly 22 | R1 / AR-1 |
| ST-12 | `applySplitResize([10,10], 0, +3, [0,0])` | `[13, 7]` — only the two adjacent panes move; their sum is conserved | R2 / AR-5 |
| ST-13 | `applySplitResize([10,10], 0, +8, [5,5])` | `[15, 5]` — clamped: the right pane stops at its minimum of 5 | R4 / AR-8 |
| ST-14 | `applySplitResize([37,42], 0, +1, [0,0])`, then re-solved by `apportion(79, result)` | `[38, 41]` from the helper, and `apportion` returns `[38, 41]` verbatim — the divider moved **exactly 1 cell** | R3 / AR-6 |
| ST-15 | A focused splitter in a `row` split receives `{type:'key', key:'right'}`, then `{key:'left'}` | The left pane grows by 1 cell, then shrinks by 1 — same clamps as the drag | R8 / AR-3 |
| ST-16 | A `Splitter` instance | `focusable === true` — it takes a tab stop | R9 / AR-12 |
| ST-17 | Mouse-down on a splitter, then `hasCapture(splitView)` returns `false` mid-drag | Capture is requested on the **`SplitView`**, not the splitter; when capture is lost the gesture is abandoned — `dragging` returns to `false` and no further resize occurs | R15 / AR-5, AR-13 |
| ST-18 | A `SplitView` with exactly 1 child, mounted 20 × 5 | 0 splitters; the child fills 20 × 5. Legal, not an error | R11 / AR-16 |
| ST-19 | `sizes: signal([1])` with 2 children; and `sizes: signal([1,1,1])` with 2 children | Padded to `[1,1]`; truncated to `[1,1]` — never throws | R11 / AR-16 |
| ST-20 | A `row` `SplitView` whose 2nd child is a `col` `SplitView`, mounted 40 × 10 | A grid: the inner split's panes are laid out inside the outer 2nd pane's rect, by composition alone | R6 / AR-17 |
| ST-21 | A `row` split's splitter (1 × 5) vs a `col` split's splitter (5 × 1) | `row` → `│` in every cell of the column with `▓` at `y = 2`; `col` → `─` in every cell of the row with `▓` at `x = 2` | R10 / AR-14 |
| ST-22 | A splitter at rest, then during a drag | Painted with the `splitter` role, then with `splitterDragging` | R10 / AR-15 |
| ST-23 | A drag and a keyboard resize on a split with `onResize` + `onResizeEnd` callbacks | Both paths deliver the new cell array to `onResize`, and `sizes` holds the same array. Call *counts* are ST-31's job | R7 / AR-9 |
| ST-24 | `minSize: 12` (scalar) on a 3-pane split; and `minSize: [5, 20]` on a 2-pane split | Scalar applies 12 to every pane; the array applies 5 and 20 per-pane | R13 / AR-10 |
| ST-27 | A `row` split, 2 panes, `sizes: signal([1,3])`, `minSize: 12`, mounted at width **31** (free 30) | Panes `[12, 18]` — naive apportion would give `[8, 22]`; the **engine** clamps on container shrink, which no drag handler can do. Sums to exactly 30 | R5 / AR-8 |

### SplitView — preflight-added cases (03-03, PF-001 … PF-004)

> These four exist because the original suite could not see the defects preflight found: ST-12…ST-14
> never leave the feasible regime, ST-22 is masked by the drag-move relayout, ST-19 stops at
> construction, and ST-23 pins payloads but not call counts. **Each is written to the failure mode,
> not the happy path** — an oracle that only exercises the happy path re-certifies the bug.

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-28 | A `row` split, 2 panes, `minSize: 12`, mounted at width **20** — free = 19, Σmin = 24, so the engine squeezes to `[10, 9]`. Then `applySplitResize([10,9], 0, delta, [12,12])` for `delta` ∈ `{0, +5, −5}` | `[10, 9]` in **all three** cases — with `cells` already below their minimums both clamp bounds collapse to 0 and the divider is frozen. **Never `[12, 7]`**, which is what the un-guarded bounds produce for `delta = 0` under the repo's `clamp` (`gestures.ts:22-24`, lo-wins). A zero-delta mouse-down must never rewrite `sizes` | R4, R7 / AR-8 · PF-001 |
| ST-29 | A splitter dragged, then mouse-up, with **no** intervening size change on the final event | Painted with `splitter` on the frame following mouse-up. **Assert after the release, not during the drag** — mid-drag the relayout repaints incidentally, so a drag-only assertion passes even when `Splitter` has no `bind` on `dragging` and the highlight is stuck | R10 / AR-15 · PF-002 |
| ST-30 | A **mounted** 2-pane split; then `sizes.set([1,1,1])`, then `sizes.set([1])` | Truncated to `[1,1]`, then padded to `[1,1]`. Every pane's solved size stays a finite integer — **never `NaN`** (a short array reaches `Math.max(0, undefined)` → `NaN` → `apportion`'s `weightSum`). `sizes()` reads back length 2 after each write. **Write after mount** — the constructor path is already normalized and proves nothing | R11 / AR-16 · PF-004 |
| ST-31 | One drag gesture: several move events that change the sizes, then several held **against** a minimum, then mouse-up. Separately, one arrow-key step | Drag: `onResize` fires once per *changed* array and **0 times** while clamped; `onResizeEnd` fires **exactly once**, at mouse-up, with the final sizes. Key step: `onResize` once **and** `onResizeEnd` once. A gesture abandoned by the staleness guard fires **no** `onResizeEnd`. Assert **call counts**, not just payloads | R7 / AR-9 · PF-003 |

### Kitchen-sink story (03-04)

| #     | Input / Scenario | Expected Output / Behavior | Source |
|-------|------------------|----------------------------|--------|
| ST-26 | `STORIES.find(s => s.id === 'layout/split')`, built at 72 × 16 and mounted headlessly | Registered; `category === 'Layout'`; paints ≥ 1 non-blank cell. **No `rd` assertion** — the chip is deliberately omitted | R12 / AR-19 · 03-04 |

> **⚠️ AUTHORING RULE:** expectations above are derived from the specification documents. Where an
> expectation is a computed number, it was hand-computed from the documented algorithm — the
> executor must not "correct" one to match what the code produces. A disagreement means the code is
> wrong.

## Test Categories

### Specification Tests (from the ST-cases above)

> Written BEFORE implementation.

| Test File | ST Cases Covered | Component | New/Extend |
| --------- | ---------------- | --------- | ---------- |
| `packages/ui/test/apportion.spec.test.ts` | ST-1 … ST-7 | Layout engine min | **Extend** (add cases only) |
| `packages/ui/test/layout.sizing.spec.test.ts` | ST-8, ST-9 | `normalizeSize` + `measure` | **Extend** (add cases only) |
| `packages/core/test/theme-roles.spec.test.ts` | ST-25 | Theme roles | **Extend** (add cases only) |
| `packages/ui/test/split.spec.test.ts` | ST-10 … ST-24, ST-27 … ST-31 | `SplitView` | New |
| `packages/ui/test/split.packaging.spec.test.ts` | — (export surface) | Barrel | New — matches the per-subsystem `*.packaging.spec.test.ts` convention (`tabs.packaging`, `containers.packaging`, …); asserts `SplitView` + `SplitViewOptions` are exported from `@jsvision/ui` and `applySplitResize` is **not** |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | ST-26 | Story | **Extend** (add one test) |

### Implementation Tests (edge cases, internals)

> Written AFTER implementation.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/ui/test/apportion.impl.test.ts` | `apportionMin` internals: fixpoint convergence with 3+ simultaneously-binding minimums; tie-breaking; a zero-weight item carrying a `min` (gets its min, residue unfilled); `min` interaction with `gap` (`solveTrack(21, [{flex,1,min:15},{flex,1}], 1)` → `[15,5]`, sizes + gap = 21); `min` alongside `fixed` items | High |
| `packages/ui/test/split.impl.test.ts` | `endDrag()` idempotency (mouse-up with no gesture; the staleness guard and mouse-up both reaching it — the second call fires **no** `onResizeEnd`); normalization edges (0 children, `minSize` array length mismatch, negative `minSize`); **modified arrows fall through** (`Ctrl`/`Alt`+arrow leaves `ev.handled` false); the `▓` grab-mark position at even vs odd extents; a splitter on a 1-cell axis; drag with `delta === 0` is a no-op **in both the feasible and the squeezed regime** (ST-28 pins the pure helper; this pins it end-to-end) | High |
| `packages/ui/test/split.impl.test.ts` | The `applyWeights` write-back **terminates**: a wrong-length write self-corrects in exactly one corrective write and the effect does not re-fire (the `Object.is`-on-a-fresh-array loop the length guard exists to prevent) | High |
| `packages/ui/test/split.impl.test.ts` | The rubber-band guard: drag far past a clamp, then reverse by 1 — the divider stays pinned until the pointer returns past the clamp point (proves the recompute-from-`startCells` design, not incremental accumulation) | High |
| `packages/core/test/theme-roles.impl.test.ts` (or the existing preset impl file) | Both roles resolve to valid colours in every preset | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| Drag through the capture seam | `SplitView` + `EventLoop` | Issue #10 requires the drag go **through the capture seam**, not via a direct `resizeBy` call: mount in a real event loop, dispatch mouse down/drag/up, assert the divider tracks and `releaseCapture` fires |
| Pane interiors reflow | `SplitView` + layout pass | A pane containing a `fr`-laid-out subtree: after a drag, the **descendants'** bounds match the new pane rect. This is the regression test for the rejected imperative design (02-current-state §Code Analysis) |
| Nested grid | `SplitView` × 2 | ST-20 end-to-end at a realistic size |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Showcase story renders | `demo:kitchen` headless smoke | ST-26 passes; no TTY needed |

## Test Data

### Fixtures Needed

None. All cases use literal numbers and real `View`/`Group` objects.

### Mock Requirements

None — real objects throughout, per the standards (mock only true externals; there are none here).
The capture seam is exercised through a real `EventLoop`, not a stub.

## Verification Checklist

- [ ] All ST-cases defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] **ST-1 green** — the no-min fast path caused zero regression
- [ ] **The full existing layout suite green** — the real proof of the fast path
- [ ] **ST-28 … ST-31 green** — the four defects preflight found are pinned, each written to the
      failure mode rather than the happy path (see their table note)
- [ ] **ST ids qualified** in every shared spec file (`ST-N (split-panes): …`) per the naming rule
- [ ] No regressions in existing tests
- [ ] `yarn check:deps` green · `scripts/check-jsdoc.mjs` green
- [ ] Test coverage meets goals
</content>
