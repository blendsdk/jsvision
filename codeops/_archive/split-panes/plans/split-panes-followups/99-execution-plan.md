# Execution Plan: Split-Panes Follow-ups

> **Feature**: split-panes · **Plan**: split-panes-followups
> **Type**: Full (lean) plan · **Branch**: `feat/split-panes` · **CodeOps Skills Version**: 3.8.0
> **Verify**: `CI=1 yarn verify` *(AR-9)*
> **Progress**: 13/13 tasks (100%) · **Last Updated**: 2026-07-17

Specification-first per phase: spec tests → red → implement → green → impl tests → verify. Marks are
two-stage: `[~]` on implementation, `[x]` only after its verify passes. Commit per the active
exec_plan commit mode (`/gitcmp` for commit+push).

Docs: [requirements](01-requirements.md) · [current-state](02-current-state.md) ·
[grabmark spec](03-01-grabmark-option.md) · [demos spec](03-02-demos.md) ·
[testing](07-testing-strategy.md) · [ambiguity register](00-ambiguity-register.md).

---

## Phase 1 — Reactive grab-mark option (shipped code) · F1–F6

The only shipped-source change. `@jsvision/core` untouched.

- [x] **1.1 Spec tests (red).** Write `packages/ui/test/split-grabmark.spec.test.ts` with
  ST-1…ST-4 ([testing §Specification](07-testing-strategy.md)). Run — expect ST-2/ST-3/ST-4 red
  (no `grabMark` yet), ST-1 may pass (locks the default). *(impl 2026-07-17; verified red: 3 failed | 1 passed — ST-1 green, ST-2/3/4 red as designed)*
- [x] **1.2 Implement (green).** Per [03-01](03-01-grabmark-option.md): add
  `SplitViewOptions.grabMark?: boolean`; add `readonly grabMark: Signal<boolean>` to `SplitView`
  (import `signal`, assign `signal(opts.grabMark ?? true)` in the constructor before the splitters);
  widen `SplitOwner` with `grabMark: Signal<boolean>` (import `type Signal`); in `Splitter`, extend
  the `onMount` bind to read `owner.grabMark()` and gate the `▓` draw behind it. Add/extend JSDoc
  `@example`s. Verify ST-1…ST-4 green. *(impl 2026-07-17; ST-1…ST-4 green; shipped split suite 39/39 green — backward compat holds)*
- [x] **1.3 Impl tests.** Write `packages/ui/test/split-grabmark.impl.test.ts` with ST-6 (col) +
  ST-7 (multiple splitters). Verify green. *(impl 2026-07-17; grab-mark suite 6/6 green)*
- [x] **1.4 Story `g` toggle.** In `packages/examples/kitchen-sink/stories/split.story.ts`, make the
  root a `preProcess = true` `Group` subclass whose `onEvent` flips `grabMark` on both splits on key
  `g` (arrows untouched); add a `‹g› grab mark` hint. *(AR-4, AR-12)* *(impl 2026-07-17; `SplitStoryRoot` + hint + blurb updated)*
- [x] **1.5 Story impl test.** Write `packages/examples/test/split-story.impl.test.ts` with ST-8
  (synthetic `g` flips every `SplitView.grabMark`, and back). Verify green. *(impl 2026-07-17; ST-8 green after building @jsvision/ui — examples consume the built dist)*
- [x] **1.6 Docs/plugin + full verify.** Run `yarn plugin:sync --fix` and commit the regenerated API
  reference; confirm `scripts/check-jsdoc.mjs` green + a plain grep for banned CodeOps IDs across
  `packages/ui/src/split/**`; `yarn check:deps` green; **`CI=1 yarn verify` green**. Commit. *(impl 2026-07-17; plugin:sync --fix regenerated containers.md (+grabMark surface); split-source banned-ID grep clean; CI=1 yarn verify green — 26/26 turbo tasks, check-plugin PASS)*

## Phase 2 — Scroll-in-a-pane story (examples) · F7–F9

- [x] **2.1 Spec test (red).** Append ST-5 to
  `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (story registered, category `Layout`,
  paints a `/Item 0/` label). Run — expect red (story missing). *(impl 2026-07-17; verified red: ST-5 fails "expected undefined to be truthy")*
- [x] **2.2 Implement (green).** Create
  `packages/examples/kitchen-sink/stories/split-scroll.story.ts` (a `row` split: a 100-item
  `ListBox` direct pane child beside an info pane) per [03-02](03-02-demos.md); register it in
  `stories/index.ts`. Verify ST-5 + the generic smoke loop green. *(impl 2026-07-17; ST-5 + generic loop green — 63 smoke tests pass)*
- [x] **2.3 Full verify.** **`CI=1 yarn verify` green.** Commit. *(impl 2026-07-17; CI=1 yarn verify green — 26/26 turbo tasks, check-plugin PASS)*

## Phase 3 — amiga-clock "Clocks" split window (examples) · F10–F12

No automated test (AR-8).

- [x] **3.1 Implement.** Edit `packages/examples/amiga-clock/main.ts` only: import `SplitView`; add a
  4th `Clocks` `Window` with a `position:'fill'` nested grid `row:[ Analog | col:[ Digital / Boing ] ]`
  using **fresh** clock instances bound to the same `now`/`frame` signals; keep the three existing
  windows unchanged. Tune window size + `minSize`s so nothing clips. Per [03-02](03-02-demos.md). *(impl 2026-07-17; 60×20 window, grid minSize [24,24] / right col minSize [9,9], spec defaults)*
- [x] **3.2 Verify.** `yarn typecheck` green; a manual `yarn workspace @jsvision/examples
  demo:amiga-clock` sanity note; **`CI=1 yarn verify` green.** Commit. *(impl 2026-07-17; amiga-clock is outside the tsconfig include (runs via tsx) — validated my edit type-clean via a throwaway include-config, tsc exit 0; CI=1 yarn verify green — 26/26 tasks. Live TTY visual run is the user's manual step (no TTY here); window/minSize values are cosmetic defaults, may want live tuning per 03-02.)*

## Phase 4 — Close-out

- [x] **4.1 Roadmap + requirements.** Check off `01-requirements.md` F1–F12 + acceptance criteria;
  update the roadmap via the roadmap skill (feature row, then cascade to portfolio `00-roadmap.md`);
  note the follow-ups on the split-panes row. *(impl 2026-07-17; all 18 checkboxes ✅; portfolio roadmap split-panes row → +followups ✅ Done; no feature-level roadmap exists — split-panes is tracked only in the portfolio)*
- [x] **4.2 Final gate.** Confirm `check-plugin` green (no new class ⇒ no component-catalog entry;
  only the API reference changed, done in 1.6); final **`CI=1 yarn verify` green.** Commit any
  residual doc changes. *(impl 2026-07-17; check-plugin PASS; final CI=1 yarn verify green — 26/26 tasks)*

---

## Progress

| Phase | Tasks | Done |
|-------|-------|------|
| 1 — grab-mark option | 6 | 6 |
| 2 — scroll story | 3 | 3 |
| 3 — clock split window | 2 | 2 |
| 4 — close-out | 2 | 2 |
| **Total** | **13** | **13** |

## Notes

- Only Phase 1 touches shipped source; it carries the full JSDoc/`check-jsdoc`/plugin-sync weight.
- Phases are independent verified deliverables — good per-phase commit boundaries.
