# Requirements — non-functional-closeout

> **Source**: [RD-14](../../requirements/RD-14-non-functional.md) · re-preflight:
> [RD-14-preflight-report.md](../../requirements/RD-14-preflight-report.md)
> **CodeOps Skills Version**: 3.9.0

This plan implements RD-14's remaining forward work. The RD's "Implementation Status (reconciled
2026-07-18)" table is the authority on what already shipped; this document scopes only what's left.

## In scope

1. **Golden-screen + a11y coverage (AC-3, the bulk).** Render a representative grid through a real
   terminal emulator and assert correctness across:
   - the four color depths — truecolor / 256 / 16 / mono (each role carries the depth-correct color
     mode);
   - `NO_COLOR` / mono — under the default theme, every role cell emits **no color** and the render
     path stays intact. The default theme is color-based, so it does **not** itself distinguish
     state under mono via a text attribute (the grid conveys cursor/selection by color role, not by
     `Attr.reverse`; `render-root` uses `defaultTheme`, not `monochromeTheme`). AC-3 requires
     "render correctly", not inverse-distinguishability — see [preflight PF-001](00-preflight-report.md).
   - ASCII-only caps — under `{ boxDrawing: false, ambiguousWide: true }`, box-drawing chrome **and**
     the ambiguous-width decorative glyphs (`•`, `▲`, `▼`) degrade to ASCII; the fixture avoids the
     funnel `▽` and ellipsis `…` (core has **no** ASCII fallback for those today — a known
     limitation, [PF-003](00-preflight-report.md)).
   Reuse core's `golden-screen-helpers.ts` harness (AR-4); add `@xterm/headless` dev-dep (AR-5).
2. **Representative perf bench (AC-1).** A 60×22 editable-grid compose+diff **median ≤ 16 ms**
   off-CI, plus **p95** (Should-Have), reusing core's `frame-bench.mjs` helpers via a workspace-
   relative import; skip-guarded under `CI`/`TUI_SKIP_PERF` (AR-7).
3. **Bytes ∝ damage (AC-2, second half).** A single-cell edit re-serializes only the damaged
   region — a ratio oracle mirroring core's `render-bytes-damage.spec.test.ts` (AR-6).
4. **Callback isolation (Should-Have, extends AC-7).** A throwing on-screen **formatter** degrades
   its one cell; a throwing custom **comparator** degrades to the type-aware default order. Both are
   small guards added spec-first (AR-9).
5. **API governance.** Update `packages/datagrid/CHANGELOG.md` `[Unreleased]` with the above and add
   a one-line "Versioning & stability" policy note (AR-12).

## Out of scope

- **Already done** (RD-14 AC-4/AC-5/AC-7-renderer): theme roles + byte-freeze, deps/docs/no-eval,
  the renderer draw-error isolation. No rework.
- **AC-6 paste / CSV-import sanitize** — the package is export-only; paste/import surfaces do not
  exist. The sanitize obligation and the combined multi-surface injection test ride with the import
  follow-up when that surface lands (RD-14 §Security).
- **Treeshake check** (RD-14 Should-Have) — deferred to a roadmap follow-on (AR-3); it needs
  build-tier tooling and is lower value than the isolation guarantees shipped here.
- **Full screen-reader / ARIA** — bounded by the terminal emulator (RD-14 Won't-Have).
- **npm publish** — deferred until `@jsvision/ui` is public (RD-14 Won't-Have).

## Success criteria (definition of done)

- ST-1…ST-7 (see [07-testing-strategy.md](07-testing-strategy.md)) pass; the two perf/bench specs
  skip-assert cleanly under `CI`.
- `@xterm/headless` present as a datagrid **devDependency** only; `yarn check:deps` still reports
  zero native runtime deps.
- The formatter/comparator guards land with their spec tests red-before-green.
- `CHANGELOG.md` `[Unreleased]` reflects the shipped surface; `yarn check:docs` stays clean.
- Full `yarn verify` green; zero regression in the existing datagrid suite; the kitchen-sink smoke
  test still green.
