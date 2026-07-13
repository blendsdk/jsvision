# 03-03 — Theme roles, the `DrawContext.caps` seam & packaging

> **Document**: 03-03-theme-packaging.md
> **Parent**: [Index](00-index.md)
> **Implements**: AC-11, AC-12, AC-13 · PA-1/PA-3/PA-6/PA-10

## GATE-1 decode — the 2 `progress*` theme roles (PA-3)

Turbo Vision ships **no** gauge/progress palette (AR-186 whole-tree search). So — exactly like
`tableHeader` (`theme.ts:147-154`, a documented TV-extension colour, not a `getColor` decode) — the
feedback roles are **documented extension colours**, grounded (not invented) in TV's bright-on-dim
gauge convention + the shipped `TScrollBar` cyan-on-blue family (`scrollBarPage`/`scrollBarControls`,
`0x13`, `theme.ts:120,126,316-317`). `0xHL`: H = bg nibble, L = fg nibble.

| Role | Byte | Decode | Draws |
|------|------|--------|-------|
| `progressFill` | `0x1B` | brightCyan-on-blue (a brighter sibling of `scrollBarControls 0x13`) | `█` + `PARTIAL[k]` filled cells (and the `#` ASCII fill) |
| `progressTrack` | `0x13` | cyan-on-blue (= `scrollBarPage`, the dim shade) | `░` track cells (and the `-` ASCII track) |

Rationale: a determinate bar reads as the shipped scrollbar's cyan-on-blue gauge, with the **fill
brighter than the track** on the same blue field — cohesive with the existing container palette and
faithful to the bright-on-dim convention. The **caption** reuses `staticText` and the **spinner glyph +
label** reuse `staticText`/`label` (no extra roles). Additive; **no existing role changes** (AC-11).

Landing (mirrors every prior additive-role block, `theme.ts`):

```ts
// interface Theme — after the RD-17 tab* roles:
/** Progress-bar fill (RD-18, PA-3). Documented TV-extension colour (TV has no gauge palette,
 *  AR-186) — 0x1B brightCyan-on-blue, a brighter sibling of the cyan-on-blue scrollbar gauge
 *  family; paints the `█`/eighth-block fill (and the `#` ASCII fill). Additive (AC-11). */
readonly progressFill: ThemeRole;
/** Progress-bar track (RD-18, PA-3). 0x13 cyan-on-blue (= {@link scrollBarPage}); the dim `░`
 *  track (and the `-` ASCII track). */
readonly progressTrack: ThemeRole;

// const defaultTheme — after tabDisabled:
progressFill:  { fg: PALETTE.brightCyan, bg: PALETTE.blue }, // 0x1B (RD-18, PA-3)
progressTrack: { fg: PALETTE.cyan,       bg: PALETTE.blue }, // 0x13 (= scrollBarPage)
```

## The `DrawContext.caps` seam (PA-1) — additive RD-03-spine edit

The one architectural addition. Three additive touch-points, all in `packages/ui/src/view/`:

1. **`view/types.ts`** — add to the `DrawContext` interface (already imports `CapabilityProfile`):
   ```ts
   /** The resolved terminal capabilities for this frame (RD-18 PA-1). A widget selects its ASCII
    *  glyph form from `caps.glyphs`/`caps.unicode` at draw time (the ProgressBar whole-cell `#`/`-`
    *  form, the Spinner `line` preset swap). Sourced from the render root's `caps`. */
   readonly caps: CapabilityProfile;
   ```
2. **`view/draw-context.ts`** — `makeDrawContext(buffer, viewRect, clip, theme, caps)` gains a **caps**
   parameter and returns it on the object (`return { text, …, color, role, size, caps };`).
3. **`view/render-root.ts:134`** — the sole production caller passes `this.caps`
   (`makeDrawContext(buffer, viewRect, clip, theme, this.caps)`).

**Test call-site updates (mechanical, not oracle changes):** **~11 sites across 5 files** call
`makeDrawContext(...)` directly — `view.drawcontext.spec.test.ts` (×4), `view.drawcontext.impl.test.ts`
(×5), `view.drawcontext-role.spec.test.ts` (×1), `view.drawcontext-role.impl.test.ts` (×1), **and
`view.hardening.spec.test.ts:119` (×1, outside the `view.drawcontext*` glob — do not miss it)**. Grep
`makeDrawContext(` under `packages/ui/test` to enumerate, then add a `caps` arg to each (a
`resolveCapabilities({ env:{}, platform:'linux' }).profile`, or a shared test const). These are
signature-fixture updates — no assertion oracle changes. Additive: no behavior change for any existing
widget (none read `ctx.caps`).

> **Why additive-param, not optional:** `DrawContext.caps` must be a real, always-present
> `CapabilityProfile` (the widgets rely on it). A required 5th `makeDrawContext` param keeps the type
> honest; the ~11 direct test callers (across 5 files) are updated once. Feedback spec tests render through the
> **render root / event loop** (the shipped `tab-strip.spec` idiom), so they get real caps
> automatically and never touch `makeDrawContext` directly.

## Subsystem & packaging (PA-6, AC-12)

New `packages/ui/src/feedback/`:

| File | Contents |
|------|----------|
| `progress-bar.ts` | `ProgressBar`, `ProgressBarOptions`, `PARTIAL`, `clamp`, **exported `asciiOnly`** |
| `spinner.ts` | `Spinner`, `SpinnerOptions`, `SpinnerName`, `SPINNERS`, preset-swap (imports `asciiOnly`) |
| `run-spinner.ts` | `runSpinner`, `RunSpinnerOptions`, `TimerSeam` |
| `index.ts` | barrel — re-exports the public symbols |

**Explicit named re-exports** appended to `packages/ui/src/index.ts` (the layout-convention rule,
AR-81/181 — as tabs/table/tree do):

```ts
// RD-18 feedback: the determinate `ProgressBar` (smooth sub-cell fill) + the indeterminate `Spinner`
// (caller-driven) + the `runSpinner` timer helper. Documented new components (TV has no gauge/spinner
// class, AR-186); additive surface = 2 core `progress*` theme roles + the `DrawContext.caps` seam.
export { ProgressBar, Spinner, runSpinner, SPINNERS } from './feedback/index.js';
export type { ProgressBarOptions, SpinnerOptions, SpinnerName, RunSpinnerOptions, TimerSeam } from './feedback/index.js';
```

- Zero runtime deps (`yarn check:deps` clean, AC-12); every file ≤ 500 lines.

## Kitchen-sink stories + `demo:feedback` (PA-10, AC-13)

**Stories** (category `Feedback`, `rd: 'RD-18'`), each a `build(ctx)` returning a `Group` of absolutely
positioned children within `ctx.width × ctx.height`, passing `ctx.caps` to the widgets:

- `stories/progress-bar.story.ts` — id **`feedback/progress-bar`**: a `ProgressBar` (caption on) driven
  0→100% by a signal a `Button`/tick steps, with a live `Text` percent echo; shows the sub-cell fill.
- `stories/spinner.story.ts` — id **`feedback/spinner`**: an animating `Spinner` (label `Loading…`) with
  a preset switcher (`dots`/`line`/`blocks`) + a visible current-preset echo. Frame advanced by the
  story's own tick (or a `runSpinner` over the app runtime).
- Two lines added to `stories/index.ts` (import + array entry, grouped under a `Feedback` heading).
- Both pass `test/kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints, unique id, metadata).

**Headless demo** `packages/examples/feedback-demo/main.ts` (`demo:feedback` script in
`packages/examples/package.json`) — an ASCII frame per step: **bar 0% → 33% → 66% → 100%**, then the
**spinner stepped through several frames** (and the ASCII-fallback form under a Unicode-off caps).
`test/feedback-demo.e2e.test.ts` runs it via `tsx` and asserts the frames (the `tabs-demo.e2e`
template).

## AFTER-diff / verification

`feedback-theme.spec.test.ts` (ST-11) asserts both roles exist, `encode()` of each does not throw, and
**no existing role changed** (snapshot the pre-existing role set). `feedback.packaging.spec.test.ts`
(ST-12) asserts the re-exports resolve, `check:deps` is clean, files ≤ 500.
