# 99 — Execution Plan: Live-Example Remediation

> **Feature**: docs-website · **Type**: Remediation (post-ship follow-up to RD-03)
> **CodeOps Skills Version**: 3.3.2
> **Progress**: 6/27 `[x]` · 2 `[~]` (Phase 1 code done + `yarn verify` green; M1–M4 manual browser pending) — **Last Updated**: 2026-07-10 09:17

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
- [~] 1.4 Impl: `PlayExample.vue` — resizable terminal container (CSS `resize`+`min` ≥ 40×12) +
  `ResizeObserver → fit.fit()`; repurpose the size button to container-resize (no remount); wheel
  `preventDefault` while focused (AR-11). ✅ (implemented: 2026-07-10 09:17 — fit lifted to component
  scope, container frozen then `resize:both` + observer refit, size button resizes the container via
  the measured cell size, wheel `preventDefault` on the terminal host. **Browser-only → verified by
  M1–M4, not headless.**)
- [x] 1.5 Impl: if ST-A2/A3/A4 went red, fix `grid-rows.ts` `GridRows`/`GridHeader` draw; green. If
  green as written, record #3 as downstream of #1/wheel (confirmed by M4 in 1.8). ✅ (2026-07-10 09:17
  — golden green as written; no `grid-rows.ts` change; #3 attributed to #1/wheel, to confirm via M4)
- [x] 1.6 Impl tests: controller edges (min-size floor; remount preserves the current size, resets
  state). Verify. ✅ (2026-07-10 09:17 — `remount` impl test migrated to terminal-driven; min-size
  floor enforced via CSS `min-width/height` on `.play-term`; controller suite 11/11)
- [x] 1.7 Verify: `yarn verify` green. ✅ (2026-07-10 09:17 — 22/22 turbo tasks; ui 1506 tests incl.
  the new golden; docs-site 41 tests + typecheck; lint + check:docs green)
- [~] 1.8 Manual browser check M1–M4 (resize keeps input+alignment; preset live; wheel no page-scroll;
  no grid garble); record results in the checklist. ⏳ (browser verification pending — code committed
  verify-green; run in `yarn docs:dev`)

**Verify**: `yarn verify`

---

## Phase 2 — Unify the demo shell (draggable-Window)
Ref: 03-02 · AR-1/5/12/13/17 · bugs #4, #5, #6.

- [ ] 2.1 Spec (AR-19): rewrite the superseded RD-03 oracles to the unified shell — **supersede
  `demo-shell.spec` ST-4**, rewrite ST-5/ST-9 + `play-controller.spec` ST-7 (03-02 §Test migration) —
  and write new **ST-B1…ST-B5** (component in a non-closable titled Window; interior on the window
  surface; desktop uses the shared menu + reachable Theme/Depth; status = hints only; registry `kind`
  parity) in `packages/docs-site/test/*`. Run red.
- [ ] 2.2 Impl: registry — `ExampleEntry.chrome` → `kind: 'component'|'app'` (8 entries + type +
  parity test); `play-controller.ts:134` reads `entry.kind`; harness `fakeEntry` param `chrome` →
  `kind`. (`PlayExample.vue` is untouched — it never reads `chrome`.) Green ST-B5.
- [ ] 2.3 Impl: `demo-shell.ts` — defer building (`build`+`title`+`kind`); `demoApp(ctx,{windowMenu})`;
  `shellForView` wraps the component in a non-closable `Window` at the interior size; `buildMenuBar`
  (System/View[/Window]) + `buildStatusLine` (hints); remove `placeContent`/`intendedSize`. Migrate
  the signature-broken tests to `build`/`title`/`kind` (`paint-smoke.spec:37`, `demo-shell.impl:43/59`,
  `security.spec:34` — 03-02 §Test migration). Green ST-B1/B2/B4 + the rewritten ST-5/ST-9/ST-7.
- [ ] 2.4 Impl: `examples/apps/desktop.ts` → `demoApp(ctx,{windowMenu:true})`; drop its self-built
  menu/status + own `about`. Green ST-B3.
- [ ] 2.5 Impl tests + Verify: `yarn verify` green.
- [ ] 2.6 Manual browser check M5–M6 (flat shadow on window surface; consistent menu + Theme/Depth
  everywhere incl. desktop); record.

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
