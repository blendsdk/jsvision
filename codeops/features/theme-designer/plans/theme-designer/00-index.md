# Theme Designer Implementation Plan

> **Feature**: A standalone, "pro" terminal application for authoring `@jsvision/core` themes — live preview, per-channel color picking, WCAG contrast, depth downsampling, presets, and file import/export.
> **Status**: Planning Complete
> **Created**: 2026-07-08
> **CodeOps Skills Version**: 3.3.2

## Overview

The theme designer is a real, standalone terminal application (a new private package `@jsvision/theme-designer`) that dogfoods the SDK: it is built from the very widgets it themes. A user edits a theme's 16 semantic **aliases** (which regenerate all 63 control roles via `createTheme`) or overrides individual **roles** directly; a curated widget gallery repaints live on every edit; a color inspector offers RGB sliders, a `#rrggbb` hex field, and the DOS-16 swatch grid; WCAG contrast is scored as you go; the selected color previews at every color depth; the 7 built-in presets seed a starting point; and themes import/export to JSON via a real file dialog.

It fills two genuine framework gaps along the way: a reusable **`Slider`** control in `@jsvision/ui` (none existed — `ScrollBar` was the closest, mouse-only, wrong look), and a small amount of designer plumbing. The app follows the approved visual mockup (menu bar · three flex panels — roles rail · live preview · inspector · status bar).

The design realizes the model already proven by the `demo:themes` walkthrough — a pure, headless-testable state machine plus a live-TTY host — scaled up from "cycle accent/mode/depth from the status line" to a full interactive editor.

## Document Index

| #   | Document                                                     | Description                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (audit trail)        |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                           | Feature requirements and scope                     |
| 02  | [Current State](02-current-state.md)                         | What exists to reuse; gaps to fill                 |
| 03-01 | [Slider Widget](03-01-slider-widget.md)                    | `@jsvision/ui` `Slider` + shared track math + core roles |
| 03-02 | [Designer Model](03-02-designer-model.md)                  | The pure, headless-testable app state machine      |
| 03-03 | [Designer App](03-03-designer-app.md)                      | The 3-pane TUI shell, inspector, preview, file I/O  |
| 03-04 | [Packaging & Integration](03-04-packaging.md)              | New package scaffold, CI, `themes-demo` change      |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | ST cases and verification                          |
| 99  | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, and task checklist               |

## Quick Reference

### Usage (once built)

```bash
# live, interactive designer on a real terminal
yarn workspace @jsvision/theme-designer start
# (piped / headless) narrated walkthrough that renders composed frames — the e2e path
yarn workspace @jsvision/theme-designer start | cat
```

```ts
// the Slider gap this feature fills, usable anywhere in @jsvision/ui:
import { Slider, signal } from '@jsvision/ui';
const red = signal(128);
const s = new Slider({ value: red, min: 0, max: 255, orientation: 'horizontal',
  onInput: (v) => {/* live */}, onChange: (v) => {/* commit */} });
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Edit model | 16 aliases + per-role overrides | AR-1 |
| Color inputs | RGB sliders + `#rrggbb` hex + DOS-16 swatches | AR-2 |
| Slider | new reusable control in `@jsvision/ui`, both orientations | AR-3, AR-8 |
| Slider ↔ ScrollBar | shared pure track-geometry helper; ScrollBar refactored | AR-9 |
| Open/Save | `@jsvision/files` FileDialog | AR-4 |
| Live preview | curated widget gallery | AR-5 |
| Package | new private `@jsvision/theme-designer` (publish-later) | AR-10 |
| Deferred | HSL · undo/redo · splitters · custom-preset library | AR-7 |

## Related Files

**New:** `packages/theme-designer/**` · `packages/ui/src/controls/slider.ts` · `packages/ui/src/controls/track.ts` · `packages/ui/test/{slider,track}.{spec,impl}.test.ts` · `packages/examples/kitchen-sink/stories/slider.story.ts`.
**Modified:** `packages/ui/src/scroll/scroll-bar.ts` (consume shared track math) · `packages/core/src/engine/color/theme.ts` + `presets.ts` + `roles.ts` (add `sliderTrack`/`sliderThumb`; expose preset seed sets) · `packages/core/src/engine/color/create-theme.ts` (export `aliasesFromSeeds`) + `color/index.ts` + `engine/index.ts` (re-export `rgb256` + `aliasesFromSeeds` + preset seeds) · `packages/ui/src/index.ts` (export `Slider`) · `packages/examples/themes-demo/main.ts` (drop live-TTY branch) · `.github/workflows/ci.yml` · root `package.json` · `CHANGELOG.md`.
