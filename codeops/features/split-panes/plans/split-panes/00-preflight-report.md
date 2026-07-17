# Preflight Report: Split Panes

> **Status**: ✅ PASSED — all 6 findings resolved (0 critical, 4 major, 2 minor, 0 observation); recommendations accepted and applied to the plan on 2026-07-17
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/split-panes/plans/split-panes/` (10 documents, 1,678 lines)
> **Codebase Grounded**: 31 source files + 8 test files examined · 96 references verified
> **Last Updated**: 2026-07-17
> **CodeOps Skills Version**: 3.8.0

> **Resolution.** The user accepted every recommendation. Applied across `01-requirements.md` (R7,
> R11, +AC 9–12), `03-03-splitview-component.md` (the clamp bounds + contract, the `Splitter` bind,
> `applyWeights` write-back, the `onResize`/`onResizeEnd` pair, `extends View`), `07-testing-strategy.md`
> (ST-28…ST-31 + the id-qualification rule), `00-ambiguity-register.md` (AR-9 gap note, AR-22
> correction), `99-execution-plan.md` (tasks 3.1.1, 3.2.1–3.2.5, 3.3.1), and `00-index.md`. The task
> count stays 43 — fixes folded into existing tasks; the four majors add spec cases ST-28…ST-31.

> **Review independence.** The artifact was authored on 2026-07-17 (today) but in a **prior
> session** — this scan ran in fresh context with no authoring memory. Same-agent bias risk is
> present but not same-session. The four MAJOR findings were additionally put through one
> independent challenger (fresh context, blind to the picks) per
> `_shared/recommendation-hardening.md`.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, `strict`), yarn 1.x + Turborepo monorepo, vitest,
zero runtime dependencies. `exactOptionalPropertyTypes` is **not** enabled (so `min: undefined` on
an optional field compiles).

**Architecture:** `@jsvision/core` is the zero-dep foundation engine; `@jsvision/ui` is the
Turbo Vision-style widget framework on top (reactive core · integer layout engine · view/group
spine · event loop · widget set). Layout is a **pure** pass (`layout.ts:26-27`) that recurses into
each child with the rect it computed. Drag gestures ride a generic pointer-capture seam on the
dispatch envelope. Themes are a total `Theme` interface whose keys are the role union.

**Key Files Examined:** `ui/src/layout/{apportion,types,layout,measure,pack-row,index}.ts` ·
`ui/src/view/{view,types,group}.ts` · `ui/src/event/{hit-test,event-loop}.ts` ·
`ui/src/desktop/{desktop,gestures}.ts` · `ui/src/tabs/tab-view.ts` · `ui/src/scroll/scroller.ts` ·
`ui/src/controls/slider.ts` · `ui/src/editor/indicator.ts` · `ui/src/reactive/signal.ts` ·
`core/src/engine/color/{theme,presets,roles,serialize,palette}.ts` ·
`core/src/engine/{input/events,host/modes}.ts` · `examples/kitchen-sink/{story,shell}.ts` ·
`ui/test/{apportion,layout.sizing,pack-row}.*.test.ts` · `examples/test/kitchen-sink.smoke.spec.test.ts` ·
GH issue #10.

**Reference Verification:** 96 references mapped to code — **93 verified, 1 phantom (PF-005),
2 inaccurate (PF-003 precedent claim, PF-006 convention claim)**.

The plan's codebase grounding is unusually strong. Spot-checked and **confirmed exact**: the four
corrections it makes to issue #10's "Substrate" section (no `min` support in the engine; `Gesture`
is hard-typed to `Window`; mode 1003 never enabled; no `frame` theme role); every cited line number
that matters (`apportion.ts:18-20,43-74,93-97,99-114`, `hit-test.ts:144-149` capture short-circuit,
`hit-test.ts:167-172` "down bubbles, other kinds do not", `desktop.ts:216,244,252`,
`indicator.ts:72`, `slider.ts:33-49,188-189`, `scroller.ts:158-159`, `theme.ts:233,238,359-360`,
`presets.ts:127-128`, `roles.ts:107-108`, `serialize.ts:33`, `modes.ts:47`, `layout.ts:118-120`);
the 68-role count (`Object.keys(defaultTheme).length === 68`); `ctx.size`/`fill`/`text`/`color` on
`DrawContext`; `MouseEvent` coords being "1-based, exactly as the terminal sends them"; and the
`pack-row.ts` module-private precedent (`pack-row.impl.test.ts:10` imports it by relative path —
so the plan's module-private helpers *are* testable as specified).

**Every hand-computed ST expectation was independently re-derived and is correct** — ST-1 `[5,8,7]`,
ST-2 `[15,5]`, ST-3 `[5,5]`, ST-4 `[37,42]`, ST-5 `[12,12,6]`, ST-6 `[5]`, ST-10 (panes 10/10,
splitter x=10), ST-11 (panes 7/7/6, splitters x=7/x=15, fills 22 exactly), ST-27 `[12,18]`, and the
`min`×`gap` impl case `solveTrack(21,…,1)` → `[15,5]`. The `apportionMin` fixpoint terminates and
sums exactly, including the documented all-pinned residue case.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-001, clamp contract unpinned) | 🟠 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-003 vs R7) | 🟠 |
| 4 | Completeness Gaps | 2 (PF-002, PF-004) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 (resolved — see `pack-row` precedent) | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-001) | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-005, PF-006) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001…PF-005) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 4 | ✅ all resolved |
| MINOR | 2 | ✅ all resolved |
| OBSERVATION | 0 | — |

> **Cross-cutting note (raised by the challenger, verified).** All four MAJOR findings share one
> root cause: **the spec suite does not cover any of them.** ST-12/13/14 exercise only feasible
> mins; ST-22 is masked by the drag-move relayout; ST-19 tests construction only; ST-23 pins neither
> dedupe nor call count. Under this repo's immutable-oracle discipline the red/green gate would
> certify code that still carries every one of these defects. Each fix must land with its ST case.

---

## 🟠 PF-001: `applySplitResize`'s clamp range inverts once the engine squeezes below `minSize`

**Dimension:** 9 (Edge Cases) · 13 (Codebase Alignment — Impact Blindness) · 1 (Ambiguities)
**Location:** `03-03-splitview-component.md` §New Functions/Methods (the `applySplitResize` formula)
**Codebase Evidence:** `packages/ui/src/layout/apportion.ts:43-74` · `packages/ui/src/desktop/gestures.ts:22-24` · plan `03-01-layout-engine-min.md` §Algorithm step 2

**The Problem:**

The plan specifies, for panes `a = index`, `b = index + 1`:

```
effective = clamp(delta, mins[a] − cells[a], cells[b] − mins[b])
```

`cells` come from **live resolved bounds** (`resolvedCells()`). The plan's own engine is specified
to place panes **below** their minimums whenever `Σmin > free` (the infeasible squeeze — ST-3,
ST-6). In that state `lo = mins[a] − cells[a] > 0` and `hi = cells[b] − mins[b] < 0`, i.e.
**`lo > hi` — an inverted range**, and the result is whatever the clamp's argument order happens to
do rather than a no-op.

This is not a corner case: verified by brute force over the infeasible domain, `cells[i] ≤ mins[i]`
holds with **zero exceptions**, so the inversion is the *norm* in that branch, not an edge of it.
And the regime is ordinary — two panes at `minSize: 12` need 25 columns; any narrower terminal
enters it. With the repo's own `clamp` (`gestures.ts:22-24`, `Math.max(lo, Math.min(hi, n))`,
documented "*`lo` wins if the range is empty*"), `delta = 0` yields `+2`: a **zero-movement
mouse-down rewrites the sizes**.

**Why it matters is subtler — and worse — than a visible jump.** In the infeasible branch
`apportionMin` returns `apportion(free, mins)` and **never reads the weights**, so the corrupted
array renders identically and nothing looks wrong. The damage is **silent state corruption**:
`onResize` fires and the caller-owned signal — the thing AR-9 makes callers persist
(`03-03` §Example 1, `savePaneLayout(next)`) — is written with a garbage array. It surfaces on the
next launch at a feasible size, where the weights *do* bind. This defeats the plan's own stated
rationale for having a drag clamp at all (`03-03` §Error Handling: "keeps the caller-owned signal
and `onResize` truthful").

The plan never defines `clamp`'s argument order, so the behavior is undefined as specified.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Clamp the bounds so the range provably contains 0: `lo = Math.min(0, mins[a] − cells[a])`, `hi = Math.max(0, cells[b] − mins[b])` | Correct under **either** clamp argument order, so it is robust to the unpinned contract; `delta = 0` is always a no-op; 2-line change | The `Math.min(0, …)` reads as a tic a later reader may "simplify" away, reinstating the bug |
| B | Derive effective minimums from live cells: `effMin[i] = Math.min(mins[i], cells[i])`, then clamp normally | Self-documenting — "you can't be pushed further below where the engine already put you" | **Algebraically identical to A** (proven over 3.2M combinations, 0 differences) — it is the better *comment*, not a different fix |
| C | Keep the formula; make "every cell ≥ its min" a documented precondition and skip the drag at the call site when infeasible | Keeps `applySplitResize` maximally simple | Makes a precondition the plan's **own engine is specified to violate**; forces the call site to re-derive the feasibility rule, which will drift from the engine |

**Recommendation: Option A, with B's phrasing as the code comment** — plus two additions the option
list misses: (1) **pin the clamp contract** by reusing/hoisting `gestures.ts:23` rather than leaving
the order implicit; (2) **add the missing spec case** — an `applySplitResize` ST case in the
infeasible regime (e.g. `applySplitResize([10, 9], 0, 0, [12, 12])` → `[10, 9]`), since ST-12/13/14
cover only feasible mins and nothing in the suite catches this today. A is preferred over the
identical B because its range provably contains 0, making the fix correct *regardless of* how
`clamp` is written — it does not depend on closing the spec gap.

Option C is rejected outright: the infeasible squeeze is a documented engine behavior (ST-3/ST-6),
not an error state a caller can be told to avoid.

`Confidence: High` — the arithmetic was re-derived and brute-forced; A≡B is proven, so the pick
cannot be wrong on behavior. The residual question is the UX one A answers by side effect (the
divider freezes while squeezed, with no feedback) — deliberate freezing is defensible, but it
should be a *decision*, not a consequence.
`Hardening: Changed. The original finding claimed a visible 3-cell jump; the challenger established that the infeasible branch ignores weights, so the render is unaffected and the real damage is silent corruption of the persisted signal. It also found the repo's actual clamp order (`gestures.ts:22-24`, lo-wins), flipping the sign of the example, and proved A≡B.`
`Challenger: converged` (REAL; recommends A, with the A≡B proof and the two additions folded in above)

**User Decision:** ✅ Accepted (Option A) — 2026-07-17. Applied to `03-03` §New Functions/Methods:
the `min(0,…)`/`max(0,…)` bounds with the "do not simplify" warning; the `clamp` contract pinned to
`gestures.ts:22-24` (hoisted); the frozen-divider consequence documented as deliberate. New spec
case **ST-28** (`07`) pins the infeasible-regime no-op.

---

## 🟠 PF-002: `Splitter` never repaints when `dragging` flips — the highlight sticks after mouse-up

**Dimension:** 13 (Codebase Alignment — Stale Assumption) · 4 (Completeness Gaps)
**Location:** `03-03-splitview-component.md` §The `Splitter` view · §The drag gesture
**Codebase Evidence:** `packages/ui/src/editor/indicator.ts:56-61` · `packages/ui/src/view/view.ts:197,202,228-240` · `packages/ui/src/controls/slider.ts:92,137-147` · `packages/ui/src/window/window.ts:89,130`

**The Problem:**

The plan sketches:

```ts
class Splitter extends BaseView {
  override focusable = true;
  readonly dragging = signal(false);
}
```

with `draw()` selecting `splitterDragging` when `dragging()`, and `SplitView.beginDrag`/`endDrag`
doing `dragging.set(true)` / `.set(false)`. **There is no `onMount`, and no `bind`.**

In this framework a bare `signal.set()` schedules nothing. The precedent the plan cites for this
exact pattern says so in as many words — `indicator.ts:58-59`:

```ts
// Repaint whenever the position, modified flag, or drag state changes (draw() is not auto-tracked).
this.bind(() => [this.pos(), this.modified(), this.drag?.() ?? false] as const);
```

`Indicator` — the source of the `dragging ? 'indicatorDragging' : 'indicatorNormal'` line the plan
copies from `indicator.ts:72` — pairs the role selection with an explicit `bind` in `onMount`. The
plan copies the draw line and drops the bind. Consequences:

- **Mouse-down, no movement:** `dragging.set(true)`, no `commit()` → no frame → **no highlight**
  until the pointer first moves.
- **Mouse-up:** the plan's handler calls `endDrag()` and returns **without** `commit()` →
  `dragging.set(false)` schedules nothing → **the splitter stays painted `splitterDragging` after
  the drag ends**, until some unrelated repaint. User-visible, and it defeats the entire payoff of
  the new `splitterDragging` role that AR-15 added.

Mid-drag it appears to work only *incidentally*: each `commit()` relayouts, which repaints
everything. **ST-22 ("at rest, then during a drag") is masked by exactly that relayout** and would
pass while the stuck highlight ships.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `onMount` + `this.bind(() => this.dragging())` to `Splitter`, mirroring `indicator.ts:58-59` | Exactly the cited precedent, correctly applied; keeps `dragging` a `Signal`, which is the framework idiom for state one view owns and another sets (`Window.dragging` at `window.ts:89,130` is set by `Desktop` at `desktop.ts:215`) | One reactive effect per splitter for a boolean that flips twice per gesture |
| B | Make `dragging` a plain boolean field and call `this.invalidate()` on each change (the `Slider` shape) | O(1), allocation-free | Misreads the precedent: `Slider.dragging` is a plain field (`slider.ts:92`) **only because `Slider.draw` never reads it** (`slider.ts:137-147` uses `sliderTrack`/`sliderThumb`) — it is not a precedent for *drawn* drag state. Also forces an API change: `SplitView` sets it cross-view, so a plain field needs a `setDragging()` setter |

**Recommendation: Option A.** The topology is `Window`/`Desktop`'s exactly — a `Signal<boolean>`
owned by the view that draws it, set by the capturing container — and the rule the precedent
establishes is that *the view that draws the signal is the view that binds it*. `Window.draw` never
reads `dragging`, so `Window` never binds it; `Indicator.draw` does, so `Indicator` binds it.
`Splitter.draw` does, so `Splitter` must. Add an ST case that asserts the role **after mouse-up**,
not only during the drag, so the oracle isn't masked by the relayout.

`Confidence: High` — the precedent is explicit, and its own comment states the mechanism.
`Hardening: Changed. The challenger identified the mouse-up path (endDrag without commit) as the concrete user-visible failure, and established that Slider is not a valid precedent for option B because its draw never reads dragging.`
`Challenger: converged` (REAL; recommends A; independently flagged that ST-22 is masked)

**User Decision:** ✅ Accepted (Option A) — 2026-07-17. Applied to `03-03` §The `Splitter` view:
`onMount(){ this.bind(() => this.dragging()) }`, mirroring `indicator.ts:56-61`, with the
"bind is required, not decorative" warning and the `extends View` note (also PF-005). New spec case
**ST-29** (`07`) asserts the `splitter` role *after mouse-up*, so the relayout can't mask it.

---

## 🟠 PF-003: `onResize` fires on unchanged sizes — contradicting R7 and the `Slider` contract AR-9 claims to follow

**Dimension:** 3 (Logical Contradictions) · 13 (Codebase Alignment — Stale Assumption)
**Location:** `01-requirements.md` R7 · `00-ambiguity-register.md` AR-9 · `03-03-splitview-component.md` §New Types/Interfaces, §The drag gesture, §Example 1
**Codebase Evidence:** `packages/ui/src/controls/slider.ts:14-15,47,49,150-155,158-164,215-217`

**The Problem:**

`commit()` is called from the drag handler on **every** mouse-move event, with no change guard. Two
independent things are wrong with that:

1. **It contradicts the plan's own requirement.** R7: "an `onResize` callback fires **on change**."
   While a drag is clamped at a minimum, `applySplitResize` returns an unchanged array and
   `onResize` fires anyway, once per mouse event.

2. **It contradicts the precedent AR-9 rests on.** AR-9 justifies the API as "the `Slider`
   contract" — but `Slider` splits the contract in two, and `SplitView` takes neither half:
   - `slider.ts:14-15` — "every live change fires `onInput`; a commit … fires `onChange`.
     **A clamped no-op fires neither.**"
   - `slider.ts:150-155` — `live()` fires `onInput` **only if the value changed**.
   - `slider.ts:215-217` — "**one drag gesture fires exactly one `onChange`**."

The consequence is in shipped JSDoc. `03-03` §Example 1 wires **persistence** to this per-mouse-event
callback:

```ts
onResize: (next) => savePaneLayout(next),      // persist; reseed the signal next launch
```

Per CLAUDE.md, `@example`s are "executable spec … for AI consumption first". This one teaches
callers and agents to write to durable storage on every mouse-move. ST-23 pins neither the dedupe
nor the call count.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Match `Slider`: `onResize` (live, deduped) + a commit callback (`onResizeEnd`) firing once per gesture and once per key step; move persistence to the commit callback in the `@example` | Symmetric with the closest precedent for a near-identical interaction; gives both use cases a home | Two callbacks on a small API; more doc churn |
| B | Keep the single `onResize`, add the dedupe, and rewrite the `@example` so persistence isn't wired to it | Smallest change | **Doesn't fix the problem**: a real drag changes the array on most moves, so persistence still fires per mouse-event — and having removed it from the example, the plan's headline use case has nowhere to go |
| D | Make the single `onResize` **commit-only** (once per gesture, once per key step, never on a no-op); callers wanting live state bind the caller-owned `sizes` signal, which `commit()` already writes live | One callback; the existing `@example` becomes correct **as written** (zero doc churn); live observation already has a first-class channel | Diverges from `Slider`, which ships the same "redundancy" (a live `value` signal *and* a live `onInput`) deliberately — invites a permanent "why does `SplitView` differ?" |

*(Option C — "document it as live, callers debounce" — was considered and dropped: it pushes a
framework-shaped problem onto every caller and still leaves R7 violated.)*

**Recommendation: Option A**, with D as a genuinely close second. A wins on consistency: `Slider` is
the nearest neighbour, it faced the same live-vs-commit question, and it answered it with two
callbacks; diverging for a widget this similar creates a discrepancy every future reader must
re-litigate. D is leaner and makes the existing example correct untouched — **if the team weights
API minimalism over Slider symmetry, D is the better answer**, and it is the one I would pick if
`SplitView` were the only draggable widget in the package.

Either way, **R7's "on change" must be honoured** (no fire on an unchanged array) and ST-23 must be
extended to pin the call count, not just the payload.

Note this does **not** re-litigate AR-9. AR-9 decided *required signal + callback* versus
internal-state alternatives; it never adjudicated live-vs-commit. This fills a gap AR-9 left open.

`Confidence: Med` — High that the defect is real (it contradicts R7 in the plan's own text); Med on
A-vs-D, which is a genuine API-taste call the user should make. What would change it: if
`SplitView` is expected to stay the only multi-value draggable widget, D dominates.
`Hardening: Changed. The challenger found that the violation is of the plan's own R7 ("fires on change"), not merely of a precedent — and surfaced option D, which was absent from the original option set and is arguably leaner.`
`Challenger: converged on A, but named D as a legitimate contender` — reconciled by presenting both.

**User Decision:** ✅ Accepted (Option A, the recommendation) — 2026-07-17. `onResize` (live, deduped)
+ `onResizeEnd` (once per commit) added to `SplitViewOptions`; `commit()` dedupes on an unchanged
array; persistence moved to `onResizeEnd` in the `@example`. R7 reworded to require "on change";
AR-9 carries a gap note (decision untouched, live-vs-commit filled). D is recorded as the considered
alternative. New spec case **ST-31** (`07`) pins call counts.

---

## 🟠 PF-004: `sizes` length normalization is constructor-only, but `sizes` is a reactive signal any writer can rewrite

**Dimension:** 4 (Completeness Gaps) · 13 (Codebase Alignment — Architecture Mismatch) · 9 (Edge Cases)
**Location:** `03-03-splitview-component.md` §Normalization ("Applied once in the constructor") · `01-requirements.md` R11 · `00-ambiguity-register.md` AR-16
**Codebase Evidence:** `packages/ui/src/tabs/tab-view.ts:288-290` · `packages/ui/src/layout/apportion.ts:48-49` · `packages/ui/src/layout/types.ts:168-169` · `packages/ui/src/reactive/signal.ts:41,53`

**The Problem:**

`03-03` §Normalization states normalization is "**Applied once in the constructor**", including
"`sizes` length ≠ child count → padded with `1` / truncated". But `sizes` is a **caller-owned
reactive `Signal`**, resynced on every write by
`bind(() => this.sizes(), (w) => this.applyWeights(w), { relayout: true })`. A later external write
of a wrong-length array reaches `applyWeights` **unnormalized**.

R11 states the guarantee **unconditionally** ("a `sizes` array whose length ≠ the child count is
padded/truncated"), so the plan promises more than the mechanism delivers. The failure is not
graceful: a short array gives `w[i] === undefined` → `normalizeSize`'s `Math.max(0, undefined)`
(`types.ts:169`) → `NaN` → `apportion` (`apportion.ts:48-49`) propagates `NaN` through `weightSum`
→ **every pane sized `NaN`**. That directly violates AR-16's "a layout container must not crash a
running app over a sizes array".

The cited structural precedent does the opposite of what the plan specifies: `TabView` normalizes
**inside its bind** (`syncActive` — "Recompute the effective active tab, correct a drifted
`active`"), documented as re-running "on any `active` or `tabs` change, **from any writer**".

**Reachability is real but narrow** — `children` is constructor-only so N is fixed, and the plan's
headline persistence path reseeds the *constructor*, which is already normalized. The live path is
a caller writing `sizes.set(loadSavedLayout())` — e.g. a 3-pane layout restored into a 2-pane split.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move length normalization into `applyWeights` (the bind path), so it self-corrects from any writer | Single normalization point, no duplication; restores R11's unconditional guarantee; matches the cited precedent | The signal and the rendered state then silently disagree — the exact "untruthful signal" the plan's two-clamp rationale calls unacceptable, given AR-9 makes that signal the thing callers persist |
| A′ | **A, plus a write-back to `sizes` guarded on length mismatch only** | Everything A gives, and the persisted signal stays truthful; the guard makes it self-terminating (after the write the length matches, so it cannot re-fire) | Slightly more code; a corrective write is observable to other subscribers |
| B | Normalize in the constructor **and** write the normalized array back to the signal unconditionally, **and** in `applyWeights` | — | **Infinite loop.** Signals compare with `Object.is` (`signal.ts:41,53`); `sizes.set(freshArray)` always writes a new reference → always notifies → the effect re-runs forever. `TabView` survives its write-back only because `active` is a **number**, where `Object.is` makes the corrective write a genuine no-op ("*a no-op write when already valid (so the effect converges)*"). That reasoning does not transfer to an array |
| C | Document that `sizes` must match the child count after construction; ignore mismatches | No code | Contradicts R11 and AR-16 ("normalize, never throw"); leaves the `NaN` path live |

**Recommendation: Option A′** — A's single normalization point, plus a write-back **guarded on
length mismatch only**. That recovers `TabView`'s convergence *semantics* on an array type without
the identity loop, and keeps the persisted signal truthful, which is the one thing plain A gives up
and which AR-9 makes load-bearing. Extend ST-19 (construction-only today) with a post-mount
external write of a wrong-length array.

**Option B must not be implemented as written** — copying `TabView`'s write-back literally onto an
array is an infinite loop, and this is precisely the kind of precedent-transplant the plan is
otherwise careful about.

`Confidence: High` on the defect and on rejecting B; `Med-High` on A′ over plain A — A′ is the
better answer only if you accept AR-9's premise that the signal is the persisted source of truth
(the plan states this explicitly, so I do).
`Hardening: Changed. The challenger established that option B — the obvious "normalize and write back" fix, and the literal reading of the TabView precedent — is an infinite loop on an array signal, and proposed the guarded write-back (A′) that plain A lacked.`
`Challenger: converged` (REAL, narrow; recommends A refined to the guarded write-back)

**User Decision:** ✅ Accepted (Option A′) — 2026-07-17. `sizes` length normalization moved from the
constructor into `applyWeights` (`03-03` §Normalization), with the write-back guarded on length
mismatch only, and the "never make it unconditional / `Object.is` infinite-loop" warning. R11
reworded to "at every write, not only at construction". New spec case **ST-30** (`07`) writes a
wrong-length array *after mount*; an impl test asserts the write-back terminates. B recorded as the
must-not-implement transplant.

---

## 🟡 PF-005: `BaseView` is a phantom reference — it is a local import alias, not an exported symbol

**Dimension:** 13 (Codebase Alignment — Phantom References) · 12 (Consistency)
**Location:** `03-03-splitview-component.md` §The `Splitter` view — `class Splitter extends BaseView`
**Codebase Evidence:** `packages/ui/src/scroll/scroller.ts:14` · `packages/ui/src/view/view.ts:63` · plan `99-execution-plan.md` task 3.2.2

**The Problem:**

`03-03` writes `class Splitter extends BaseView`. **No `BaseView` exists.** The only occurrence in
the repo is a file-local rename inside one module:

```ts
// packages/ui/src/scroll/scroller.ts:14
import { Group, View as BaseView } from '../view/index.js';
```

The exported class is `View` (`view/view.ts:63`, `export abstract class View`). The plan's own
execution plan already says the right thing — task 3.2.2: "Implement `Splitter extends **View**`" —
so the two documents disagree, and `03-03` (the spec an executor reads for the class shape) carries
the wrong one.

Impact is bounded: an executor copying `03-03` literally hits a compile error immediately. But
`03-03` is the document that governs the file, and the plan is otherwise meticulous about naming.

**Options:** Only one resolution is viable — correct `03-03` to `class Splitter extends View`, and
(optionally) note that `View` is abstract so `draw()` must be implemented. Considered and rejected:
introducing a real `BaseView` alias in `view/index.ts` (invents public surface to match a typo, and
`scroller.ts`'s local alias exists only to avoid a collision with its own `View` usage).

**Recommendation:** Fix `03-03` to `extends View`, matching `99-execution-plan.md` task 3.2.2 and
every other widget in the package.

**User Decision:** ✅ Accepted — 2026-07-17. `03-03` §The `Splitter` view now reads `class Splitter
extends View`, with a note that `View` is abstract (so `draw()` must be implemented) and that
`BaseView` is only the `scroller.ts:14` local alias. Task 3.2.2 reinforced.

---

## 🟡 PF-006: AR-22's "matching every existing test file" is false — and the plan injects a colliding ST namespace into `layout.sizing.spec.test.ts`

**Dimension:** 12 (Consistency) · 13 (Codebase Alignment — Convention Violations)
**Location:** `00-ambiguity-register.md` AR-22 · `07-testing-strategy.md` §Naming convention, §Specification Tests table · `99-execution-plan.md` tasks 1.1.1, 1.1.2
**Codebase Evidence:** `packages/ui/test/apportion.spec.test.ts` (0 ST-prefixed tests, 5 plain-named) · `packages/ui/test/layout.sizing.spec.test.ts` (ST-01 … ST-06) · `packages/core/test/theme-roles.spec.test.ts` (two `ST-13` tests) · `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (ST-13, ST-16, ST-17, ST-24, ST-35)

**The Problem:**

Two related inaccuracies:

1. **The convention claim is overstated.** AR-22 records the decision as "repo convention:
   `test('ST-N: …')`, matching `kitchen-sink.smoke.spec.test.ts:66` and **every other test file**."
   Repo-wide it is 269 of 306 spec files — dominant, but not universal, and the exception matters:
   **`apportion.spec.test.ts`, the target for ST-1…ST-7 (task 1.1.1), is one of the files with no
   ST-prefixed tests at all.** Adding `test('ST-1: …')` there makes that file internally
   inconsistent — the opposite of what AR-22 intended.

2. **ST ids collide across namespaces in a shared file.** ST numbering is per-plan, but the plan
   extends files that already carry *other* plans' ST ids:
   - `layout.sizing.spec.test.ts` already numbers its cases **ST-01 … ST-06**; task 1.1.2 adds
     **ST-8** and **ST-9** to that same file. A reader meeting `ST-8` directly after `ST-06` will
     reasonably assume it continues the file's sequence. It does not — it belongs to split-panes.
   - `theme-roles.spec.test.ts` already has two `ST-13` tests; the plan adds ST-25.
   - `kitchen-sink.smoke.spec.test.ts` already has ST-13/16/17/24/35; the plan adds ST-26 (no direct
     number collision, but a third namespace in one file).

Nothing breaks at runtime; the cost is traceability, which is the entire point of the ST-N form.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep AR-22's ST-N form; **qualify the ids in shared files** — e.g. `test('ST-8 (split-panes): …')` — and correct AR-22's "every other test file" to "the dominant convention (269/306)" | Preserves the decision; makes the namespace explicit exactly where it is ambiguous; cheap | A slightly longer test title in the extended files |
| B | Keep bare ST-N everywhere; note the namespace only in `07-testing-strategy.md`'s mapping table | Zero change to test titles | Leaves `ST-8` sitting under `ST-06` in one file with nothing on the line to disambiguate |
| C | Renumber the plan's ST cases into each target file's existing sequence (ST-07, ST-08 in `layout.sizing`) | Files stay internally consistent | Breaks traceability to `07-testing-strategy.md`, which the plan treats as the immutable oracle; a plan-level id would then mean two different things |

**Recommendation: Option A.** It keeps AR-22's decision intact (not re-litigated — the user chose
the ST-N form and that stands), and applies it where it actually lands. C is the wrong direction:
it would make `07-testing-strategy.md`'s ST ids — the oracle the execution plan repeatedly points
at — disagree with the tests. The AR-22 factual correction should be made regardless of which
option wins, since a future reader will otherwise trust "every other test file" and be surprised by
`apportion.spec.test.ts`.

**User Decision:** ✅ Accepted (Option A) — 2026-07-17. `07-testing-strategy.md` §Testing Overview
now carries the id-qualification rule (`ST-N (split-panes): …` in every shared file, bare in
`split.*`), and AR-22's "every other test file" is corrected to "the dominant convention (269/306),
`apportion.spec.test.ts` being an exception" — the decision itself untouched.

---

## Adversarial checklist (same-agent-bias safeguard)

- *"What assumption might I be unconsciously confirming?"* — that the plan's hand-computed ST
  expectations are right because they are stated confidently. Countered by re-deriving **every** one
  independently against the real `apportion` source; all are correct.
- *"What would a domain expert who disagrees flag?"* — that `track` uses `position: 'fill'` while the
  cited `TabView` precedent (`tab-view.ts:263-267`) uses `size: {kind:'fr', weight:1}`. Examined and
  **not** raised as a finding: both are out-of-flow-or-flex on the main axis, both collapse under an
  `auto` parent (`measure.ts:50` filters to flow children; `childMainAndCross` gives `fr` a main of
  0), and `fill` is strictly more robust against a caller's whole-object `layout` write. The plan's
  reason-for-existence citation is accurate even though the mechanism differs.
- *"What external standard might this violate?"* — none applies; this is a new component with no
  Turbo Vision counterpart (issue #10 GATE-1), so no fidelity decode is owed and none was skipped.
- **Testability worry, investigated and dismissed:** whether spec tests could reach the
  module-private `applySplitResize` / `Splitter`. They can — `pack-row.impl.test.ts:10` imports a
  module-private helper by relative path (`'../src/layout/pack-row.js'`), and `@jsvision/ui` tests
  import internals relatively throughout (298 relative imports vs 33 by package name). The plan's
  packaging test correctly asserts only the **barrel** surface.
</content>
</invoke>
