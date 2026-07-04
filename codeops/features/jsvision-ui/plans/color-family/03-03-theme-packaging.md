# 03-03: `colorMarker` role + core re-exports + packaging + showcase

> **Document**: 03-03-theme-packaging.md
> **Parent**: [Index](00-index.md)
> **Components**: `packages/core/src/engine/color/{theme,index}.ts`, `packages/core/src/engine/index.ts`,
> `packages/ui/src/color/index.ts`, `packages/ui/src/index.ts`, kitchen-sink stories, `color-demo/`

## The `colorMarker` theme role (PA-1) — additive

**One** role, pinned to the TV-decoded forced-contrast byte `0x70` (`colorsel.cpp:136`).

### `packages/core/src/engine/color/theme.ts`

- On the `Theme` interface, add `readonly colorMarker: ThemeRole;` with a JSDoc citing the decode:
  > `TColorSelector::draw()` forces the `◘` marker on a black cell to attr `0x70`
  > (`colorsel.cpp:132-137`) so it stays visible. `colorMarker` pins that byte: `0x70` = black
  > (`0`) on lightGray (`7`). RD-21 fires it on **near-black** cells (the generic extension of TV's
  > `c==0`, PA-2). Additive.
- In `defaultTheme`: `colorMarker: { fg: PALETTE.black, bg: PALETTE.lightGray },` (= `0x70`).

### Guard allowlists (PA-14)

The closed-set theme guards must list the new role. **Three** guards are closed-set ("the X roles are
the ONLY additive keys") and will each fail when `colorMarker` lands — append `colorMarker` to each:

- `packages/ui/test/tabs-theme.spec.test.ts` (`TAB_ROLES`, ST-30)
- `packages/ui/test/feedback-theme.spec.test.ts` (`FEEDBACK_ROLES`, ST-11)
- `packages/ui/test/date-theme.spec.test.ts` (the six `calendar*` roles, "ONLY new keys")

`packages/ui/test/table-theme.spec.test.ts` is **not** closed-set (ST-20 asserts only its own
`tableHeader` byte + `encode()` non-throw) — **no edit needed**. Still run
`grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY" packages/ui/test/*theme*` before implementing as the
authoritative backstop (re-confirm the set hasn't drifted). **Keep every existing byte assertion.**

## Core re-exports (PA-3) — additive

Make `ANSI16_ORDER` + `toRgb` public (they are defined but not surfaced — PF-002). `HEX_RE` stays
private.

### `packages/core/src/engine/color/index.ts`

Add: `export { ANSI16_ORDER } from './palette.js';` and `export { toRgb } from './color.js';` (the
barrel currently re-exports `PALETTE`, `defaultTheme`, the encoders, `InvalidColorError`).

### `packages/core/src/engine/index.ts` (the color block, lines 146-157)

Add `ANSI16_ORDER` and `toRgb` to the `export { … } from './color/index.js';` list. **No existing
export line changes** (AC-11). `@jsvision/ui` then imports both by name from `@jsvision/core`.

## `@jsvision/ui` packaging (AC-11)

- `packages/ui/src/color/index.ts` — barrel: `export { ColorSwatch } from './color-swatch.js';`,
  `export { ColorPicker } from './color-picker.js';`, plus the pure helpers if any are public (the
  `color-grid.ts` functions stay internal unless a test needs them — keep internal, mirroring
  `calendar-grid`). Export the option types (`ColorSwatchOptions`, `ColorPickerOptions`).
- `packages/ui/src/index.ts` — **explicit named re-exports** (the layout-convention rule, matching the
  `date`/`feedback` blocks): `export { ColorSwatch, ColorPicker } from './color/index.js';` +
  `export type { ColorSwatchOptions, ColorPickerOptions } from './color/index.js';`.
- `yarn check:deps` stays clean (zero runtime deps); every `color/` file ≤ 500 lines.

## Kitchen-sink stories (AC-12, NON-NEGOTIABLE showcase)

Two stories, category **`Color`**, `rd: 'RD-21'` (mirror `date-picker.story.ts`):

- **`stories/color-swatch.story.ts`** (id `color/color-swatch`) — a DOS-16 `ColorSwatch` (`colors:
  ANSI16_ORDER`, `columns: 4`) bound to a `signal<Color>`, with a live echo `Text` showing the selected
  color **name + hex** (via `nameFor` + `toRgb`), plus an interaction hint (arrows nav · Enter/Space
  select · click/drag).
- **`stories/color-picker.story.ts`** (id `color/color-picker`) — a `ColorPicker` chip opening the
  grid + a hex field (`allowCustom: true`), with a live bound-value echo. Hint: Down/Alt+Down/`▐↓▌`
  opens · pick or type `#rrggbb` · Esc cancels.
- Two lines in `stories/index.ts`; both pass `kitchen-sink.smoke.spec.test.ts` (mount + paint + unique
  id + metadata).

## Headless demo (AC-12)

`packages/examples/color-demo/main.ts` — a dispatch-driven walkthrough, an **ASCII frame per step**
(mirrors `date-demo`): render the swatch → arrow-nav the grid → pick a swatch (Enter) → open the picker
popup → enter a hex color → commit. Add `"demo:color"` to `packages/examples/package.json` and
`packages/examples/test/color-demo.e2e.test.ts` (drives the steps headless, asserts frames + the final
`value`).

## Theme-role summary

| Role | Byte | fg / bg | Source | Use |
|------|------|---------|--------|-----|
| `colorMarker` | `0x70` | black / lightGray | `colorsel.cpp:136` (PA-1/PA-2) | The near-black cell's `◘` marker (+ chip block for a near-black value). |

All other surfaces reuse existing roles: cells = raw `Color`s (no role, AR-217), the popup frame =
RD-14's `historyWindow`, the hex `Input` = `input`/`inputSelection`, the chip caption =
`staticText`/`label`.
