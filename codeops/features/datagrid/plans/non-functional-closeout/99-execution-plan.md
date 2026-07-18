# Execution Plan — non-functional-closeout

> **Implements**: datagrid/RD-14 · **CodeOps Skills Version**: 3.9.0
> **Progress**: 14/24 tasks (58%) — exec_plan started 2026-07-18 (`--auto-commit`); Phase 0 ✅ · Phase 1 ✅ (`18cd2291`) · Phase 2 ✅
> **Verify** (every task): `yarn verify` — perf specs auto-skip under `CI` / `TUI_SKIP_PERF`.

Specification-first per phase: **Spec tests → red → implement → green → impl tests & hardening**.
Commits go through **/gitcm** (no raw git in this plan). Keep subjects lowercase-leading
(commitlint). Run **`yarn lint:fix`** before the final PR-bound push and commit what it changes
(prime directive).

This is the single source of truth for progress — each task appears exactly once.

## Phase 0 — Setup (enabling)

- [x] 0.1 Add `@xterm/headless: "^6.0.0"` to `packages/datagrid/package.json` devDependencies (AR-5); run `yarn install`. _(2026-07-18: added; resolves from root node_modules, already in yarn.lock:1829; `yarn install` clean.)_
- [x] 0.2 _(2026-07-18: probe importing both `../../core/test/golden-screen-helpers.js` + `../../core/bench/frame-bench.mjs` reproduced `TS6059` + `TS7016`; added an `exclude` for the 3 specs to `tsconfig.typecheck.json`; proved a cross-package-importing file under an excluded name typechecks green; removed the probe; clean baseline `yarn workspace @jsvision/datagrid typecheck` green.)_ **Prove the cross-package imports typecheck, not just resolve (PF-002).** Wire a throwaway spec importing both `../../core/test/golden-screen-helpers.js` **and** `../../core/bench/frame-bench.mjs`, then run `yarn workspace @jsvision/datagrid typecheck`. It fails as-is (`TS6059` — cross-package `.ts` outside `rootDir:"."`; `TS7016` — declaration-less `.mjs`) because datagrid, unlike core, typechecks `test/`. Fix by **excluding** the three cross-package-importing specs (`golden-screen`, `a11y-golden`, `perf-grid-bench`) from `packages/datagrid/tsconfig.typecheck.json` (mirroring core's src-only typecheck); they stay covered by vitest at run time. `render-bytes-damage` + `callback-isolation` specs import nothing cross-package and stay typechecked. Confirm `yarn workspace @jsvision/datagrid typecheck` green before Phase 1.

## Phase 1 — Golden-screen & a11y (AC-3) · ST-1, ST-2, ST-3

**Session 1 — Spec tests (red)**
- [x] 1.1 _(2026-07-18: `test/fixtures/golden-grid.ts` — seeds the four roles on distinct cells via the body's injected `dirty`/`errors`/`selectedKeys` registries (deterministic, no focus-stealing edit) + `loop.focusView(body)` for `gridCursor`; a two-key `SortHeader` paints `▲`/`▼` with no funnel `▽`; a manual perimeter frame gives `┌─│` — `ScreenBuffer.box` `fillRect`s its interior so a `set`-based ring is used instead. Geometry validated via a throwaway probe.)_ Build the shared fixture grid pre-seeded into the four role states. **Non-overlapping** per PF-006. `test/fixtures/golden-grid.ts`.
- [x] 1.2 _(2026-07-18: `test/golden-screen.spec.test.ts` — ST-1 across 4 depths reads each role cell's depth-correct colour MODE (band roles on bg, fg-only dirty on fg) + a distinctness guard.)_ Write `test/golden-screen.spec.test.ts` (ST-1).
- [x] 1.3 _(2026-07-18: `test/a11y-golden.spec.test.ts` — ST-2 mono/NO_COLOR every role cell uncoloured + painted-cell render-intact check (no `reverseState()`, PF-001); ST-3 `{boxDrawing:false, ambiguousWide:true}` → `┌─│•▲▼`→`+-|*^v` + whole-frame no-non-ASCII scan, `▽`/`…` excluded, PF-003.)_ Write `test/a11y-golden.spec.test.ts` (ST-2, ST-3).
- [x] 1.4 _(2026-07-18: 7/7 green. ST-1/ST-3 green as written; ST-2 required one correction to my own render-intact assertion — the mono profile also downgrades box-drawing `┌→+`, so "intact" = a painted-cell count, not a specific surviving glyph. No grid/role/fallback defect surfaced.)_ Run the suite; record red/green per ST.

**Session 2 — Implementation (green)**
- [x] 1.5 _(2026-07-18: all green on write — the emulator round-trip surfaced no grid/role/fallback gap; roles downsample cleanly at every depth and all grid glyphs have ASCII fallbacks.)_ Make ST-1/ST-2/ST-3 green.

**Session 3 — Hardening**
- [x] 1.6 _(2026-07-18: full `yarn verify` green — 30/30 turbo; 664 datagrid tests incl. kitchen-sink smoke; `check:deps`/`check:docs` clean; `yarn lint:fix` clean. Committed `18cd2291` (Phase 0+1, incl. the RD-14 plan/preflight record) and pushed to `feat/editable-data-grid`.)_ Full `yarn verify`; confirm `kitchen-sink.smoke.spec.test.ts` still green and `check:deps` clean. Commit.

## Phase 2 — Perf bench & bytes ∝ damage (AC-1, AC-2) · ST-4, ST-5

**Session 1 — Spec tests**
- [x] 2.1 _(2026-07-18: `test/fixtures/perf-grid.ts` — a 60×22 eager `fromRows(signal(rows),{rowKey})` grid, 5 columns, 30 rows (fills the 21 visible), bare `createRenderRoot` with an explicit `defaultTheme`.)_ Build the 60×22 eager `fromRows` fixture.
- [x] 2.2 _(2026-07-18: `test/perf-grid-bench.spec.test.ts` — grid built once (outside the timed region, PF-005); each iter forces a full recompose via `setTheme` (no geometry change → no re-layout) + `flush` + `serialize(buffer,null)`; median over 200 warmed iters vs 16 ms; `median`/`p95`/`perfBudgetMode` from the cross-package bench.)_ Write `test/perf-grid-bench.spec.test.ts` (ST-4).
- [x] 2.3 _(2026-07-18: `test/render-bytes-damage.spec.test.ts` — explicit `buffer().clone()` snapshot + core standalone `serialize(base,null)`/`serialize(after,base)`; `rr.serialize()` was NOT usable as the "full first paint" because the grid schedules a reactive post-mount repaint that empties the cached diff — runtime AR-14.)_ Write `test/render-bytes-damage.spec.test.ts` (ST-5).
- [x] 2.4 _(2026-07-18: off-CI both assert green; `CI=1` logs `median 2.065ms p95 3.012ms` and skips the assert. Both behave.)_ Run off-CI (assert path) and with `CI=1` (skip/log path).

**Session 2 — Implementation (green)**
- [x] 2.5 _(2026-07-18: no finding — 60×22 compose+diff median ≈2 ms, well within the 16 ms budget; single-cell diff ≪ full/10. Nothing relaxed.)_ Resolve any genuine perf/proportionality finding (expected none).

**Session 3 — Hardening**
- [x] 2.6 _(2026-07-18: `test/render-bytes-damage.impl.test.ts` — unchanged-frame → 0 diff bytes + whole-row change > single-cell yet < full/2. Full `yarn verify` green (30/30 turbo) with the concurrently-edited RD-16 leftover isolated. Committed + pushed.)_ Optional `*.impl.test.ts` edges. Full `yarn verify`. Commit.

## Phase 3 — Callback isolation (Should-Have, extends AC-7) · ST-6, ST-7

**Session 1 — Spec tests (red)**
- [x] 3.1 _(2026-07-18: `test/callback-isolation.spec.test.ts` — ST-6 (mount + painted-frame read), ST-7 (pure `sortRowsMulti` + grid-level `sortBy`). All 3 RED — the throw propagated from `sort.ts:63` / the format broke the paint.)_ Write `test/callback-isolation.spec.test.ts`. Confirm **red**.

**Session 2 — Implementation (green)**
- [x] 3.2 _(2026-07-18: `column.ts` accessor — `try { c.format(v,row) } catch { String(v) }`, mirroring the export-path guard.)_ Guard the on-screen formatter.
- [x] 3.3 _(2026-07-18: `sort.ts` `compareOneKey` — `col.compare` wrapped in try/catch, fallback `compareValues(va,vb)`; stays below the nil short-circuit so a custom comparator never sees a null.)_ Guard the comparator.
- [x] 3.4 _(2026-07-18: all 3 spec tests green.)_ Confirm ST-6/ST-7 green.

**Session 3 — Impl tests & hardening**
- [x] 3.5 _(2026-07-18: `test/callback-isolation.impl.test.ts` — formatter degrades only the throwing cell (accessor unit); throwing primary comparator falls back yet the secondary key still orders ties; the guard sits below the `nulls` short-circuit; export-path formatter still degrades. 4/4 green.)_ Write `test/callback-isolation.impl.test.ts`.
- [ ] 3.6 Full `yarn verify`; commit.

## Phase 4 — API governance & closeout

- [ ] 4.1 Update `packages/datagrid/CHANGELOG.md` `[Unreleased]` — add the golden-screen/a11y, perf bench, bytes∝damage, and formatter/comparator-isolation entries; add a one-line "Versioning & stability" note (AR-12).
- [ ] 4.2 Run **`yarn lint:fix`** (prime directive); stage/commit whatever it changes.
- [ ] 4.3 Final full `yarn verify` green; confirm `check:deps` + `check:docs` clean and the whole datagrid suite passes with zero regression.
- [ ] 4.4 Commit via **/gitcm**. (exec_plan then advances RD-14 → ✅ Done on the feature roadmap.)

## Estimate

4 working phases + setup · 24 tasks · ≈ 8–10 h. Phase 1 (golden/a11y) is the largest slice; Phase 0 now includes the typecheck-proving spike (PF-002).
