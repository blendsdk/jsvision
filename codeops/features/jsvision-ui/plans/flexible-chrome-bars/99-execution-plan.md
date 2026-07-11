# Execution Plan — Flexible Chrome Bars

> **Feature**: jsvision-ui / flexible-chrome-bars · **CodeOps Skills Version**: 3.3.2
> **Progress**: 17/25 tasks (68%) · Last updated: 2026-07-11 14:44
> Single source of truth for progress — each task appears once. Spec-first ordering per feature phase
> (Spec Tests → red → Implementation → green → Impl Tests & Hardening). Commit via **/gitcm** (or
> **/gitcmp**) per the exec_plan commit mode — never raw git.

**Verify (every phase):** `yarn verify` (AR-17). Narrower loops noted per task.

---

## Phase 1 — Shared bar-layout foundation (internal helper)

Internal-only (no user-facing oracle → impl-first, validated through the bar oracles later). Spec 03-01.

- [x] **T-1.1** Add the pure `packRow(segments, total, startX?)` helper over the layout engine's
  `solveTrack`/apportion (`packages/ui/src/layout/apportion.ts`); implemented as a dedicated
  `layout/pack-row.ts` module (one of the two locations 03-01 offers). No barrel export. (AR-6, AR-7)
  ✅ (completed: 2026-07-11 14:07)
- [x] **T-1.2** Impl tests `pack-row.impl.test.ts` — empty, all-fixed (== left-pack), one flex, multi-flex
  (integer largest-remainder, exact sum), fixed-overflow (flex→0), non-zero `startX`. (07 § C) — 8 tests.
  ✅ (completed: 2026-07-11 14:07)

**Verify:** `yarn workspace @jsvision/ui test` green for `pack-row`.

---

## Phase 2 — StatusLine → general child-view container

Spec 03-02. Oracles ST-01…ST-07 + preserved status oracles.

### Session 1 — Spec tests (red)
- [x] **T-2.1** Write `packages/ui/test/status-bar.spec.test.ts` with ST-01…ST-07 (07 § A). Run — they
  fail (red: 6 failed, ST-06 parity green). Do **not** touch `app-shell.status.spec.test.ts` (preserved).
  ✅ (completed: 2026-07-11 14:28)

### Session 2 — Implementation (green)
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.2** Add `StatusItemView` + `statusItem(text, command?, key?)` in
  `packages/ui/src/status/status-item.ts`: accessor text (`string | () => string`), optional command,
  faithful per-item render (pressed/enabled style matrix, `~…~` accent), `measure()` → `{width, height:1}`,
  `focusable=false`. Retain the public `StatusItem` **type** so `StatusItemView` satisfies it and
  exposes `.command`/`.text`/`.key`. (AR-2, AR-3, AR-9, AR-10, AR-13)
  - **Preflight PF-004:** an accessor-text change must trigger `invalidateLayout()` (not just
    `invalidate()`) so a widened string re-measures the row and shifts neighbours (ST-04). Bind the
    accessor on **mount** (like `Text`) so eager construction at the 18 call sites needs no reactive owner.
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.3** Rewrite `StatusLine` as `extends Group` (`direction:'row'`, `postProcess`), owning
  interaction: `itemAt(x)` over command-item children only, press/drag/release + accelerator sweep +
  capture via the unchanged seam; `statusLine(children: View[])`. Passive segments (spacer/widget/
  command-less) are skipped by hit-test + accelerators. (AR-4, AR-5, AR-12, AR-20)
  - **Preflight PF-003:** set the group `background` to the `statusBar` bg so empty gap cells and
    trailing cells keep the full-row fill the current monolithic `draw()` produced (`statusline.ts:138`);
    otherwise ST-01's empty-gap assertion + the preserved trailing-cell pixel oracles regress.
  - **Preflight (safe):** no external code reads `StatusLine.items` — back the accelerator sweep with
    the command-item children instead.
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.4** Update `packages/ui/src/status/index.ts` — add `StatusItemView` (additive); keep
  `StatusLine`/`statusLine`/`statusItem`/`StatusItem`/`StatusLoopSeam`. Also added `StatusItemView` to the
  package barrel `src/index.ts`.
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.5** Green: ST-01…ST-07 pass **and** every preserved oracle
  (`app-shell.status.spec` + `app-shell.menu` + `app-shell.packaging.spec`) passes unmodified — full ui
  unit suite 1521 passed. Required pulling **T-4.1** (the `application.ts` layout merge) forward, since the
  status line now carries an internal `direction:'row'`.

### Session 3 — Impl tests & hardening
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.6** `status-bar.impl.test.ts` — `measure()` width (static+accessor), pressed/enabled style
  matrix, command-less skip in `itemAt`, accelerator sweep skipping passive. (07 § C) — 4 tests.
- [x] ✅ (completed: 2026-07-11 14:28) **T-2.7** JSDoc: `@example` on `statusLine`/`statusItem`/`StatusItemView` (user-facing, no TV/C++
  or CodeOps IDs); `yarn workspace @jsvision/ui check:docs` green. (AR-13)

**Verify:** `yarn workspace @jsvision/ui test` + `check:docs` green.

---

## Phase 3 — MenuBar flexible-title layout

Spec 03-03. Oracles ST-08…ST-10 + preserved menu oracles.

### Session 1 — Spec tests (red)
- [x] **T-3.1** Write `packages/ui/test/menu-flex.spec.test.ts` with ST-08…ST-10 (07 § A). Run — red.
  Do **not** touch `app-shell.menu.spec/impl` (preserved). ✅ (completed: 2026-07-11 14:44)

### Session 2 — Implementation (green)
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.2** Add the `{kind:'spacer', weight?}` `MenuItem` variant + `menuSpacer(weight?)` builder;
  make `titleOf`/`menuItemHotkey`/`menuItemLabel` return `''` for it (skipped by nav/hotkey). (AR-5, AR-19)
  - Mechanical fallout: extending the `MenuItem` union forced spacer guards in existing submenu-item
    code that narrows on `kind` (`controller.ts` isSelectable/firstSelectable/itemWidth/pickRow/itemHotkey,
    `popup.ts` row draw) — each treats a stray spacer as inert (spacers are top-level only).
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.3** Make `layoutTitles(tops, barWidth?)` + `titleIndexAt(tops, x, barWidth?)` width-aware via
  `packRow` — default (no width / no spacer) byte-identical to today; spacers are not emitted as titles
  (the returned titles keep their original node index). (AR-7, AR-8)
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.4** Thread the bar width: `MenuBar.draw` passes `ctx.size.width`; the click hit-test passes
  `this.bounds.width`; the controller passes `viewport().width` so popups anchor under the moved
  title. (AR-8)
  - **Preflight PF-002 (done):** threaded `viewport().width` into `openLevelForTop`'s `layoutTitles`
    call (not `openTop`). Also had to change its array-index `layoutTitles(tops)[index]` to
    `.find(t => t.index === index)` — titles now skip spacers, so an array position ≠ a node index.
  - Realizes **AR-5** (nav skips a spacer): `switchTop` (←→) now steps over spacer nodes. The plan's
    "existing filter" mechanism did not exist; this adds it. No-spacer bars are unaffected.
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.5** Export `menuSpacer` from `menu/index.ts` + the package barrel `src/index.ts` (additive).
  Green: ST-08…ST-10 pass **and** `app-shell.menu.spec` + `app-shell.menu.impl` pass unmodified (full ui
  suite 1532 passed).

### Session 3 — Impl tests & hardening
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.6** `menu-flex.impl.test.ts` — spacer skipped by helpers; `layoutTitles` with 0/1/2/weighted spacers;
  click-to-open anchor with a right-aligned title; ←→ steps over the spacer. (07 § C) — 4 tests.
- [x] ✅ (completed: 2026-07-11 14:44) **T-3.7** JSDoc: `@example` on `menuSpacer` + updated `layoutTitles`/`titleIndexAt`; `check:docs` green. (AR-13)

**Verify:** `yarn workspace @jsvision/ui test` + `check:docs` green.

---

## Phase 4 — App-shell integration, demo, kitchen-sink

Spec 03-04.

- [x] ✅ (completed: 2026-07-11 14:28 — pulled forward into Phase 2, a hard prerequisite for the preserved
  status oracle) **T-4.1** `application.ts` — merge the fixed-1-row size into each bar's existing layout
  (`{...layout, size:{fixed:1}}`) so StatusLine keeps `direction:'row'`; app-shell oracles stay green. (AR-11)
- [ ] **T-4.2** (Preflight PF-001, decision **B**) **Create** a new example
  `packages/examples/chrome-bars-demo/main.ts` — `<Exit><spacer fill><ProgressBar><clock>` status line +
  a right-aligned `~F1~ Help` menu via `menuSpacer()`; a ~1s timer bumps `value`/`clock` and emits a
  no-op command to flush a frame (unref'd); keep the TTY guard + `main().then(process.exit)` tail. Add a
  `"demo:chrome-bars": "tsx chrome-bars-demo/main.ts"` script to `packages/examples/package.json` (the
  `demo:playground` name is already taken by `keyboard-mouse-playground`). (AR-14)
- [ ] **T-4.3** Add `"chrome-bars-demo"` to `packages/examples/tsconfig.json` `include`; confirm
  `yarn workspace @jsvision/examples typecheck` now covers it. (AR-14)
- [ ] **T-4.4** Add `kitchen-sink/stories/status-bar.story.ts` (id `app-shell/status-bar`: spacer
  right-align + embedded `ProgressBar` + live clock + blurb/hint) and register it in
  `stories/index.ts`. (AR-15)
- [ ] **T-4.5** Green: `kitchen-sink.smoke.spec` picks up + renders the story; examples typecheck passes.

**Verify:** `yarn build` then `yarn workspace @jsvision/examples test` + `typecheck` green.

---

## Phase 5 — Full verify & regression sweep

- [ ] **T-5.1** `yarn verify` green end-to-end (lint + typecheck + build + unit test + `check:docs`) across
  all packages, including docs-site's live-example test/typecheck.
- [ ] **T-5.2** Regression audit: confirm **no** preserved spec-oracle file was modified; every preserved
  oracle (status/menu/packaging/app-shell suites) green. (07 § B)
- [ ] **T-5.3** Manual smoke on a real TTY: `yarn workspace @jsvision/examples demo:chrome-bars` shows
  `<Exit>———fill———<progress><clock>`, the progress advances, the clock ticks, Alt-X quits. (Piped run
  hits the TTY guard — note that as the headless path.)
- [ ] **T-5.4** Commit the feature via **/gitcm** (or **/gitcmp**), scope `status`/`menu`/`app-shell`.

**Verify:** `yarn verify` green; manual TTY smoke confirmed.

---

## Summary

- **Total phases:** 5 · **Total tasks:** 25 · **New spec oracles:** 10 (ST-01…ST-10) · **Preserved
  oracles:** status + menu + packaging + app-shell suites (unmodified).
- **New public surface (additive):** `StatusItemView`, accessor/optional-command `statusItem`,
  `menuSpacer`, width-aware `layoutTitles`/`titleIndexAt`. **No breaking changes** (AR-10).
- **Deferred (follow-up):** embedded passive widgets in the menu bar (AR-1); a `ToolBar` component (AR-18).

**To begin implementation:** use the exec_plan skill on `flexible-chrome-bars`.
