# Ambiguity Register — non-functional-closeout

> **Feature**: datagrid · **Implements**: datagrid/RD-14 · **CodeOps Skills Version**: 3.9.0
> **Gate status**: ✅ GATE PASSED — all items resolved, user-confirmed, zero deferred.

Every plan decision traces to a numbered entry here. Decisions marked *(session gate)* were taken
from the three-question Zero-Ambiguity gate in this session; *(RD-14 / preflight)* were already
settled in the RD or its re-preflight (`../../requirements/RD-14-preflight-report.md`) and are not
re-litigated; *(grounded)* are convention/consistency defaults verified against the actual code
(`file:line` cited).

| AR | Category | Question | Decision | Status | Source |
|----|----------|----------|----------|--------|--------|
| AR-1 | Scope | What does this plan implement vs leave to RD-14's other ACs? | Only RD-14's **remaining forward work**: AC-1 (60×22 bench), AC-2 (bytes∝damage grid test), AC-3 (golden-screen + a11y) **plus** the accepted Should-Haves. Explicitly **out**: AC-4/AC-5/AC-7-renderer (already done), AC-6 paste/import (surface does not exist — rides the import follow-up), and the treeshake check (deferred). | ✅ Resolved | RD-14 / preflight |
| AR-2 | Scope / testability | How much grid surface do the golden-screen / a11y tests cover? | **One representative fixture** exercising all four grid roles (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`) + box borders + one ASCII-fallback glyph, asserted across the **full condition matrix** (truecolor/256/16/mono + NO_COLOR/mono + ASCII-fallback). Mirrors core's single-fixture-across-the-depth-matrix approach. | ✅ Resolved | session gate |
| AR-3 | Scope | Which of RD-14's three Should-Haves ship in this plan? | **Include** the throwing-formatter + throwing-comparator single-degradation guarantee and **p95** reporting in the bench. **Defer** the treeshake check to a roadmap follow-on. | ✅ Resolved | session gate |
| AR-4 | Architecture / DRY | Reuse core's xterm golden-screen helper, or copy a local adapter? | **Reuse** core's `golden-screen-helpers.ts` (`makeTerm`/`feed`/`readCell`) and `frame-bench.mjs` (`median`/`p95`/`perfBudgetMode`) via a **workspace-relative test-only import** (`../../core/test/…`, `../../core/bench/…`). DRY; datagrid inherits adapter fixes. Coupling to core's test-dir layout is accepted (a move breaks datagrid's run in the same CI). | ✅ Resolved | session gate + RD-14 |
| AR-5 | Dependency | Where does `@xterm/headless` get declared? | Add `@xterm/headless` `^6.0.0` to **`packages/datagrid/package.json` devDependencies** — matching core/web/docs-site (`packages/core/package.json:57`). Pure-JS, dev-only → safe past `check:deps` (which guards runtime deps only). | ✅ Resolved | grounded |
| AR-6 | Testability | What is the bytes∝damage oracle, and on what data source? | Mirror core's ratio oracle (`render-bytes-damage.spec.test.ts:32-42`): a single-cell edit's `rr.serialize()` diff emits **>0 bytes and <1/10 of the full first-paint bytes** — a ratio, not an absolute count (deterministic, machine-independent). Use an **eager in-memory `fromRows` source** so timing/serialization is not muddied by async paging. | ✅ Resolved | grounded (mirrors core) |
| AR-7 | Testability | Bench fixture, metrics, and gating? | A **60×22 eager `fromRows` grid** (~5 columns reusing the `data-at-scale`/`columns-layout` model) measuring **compose + `serialize()`** over warmed iterations; **median** is the Must-Have gate (≤16 ms), **p95** is logged (Should-Have). Reuse core's `median`/`p95`; write datagrid's own timing loop (core's `measureComposeDiff` is hardwired to its synthetic 200×50 frame). Off-CI assert; skip under `CI`/`TUI_SKIP_PERF` via `perfBudgetMode`. | ✅ Resolved | grounded (mirrors `perf-budget.spec.test.ts`) |
| AR-8 | Convention | Which vitest project do the new tests live in? | `*.spec.test.ts` in the **`unit`** project. Core classifies its golden-screen, a11y, and perf-budget specs the same way (`packages/core/vitest.config.ts` unit `include: ['test/**/*.{spec,impl}.test.ts']`); the heavy xterm import is per-file lazy. | ✅ Resolved | grounded (convention) |
| AR-9 | Feasibility / scope | Is callback isolation test-only or does it need implementation? | **Implementation.** The on-screen formatter (`column.ts:247` `c.format(v, row)`) and the custom comparator (`sort.ts:63` `col.compare(va, vb)`) are **unguarded today**. The Should-Have adds small try/catch guards — formatter degrades to `String(v)` (mirroring the export guard `grid.ts:1004-1005` and the renderer guard `cell-draw.ts:120-125`); comparator degrades to the type-aware default `compareValues`. Spec-first: spec → red → guard → green. | ✅ Resolved | grounded |
| AR-10 | Convention | Verify command? | `yarn verify` (root; = `yarn lint` then `turbo run typecheck build test check:docs`). Authoritative per project `CLAUDE.md`. | ✅ Resolved | grounded |
| AR-11 | Testability | ASCII-fallback oracle boundary? | Assert the **chrome** (box borders + decorative glyphs) is ASCII-representable under ASCII-only caps (`┌→+`, `─→-`, `│→|`, mirroring `a11y-golden.spec.test.ts:63-68`); **user data text is out of scope** (the caller may legitimately feed non-ASCII values). | ✅ Resolved | grounded |
| AR-12 | Governance | CHANGELOG handling? | `packages/datagrid/CHANGELOG.md` **already exists** (created during the RD-14 re-preflight, PF-005). This plan's governance task **updates** its `[Unreleased]` section with the golden/bench/isolation entries and adds a one-line "Versioning & stability" note — it does not re-create the file. | ✅ Resolved | grounded (file exists) |

**Adversarial re-check (same-session authorship):** this plan was authored in the same session as
the RD-14 re-preflight. Guarded against by (a) three independent Explore agents re-establishing
ground truth with `file:line` citations, and (b) reading each core pattern file (`render-bytes-
damage`, `perf-budget`, `golden-screen`, `a11y-golden`) directly rather than from memory before
mirroring it. The one place memory was wrong — believing `render-bytes-damage.spec.test.ts` did not
exist — was caught and corrected by a disk check.

## Preflight amendments (iteration 1, 2026-07-18)

A later-session preflight ([`00-preflight-report.md`](00-preflight-report.md)) refined four of the
decisions above; the original decisions stand except as noted:

- **AR-2 (ST-2 coverage)** → **PF-001.** The "focus & selection distinguishable via the inverse
  attribute under mono" oracle was unsound: the default grid roles convey state by **color**, not
  `Attr.reverse`, and `createRenderRoot` uses `defaultTheme` (not `monochromeTheme`) under mono. ST-2
  now asserts only no-color + intact render (the AC-3 requirement); the `reverseState()` claim is
  dropped.
- **AR-4 (harness reuse)** → **PF-002.** The workspace-relative reuse is sound at runtime but does
  **not typecheck** as-is (datagrid typechecks `test/`; the cross-package `.ts` → `TS6059`, the
  `.mjs` → `TS7016`). Phase 0 (new task 0.2) proves typecheck and excludes the three
  cross-package-importing specs from `tsconfig.typecheck.json`, mirroring core's src-only typecheck.
- **AR-7 (bench)** → **PF-004/PF-005.** The `fromRows` sketch signature is corrected
  (`fromRows(signal(rows), { rowKey })`); the ST-4 timed region is clarified to compose+diff only
  (grid construction outside the loop) to match AC-1.
- **AR-11 (ASCII-fallback oracle)** → **PF-003.** `boxDrawing:false` alone is the wrong lever — the
  grid's `•`/`▲`/`▼` need `ambiguousWide:true`, and funnel `▽`/ellipsis `…` have no core fallback.
  ST-3 now uses `{boxDrawing:false, ambiguousWide:true}` and keeps `▽`/`…` out of the fixture
  (recorded as a known limitation).
