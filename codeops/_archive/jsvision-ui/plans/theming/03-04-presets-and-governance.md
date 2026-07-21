# Presets & Governance: Theming

> **Document**: 03-04-presets-and-governance.md
> **Parent**: [Index](00-index.md)

## Overview

The 7 shipped presets (`packages/core/src/engine/color/presets.ts`) and the additive-surface
governance work (barrels, CHANGELOG, packaging spec, tree-shake, `@example` docs). Presets are
tree-shakeable named exports — an app that imports one pulls in none of the others.

## Implementation Details

### Presets (AR-270, AR-272)

| Preset | How built | Pin (AC-10) |
|--------|-----------|-------------|
| `turboVisionTheme` | **`= defaultTheme`** (a re-export alias; the classic look, still the render-root default) | identity with `defaultTheme` |
| `monochromeTheme` | **Hand-authored literal** — every role `fg`/`bg` is `'default'`, black, white, or gray; focused/selected/disabled distinguished by `attrs` (reverse/bold/underline/dim), never hue (AR-272). The one attr-driven, non-seed preset. | no chromatic color; focused vs normal differ **only** in `attrs` |
| `slateTheme` | **Generated** — `createTheme({ mode, accent: <muted slate-blue>, neutral: <slate gray> })`; an enterprise muted blue-gray look | valid `Theme`; no canonical pin required |
| `nordTheme` | **Generated + overrides** — `createTheme` seeded to Nord, with `overrides` pinning canonical hexes | `background === '#2e3440'` (Nord `nord0`) |
| `draculaTheme` | generated + overrides pinning Dracula hexes | `background === '#282a36'` |
| `solarizedDarkTheme` | generated + overrides pinning Solarized hexes | `background === '#002b36'` (base03) |
| `gruvboxDarkTheme` | generated + overrides pinning Gruvbox hexes | `background === '#282828'` (bg0) |

Each curated preset pins its canonical background/foreground/accent via `overrides` so the exact hex
values appear regardless of ramp rounding; the remaining roles derive from `rolesFromAliases`. Every
preset is a fully-realized `Theme` and round-trips through `serialize`/`parse` (`03-03`).

### Governance / additive-surface (PA-6, AR-275)

1. **Barrels** —
   - `packages/core/src/engine/color/index.ts`: after the `theme.js` block, add a value export
     (`ramp, lighten, darken, mix, createTheme, rolesFromAliases, contrastRatio, serializeTheme,
     parseTheme, InvalidThemeError, monochromeTheme, turboVisionTheme, slateTheme, nordTheme,
     draculaTheme, solarizedDarkTheme, gruvboxDarkTheme`) and a type export (`ThemeColors, ThemeOptions`).
   - `packages/core/src/engine/index.ts`: append the same values to the color `export { … }` block
     and the types to its `export type { … }` line.
2. **CHANGELOG** — a root `CHANGELOG.md` `## [Unreleased]` entry naming the new exports (api-stability
   is doc-presence only; there is no export snapshot to regenerate).
3. **Packaging spec** — a new `packages/core/test/theme-packaging.spec.test.ts` (mirrors
   `packages/ui/test/color.packaging.spec.test.ts`): asserts each new symbol is importable from
   `@jsvision/core`, every pre-existing color export (`toRgb`, `PALETTE`, `defaultTheme`, `Attr`, …)
   still resolves (additive-only), and every new source file is ≤ 500 lines.
4. **Tree-shake** — extend `treeshake.spec` (or a sibling) to import **one** preset and assert the
   other six preset names do **not** appear in the one-symbol esbuild bundle text (mirrors
   `treeshake.spec.test.ts`'s relational-size shape; presets are plain-data consts so a correct
   tree-shaker drops the unused ones).
5. **`@example` docs** — `check-jsdoc.mjs` requires an `@example` on every public **function/class**:
   `ramp`, `lighten`, `darken`, `mix`, `createTheme`, `rolesFromAliases`, `contrastRatio`,
   `serializeTheme`, `parseTheme`, `InvalidThemeError`. The 7 preset consts, `defaultTheme`, and the
   `ThemeColors`/`ThemeOptions` types are exempt (plain data / types). sRGB↔OKLab conversions stay
   **internal** (not exported → no doc obligation).
6. **a11y-golden** — no change required (the mono/attribute contract is unchanged; `monochromeTheme`
   exercises it but does not alter it).

## Integration Points
- Presets consume `createTheme`/`rolesFromAliases` (`03-02`) and `defaultTheme` (`turboVisionTheme`).
- Presets feed the kitchen-sink `Theming` story + smoke test (`03-06`), which mounts **every** preset.

## Code Examples

```ts
import { nordTheme, monochromeTheme, serializeTheme } from '@jsvision/core';

nordTheme.background;               // '#2e3440'
serializeTheme(monochromeTheme);    // round-trips with attrs intact

// Tree-shake: importing only nordTheme excludes draculaTheme/etc. from the bundle.
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| A preset fails depth-robustness (unreadable at some depth) | Caught by the per-depth golden (RD-22 AC-12); fix the seed/override | AR-270 |
| `monochromeTheme` accidentally uses a chromatic color | Caught by ST asserting no hue + attrs-only state distinction | AR-272 |
| A new source file exceeds 500 lines | Caught by the packaging spec's line-budget assertion | PA-6, PA-8 |

> **Traceability:** `00-ambiguity-register.md` (PA-6, PA-8) + `../../requirements/00-ambiguity-register.md` (AR-270/AR-272/AR-275).

## Testing Requirements
- All 7 presets exported and valid `Theme`s; `turboVisionTheme === defaultTheme`; each curated preset
  pins ≥1 canonical hex (ST-21…ST-23).
- `monochromeTheme`: no chromatic color; focused vs normal differ only in `attrs` (ST-24).
- Depth robustness: every preset composes a representative widget set and paints non-empty at
  `truecolor`/`256`/`16`/`mono` (ST-25).
- Tree-shake: a one-preset bundle excludes the other six (ST-26); packaging spec: importability +
  existing-unchanged + ≤500-line budget (ST-27, P-AC-3).
