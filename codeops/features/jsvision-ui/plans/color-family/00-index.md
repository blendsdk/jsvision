# Color family (`ColorSwatch` + `ColorPicker`) Implementation Plan

> **Feature**: A `ColorSwatch` color-grid view + a `ColorPicker` swatch dropdown for `@jsvision/ui`
> **Status**: Planning Complete
> **Created**: 2026-07-04
> **Implements**: jsvision-ui/RD-21
> **CodeOps Skills Version**: 3.2.0

## Overview

RD-21 adds a **color family** to `@jsvision/ui`: a **`ColorSwatch`** — a focusable `View` drawing a
grid of 3-column color cells over a generic **`Color[]`** palette (DOS-16 default) with a `◘`
selection marker and wrap-around arrow + click/drag navigation — and a **`ColorPicker`** — a `Group`
compressing a trigger chip + a `▐↓▌` dropdown that opens the `ColorSwatch` in the RD-14 anchored popup,
with an optional hex `Input` for arbitrary `#rrggbb` truecolor.

`ColorSwatch`'s **drawing is a decode, not a design** (the NON-NEGOTIABLE TV-fidelity directive): the
3-wide cells (`moveChar(j*3, icon, c, 3)`), the `◘` marker (CP437 `8`) + the black-cell `0x70`
forced-contrast rule, the wrap-around arrow math, and the `mouse.y*4 + mouse.x/3` click/drag hit math
all match Turbo Vision's **`TColorSelector`** (`source/tvision/colorsel.cpp:111-237`) cell-by-cell,
verified at GATE-1/GATE-2. The **generic palette**, **truecolor cells**, the **hex field**, the
**dropdown**, the cursor-vs-`value` split, and the omitted frame are documented **extensions** (TV's
`TColorSelector` is index-only, index-0..15, framed, and lives inside the heavy `TColorDialog`) — they
get spec oracles but no `.cpp` diff.

The one cross-RD dependency — RD-14's `openAnchoredPopup` generalized to host a non-list `View` —
**already landed by RD-20** (`popup.ts:59-88`: `buildContent(commit)`/`contentSize`/`focusTarget`), so
RD-21 simply **consumes** it and does not touch `dropdown/`. Core edits are **additive**: one
`colorMarker` theme role (`0x70`) + two public re-exports (`ANSI16_ORDER`, `toRgb`). No existing public
API changes.

## Document Index

| #   | Document                                              | Description                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate decisions (PA-1…PA-15)           |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                   | Feature requirements and scope (Source: RD-21)       |
| 02  | [Current State](02-current-state.md)                 | Reuse points + the already-generalized popup         |
| 03-01 | [ColorSwatch + color-grid](03-01-color-swatch.md)  | The 3-wide grid `View`, marker, wrap-around nav, drag |
| 03-02 | [ColorPicker + hex field](03-02-color-picker.md)   | Trigger chip + `▐↓▌` + anchored popup + hex `Input`  |
| 03-03 | [Theme role + re-exports + packaging](03-03-theme-packaging.md) | `colorMarker` role, core re-exports, stories/demo |
| 07  | [Testing Strategy](07-testing-strategy.md)           | ST-1…ST-15 spec oracles ↔ AC-1…AC-15                 |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, sessions, and task checklist                 |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { ColorSwatch, ColorPicker } from '@jsvision/ui';
import { ANSI16_ORDER } from '@jsvision/core';

// A standalone DOS-16 swatch bound to a Color.
const chosen = signal<Color>('brightCyan');
const sw = new ColorSwatch({
  value: chosen,
  columns: 4,                      // default 4 (TColorSelector)
  onChange: (c) => console.log(c),
});

// A one-line picker: a chip + dropdown grid + hex entry, sharing the value.
const cp = new ColorPicker({
  value: chosen,
  allowCustom: true,               // default: include the hex field
  nameFor: (c) => String(c),       // optional caption name
});
```

### Key Decisions

| Decision                                   | Outcome                                                                | AR Ref |
| ------------------------------------------ | --------------------------------------------------------------------- | ------ |
| `colorMarker` theme role                   | One additive role = `0x70` black-on-lightGray (dark-cell marker only) | PA-1   |
| Forced-contrast predicate                  | Near-black via `toRgb` luminance (subsumes TV's `c==0`)               | PA-2   |
| Core additive re-exports                   | `ANSI16_ORDER` + `toRgb` only (`HEX_RE` stays private)               | PA-3   |
| `src/color/` file split                    | `color-grid.ts` (pure) + `color-swatch.ts` + `color-picker.ts` + barrel | PA-4 |
| Cell geometry (GATE-1)                     | `█` 3-wide cell, `fg=cellColor`/`bg=black`; `◘` marker at centre      | PA-5/6/7 |
| State model                                | Internal cursor SoT; `value` a derived two-way bind; init `indexOf`/`0` | PA-9 |
| Drag out-of-bounds                         | Outside grid → revert; partial-row overshoot → clamp                 | PA-10  |
| Picker commit                              | Commit-on-release (drag previews; down doesn't close)                | PA-11  |
| Popup generalization                       | Consume RD-20's `openAnchoredPopup` (no `dropdown/` edit)            | (dep)  |
| Kitchen-sink ids / demo                    | `color/color-swatch` + `color/color-picker`; `demo:color`           | PA-14  |

## Related Files

**New** — `packages/ui/src/color/`: `color-grid.ts`, `color-swatch.ts`, `color-picker.ts`, `index.ts`.
**Modified (additive)** — `packages/core/src/engine/color/theme.ts` (the `colorMarker` role),
`packages/core/src/engine/color/index.ts` + `packages/core/src/engine/index.ts` (re-export
`ANSI16_ORDER` + `toRgb`), `packages/ui/src/index.ts` (explicit `color/` re-exports).
**Consumed, not edited** — `packages/ui/src/dropdown/popup.ts` (the generalized `openAnchoredPopup`).
**New examples** — `packages/examples/kitchen-sink/stories/{color-swatch,color-picker}.story.ts`,
`packages/examples/color-demo/`, `packages/examples/test/color-demo.e2e.test.ts`.
