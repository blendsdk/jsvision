# Designer Model: Theme Designer

> **Document**: 03-02-designer-model.md
> **Parent**: [Index](00-index.md)
> Lives in `packages/theme-designer/src/model/`. Pure, view-free, headless-testable.

## Overview

The pure state machine behind the app (AR-11). It owns the theme-authoring state and derives the live
`Theme`, so every behavior is unit-testable without a terminal — exactly the pattern already proven by
`examples/themes-demo/designer.ts`, scaled to alias + role editing, contrast, depth, and file round-trips.
The view (03-03) is a thin reactive shell over this model.

## Architecture

`@jsvision/core` provides the theming primitives; this module composes them into an editing session. It
performs **no** I/O — serialize/parse produce/consume strings; the host layer does the actual fs (AR-21).

## Implementation Details

### State (two-mode)

The core theming API is asymmetric — you can go **seeds → `Theme`** (`createTheme`) but never **`Theme` →
aliases**, and `defaultTheme`/`monochromeTheme`/imported files are opaque `Theme`s with **no alias form**
(`defaultTheme` is a hand-authored DOS-16 literal, not `createTheme`-derived). So the model carries a single
`roleSnapshot` discriminator instead of holding a resolved 16-alias set (which nothing can supply for an
opaque theme):

- **`roleSnapshot === null` ⇒ *derive* mode** — the theme is generated from editable `seeds` +
  `aliasOverrides` via `createTheme`; alias editing works immediately.
- **`roleSnapshot !== null` ⇒ *roles* mode** — an opaque 63-role theme (from **import** or a **literal
  preset**) is shown verbatim; the first alias/seed edit **transitions to derive** and drops the snapshot,
  so that edit is immediately visible (no reverse alias→roles map needed).

```ts
export type EditTarget =
  | { readonly kind: 'alias'; readonly name: keyof ThemeColors }
  | { readonly kind: 'role'; readonly name: keyof Theme };

/** The seed inputs for createTheme-based derivation (the 'derive' source of truth). */
export interface ThemeSeeds {
  readonly mode: 'light' | 'dark';
  readonly accent: Color;
  readonly neutral?: Color;
  readonly danger?: Color; readonly warning?: Color; readonly success?: Color; readonly info?: Color;
}

export interface DesignerState {
  readonly seeds: ThemeSeeds;                    // active source of truth in derive mode
  readonly aliasOverrides: Partial<ThemeColors>; // per-alias edits merged over the derived aliases
  readonly roleOverrides: Partial<Theme>;        // per-role edits, applied last (both modes)
  readonly roleSnapshot: Theme | null;           // non-null ⇒ roles mode (import / literal preset)
  readonly selected: EditTarget;                 // what the inspector edits
  readonly depth: ColorDepth;                    // preview depth toggle
  readonly dirty: boolean;                       // unsaved edits since last load/save
}
```

### The model (a small reactive object; signatures indicative)

```ts
/** The model's own preset registry (core exposes presets as Themes, not by a PresetName type). */
export type PresetName =
  | 'turbo-vision' | 'monochrome' | 'slate' | 'nord' | 'dracula' | 'solarized-dark' | 'gruvbox-dark';

export interface DesignerModel {
  readonly state: Accessor<DesignerState>;       // reactive snapshot
  readonly theme: Accessor<Theme>;               // derived live Theme (memoized)

  select(target: EditTarget): void;
  colorOf(target: EditTarget): Color;            // current color for the inspector to load
  resolvedAliases(): ThemeColors;                // the 16 aliases for the rail chips (derive mode)

  setAlias(name: keyof ThemeColors, color: Color): void;     // R1 — writes aliasOverrides; transitions roles→derive
  setMode(mode: 'light' | 'dark'): void;                     // sets seeds.mode; transitions roles→derive
  setRole(name: keyof Theme, patch: Partial<ThemeRole>): void; // R2 — writes roleOverrides (both modes)
  clearRole(name: keyof Theme): void;                          // revert to derived / snapshot value

  setDepth(depth: ColorDepth): void;

  loadPreset(name: PresetName): void;            // R8 — resets dirty (see mapping below)
  reset(): void;                                 // derive mode from default seeds (a generated palette)

  exportJson(): string;                          // R9 — serializeTheme(theme())
  importJson(json: string): void;                // R10 — throws InvalidThemeError on bad input; roles mode (roleSnapshot set); dirty=false
  markSaved(): void;                             // clears dirty after a successful write
}
```

### Derivation (the core rule)

- **Derive mode** (`roleSnapshot === null`): `theme()` = `createTheme({ ...seeds, overrides: aliasOverrides,
  roleOverrides })`. `aliasOverrides` re-drives the roles each edited alias touches; `roleOverrides` is
  layered last — matching `createTheme`'s documented order (`overrides` → `rolesFromAliases` →
  `roleOverrides`). The rail's alias chips read `resolvedAliases()` = `{ ...aliasesFromSeeds(seeds),
  ...aliasOverrides }`.
- **Roles mode** (`roleSnapshot !== null`): `theme()` = `applyRoleOverrides(roleSnapshot, roleOverrides)` —
  the opaque theme verbatim, plus any role edits made since. `resolvedAliases()` returns the retained
  `seeds`' aliases as a *preview* of what switching to alias editing would produce.
- **Transition (roles → derive):** the first `setAlias`/`setMode` clears `roleSnapshot` (→ null) and applies
  the edit onto the retained `seeds` + `aliasOverrides`, so the edit is immediately visible. User role edits
  made in roles mode survive as `roleOverrides` (AR-25).

> **`reset()`** returns to derive mode from a fixed default seed set — a **generated** palette, deliberately
> *not* the DOS-16 `defaultTheme` (which has no alias form). The exact `turboVisionTheme` look is available
> via `loadPreset('turbo-vision')`, which enters **roles** mode.

### Presets (R8, AR-16) — mapping

- The **5 derived presets** (`slate`/`nord`/`dracula`/`solarized-dark`/`gruvbox-dark`) load as **seed sets**
  into **derive** mode (`{ mode, accent, neutral, aliasOverrides: overrides }`) — verified: they carry no
  `roleOverrides` — so alias editing works immediately. Their seed sets come from core (exposed as data) or a
  small in-model table.
- The **2 literal presets** (`turbo-vision` = `defaultTheme`, `monochrome`) load as a **role snapshot** into
  **roles** mode (they have no seeds); editing an alias transitions to derive from the default seeds.
- `loadPreset` clears `dirty`.

### Contrast (R6)

```ts
export interface ContrastRow { readonly pair: string; readonly ratio: number; readonly level: 'AAA'|'AA'|'fail'; }
export function contrastRows(theme: Theme): ContrastRow[];   // AR-14
```

Evaluates a fixed list of text/bg role pairs (lifted + extended from `themes-demo`'s `CONTRAST_PAIRS`):
`staticText`, `dialog`, `menuBar`, `button`, `inputNormal`, `listFocused`, `statusBar`, `window` title/bg.
Uses `contrastRatio`; **skips** any pair returning `NaN` (a `'default'` color). `level` = `ratio>=7 ? 'AAA'
: ratio>=4.5 ? 'AA' : 'fail'`.

### Depth (R7)

```ts
export interface DepthSample { readonly depth: ColorDepth; readonly hex: string; readonly label: string; }
export function depthSamples(color: Color): DepthSample[];    // AR-15
```

`truecolor` = the color as-is; `256` = `rgb256(nearest256(rgb))`; `16` = the Borland DOS-16 hex for the
slot `nearest16(rgb)` emits — `PALETTE[DOS16_BY_SLOT[nearest16(rgb)]]`, a fixed 16-entry CGA reindex of
`PALETTE` (AR-26 runtime — the naïve `PALETTE[ANSI16_ORDER[nearest16(rgb)]]` is invalid: `PALETTE` is
keyed by Borland names, `ANSI16_ORDER` yields ANSI names); `mono` = luminance-threshold black/white. A
`'default'`/unresolvable color yields a single "n/a" row.

> **Additive core export:** `rgb256` is not currently re-exported from `@jsvision/core`'s public barrel (it
> lives in `palette.ts`); this feature adds it (additive, no behavior change). `depthSamples` is
> **display-only** — it computes the 4 swatch hexes for the selected color. The preview gallery itself is
> **not** re-rendered at a lower depth (R7 is scoped to this sample strip — see 03-03 §Depth).

### Hex validation (R3, AR-20)

A `#rrggbb`-well-formed `Validator` (not just a charset `filter`): `isValidInput` accepts the growing prefix
of `#` + up to 6 hex digits; `isValid` requires exactly `#rrggbb` (or a 3-digit `#rgb`); errors otherwise.
Lives in `packages/theme-designer/src/model/hex-validator.ts` (parse logic mirrors the existing
`color-picker.ts` `parseHex`).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `importJson` receives non-JSON / wrong version / missing/unknown role / bad color | let `parseTheme`'s `InvalidThemeError` propagate to the host, which shows a `messageBox`; **model state unchanged** | AR-20 |
| `setAlias`/`setRole` given `'default'` or an unresolvable color | `'default'` is a valid `Color` and allowed; a malformed hex never reaches the model (validator gates the field) | AR-20 |
| `loadPreset`/`importJson` while `dirty` | the model does not prompt — the **host** runs the confirm before calling (AR-24); the model just resets `dirty` on success | AR-24 |

> **Traceability:** see `00-ambiguity-register.md` for every AR referenced.

## Testing Requirements

- Pure model spec: ST-12…ST-22 (derive, override, clear, preset, contrast, depth, serialize round-trip, import valid/invalid, dirty, hex validator) + ST-31 (the roles→derive transition: an alias edit after import/literal-preset load is immediately visible).
- Impl tests: roles↔derive transition edge cases (roleSnapshot lifecycle, user role edits surviving as `roleOverrides`); light/dark derivation; preset → dirty reset; `resolvedAliases` in both modes.
