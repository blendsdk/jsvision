# Ambiguity Register: Split-Panes Follow-ups

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Gate status**: ✅ GATE PASSED — every item Resolved with an explicit user decision.

This register is the Zero-Ambiguity audit trail for the `split-panes-followups` plan. Every design,
scope, and behavior decision below traces to an explicit user choice (two `AskUserQuestion` rounds)
or to a fact verified against the current code (cited `file:line`). No item is deferred.

## Register

| # | Category | Question | Options considered | Decision | Rationale | Status |
|---|----------|----------|--------------------|----------|-----------|--------|
| AR-1 | Scope / process | How to model this work — full plan or lightweight task? | Full (lean) plan · lightweight task mini-plan | **Full (lean) plan** under the existing `split-panes` feature, sibling to the shipped plan | User choice (Q4). Item 1 touches shipped source and deserves full spec-first treatment; consistent with how `split-panes` itself was built | ✅ Resolved |
| AR-2 | Behavior / scope | How far should the `▓` grab-mark toggle go? Today `Splitter.draw()` paints it unconditionally (`packages/ui/src/split/splitter.ts:50-51`) | Option + static demo · option + live toggle · option + tests only | **Reactive + live toggle** — `grabMark` is signal-backed and flippable at runtime | User choice (Q1) | ✅ Resolved |
| AR-3 | API design | How is the reactive `grabMark` modeled on the public API? | `grabMark?: boolean` option + public `Signal<boolean>` · caller-owned `Signal<boolean>` input | **`grabMark?: boolean` (default `true`) on `SplitViewOptions` + a public `readonly grabMark: Signal<boolean>` on `SplitView` seeded from it.** `SplitOwner` (`splitter.ts:16`) gains `grabMark: Signal<boolean>`; `Splitter` reads `this.owner.grabMark()` in `draw` and binds it in `onMount` (alongside `dragging`, `splitter.ts:37-43`) so a flip repaints | User choice (follow-up Q1). Mirrors the package's precedents: `dragging` is an internal signal, `sizes` is caller-owned; a plain-bool option keeps the common static case trivial and backward-compatible | ✅ Resolved |
| AR-4 | UX / placement | Which kitchen-sink story hosts the live `grabMark` toggle? | Existing `layout/split` story · the new scroll story · both | **Existing `layout/split` story**, key **`g`** flips `grabMark` on every divider; a `‹g› grab mark` hint is added | User choice (follow-up Q2). Keeps the new scroll story focused purely on scrolling | ✅ Resolved |
| AR-5 | Scope | How to prove/showcase a scrolling widget inside a pane? | New story (list + grid) · **new story (list only)** · enhance existing story | **New kitchen-sink story: a `row` split with a scrollable `ListBox` pane beside an info pane**, plus a headless smoke test | User choice (Q2) | ✅ Resolved |
| AR-6 | Feasibility (grounded) | Does a `ListBox` scroll correctly as a **direct** `SplitView` pane child, given `SplitView` overwrites `pane.layout` with `{ size: fr }` (`split-view.ts:136,168`)? | Direct child · wrap in a filling Group | **Direct child — no wrapper.** `ListView.layout = { direction: 'row' }` (`list-view.ts:83`) arranges `[rows fr | bar 1]`, but the engine defaults `direction` to `'row'` (`types.ts:213`), so replacing the layout with `{ size: fr }` (which omits `direction`) preserves the arrangement. This is the **identical transformation** the existing `listview.story.ts` already performs via `at()` (absolute rect, no `direction`) and renders correctly. A wrapper would hit the same layout replacement, so it adds nothing | Verified against code | ✅ Resolved |
| AR-7 | Scope / demo | How does the amiga-clock 4th window divide the three clocks? | col (stacked) · row (side-by-side) · **nested grid** | **A 4th `Clocks` window** (`Window`, `position:'fill'` `SplitView`) with a **nested grid**: `row` of `[ Analog | col:[ Digital / Boing ] ]`. **Fresh** clock instances bound to the same `now`/`frame` signals (`main.ts:98`); the existing three standalone windows are kept intact ("additionally") | User choice (Q3) | ✅ Resolved |
| AR-8 | Testing | Does item 3 (amiga-clock) get an automated test? | Typecheck only (live demo) · add a headless smoke test | **Typecheck only.** amiga-clock has no headless smoke test today; item 3 is covered by `yarn typecheck` + a manual run. No `*.spec`/`*.smoke` test is added for it | User choice (follow-up Q4). Consistent with the existing demo's coverage | ✅ Resolved |
| AR-9 | Process | Which verify command fills every plan `Verify` line? | `CI=1 yarn verify` · plain `yarn verify` | **`CI=1 yarn verify`** | User choice (follow-up Q3). Turbo forwards `CI`, so the machine-dependent 16 ms perf assertion auto-skips — avoids the known `TUI_SKIP_PERF`-not-forwarded-through-turbo flake | ✅ Resolved |
| AR-10 | Process | Branch for this work? | Continue on `feat/split-panes` · new branch | **Continue on `feat/split-panes`** (the parent feature is unmerged / PR-ready, so these follow-ups belong with it) | User-directed default; low stakes, reversible | ✅ Resolved |
| AR-11 | Compatibility (grounded) | Does adding `grabMark` disturb the shipped `split.spec.test.ts` immutable oracle? | Append to it · put new tests in a new file | **New files** (`split-grabmark.spec.test.ts` / `split-grabmark.impl.test.ts`) — the shipped oracle is left byte-untouched; `grabMark` defaults to `true`, preserving current output | Verified: default `true` means every existing assertion still holds | ✅ Resolved |
| AR-12 | Feasibility (grounded) | How does the `layout/split` story catch the `g` key without stealing the splitter's arrows? | Root Group with `preProcess = true` + `onEvent` · a dedicated focusable child | **Root Group subclass with `preProcess = true`** whose `onEvent` handles only `g` (flip + `ev.handled = true`) and leaves everything else unhandled, so arrows still reach the focused `Splitter`. Mirrors `DetailScreen` in `drill-down.story.ts:20-48` | Verified against the precedent | ✅ Resolved |

## Notes

- Items 2 and 3 change only `packages/examples/**` (demo code — the shipped-source JSDoc/no-ID bans
  apply in spirit, and examples are themselves agent-training material). Only item 1 changes shipped
  source (`packages/ui/src/split/**`, `packages/core` untouched — no theme role is added).
- `grabMark` adds public surface, so the plugin API reference will drift; the plan regenerates it
  with `yarn plugin:sync --fix` inside item 1's hardening step so `check-plugin` (part of
  `yarn verify`) stays green.
