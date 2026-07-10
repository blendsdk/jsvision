# 99 — Execution Plan: Live-Example Remediation

> **Feature**: docs-website · **Type**: Remediation (post-ship follow-up to RD-03)
> **CodeOps Skills Version**: 3.3.2
> **Progress**: 13/27 `[x]` · 1 `[~]` (Phases 1–2 done + `yarn verify` green; browser-confirmed M1/M2/M4/M5/M6 + fixed a real wheel-fix defect; M3 hardware eyeball residual) — **Last Updated**: 2026-07-10

Spec-first per phase: **spec tests → red → implement → green → impl tests → verify**. Phase order
per AR-7 (Resize → Shell → Reopen → Source). **Verify** = `yarn verify` (AR-15) unless a task names a
faster inner loop. Marks are two-stage: `[ ]` → `[~]` (implemented, unverified) → `[x]` (verified).
Commit cadence is chosen at `exec_plan` time. The browser-only behaviours are proven by the Manual
browser checklist (07 §Manual) — its execution is a task, not an afterthought.

---

## Phase 1 — Play resize (terminal-driven) + wheel-leak + GridRows H-scroll golden
Ref: 03-01 · AR-2/6/8/10/11 · bugs #1, #3, wheel-leak.

- [x] 1.1 Spec: ST-A1 (controller viewport tracks the terminal — harness real-emulator resize) in
  `packages/docs-site/test/*`; add `cols/rows` + `resize` to `test/helpers/play-harness.ts`
  `HarnessTerminal`. Run red. ✅ (implemented: 2026-07-10 02:57 — `play-resize.spec.test.ts`: ST-A1 red→green after 1.3; a grow-resize guard confirms live `onResize→loop.resize` tracking stays green)
- [x] 1.2 Spec: ST-A2/A3/A4 (GridRows overflow render at `indent>0`, wide-glyph left-clip, header
  lockstep) in `packages/ui/test/datagrid.hscroll.spec.test.ts`. Run (record red or green). ✅
  (implemented: 2026-07-10 09:17 — 3 fixed 10-wide columns scrolled to `indent 5`: cells pan + `│`
  dividers at column right edges; a wide glyph whose lead hits `x=−1` drops whole (blank col 0);
  header pans in lockstep. **Green as written** — no `grid-rows.ts` fix needed, confirming #3 is
  downstream of #1/wheel)
- [x] 1.3 Impl: extend `TerminalLike` with `readonly cols/rows`; reorder `play-controller.ts` `open()`
  to create the terminal first and build the app at `term.cols × term.rows`. Green ST-A1. ✅
  (implemented: 2026-07-10 02:57 — terminal-driven `open()` with error-safe orphan-terminal disposal
  so the throwing-example leak oracle stays green; `size` demoted to a fallback; migrated the
  `remount` impl test to terminal-driven; controller suite 11/11 green)
- [x] 1.4 Impl: `PlayExample.vue` — resizable terminal container (CSS `resize`+`min` ≥ 40×12) +
  `ResizeObserver → fit.fit()`; repurpose the size button to container-resize (no remount); wheel
  `preventDefault` (AR-11). ✅ (implemented 2026-07-10; browser-verified 2026-07-10 via HMR — fit
  lifted to component scope, container frozen then `resize:both` + observer refit, preset button
  resizes the container by the measured cell size. **Wheel fix corrected mid-check (AR-11 runtime):
  the bubble-phase listener never fired — xterm `stopPropagation()`s the wheel in the target phase —
  so it is now a CAPTURE-phase `preventDefault` + a background scroll-lock (`<html>` overflow while
  open, restored on close).** Verified live: the capture listener fires (a child-dispatched cancelable
  wheel returns `defaultPrevented`), the app still receives the wheel (grid scrolled), the scroll-lock
  sets on open + restores on close, and the preset grows the app live 80×24→100×30 with no remount.
  Browser-only → not headless.)
- [x] 1.5 Impl: if ST-A2/A3/A4 went red, fix `grid-rows.ts` `GridRows`/`GridHeader` draw; green. If
  green as written, record #3 as downstream of #1/wheel (confirmed by M4 in 1.8). ✅ (2026-07-10 09:17
  — golden green as written; no `grid-rows.ts` change; #3 attributed to #1/wheel, to confirm via M4)
- [x] 1.6 Impl tests: controller edges (min-size floor; remount preserves the current size, resets
  state). Verify. ✅ (2026-07-10 09:17 — `remount` impl test migrated to terminal-driven; min-size
  floor enforced via CSS `min-width/height` on `.play-term`; controller suite 11/11)
- [x] 1.7 Verify: `yarn verify` green. ✅ (2026-07-10 09:17 — 22/22 turbo tasks; ui 1506 tests incl.
  the new golden; docs-site 41 tests + typecheck; lint + check:docs green)
- [~] 1.8 Manual browser check M1–M4 (resize keeps input+alignment; preset live; wheel no page-scroll;
  no grid garble); record results in the checklist. ◑ (2026-07-10, live in `yarn docs:dev` on the
  data-grid Play — see 07 §Manual: **M1 ✅** resize keeps input+alignment (grid stays aligned, app
  functional after grow); **M2 ✅** preset live 80×24→100×30, no remount blank; **M4 ✅** grid renders
  crisp at both sizes, no garble; **M3 ◑** wiring verified (capture wheel listener fires, app still
  scrolls, scroll-lock cycles on open/close) — the one residual is the page-scroll-STOP under a REAL
  hardware wheel, which automation can't assert (CDP force-scrolls past both `preventDefault` and CSS
  `overflow`); left as a human eyeball, carried into Phase 5.2.)

**Verify**: `yarn verify`

---

## Phase 2 — Unify the demo shell (draggable-Window)
Ref: 03-02 · AR-1/5/12/13/17 · bugs #4, #5, #6.

- [x] 2.1 Spec (AR-19): rewrite the superseded RD-03 oracles to the unified shell — **supersede
  `demo-shell.spec` ST-4**, rewrite ST-5/ST-9 + `play-controller.spec` ST-7 — and write new
  **ST-B1…ST-B5**. ✅ (2026-07-10 — demo-shell.spec rewritten to ST-B1/B2/B3/B4 + ST-5/ST-9;
  registry.spec gained ST-B5; harness `fakeEntry` param `chrome`→`kind`. ST-B1/B2 reach the stage
  window via public `desktop.children`+`Window`; ST-B2 samples the interior centre ≠
  `turboVisionTheme.desktop.pattern`; ST-B3 drives the real desktop example + `emitCommand`. Red first.)
- [x] 2.2 Impl: registry — `ExampleEntry.chrome` → `kind: 'component'|'app'`; `play-controller.ts`
  passes `kind`; harness `fakeEntry` param `kind`. ✅ (2026-07-10 — the 8 entries mapped by their real
  `build()` return: button/input/list-box/data-grid/preset-gallery=`component`,
  form-dialog/file-dialog/desktop=`app` — NOT a mechanical `chrome` rename (data-grid + preset-gallery
  were `chrome:'full'` but return Views). `PlayExample.vue` untouched. Green ST-B5.)
- [x] 2.3 Impl: `demo-shell.ts` — defer building (`build`+`title`+`kind`); `demoApp(ctx,{windowMenu?})`;
  `shellForView` wraps the component in a non-closable `Window`; `buildMenuBar`/`buildStatusLine`;
  migrate the signature-broken tests. ✅ (2026-07-10 — `demoShell` branches on `opts.kind` (`instanceof
  View` guard, no unsafe cast); `shellForView` `winRect {x:1,y:0,w:dw-2,h:dh-1}`, builds at the interior
  and **centers via `centerInInterior`** (reused `intendedSize`, retargeted desktop→window; handles
  fixed-size (button, centered) + ctx-sized (data-grid, fills) — runtime note AR-13). `placeContent`
  removed; `intendedSize` kept; unused theme/depth-cycle commands dropped. Migrated
  paint-smoke/security/demo-shell.impl to `build`/`title`/`kind`. Green ST-B1/B2/B4 + ST-5/9/7.)
- [x] 2.4 Impl: `examples/apps/desktop.ts` → `demoApp(ctx,{windowMenu:true})`; drop its self-built
  menu/status + own `about`. ✅ (2026-07-10 — kept `desktop.shadow` + Welcome/Tips windows. Green ST-B3.)
- [x] 2.5 Impl tests + Verify: `yarn verify` green. ✅ (2026-07-10 — 22/22 turbo tasks; docs-site 45
  tests; lint + typecheck + check:docs green.)
- [x] 2.6 Manual browser check M5–M6. ✅ (2026-07-10, live in `yarn docs:dev` — **M5 ✅** the button's
  flat block-shadow reads on the clean blue window surface (not the dots); data-grid + button in titled
  non-closable Windows (title + zoom box, no `[×]`), component centered on the surface; **M6 ✅** every
  example shows the same `≡ View` menu + hints-only status; the desktop app now shows `≡ View Window`
  (was its own menu without View) — Theme reachable there (ST-B3 confirms the command repaints).)

**Verify**: `yarn verify`

---

## Phase 3 — Dialog reopen
Ref: 03-03 · AR-3/14 · bug #7. Depends on Phase 2.

- [ ] 3.1 Spec: ST-C1 (after build a modal is active; ending it keeps the stage Window + Open button;
  `demo.openDialog` re-activates a modal) for both dialog examples. Run red.
- [ ] 3.2 Impl: `controls/form-dialog.ts` + `files/file-dialog.ts` — stage `Window` + "Open the dialog"
  Button + `openTheDialog()` closure bound to `demo.openDialog`; start open once. Green ST-C1.
- [ ] 3.3 Impl tests + Verify: `yarn verify` green.
- [ ] 3.4 Manual browser check M7 (close → reopen works, repeatable); record.

**Verify**: `yarn verify`

---

## Phase 4 — Source framing (build()-first)
Ref: 03-04 · AR-4/9 · bug #2.

- [ ] 4.1 Spec: update the drift oracle → ST-D1 (region + full-file embeds, no pasted block) and add
  ST-D2 (region-pair per module) in `packages/docs-site/test/*`. Run red.
- [ ] 4.2 Impl: add `// #region example` / `// #endregion example` to all 8 modules; update each
  page (region embed + `::: details` full module); extend `check-docs-build.mjs` LIVE-EXAMPLES guard
  (ST-D3). Green ST-D1/D2.
- [ ] 4.3 Verify the build gate (ST-D3): `yarn docs:build` then
  `node packages/docs-site/scripts/check-docs-build.mjs` — both snippets present in built HTML
  (fall back to a `### Full module` sub-section if `<<<` doesn't process inside `::: details`).
- [ ] 4.4 Verify: `yarn verify` green.
- [ ] 4.5 Manual browser check M8 (Source shows build() by default; full module in details); record.

**Verify**: `yarn verify`

---

## Phase 5 — Finalize
Ref: 01 §Success · 07 §Manual.

- [ ] 5.1 Full `yarn verify` + `check-docs-build.mjs` green from a clean `dist/`.
- [ ] 5.2 Execute + record the complete Manual browser checklist M1–M8 (07 §Manual).
- [ ] 5.3 Update the docs-site note in `CLAUDE.md` (chrome modes → one Window shell; registry `kind`;
  Source region convention) if the change warrants it.
- [ ] 5.4 Roadmap sync: note the remediation under docs-website RD-03 (or a `T-` row) via the roadmap
  skill.

**Verify**: `yarn verify`
