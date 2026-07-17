# Ambiguity Register: Split Panes (resizable)

> **Status**: ✅ GATE PASSED — all 22 items resolved (21 resolved · 1 named deferral) · +1 runtime (AR-23)
> *(AR-22 was surfaced during authoring per the surface-during-authoring rule, and resolved before writing resumed. AR-23 was surfaced during execution — tagged `(runtime)`.)*
> **Last Updated**: 2026-07-17 17:58
> **Source issue**: [GH #10](https://github.com/blendsdk/jsvision/issues/10) — "Modern component: Split panes (resizable)"
> **CodeOps Skills Version**: 3.8.0

Systematic scan across all 12 categories. Issue #10 pre-supplies recommendations for AR-1…AR-3
(its own "Open decisions") and defers AR-15 to plan GATE-1; every other row was surfaced by the
Phase 1 codebase analysis. Several rows exist because the issue's "Substrate" section is factually
wrong about the current code — those are marked **(issue claim corrected)**.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | N-pane vs strictly-binary split | A: N children + N−1 splitters, nest for grids · B: strictly binary + nesting | **A** — N panes + N−1 splitters; nest for grids | ✅ Resolved |
| 2 | Scope | Collapse/snap a pane (double-click) | A: fast-follow, not v1 · B: in v1 | **A** — fast-follow, not v1 | ✅ Resolved |
| 3 | Scope / UX | Keyboard resize of the focused splitter | A: yes, arrows resize · B: hotkey w/o tab stop · C: no, mouse-only | **A** — yes, arrows resize the focused splitter; splitter is focusable and takes a tab stop | ✅ Resolved |
| 4 | UX / Scope | Hover grab affordance + "resize cursor" **(issue claim corrected — hover does not exist)** | A: drag-only highlight in v1, defer hover · B: enable mouse mode 1003 in core now · C: drop the affordance | **A** — highlight while dragging only; hover deferred (see AR-20) | ✅ Resolved |
| 5 | Technical | Layout mechanism: how panes/splitters get bounds | A: imperative (Scroller-style, solve in `draw()`) · B: declarative (TabView-style `fr`) · C: hybrid | **B** — declarative; A/C are defective (see notes), presented as the only viable option | ✅ Resolved |
| 6 | Technical / Data | Sizes source-of-truth representation | A: fractional weights · B: integer cells · C: weights-in-cell-units | **C** — integer cell counts used directly as `fr` weights | ✅ Resolved |
| 7 | Technical / Naming | Where the pure clamped-apportion helper lives | A: `layout/` internal · B: inside `split/` · C: exported from `layout/index.ts` | **A** — internal in `layout/apportion.ts`, NOT barrel-exported (decided by AR-8=C: the engine is the consumer) | ✅ Resolved |
| 8 | Edge case / Technical | `minSize` enforcement on container shrink; the engine has no min support | B: clamp at drag time only · C: add optional `min` to the engine now, with a no-min fast path | **C** — add `min?` to `TrackItem`(flex) + `Size`(fr); `solveTrack` delegates to internal `apportionMin()` only when a min is present | ✅ Resolved |
| 9 | Integration / Data | Is `sizes` caller-owned (controlled) or component-internal? | A: required `Signal<number[]>` + `onResize` · B: optional signal, internal fallback · C: `number[]` seed + internal signal | **A** — required `sizes: Signal<number[]>` + `onResize`, following the `Slider` convention (`controls/slider.ts:33-49`) | ✅ Resolved |
| 10 | Data | `minSize` cardinality | A: `number \| number[]` · B: `number` only · C: `number[]` only | **A** — `minSize?: number \| number[]`; scalar applies to all panes, array is per-pane | ✅ Resolved — user accepted recommendation |
| 11 | Naming | Public surface: factory vs class | A: `SplitView` class · B: `createSplit()` factory · C: both | **A** — `SplitView` class, matching every other widget in the package (the issue's `createSplit` sketch is rejected as inconsistent) | ✅ Resolved |
| 12 | UX / Behavioral | Is a splitter focusable (a tab stop)? | A: yes, focusable · B: no, `grabsFocus`-style act-without-focus | **A** — focusable / tab stop (decided by AR-3: arrows-resize requires it) | ✅ Resolved |
| 13 | Behavioral | Does mouse-down on a splitter steal focus from the pane content? | A: yes, framework default · B: no, act without focus | **A** — yes; the framework's focus-on-click default, consistent with AR-3/AR-12 making it a tab stop | ✅ Resolved — user accepted recommendation |
| 14 | UX / Presentation | Splitter glyphs — issue says vertical `│`, horizontal "`═` or `─`" (ambiguous); `▓` grab mark was hover-gated | A: `│`/`─` + static `▓` midpoint grab mark · B: `│`/`─` plain · C: `│`/`═` per the issue art | **A** — `│` / `─` single-line (matching the framework's frames) + a static `▓` grab mark centred on each splitter, recovering the discoverability lost with hover | ✅ Resolved |
| 15 | UX / Technical | Theme role: additive `splitter` role vs reuse an existing role **(issue defers to plan GATE-1)** | A: add `splitter` + `splitterDragging` pair · B: reuse `staticText` + `indicatorDragging` · C: single `splitter` role | **A** — add the `splitter` + `splitterDragging` pair, mirroring `indicatorNormal`/`indicatorDragging` | ✅ Resolved |
| 16 | Edge case | Degenerate inputs: <2 children, `sizes`/`minSize` length mismatch, zero/negative sizes | A: normalize + document · B: throw · C: normalize silently | **A** — normalize + document: 1 child ⇒ no splitter; mismatched `sizes` padded/truncated to the child count; zero/negative weights clamp to 0 | ✅ Resolved |
| 17 | Technical | Nesting for grids — composition only or special handling? | A: pure composition · B: dedicated grid affordance | **A** — pure composition; a `SplitView` is simply a child of another `SplitView` | ✅ Resolved — user accepted recommendation |
| 18 | Naming | Module path + barrel export names | A: `packages/ui/src/split/` → re-export from `src/index.ts` · B: fold into `layout/` | **A** — `packages/ui/src/split/`, matching the `tabs/`/`scroll/`/`controls/` subsystem layout | ✅ Resolved |
| 19 | Naming / Scope | Kitchen-sink story `id`/`category`, and the `rd?` chip (no RD exists — this plan has no RD) | A: omit `rd` · B: synthesize a chip | **A** — omit the optional `rd` chip; story `id: 'layout/split'`, `category: 'Layout'` | ✅ Resolved — user accepted recommendation |
| 20 | Scope (deferral) | Framework-wide hover support (mouse mode 1003 + capability gate) — split out of AR-4 | A: named deferral (owner + demand trigger) · B: milestone trigger · C: GH issue only | ⏸ **Deferred** — framework-wide hover support (mouse mode 1003 + capability gate) · owner: gevik · revisit: when a second widget needs hover, or before `@jsvision/ui` v1.0. **Filed at execution close-out as [GH #97](https://github.com/blendsdk/jsvision/issues/97).** | ⏸ Deferred (filed #97) |
| 21 | Technical | The verify command that fills every plan Verify line | A: `yarn verify` · B: `yarn verify` per task + `yarn gate` at the end | **A** — `yarn verify` (= `yarn lint` then `turbo run typecheck build test check:docs`), per CLAUDE.md and issue #10's own acceptance criterion | ✅ Resolved |
| 22 | Naming (surfaced during authoring) | Spec-test naming: the CodeOps template bans ST-/RD- ids in test code; the repo's tests use them | A: repo convention (`ST-N:` titles) · B: CodeOps plain-language · C: plain language + mapping in the plan only | **A** — repo convention: `test('ST-N: …')`, matching `kitchen-sink.smoke.spec.test.ts:66`. ⚠️ **Justification corrected by preflight (PF-006):** this row originally read "matching … **every other test file**". That is false — it is the *dominant* convention (269 of 306 spec files), and `apportion.spec.test.ts`, one of this plan's own targets, is an exception with no ST-prefixed tests. **The decision stands; the reasoning was overstated.** 07-testing-strategy.md now carries the id-qualification rule the correction implies | ✅ Resolved (justification corrected) |

| 23 | Testing **(runtime)** | Adding the `splitter`/`splitterDragging` roles broke **6 pre-existing spec-test invariants** that snapshot the whole theme role set — a total-count assertion (`severity-text-theme.spec` ST-C2, 68) and five per-feature "additive-only" allowlists (`color`/`date`/`editor`/`feedback`/`tabs-theme.spec`) — none of which knew about the new roles | A: register the two roles in each snapshot (each test's own **designed** "sanctioned later additive roles" extension slot) · B: report a blocker and stop, per the immutable-oracle rule | **A** — this is the exact mechanical friction AR-15 / 03-02 §Known friction pre-accepted ("a role-count assertion **plus a union**"). Each oracle still byte-freezes every pre-existing + own-feature role and still trips on any *un*sanctioned key, so the guarantee is **preserved, not weakened** — as those tests' own comments state ("Extending this allowlist does NOT weaken the guarantee"). Updated: count `68→70`; allowlists `+= splitter, splitterDragging`. Not a spec *rewrite* — a registration into the tests' extension point | ✅ Resolved (runtime) |

### Resolution Notes

**AR-4:** The issue asks for a `▓` grab affordance "on hover" and a "resize cursor affordance".
Neither is buildable today. `MouseEvent.kind` includes `'move'`
(`packages/core/src/engine/input/events.ts:25-31`) and the parser can emit it
(`input/mouse.ts:104-105`), but the host only enables **mode 1002** (button-event/drag tracking) at
`packages/core/src/engine/host/modes.ts:47`; **mode 1003** (any-event tracking) is never enabled
anywhere in the repo. Bare hover motion is therefore never reported, and there is no hover state,
no `hovered` flag, and no enter/leave events. A terminal has no cursor shape to change either.
AR-14 recovers the lost discoverability with a *static* grab mark instead.

**AR-5/AR-6/AR-7/AR-8:** The issue claims the layout engine's `fr` sizing gives `minSize` clamping
for free. It does not — `TrackItem` is `fixed | flex` only (`packages/ui/src/layout/apportion.ts:18-20`)
and no min/max clamp exists anywhere in the engine, including `LayoutProps` (`layout/types.ts:56-81`).
Clamping is therefore new code.

*Why the imperative pattern is rejected (AR-5).* `View.layout` is a data field, not a method — there
is no `layout()` hook (`view/view.ts:69`), which is why `Scroller` writes child `.bounds` inside
`draw()` (`scroll/scroller.ts:143-164`). That pattern does **not** generalize here.
`layout.ts:118-120` does `result.set(child, childRect)` then recurses:
`layoutContainer(child, { width: childRect.width, height: childRect.height }, result)` — a pane's
entire interior subtree is solved against the rect the reflow pass computed. Overwriting
`pane.bounds` in `draw()` leaves every descendant sized against the stale rect with nothing to
re-solve it, so panes render clipped or empty. `Scroller` is exempt only because its content is
caller-laid-out to a fixed `extent`, independent of the viewport (`scroll/scroller.ts:11-12`), and
its documented usage places children with `position:'absolute'` rects (`scroller.ts:55`), which
`layout.ts:94-102` places from `props.rect` regardless of parent size. Split panes hold arbitrary
caller subtrees that must reflow to the pane. **Governing rule: pane size is an INPUT to the reflow,
not an output of the draw.** The hybrid variant fails too — a signal write during compose lands on
the next frame, showing one frame of unclamped geometry precisely when the clamp binds.

*Why cell-unit weights (AR-6).* In `apportion` (`apportion.ts:56-63`), when `total === weightSum`
every `remainder = (total * w_i) % total = 0` and `quotient = w_i`, so `leftover = 0` and the
function returns its input verbatim. In the steady state (`Σ paneCells === free`) the solve is the
**identity**, so a 1-cell pointer move moves the divider exactly 1 cell — never 0 or 2. Off the
steady state (after a container resize) `apportion` rescales proportionally, integer-exact and
deterministic (ties to the earliest item), so the redistribution policy is inherited rather than
invented. **Trap this imposes:** after a resize the signal holds stale counts, so the drag handler
must read the resolved `pane.bounds`, apply ±delta, and write the whole array back — restoring
`Σ === free` and re-arming the identity. Same discipline as `Scroller`, where the signal holds
*desired* and the clamp is applied against live geometry at read (`scroller.ts:158-159`).

*Why `layout/` does not imply public (AR-7).* `layout/index.ts` states that internal helpers stay
module-private, and `layout/pack-row.ts` is the precedent: a pure `solveTrack` adapter living in
`layout/`, absent from the barrel, cross-imported by `menu/builders.ts:12`. `apportionMin` follows
it. Public surface added by AR-8 is therefore **one optional field on two existing types**
(`TrackItem.min`, `Size.min` on the `fr` variant) — no new exported function.

*The AR-8 engine change, scoped (the no-min fast path is what makes it landable).* No existing
caller can set `min` (the field does not exist), so every current call site passes `undefined` and
must get a byte-identical result — `solveTrack` delegates to `apportionMin` **only when some item
carries a min**, otherwise the current `apportion` line runs unchanged. That makes the
zero-regression claim mechanical rather than argued. Touch points: `apportion.ts` (`TrackItem.min`;
the `solveTrack` fast path; the new internal `apportionMin`), `layout/types.ts` (`Size.min` on `fr`,
clamped in `normalizeSize`), `layout/layout.ts` (pass `min` through to the track item),
`layout/measure.ts` (an `fr` item contributes `min ?? 0` to natural size — CSS agrees:
`flex-basis:0; min-width:20px` measures 20 in a shrink-to-fit container). `justify` needs no change:
`layout.ts:194` already computes `free = Math.max(0, contentMain - used)`, so a binding min simply
consumes space. **Infeasible case** (`Σmin > free`): fall back to `apportion(free, mins)` — a
proportional squeeze that still sums to `free` exactly. Items must never overflow their bounds:
hit-testing reads `bounds`, so an overflowing pane is a wrong click target, not merely a clipped
glyph. `apportionMin` algorithm: apportion → pin violators at their min → re-apportion the remainder
among the unpinned → repeat to fixpoint. Pure, integer-exact.

*Rejected during hardening (do not resurrect).* Using `measure()` as a "tell me my available size
before my children are laid out" hook. It appears to work — `layout.ts:89` `solveMainSizes` →
`naturalSize` → `box.measure(available)` runs before `layoutContainer` recurses at `layout.ts:120`,
so a side-effecting `measure()` could rewrite weights and have them honored in the same pass. Reject
it: `available` is the *parent's* content box (wrong whenever a sibling, gap, or `justify` exists),
it fires again for the cross axis when `align !== 'stretch'`, and it violates the engine's advertised
purity contract (`layout.ts:26-27` — "Pure: mutates neither `root` nor anything reachable from it"),
which is pinned by an immutable oracle in `layout.packaging.spec.test.ts` (ST-16).

*Capture target (informs AR-13).* A splitter **moves under the pointer**, so capturing on the
splitter itself (the `ScrollBar` habit, where the bar is stationary) yields a self-referential
coordinate frame. The correct precedent is `Desktop`, which captures on **itself** —
`desktop.ts:216` `this.loop?.setCapture(this)` — after which "mouse events arrive here directly with
desktop-local coordinates" (`desktop.ts:244`), plus a `hasCapture` staleness guard that abandons the
gesture if capture is lost externally (`desktop.ts:252`). `SplitView` captures on itself; mouse-down
bubbles to it from the splitter (`hit-test.ts:167-172` — down bubbles, other kinds do not).

**AR-9:** `Slider` is the governing precedent — a draggable widget mutating a value takes a required
two-way `value: Signal<number>` plus `onInput`/`onChange` (`controls/slider.ts:33-49`). `SplitView`
mirrors it with `sizes: Signal<number[]>`. The signal holds **`fr` weights**: a caller seeds ratios
(`signal([1, 1])` = equal, `[2, 1]` = 2:1) and the drag writes cell-unit weights back. Persisting and
restoring works across container sizes because weights rescale proportionally (see AR-6).

> **AR-9 — gap filled by preflight (PF-003), decision untouched.** AR-9 decided the *controlled-signal
> shape* (required `Signal<number[]>` + a callback, versus internal-state alternatives); it never
> adjudicated **live vs. commit**. 03-03 specified a single `onResize` firing on every drag-move
> event — including clamped no-ops — which violates R7's own "fires **on change**" and takes neither
> half of the `Slider` contract this very note cites (`onInput` live+deduped, `onChange` once per
> gesture; `slider.ts:14-15`, `:150-155`, `:215-217`). The shipped `@example` then wired persistence
> to it. Resolved to the full `Slider` shape: **`onResize` (live, deduped) + `onResizeEnd` (commit)**,
> with persistence moved to `onResizeEnd`. A leaner alternative was weighed and rejected — a single
> commit-only `onResize`, with callers binding the `sizes` signal for live state — on consistency
> grounds: `Slider` ships the live-signal/live-callback redundancy deliberately, and diverging for a
> near-identical drag widget would leave a permanent "why does `SplitView` differ?".

**AR-11:** Every widget in `@jsvision/ui` is a class (`Button`, `ListView`, `TabView`, `Scroller`,
`DataGrid`, `ScrollBar`, `Slider`, …); `createX` is reserved for non-widget infrastructure
(`createApplication`, `createRouter`, `createRenderRoot`, `createEventLoop`). Issue #10's
`createSplit()` sketch is therefore inconsistent with the package and is rejected in favour of a
`SplitView` class. Structurally it follows `TabView`, whose inner `Group` (`tabs/tab-view.ts:263-267`)
exists precisely so a caller assigning `view.layout = { position:'absolute', rect }` (a whole-object
write) cannot clobber the container's own `direction`. `SplitView` has the same exposure.

**AR-15:** Precedent for a normal/dragging role pair is `indicatorNormal`/`indicatorDragging`
(`packages/core/src/engine/color/theme.ts:233,238`), selected at draw time in
`editor/indicator.ts:72`. There is **no** role named `frame` — border/title/icon are structural
extras on `window`/`windowInactive`/`dialog`. Adding a role touches 4 compiler-enforced spots:
`theme.ts` (interface `Theme`), `theme.ts` (`defaultTheme`), `presets.ts` (`monochromeTheme` — the
only hand-authored preset; the other 11 go through `createTheme` and come free), `roles.ts`
(`rolesFromAliases`). `CANONICAL_ROLES` is derived (`serialize.ts:33`), so serialization needs no
change. **Known friction:** this bumps the theme-role count, a recurring merge-conflict point with
the in-flight datagrid branch.
</content>
