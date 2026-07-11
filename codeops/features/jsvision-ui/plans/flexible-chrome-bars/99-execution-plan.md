# Execution Plan — Flexible Chrome Bars

> **Feature**: jsvision-ui / flexible-chrome-bars · **CodeOps Skills Version**: 3.3.2
> **Progress**: 0/25 tasks (0%)
> Single source of truth for progress — each task appears once. Spec-first ordering per feature phase
> (Spec Tests → red → Implementation → green → Impl Tests & Hardening). Commit via **/gitcm** (or
> **/gitcmp**) per the exec_plan commit mode — never raw git.

**Verify (every phase):** `yarn verify` (AR-17). Narrower loops noted per task.

---

## Phase 1 — Shared bar-layout foundation (internal helper)

Internal-only (no user-facing oracle → impl-first, validated through the bar oracles later). Spec 03-01.

- [ ] **T-1.1** Add the pure `packRow(segments, total, startX?)` helper over the layout engine's
  `solveTrack`/apportion (`packages/ui/src/layout/apportion.ts`); co-locate in `menu/builders.ts` or a
  new `layout/pack-row.ts`. No barrel export. (AR-6, AR-7)
- [ ] **T-1.2** Impl tests `pack-row.impl.test.ts` — empty, all-fixed (== left-pack), one flex, multi-flex
  (integer largest-remainder, exact sum), fixed-overflow (flex→0), non-zero `startX`. (07 § C)

**Verify:** `yarn workspace @jsvision/ui test` green for `pack-row`.

---

## Phase 2 — StatusLine → general child-view container

Spec 03-02. Oracles ST-01…ST-07 + preserved status oracles.

### Session 1 — Spec tests (red)
- [ ] **T-2.1** Write `packages/ui/test/status-bar.spec.test.ts` with ST-01…ST-07 (07 § A). Run — they
  fail (red). Do **not** touch `app-shell.status.spec.test.ts` (preserved).

### Session 2 — Implementation (green)
- [ ] **T-2.2** Add `StatusItemView` + `statusItem(text, command?, key?)` in
  `packages/ui/src/status/status-item.ts`: accessor text (`string | () => string`), optional command,
  faithful per-item render (pressed/enabled style matrix, `~…~` accent), `measure()` → `{width, height:1}`,
  `focusable=false`. Retain the public `StatusItem` **type** so `StatusItemView` satisfies it and
  exposes `.command`/`.text`/`.key`. (AR-2, AR-3, AR-9, AR-10, AR-13)
- [ ] **T-2.3** Rewrite `StatusLine` as `extends Group` (`direction:'row'`, `postProcess`), owning
  interaction: `itemAt(x)` over command-item children only, press/drag/release + accelerator sweep +
  capture via the unchanged seam; `statusLine(children: View[])`. Passive segments (spacer/widget/
  command-less) are skipped by hit-test + accelerators. (AR-4, AR-5, AR-12, AR-20)
- [ ] **T-2.4** Update `packages/ui/src/status/index.ts` — add `StatusItemView` (additive); keep
  `StatusLine`/`statusLine`/`statusItem`/`StatusItem`/`StatusLoopSeam`.
- [ ] **T-2.5** Green: ST-01…ST-07 pass **and** `app-shell.status.spec` + `app-shell.packaging.spec`
  pass unmodified. Fix code until green (spec-first).

### Session 3 — Impl tests & hardening
- [ ] **T-2.6** `status-bar.impl.test.ts` — `measure()` width (static+accessor), pressed/enabled style
  matrix, command-less skip in `itemAt`, accelerator sweep skipping passive. (07 § C)
- [ ] **T-2.7** JSDoc: `@example` on `statusLine`/`statusItem`/`StatusItemView` (user-facing, no TV/C++
  or CodeOps IDs); `yarn workspace @jsvision/ui check:docs` green. (AR-13)

**Verify:** `yarn workspace @jsvision/ui test` + `check:docs` green.

---

## Phase 3 — MenuBar flexible-title layout

Spec 03-03. Oracles ST-08…ST-10 + preserved menu oracles.

### Session 1 — Spec tests (red)
- [ ] **T-3.1** Write `packages/ui/test/menu-flex.spec.test.ts` with ST-08…ST-10 (07 § A). Run — red.
  Do **not** touch `app-shell.menu.spec/impl` (preserved).

### Session 2 — Implementation (green)
- [ ] **T-3.2** Add the `{kind:'spacer', weight?}` `MenuItem` variant + `menuSpacer(weight?)` builder;
  make `titleOf`/`menuItemHotkey`/`menuItemLabel` return `''` for it (skipped by nav/hotkey). (AR-5, AR-19)
- [ ] **T-3.3** Make `layoutTitles(tops, barWidth?)` + `titleIndexAt(tops, x, barWidth?)` width-aware via
  `packRow` — default (no width / no spacer) byte-identical to today. (AR-7, AR-8)
- [ ] **T-3.4** Thread the bar width: `MenuBar.draw` passes `ctx.size.width`; the click hit-test passes
  the bar width; `MenuController.openTop` passes `viewport().width` so popups anchor under the moved
  title. (AR-8)
- [ ] **T-3.5** Export `menuSpacer` from `menu/index.ts` (additive). Green: ST-08…ST-10 pass **and**
  `app-shell.menu.spec` + `app-shell.menu.impl` pass unmodified.

### Session 3 — Impl tests & hardening
- [ ] **T-3.6** `menu-flex.impl.test.ts` — spacer skipped by helpers; `layoutTitles` with 0/1/2 spacers;
  `openTop` anchor x with a right-aligned title. (07 § C)
- [ ] **T-3.7** JSDoc: `@example` on `menuSpacer` + updated `layoutTitles`; `check:docs` green. (AR-13)

**Verify:** `yarn workspace @jsvision/ui test` + `check:docs` green.

---

## Phase 4 — App-shell integration, demo, kitchen-sink

Spec 03-04.

- [ ] **T-4.1** `application.ts` — merge the fixed-1-row size into each bar's existing layout
  (`{...layout, size:{fixed:1}}`) so StatusLine keeps `direction:'row'`; app-shell oracles stay green. (AR-11)
- [ ] **T-4.2** Extend `packages/examples/playground/main.ts` — `<Exit><spacer fill><ProgressBar><clock>`
  status line + a right-aligned `~F1~ Help` menu via `menuSpacer()`; a ~1s timer bumps `value`/`clock`
  and emits a no-op command to flush a frame (unref'd); keep the TTY guard + exit tail. (AR-14)
- [ ] **T-4.3** Add `"playground"` to `packages/examples/tsconfig.json` `include`; confirm
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
- [ ] **T-5.3** Manual smoke on a real TTY: `yarn workspace @jsvision/examples playground` shows
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
