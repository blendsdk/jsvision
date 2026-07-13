# Aliases, Ramp & Contrast: Theming

> **Document**: 03-01-aliases-ramp-contrast.md
> **Parent**: [Index](00-index.md)

## Overview

The pure, zero-dependency core primitives that sit *below* the roles: the 16-token semantic alias
interface (`ThemeColors`), the perceptual OKLab ramp generator (`ramp`/`lighten`/`darken`/`mix`), and
the WCAG contrast helper (`contrastRatio`). All three operate on `Color` at the boundary and are
side-effect-free. They live in `packages/core/src/engine/color/{aliases,ramp,contrast}.ts`.

## Architecture

### Current Architecture
`color/` has `toRgb` (validate/parse to `Rgb | null`) and `PALETTE`/`ANSI16_REFERENCE`, but no
perceptual color math and no semantic tier. See `02-current-state.md`.

### Proposed Changes
Add three independent pure modules. `ramp` and `contrast` consume `toRgb`; `aliases` is a type-only
interface. None import each other (ramp does OKLab math internally; contrast does luminance math
internally).

## Implementation Details

### `aliases.ts` — the semantic alias tier (AR-266, AR-280)

`ThemeColors` is a **type-only** interface of exactly **16** tokens, each a `Color`. It is the middle
layer generated themes are expressed in; each token's meaning is the public contract (RD-22
§"The semantic alias tier" owns the per-token definitions — this doc does not restate them).

```ts
export interface ThemeColors {
  // text (4)
  readonly foreground: Color;
  readonly foregroundMuted: Color;
  readonly foregroundDisabled: Color;
  readonly foregroundOnAccent: Color;
  // surface (4)
  readonly background: Color;
  readonly backgroundRaised: Color;
  readonly backgroundSunken: Color;
  readonly backgroundSelected: Color;
  // accent (2)
  readonly accent: Color;
  readonly accentMuted: Color;
  // line (2)
  readonly border: Color;
  readonly borderMuted: Color;
  // status (4)
  readonly danger: Color;
  readonly warning: Color;
  readonly success: Color;
  readonly info: Color;
}
```

There is **no** `accentForeground` token (dropped as a synonym of `foregroundOnAccent`, AR-280).
`ThemeColors` is a type → exempt from the `@example` check (`check-jsdoc.mjs` skips types), but each
field carries a one-line doc comment stating its meaning + typical on-surface pairing.

### `ramp.ts` — OKLab perceptual color math (AR-268, AR-283)

Björn Ottosson's OKLab, internal to the module; `Color` in, `Color` out (as `#rrggbb`).

```ts
export function ramp(seed: Color, steps: number): Color[];       // steps perceptually-even shades, dark→light
export function lighten(color: Color, amount: number): Color;    // raise OKLab L by `amount` (0..1)
export function darken(color: Color, amount: number): Color;     // lower OKLab L by `amount`
export function mix(a: Color, b: Color, t: number): Color;       // interpolate a→b in OKLab (t 0..1)
```

Internal pipeline (not exported): `srgbToLinear` → `linearToOklab` (the LMS matrices + cube root) and
back `oklabToLinear` → `linearToSrgb`, **gamut-clamped** to `[0,255]` per channel on the return. `L`
is adjusted for `lighten`/`darken`; `mix` interpolates all three OKLab components.

**Unresolvable seed (AR-283):** OKLab needs RGB. `toRgb(seed)` returns `null` for `'default'`, which
has no fixed RGB, so `ramp`/`lighten`/`darken`/`mix` **`throw InvalidColorError`** when the seed
resolves to `null`. `createTheme` seeds are therefore documented as resolvable colors only (hex or
named) — a generated theme never seeds from `'default'`.

### `contrast.ts` — WCAG contrast (AR-273, AR-283)

```ts
export function contrastRatio(a: Color, b: Color): number;  // 1..21, or NaN if either is unresolvable
```

Standard WCAG 2.x: relative luminance `L = 0.2126·R + 0.7152·G + 0.0722·B` on linearized sRGB, ratio
`(Llight + 0.05) / (Ldark + 0.05)`. It is **pure and never called inside `createTheme`** — it does not
auto-adjust colors (warn-only, AR-273).

**Unresolvable input (AR-283):** if either color resolves to `null` (`'default'` — no fixed luminance,
it's whatever the terminal chooses), `contrastRatio` returns **`NaN`** ("contrast unknown"). It never
throws — the designer calls it inside a render/preview loop and treats `NaN` as *skip* (no false
alarm). `monochromeTheme` legitimately uses `'default'`.

### Integration Points
- Consumed by `createTheme`/`rolesFromAliases` (`03-02`) — the ramps feed the alias object.
- Consumed by the designer (`03-06`) — `contrastRatio` drives the warning panel.
- `ramp` output downsamples through the existing `encode`/`downsample` path unchanged.

## Code Examples

```ts
import { ramp, lighten, contrastRatio } from '@jsvision/core';

ramp('#3b82f6', 5);           // 5 even shades of blue, dark → light
lighten('#3b82f6', 0.2);      // a lighter blue (OKLab L + 0.2, gamut-clamped)
contrastRatio('#000', '#fff'); // 21
contrastRatio('default', '#fff'); // NaN — unresolvable
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| `ramp`/`lighten`/`darken`/`mix` seed resolves to `null` (`'default'`) | `throw InvalidColorError` | AR-283 |
| `ramp`/… seed is malformed hex / unknown name | `toRgb` throws `InvalidColorError` (reused, not re-implemented) | AR-268 |
| `contrastRatio` with an unresolvable color | return `NaN` (never throw) | AR-283 |
| OKLab return lands outside `[0,255]` | clamp per channel to gamut | AR-268 |

> **Traceability:** see `00-ambiguity-register.md` (this plan) and `../../requirements/00-ambiguity-register.md` (AR-266/AR-268/AR-273/AR-280/AR-283).

## Testing Requirements
- OKLab round-trips sRGB→OKLab→sRGB within ≤1/255 per channel for the 16 `PALETTE` colors; `lighten`
  strictly increases L, `darken` strictly decreases it (ST-1…ST-3).
- `ramp('default', n)` throws `InvalidColorError`; `contrastRatio('default', x)` is `NaN` (ST-4, ST-6).
- `contrastRatio('#000000','#ffffff') === 21` (±0.01); `contrastRatio(c, c) === 1` (ST-5).
- `ThemeColors` is a type with 16 members (compile check via `rolesFromAliases`'s input; ST-7).
