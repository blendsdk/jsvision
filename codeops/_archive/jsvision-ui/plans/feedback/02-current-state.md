# Current State — the code RD-18 builds on

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

RD-18 is purely additive. Every facility it needs already exists; the analysis below records the exact
seams + the one gap the plan closes (the caps draw-time seam, PA-1). Line numbers verified against the
working tree.

## Leaf-`View` model (the widgets' shape)

- `packages/ui/src/controls/text.ts` — the canonical **leaf `View`** (`class Text extends View`): a
  literal-or-getter content, `onMount(() => this.bind(content))` to repaint on signal change, and a
  single `draw(ctx)` that fills the field and paints text in a theme role. **No children, no
  `onEvent`.** `ProgressBar`/`Spinner` mirror this exactly (bound `value`/`frame` in place of
  `content`). (RD-18 AR-193)
- `packages/ui/src/view/view.ts` — `View` base: `bind(fn)` (subscribe a reactive getter → repaint),
  `invalidate()`, `onMount`, `state` flags (`visible`/`disabled`/`focused`). Leaf widgets need only
  `bind` + `draw`.

## Paint facade — `DrawContext` (and the one gap)

- `packages/ui/src/view/draw-context.ts` — `makeDrawContext(buffer, viewRect, clip, theme)` builds the
  view-local, auto-clipped facade: `text` (routes through core `sanitize` — the injection boundary),
  `fillRect`, `fill`, `box`, `shadow`, `color(role)`, `role(name)`, `size`. All writes go through
  `ScreenBuffer` (width-correct, clip-safe). **`text()` sanitizes + the buffer clips** → the caption /
  label security requirement (AC-9/AC-14) is satisfied by using `ctx.text`.
- `packages/ui/src/view/types.ts:39-57` — the `DrawContext` **interface**. **Gap:** it exposes no
  `caps`. RD-18's widget-level ASCII selection needs `caps` at draw time.
- **The caps flow that already exists:** `RenderRoot` holds `caps: CapabilityProfile`
  (`render-root.ts:196,211`) and uses it for `serialize()` (`:307`). `makeDrawContext` is called from
  exactly **one** production site (`render-root.ts:134`), which is a method on the same `RenderRoot`
  that owns `this.caps`. → **PA-1** threads `this.caps` into `makeDrawContext` and surfaces it as
  `DrawContext.caps`. Additive; **1 production call site** (`render-root.ts:134`) + **~11 mechanical
  drawcontext-test call sites across 5 files** (`view.drawcontext.spec.test.ts` ×4,
  `view.drawcontext.impl.test.ts` ×5, `view.drawcontext-role.spec.test.ts` ×1,
  `view.drawcontext-role.impl.test.ts` ×1, **and `view.hardening.spec.test.ts:119` ×1** — the last is
  **outside** the `view.drawcontext*` glob, so it must be listed explicitly). Grep `makeDrawContext(`
  to confirm the full set before editing.
- Precedent for additively growing `DrawContext`: RD-05 added `role<K>()` (draw-context.ts:176-179).

## Capability model (what the predicate reads)

- `packages/core/src/engine/capability/profile.ts` — `CapabilityProfile.glyphs: GlyphCaps`
  (`{ boxDrawing, halfBlocks, ambiguousWide }`) + `CapabilityProfile.unicode: UnicodeCaps`
  (`{ utf8, widthMode, emoji }`). The block/eighth-block glyphs are **Block Elements** → need
  `unicode.utf8` **and** `glyphs.halfBlocks`; braille needs `unicode.utf8`. → the unified
  `asciiOnly(caps) = !caps.unicode.utf8 || !caps.glyphs.halfBlocks` predicate (PA-2).
- `resolveCapabilities({ env, platform, override })` (exported from `@jsvision/core`) is the test
  vehicle — spec tests already build caps this way (`tab-strip.spec.test.ts:19`), overriding to get a
  Unicode-off profile for the AC-3/AC-8 fallback oracles.
- **Why not the serialize-time `fallbackGlyph` map** (`render/glyphs.ts`): it is a 1:1 **global**
  substitution — both `█` and `░` collapse to `#` (no fill-vs-track notion) and 6 of the 7 eighth-block
  partials are in **no** fallback table (preflight PF-001, verified `glyphs.ts:61-70,97-104`). Hence
  the widget-level selection. No `glyphs.ts` edit.

## Theme-role pattern (PA-3)

- `packages/core/src/engine/color/theme.ts` — the additive-role pattern: each subsystem appends roles
  to the `Theme` interface + `defaultTheme` object. Two grounding precedents for RD-18:
  - **`tableHeader`** (`:147-154`, `:322`) — a **documented TV-extension colour** (TV has no table
    class), a grounded design choice (`0x3F` white-on-cyan), **not** a `getColor` decode. RD-18's
    `progress*` roles are the same class (TV has no gauge palette, AR-186/192).
  - **`scrollBarPage`/`scrollBarControls`** (`:120,126`, `:316-317`) — the shipped **cyan-on-blue gauge
    family** (`0x13`). PA-3 grounds `progressTrack = 0x13` (= `scrollBarPage`) + `progressFill = 0x1B`
    brightCyan-on-blue (a brighter sibling) in this family: fill brighter than track, on the same blue
    field. `0xHL`: H = bg nibble, L = fg nibble.
- `PALETTE` exposes `blue`, `cyan`, `brightCyan`, `darkGray`, `lightGray`, `green`, `brightGreen`,
  `white`, `black`, `red`, `yellow` (used throughout `defaultTheme`).

## Timer seam (PA-7 / `runSpinner`)

- `packages/core/src/engine/host/types.ts:126-129` — `RuntimeAdapter.setTimer(fn, ms): TimerHandle`
  + `clearTimer(handle)`. The same injectable OS-timer boundary the ESC-disambiguation timer uses.
  `runSpinner` takes a `Pick<RuntimeAdapter,'setTimer'|'clearTimer'>` subset; a fake steps time
  deterministically in tests (no wall-clock). No new core primitive.

## Story / demo harness (AC-13)

- `packages/examples/kitchen-sink/story.ts` — `StoryContext` **already carries `caps`**
  (`:23 readonly caps: CapabilityProfile`) + `width`/`height`. A story's `build(ctx)` returns a `Group`
  of absolutely-positioned children; the shell owns all chrome. `stories/index.ts` aggregates stories
  explicitly (add one import + one array entry).
- `packages/examples/tabs-demo/main.ts` + `test/tabs-demo.e2e.test.ts` — the headless-walkthrough
  template (`resolveCapabilities` → dispatch-driven → ASCII frame per step → e2e asserts frames);
  `demo:tabs` script in `packages/examples/package.json`. `demo:feedback` mirrors it.

## Net gap the plan closes

Only **one** structural addition: the `DrawContext.caps` seam (PA-1, additive, 1 production call site).
Everything else — leaf `View`, `bind`, `sanitize`-backed `ctx.text`, the additive theme-role pattern,
`resolveCapabilities`, the `RuntimeAdapter` timer seam, the story/demo harness — is shipped and reused
unchanged.
