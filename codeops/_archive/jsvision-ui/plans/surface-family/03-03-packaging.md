# 03-03 — Packaging, kitchen-sink story & `demo:surface`

> **Document**: 03-03-packaging.md · **Parent**: [Index](00-index.md)
> **Covers**: AC-10, AC-11, AC-12 · **AR**: PA-7/9
> **CodeOps Skills Version**: 3.3.0

## Theme roles — none new (AC-10, RD AR-231)

RD-19 adds **0 new core theme roles**. Surface cells render as their own colours (whatever the app
drew); the only themed surface is the empty-area margin, which reuses **`windowInactive`**
(`theme.ts:335` = `0x17` lightGray-on-blue, TV `mapColor(1)` frame-passive). **No** `@jsvision/core`
edit. GATE-1 pins the exact fg/bg (`0x17`: bg=blue `1`, fg=lightGray `7`). A `color-theme`-style
byte-guard is **not** needed (no role added), but a spec asserts `encode(windowInactive)` does not throw
and no core role byte changed (AC-10).

## Packaging (AC-11)

- New subsystem **`packages/ui/src/surface/`**: `surface-geometry.ts`, `surface.ts`, `surface-view.ts`,
  `index.ts` (barrel). Each ≤ 500 lines; pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps.
- **Explicit named re-exports** from `packages/ui/src/index.ts`:
  `Surface`, `SurfaceView`, and the types `SurfaceOptions`, `SurfaceViewOptions`, `Point`. The pure
  `surface-geometry.ts` helpers stay **internal** (mirroring `color-grid.ts`).
- `yarn check:deps` clean; **no existing `@jsvision/core` export changes** (reuses `ScreenBuffer` +
  `windowInactive` + `sanitize` + `defaultTheme`, all already public).

## Kitchen-sink story (NON-NEGOTIABLE showcase, AC-12)

- `packages/examples/kitchen-sink/stories/surface-view.story.ts` — id **`surface/surface-view`**,
  category **`Surface`**, `rd: 'RD-19'`. A **pannable ASCII canvas**: an offscreen `Surface` (via
  `Surface.from(rows)`) **larger than its viewport**, a `SurfaceView` showing a window onto it, a
  visible `delta` echo, and interaction hints (arrow keys drive `delta` at the story level — the
  `SurfaceView` stays passive; the story owns the key→`delta` wiring, or binds a `ScrollBar`). One line
  in `stories/index.ts`. Must pass `test/kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints,
  unique id, metadata).

## Headless demo (`demo:surface`, AC-12)

- `packages/examples/surface-demo/main.ts` — a dispatch-driven walkthrough, **one ASCII frame per
  step**: render the viewport → pan right (`delta.x++`) → pan down (`delta.y++`) → pan past an edge to
  reveal the empty-area fill → recentre. Matches `demo:color`/`demo:date`/`demo:tabs`.
- `"demo:surface"` script in `packages/examples/package.json`.
- `packages/examples/test/surface-demo.e2e.test.ts` (vitest `e2e`, runs `main.ts` via `tsx`) asserting
  the frames (viewport content, then the `windowInactive` empty-area fill on the past-edge frame).

## Docs / roadmap (post-completion, exec_plan)

- Refresh the root `CLAUDE.md` Project-structure with a `packages/ui/src/surface/` entry + the
  `demo:surface` line (exec_plan post-analysis).
- Advance the RD-19 roadmap row to **Done** and cascade the portfolio counts (roadmap skill).
