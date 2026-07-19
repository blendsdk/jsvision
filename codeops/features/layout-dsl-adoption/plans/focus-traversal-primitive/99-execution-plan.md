# 99 — Execution Plan

> **Plan**: layout-dsl-adoption/focus-traversal-primitive · **Implements**: RD-01 (FR-2/FR-3 enabler)
> **Progress**: 8/11 tasks (73%)
> **Last Updated**: 2026-07-19
> **CodeOps Skills Version**: 3.9.0

Spec-first for a core behavior change: **spec oracles red → implement → green (witnesses unedited) →
impl tests + docs → non-regression sweep → PR**. One PR against `@jsvision/ui`. No `*.spec.test.ts`
witness is edited (AR-7). Verify = `TUI_SKIP_PERF=1 yarn verify` (+ `yarn bench` no-regression).
Commit via **/gitcm**; before the PR-bound push run `yarn lint:fix` then **/gitcmp**.

> **Commit boundaries (spec-first + `--auto-commit`).** The RED tasks (1.1, 1.2, 2.1, 2.2) pass through
> an intentionally red suite and are therefore not independently committable; the first green,
> committable state is task 2.3. Auto-commit fires at each green boundary (2.3, phase 3, phase 4) —
> never on a red suite.

## Phase 1 — Spec oracles (RED) (R-1…R-4, spec 07)

- [x] **1.1 (Spec)** Add `packages/ui/test/event.focus-traversal.spec.test.ts` with ST-F1…ST-F7 (07
  table), through the public loop surface. Confirm they are **RED on current code**. *(Implemented +
  verified 2026-07-19: 6/7 RED — ST-F1/F2/F3/F4/F6/F7 fail on the group-scoped `advance`. Accuracy
  note: the pre-run red-list predicted F5 and omitted F4; in fact **F4 is red** and **F5 passes**
  before and after — F5 is a confinement guard (group-scoping structurally cannot escape a modal), so
  it can only be green. The behavioral contract is unchanged; both are green after implementation.)*
- [x] **1.2 (Witness baseline)** Confirm witnesses W-1…W-9 (`event.focus.spec`, `event.focus.impl`,
  `event.hardening.spec`) are **green on current code**, unedited — the pre-change baseline.
  *(Verified 2026-07-19: 21/21 green across the three witness files, unedited.)*

## Phase 2 — Implement the traversal (R-1…R-6, spec 03-01)

- [x] **2.1 (Impl)** In `event/focus.ts`: add `scope` to `FocusManager.focusNext`/`focusPrev`; rewrite
  `advance(direction, scope)` as the scope-ceilinged tree-order climb (`siblingCandidate` + `enterEnd`,
  preserving anchor-recovery). Capture the prior-focused leaf **before** resetting the `current` of every
  group the climb bubbles out of (so the blur targets the right leaf and a wrap is tree-order, not
  last-visited). Forward descent reuses restore-or-first; reverse descent uses a new `descendLast` helper
  (restore-or-last) so Shift-Tab is the exact inverse of Tab. `focusInto`/`focusView`/`getFocused`/
  `focusedLeafIn`/`isFocusable` external contracts unchanged. *(Implemented 2026-07-19: added
  `focusLeafFrom` (flip-from-captured-old), `descendForward`/`descendLast`/`descend`, `findLastReceiver`,
  `isWithin`, `siblingCandidate`, `enterEnd`; `focusInto` = `descendForward(view, getFocused())`.)*
- [x] **2.2 (Wiring)** In `event/event-loop.ts`: pass `this.scopeRoot()` at the public
  `focusNext()`/`focusPrev()` and at `routeContext.focusNext`/`focusPrev` (scope already computed).
  Verify `event/dispatch.ts` needs no behavior change (view-facing `focusNext`/`focusPrev` stay
  parameterless). *(Done 2026-07-19: two call sites updated; `dispatch.ts` unchanged — its `RouteContext`
  `focusNext`/`focusPrev` are parameterless and the loop supplies the scope.)*
- [x] **2.3 (Green)** ST-F1…ST-F7 green; **W-1…W-9 green unedited**. *(Verified 2026-07-19: 27/27 across
  the ST-F + 3 witness files; full `@jsvision/ui` unit suite 1747/1747 green; `tsc --noEmit` clean; no
  witness edited. Commit via /gitcmp per `--auto-commit`.)*

## Phase 3 — Impl tests, docs, perf (R-7, NFR-5, spec 07)

- [x] **3.1 (Impl tests)** Add `event.focus-traversal.impl.test.ts` (IMP-1…IMP-4): empty-start
  first/last, disabled-anchor recovery under nesting, no per-frame alloc, `scope=null` no-op.
  *(Done 2026-07-19: 4/4 green; IMP-2 also covers the bubble-out when a group is exhausted; IMP-4 tests
  the manager directly since the public loop only reaches `scope=null` before mount.)*
- [x] **3.2 (Docs)** Update JSDoc on `focusNext`/`focusPrev` — tree-order + scope ceiling +
  restore-on-non-Tab-entry — with a copy-pasteable `@example` (Tab cycling a `col(row(input),
  row(ok,cancel))`). `why`-comments only; no CodeOps/TV refs. `yarn check:docs` green. *(Done 2026-07-19:
  rich `@example` on the public `EventLoop.focusNext` in `types.ts`; `FocusManager` interface + `advance`
  impl carry tree-order prose. `FocusManager` is internal (not doc-gated). check:docs: 0 banned refs,
  0 missing `@example`.)*
- [x] **3.3 (Perf)** `yarn bench` shows no hot-widget regression (16 ms off-CI ceiling); confirm IMP-3.
  *(Done 2026-07-19: compose+diff median 3.0 ms / p95 3.7 ms — far under 16 ms; the change touches only
  the keypress focus path, never the renderer. IMP-3 green.)*

## Phase 4 — Non-regression sweep, kitchen-sink, PR (AR-8/AR-11, spec 02)

- [ ] **4.1 (Sweep)** First **enumerate any widget that keymap-binds `tab`** — those are the *only*
  Tab-consumers (an unbound Tab is intercepted in `route()` before any view's `onEvent`, so no view can
  consume it), and they are unaffected because a bound `tab` becomes a command before the focus step; the
  editor binds none (Ctrl-Q/Ctrl-K prefixes). Note `TabView` plain-Tab now escapes the active page into the
  next sibling by design. Then run full `TUI_SKIP_PERF=1 yarn verify` across the monorepo — especially
  `@jsvision/ui` (editor/split-view/tab-view/list), `@jsvision/forms` (formDialog), `@jsvision/files`
  (file/chdir), `@jsvision/examples`. Any behavioral test that flips is a real regression to investigate
  (expected: only *new* Tab reachability, which no existing test asserts). Record the pass.
- [ ] **4.2 (Kitchen-sink)** Confirm no new **visual component** is introduced (engine-only capability),
  so no new showcase story is required (AR-8); the traversal is proven by ST-F# and exercised by the
  downstream flex-dialog stories. Record this determination.
- [ ] **4.3 (PR)** `yarn lint:fix`, commit whatever it changes (/gitcm), full verify green, then
  **/gitcmp** for the PR-bound push. Open the PR citing the new companion issue; note it is a
  prerequisite of #115 + #120.

## Done when

All 11 boxes checked; ST-F1…F7 + IMP-1…IMP-4 green; **every witness W-1…W-9 green unedited**; no
`*.spec.test.ts` edited; `TUI_SKIP_PERF=1 yarn verify` + `check:docs` green; `yarn bench`
no-regression; JSDoc `@example` present on the changed methods; the companion issue + roadmap row
reflect the primitive as a prerequisite of #115/#120.
