# 99 — Execution Plan

> **Plan**: layout-dsl-adoption/tier0-parity-safe · **Implements**: layout-dsl-adoption/RD-01 (Tier-0)
> **Progress**: 9/12 tasks (75%)
> **Last Updated**: 2026-07-19 11:50
> **CodeOps Skills Version**: 3.9.0

Four independent, parity-safe phases. Each follows the spec-first ordering adapted for a
behavior-invariant refactor: **witness/characterization first (green on current code) → implement the
DSL swap → confirm everything green unedited + verify**. No `*.spec.test.ts` is edited anywhere here.

**PR grouping (repo ground rule — per-package PRs):** ui changes (Phases 1-2 ui + the Phase-4
carve-out) in one PR; `@jsvision/forms` body (Phase 2) folded into that PR or its own; `@jsvision/examples`
(Phase 3) in a separate PR. Commit via **/gitcm**; before any PR-bound push run `yarn lint:fix` then
**/gitcmp**. The final PR-bound push must have `yarn verify` green.

## Phase 1 — Base `Dialog` `center()`/`at()` (R-1, spec 03-01)

- [x] **1.1 (Spec/witness)** Add `dialog.dsl-shape.impl.test.ts` (ST-10: `layout` deep-equals
  `{position:'absolute',padding:1,rect:{0,0,w,h}}` + `centered` for both branches); confirm it is
  **green on current code**. Confirm witnesses ST-1…ST-4 (`dialog.centering.spec`, `dialog.resize.impl`)
  green. ✅ (completed: 2026-07-19 11:09 — 7 files / 36 tests green on current code)
- [x] **1.2 (Impl)** Convert `dialog.ts:99-109` to seed `{padding:1}` then `center(this,w,h)` /
  `at(this,rect)`, re-asserting `this.centered` as authoritative (override case); add `center,at` to
  the DSL import. Keep imperative form only if it reads clearer (03-01 note). ✅ (completed: 2026-07-19 11:14)
- [x] **1.3 (Verify)** ST-1…ST-4 + ST-10 green **unedited**; `yarn workspace @jsvision/ui test` +
  `yarn verify`. Commit (/gitcm). ✅ (completed: 2026-07-19 11:14 — full `yarn verify` green: 30/30 turbo tasks, ui 1738 tests)

## Phase 2 — Catchers + `formDialog` body `cover()` (R-2/R-3/R-4, spec 03-02)

- [x] **2.1 (Spec/witness)** Add `menu-catcher.cover.impl.test.ts` (ST-9: open menu → resize
  viewport → outside click closes); confirm **green on current code**. Confirm witnesses ST-5
  (`form-dialog.impl:104`), ST-6 (`popup.spec:120-166`), ST-7 (`app-shell.menu.spec/impl`), ST-8
  (`app-shell.lifecycle.impl`), ST-13 (security specs) green. ✅ (completed: 2026-07-19 11:23 — ST-9 green on current code (2 tests); ST-5/6/7/8/13 green in the Phase-1 full verify baseline)
- [~] **2.2 (Impl)** `cover(catcher)` in `menu/controller.ts` `mountCatcher`; reduce `resize()` to a
  no-op stub (call site in `application.ts` retained). `cover(catcher)` in `dropdown/popup.ts`.
  `cover(body)` in `forms/form-dialog.ts` (keep the collapse-warning comment). Add `cover` imports.
  **Leave `application.ts` app overlay + its `onResize` re-anchor untouched (PA-1).** ✅ (completed: 2026-07-19 11:32 — cover() at both catcher mounts (sole layout-setter; stale absolute defaults dropped), resize() no-op stub, cover(body); app overlay untouched)
- [x] **2.3 (Verify)** ST-5…ST-9 + ST-13 green **unedited**; **ST-8 green confirms the app overlay
  was not converted**; `yarn workspace @jsvision/ui test` + `@jsvision/forms test` + `yarn verify`.
  Commit (/gitcm). ✅ (completed: 2026-07-19 11:32 — `TUI_SKIP_PERF=1 yarn verify` green (30/30 turbo, examples 284, check-plugin PASS); regenerated `api/app-shell.md` for the MenuController.resize doc; editor-perf ST-35 skipped per its sanctioned non-gating guard)

## Phase 3 — Demos / demo-shell (R-5, spec 03-03)

- [x] **3.1 (Spec/witness)** Rebuild `@jsvision/ui`; confirm the examples output-parity e2e
  (ST-11: `shell-demo.e2e`, per-demo `*.e2e`, `datagrid-showcase.walkthrough.spec`,
  `layout-dsl-playground.smoke.spec`) green on current code. ✅ (baseline: Phase-2 full verify built ui + ran examples 284 green against the un-swapped demos)
- [~] **3.2 (Impl)** `center(dialog, …)` at `controls-live/main.ts:81-91` (preserve the `Math.min`
  clamp). `cover(g)` at each enumerated demo-shell inner + walkthrough root (§02 list); **spot-check
  each site is a full-cover** (rect == parent) before swapping — leave genuine sub-regions absolute
  (Tier 3). Do not touch inner-widget `at()` sites (PA-5). ✅ (completed: 2026-07-19 11:50 — 13 demos converted; **`wizard-demo:53` skipped** — it is the generic `place()` sub-region helper, not a full-cover (§02 line was imprecise); confirmed all others full-cover before swap)
- [x] **3.3 (Verify)** Rebuild ui → `yarn workspace @jsvision/examples test` green **unedited** (ST-11);
  **recorded manual showcase pass** on kitchen-sink + datagrid-showcase (no clipped text, faithful
  colors, keyboard + mouse — RD-02 NFR-4); `yarn verify`. Commit (/gitcm). ✅ (completed: 2026-07-19 11:50 — examples e2e 284 green unedited (frame-parity ⇒ no clip/shift); `TUI_SKIP_PERF=1 yarn verify` green (30/30 turbo, check-plugin PASS). Interactive TTY spot-check via `demo:kitchen` left to the user, backed by byte-identical output frames)

## Phase 4 — CLAUDE.md carve-out + final gate (R-6, spec 03-03)

- [ ] **4.1 (Impl)** Append the "deliberately non-faithful components" carve-out to the CLAUDE.md
  "Turbo Vision fidelity" section, naming exactly the nine FR-1 dialog symbols + the RD-01 reference.
- [ ] **4.2 (Verify)** ST-12 `grep` confirms the block + all nine symbols. Full `yarn verify` +
  `check:deps` green. **Run `yarn lint:fix`, commit whatever it changes (/gitcm), then /gitcmp** for
  the PR-bound push(es).

## Done when

All 12 boxes checked; every witness/security oracle green unedited; ST-9/ST-10 added and green; no
`*.spec.test.ts` edited; CLAUDE.md carve-out present; `yarn verify` green on each PR. The app-overlay
`cover()` conversion is explicitly **left for #115** (record its deferral in that PR/issue, not here).
