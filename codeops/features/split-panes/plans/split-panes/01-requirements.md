# Requirements: Split Panes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source issue**: [GH #10](https://github.com/blendsdk/jsvision/issues/10)

This plan has no upstream RD — a single component at this scale follows the repo's established
plans-only precedent (`theme-accelerators`, `navigation-router`). This document is therefore the
**owning** requirements doc.

## Feature Overview

A `SplitView` container divides its region into N panes separated by N−1 draggable 1-cell
splitters, along a `row` (side-by-side) or `col` (stacked) axis. Dragging a splitter
re-apportions space between the panes on either side of it, clamped so no pane shrinks below its
minimum. Splits nest — a column split placed inside a row split produces a grid. The splitter is
focusable and resizable from the keyboard.

Turbo Vision has no split-pane counterpart, so no fidelity decode applies (issue #10 GATE-1); this
is a documented new component, free to be designed on its own terms.

## Functional Requirements

### Must Have

- [ ] **R1** — A `row` or `col` `SplitView` renders N panes separated by N−1 one-cell splitters. *(AR-1)*
- [ ] **R2** — Dragging a splitter with the pointer re-apportions space between its two adjacent panes, live. *(AR-5)*
- [ ] **R3** — A 1-cell pointer movement moves the divider exactly 1 cell — never 0, never 2. *(AR-6)*
- [ ] **R4** — No pane may be dragged below its `minSize`. *(AR-8)*
- [ ] **R5** — A container shrink must not push a pane below its `minSize`; when the container cannot honour every minimum, panes squeeze proportionally and must still exactly fill the container — never overflow. *(AR-8)*
- [ ] **R6** — Nesting a `SplitView` inside a `SplitView` produces a working grid, by composition alone. *(AR-17)*
- [ ] **R7** — Pane sizes live in a caller-owned `Signal<number[]>` of `fr` weights, which the drag rewrites in cell units. An `onResize` callback fires **on change** (live; never on an unchanged array), and an `onResizeEnd` callback fires **on commit** — once per drag gesture, once per keyboard step. Persistence is an `onResizeEnd` concern. *(AR-9)*
- [ ] **R8** — The focused splitter resizes with the arrow keys, using the same clamps as the drag. *(AR-3)*
- [ ] **R9** — A splitter is focusable and takes a tab stop. *(AR-12)*
- [ ] **R10** — A splitter draws `│` (row split) or `─` (col split) with a static `▓` grab mark at its midpoint, in the `splitter` theme role; while dragging it draws in `splitterDragging`. *(AR-14, AR-15)*
- [ ] **R11** — Degenerate inputs are normalized, not thrown: a 1-child split renders the child with no splitter; a `sizes` array whose length ≠ the child count is padded/truncated — **at every write, not only at construction**, since `sizes` is a caller-owned signal any writer may rewrite; zero/negative weights clamp to 0. *(AR-16)*
- [ ] **R12** — The component ships a kitchen-sink story that passes the headless smoke test. *(AR-19, and the repo's non-negotiable showcase gate)*

### Should Have

- [ ] **R13** — `minSize` accepts a scalar (applies to every pane) or an array (per-pane). *(AR-10)*
- [ ] **R14** — Mouse-down on a splitter focuses it, per the framework's focus-on-click default. *(AR-13)*
- [ ] **R15** — A drag whose pointer capture is lost externally (a modal opens, the view is removed) abandons the gesture rather than leaving a stuck splitter. *(AR-5 notes — the `Desktop` precedent)*

### Won't Have (Out of Scope)

- **Collapse/snap a pane by double-clicking a splitter** — fast-follow, not v1. *(AR-2)*
- **Hover affordances** — a hover-lit grab handle and a resize cursor are not buildable: the host never enables mouse mode 1003, so bare motion is never reported, and there is no hover state in the framework. Deferred as a framework-wide decision. *(AR-4, AR-20)*
- **A dedicated grid affordance** — grids come from nesting, nothing more. *(AR-17)*
- **A `createSplit()` factory** — rejected as inconsistent with the package, in which every widget is a class. *(AR-11)*
- **`max` size support in the layout engine** — only `min` is in scope; `max` has no consumer.

## Technical Requirements

### Performance

- The added `min` support must not regress the existing layout hot path: `solveTrack` runs the
  current `apportion` line unchanged whenever no track item carries a `min`. *(AR-8)*
- `apportionMin` is pure integer arithmetic and converges by pinning; it must terminate in at
  most N passes for N items.
- The repo's 16 ms frame ceiling (`yarn bench`, informational, never gates) must not regress.

### Compatibility

- ESM-only; NodeNext `.js` import specifiers in `.ts` sources.
- Zero runtime dependencies — `yarn check:deps` must stay green.
- `@jsvision/core` stays zero-dep; the theme-role addition is type + data only.
- **Backward compatibility is absolute**: `min` is an optional field on two existing exported types
  (`TrackItem`, `Size`). No existing caller can set it, so every current call site must produce
  byte-identical output. *(AR-8)*

### Security

No new input-handling surface reaches a trust boundary: `SplitView` consumes already-decoded,
already-hit-tested mouse and key events from the framework's own event loop, and its numeric inputs
(`sizes`, `minSize`) come from application code, not from users or the network. The relevant
robustness obligations are therefore integer-domain, and they are treated as correctness
requirements rather than vulnerabilities:

- Every apportion path must sum to exactly the available space, so a pane can never be given
  bounds outside its container. This is load-bearing beyond cosmetics: hit-testing reads
  `bounds`, so an overflowing pane is a **wrong click target**. *(AR-8)*
- Degenerate and hostile numeric inputs (negative, zero, `NaN`-adjacent, or oversized `minSize`;
  mismatched array lengths) must normalize rather than throw or corrupt geometry — a layout
  container that throws mid-render takes down the running app. *(AR-16)*

### Documentation

- Every public export carries JSDoc with a working `@example` (`scripts/check-jsdoc.mjs` gates it).
- No CodeOps/RD/plan IDs and no Turbo Vision / C++ provenance in shipped code or comments.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Pane count | N + N−1 splitters · strictly binary + nesting | N panes | Simpler authoring; `solveTrack` is already N-ary | AR-1 |
| Collapse/snap | v1 · fast-follow | Fast-follow | Keeps v1 on the core drag+clamp contract; `ev.clickCount` already exists, so it is additive later | AR-2 |
| Keyboard resize | Arrows · hotkey without tab stop · mouse-only | Arrows + tab stop | Accessibility; reuses the drag's clamp | AR-3 |
| Hover affordance | Drag-only highlight · enable mode 1003 now · drop it | Drag-only + static grab mark | Hover does not exist; enabling mode 1003 is framework-wide host work far beyond this component | AR-4, AR-14 |
| Layout mechanism | Imperative (Scroller) · declarative (`fr`) · hybrid | Declarative | The others are defective — pane interiors would be sized against a stale rect | AR-5 |
| Sizes state | Ratios · cells · cell-unit weights | Cell-unit weights | The apportion identity gives exact 1-cell drag fidelity and inherits a tested resize policy | AR-6 |
| Clamp helper location | `layout/` internal · `split/` · barrel-exported | `layout/` internal | The engine is the consumer; `pack-row.ts` is the precedent for a non-exported `layout/` helper | AR-7 |
| `minSize` on shrink | Drag-time clamp only · engine `min` now | Engine `min` now | The issue requires the clamp; the no-min fast path makes the regression risk mechanically nil | AR-8 |
| `sizes` contract | Required signal · optional signal · plain seed array | Required `Signal<number[]>` | Matches `Slider`, the closest precedent; makes layout persistence trivial | AR-9 |
| Public surface | Class · factory · both | `SplitView` class | Every widget in the package is a class | AR-11 |
| Theme roles | New pair · reuse existing · single role | `splitter` + `splitterDragging` | Mirrors `indicatorNormal`/`indicatorDragging`; lets themes style splitters independently | AR-15 |
| Degenerate inputs | Normalize+document · throw · normalize silently | Normalize + document | A layout container must not crash a running app over a sizes array | AR-16 |
| Verify command | `yarn verify` · + `yarn gate` | `yarn verify` | Per CLAUDE.md and the issue's own acceptance criterion | AR-21 |

> **Traceability:** Every scope decision references the Ambiguity Register entry (AR #) that
> resolved it. See [`00-ambiguity-register.md`](00-ambiguity-register.md).

## Acceptance Criteria

Issue #10's stated criteria, plus the two this plan adds from the gate and the four preflight
added (see [`00-preflight-report.md`](00-preflight-report.md)):

1. [ ] A `row`/`col` split renders panes with a draggable divider; dragging re-apportions within `minSize` clamps. *(R1, R2, R4)*
2. [ ] Nested splits produce a grid. *(R6)*
3. [ ] The pure apportion/clamp helpers are covered by spec + impl tests; the drag goes through the capture seam. *(07-testing-strategy.md)*
4. [ ] A kitchen-sink story exists and passes the headless smoke test. *(R12)*
5. [ ] `yarn verify` is green. *(AR-21)*
6. [ ] **Added by the gate:** a container shrink never pushes a pane below `minSize`, and panes never overflow their container. *(R5, AR-8)*
7. [ ] **Added by the gate:** adding `min` causes zero behavioral change for every existing `solveTrack` caller. *(AR-8)*
8. [ ] `yarn check:deps` green (no native deps) and `scripts/check-jsdoc.mjs` green (every public export has an `@example`; no banned references).
9. [ ] **Added by preflight (PF-001):** a drag while the minimums are unsatisfiable never rewrites `sizes` — the divider freezes rather than jumping, and the persisted signal is never silently corrupted. *(ST-28)*
10. [ ] **Added by preflight (PF-002):** the splitter repaints in `splitter` immediately after mouse-up — the drag highlight never sticks. *(ST-29)*
11. [ ] **Added by preflight (PF-004):** a wrong-length `sizes` array written *after* mount is padded/truncated, never `NaN`-poisoned. *(ST-30)*
12. [ ] **Added by preflight (PF-003):** `onResize` never fires on an unchanged array, and one drag gesture fires exactly one `onResizeEnd`. *(R7, ST-31)*
</content>
