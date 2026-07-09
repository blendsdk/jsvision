# createTheme & rolesFromAliases: Theming

> **Document**: 03-02-create-theme-and-roles.md
> **Parent**: [Index](00-index.md)

## Overview

`createTheme(options)` turns a handful of seeds into a full `Theme`; `rolesFromAliases(colors)` is the
one canonical function turning the 16 `ThemeColors` aliases into all **63** control roles (+ their
role-only extras). Both live in `packages/core/src/engine/color/create-theme.ts` (split
`rolesFromAliases` → `roles.ts` if the file nears 500 lines, PA-8). Pure, zero-dep.

## Architecture

### Proposed Changes
Add `createTheme`/`rolesFromAliases`/`ThemeOptions`. The pipeline:

```
ThemeOptions (mode + accent + optional neutral/status + overrides + roleOverrides)
  │
  │  ramp.ts: neutral ramp (mode-anchored) + accent ramp + status seeds
  ▼
ThemeColors (16 resolved aliases)  ← options.overrides merged here (Partial<ThemeColors>)
  │
  │  rolesFromAliases()
  ▼
Theme (63 roles + extras)          ← options.roleOverrides deep-merged here (Partial<Theme>)
```

`rolesFromAliases` composes **only** from the 16 aliases it is handed (it has no ramp access — all
ramping happens in `createTheme` to produce the aliases). Its return type is `Theme`, so the compiler
proves every role + extra is present (RD-22 §"Traceability of coverage").

`defaultTheme` is **not** rewritten onto aliases — it stays the hand-authored literal and
`turboVisionTheme` aliases it (`03-04`). `rolesFromAliases` governs *generated* themes only.

## Implementation Details

### `ThemeOptions` + `createTheme` (AR-269)

```ts
export interface ThemeOptions {
  mode: 'light' | 'dark';                 // required
  accent: Color;                          // required — the brand seed (resolvable, not 'default')
  neutral?: Color;                        // else a mode-appropriate near-gray
  danger?: Color; warning?: Color; success?: Color; info?: Color; // else sensible defaults
  overrides?: Partial<ThemeColors>;       // discrete per-alias overrides, merged after generation
  roleOverrides?: Partial<Theme>;         // final per-role escape hatch, deep-merged last
}

export function createTheme(options: ThemeOptions): Theme;
```

- **neutral ramp**: a low-chroma ramp anchored on `neutral` (or a `mode`-appropriate near-gray when
  omitted). `mode` inverts which end becomes `background` vs `foreground` (dark → dark background /
  light foreground; light → the reverse).
- **accent ramp**: shades of `accent` for `accent` (base) + `accentMuted` (a dimmer/pressed step).
- **status**: `danger`/`warning`/`success`/`info` from the seeds or defaults.
- Seeds are **resolvable colors only** — `ramp` throws on a `'default'` seed (AR-283).
- `overrides` merge at the **alias** step (so an overridden `accent` re-drives every accent-derived
  role); `roleOverrides` deep-merge at the **role** step (surgical single-role fixes).

### `rolesFromAliases(colors)` — the 63-role semantic-collapse mapping (AR-267, PA-2)

```ts
export function rolesFromAliases(colors: ThemeColors): Theme;
```

Each role maps to its nearest alias by **purpose** (PA-2 semantic collapse): accent/focus surfaces →
`accent`/`accentMuted` + `foregroundOnAccent`; body text → `foreground`; de-emphasized → `foregroundMuted`;
disabled → `foregroundDisabled`; sunken fields → `backgroundSunken`; selected-unfocused rows →
`backgroundSelected`; status accents → `danger`/`warning`/`success`/`info` (default **red** hotkeys →
`danger`, **yellow** shortcuts → `warning`). The `defaultTheme` per-role palette variety is intentionally
**not** reproduced (it stays the literal `turboVisionTheme`).

The complete, authoritative mapping (all 63 roles; `fg`/`bg` are alias token names; **extra** lists
role-only keys):

| Role | fg | bg | extra |
|------|----|----|-------|
| `desktop` | `foregroundMuted` | `background` | `pattern: '░'` (U+2591) |
| `menuBar` | `foreground` | `backgroundRaised` | `hotkey: danger` |
| `menuSelected` | `foregroundOnAccent` | `accent` | `hotkey: danger` |
| `window` | `foreground` | `backgroundRaised` | `border: border`, `title: foreground`, `icon: accent` |
| `windowInactive` | `foregroundMuted` | `backgroundRaised` | `border: borderMuted`, `title: foregroundMuted`, `icon: foregroundMuted` |
| `dialog` | `foreground` | `backgroundRaised` | `border: border`, `title: foreground`, `icon: accent` |
| `button` | `foregroundOnAccent` | `accent` | — |
| `buttonFocused` | `foregroundOnAccent` | `accentMuted` | `hotkey: warning` |
| `staticText` | `foreground` | `backgroundRaised` | — |
| `label` | `foreground` | `backgroundRaised` | — |
| `labelSelected` | `accent` | `backgroundRaised` | — |
| `labelShortcut` | `warning` | `backgroundRaised` | — |
| `buttonDefault` | `foregroundOnAccent` | `accent` | — |
| `buttonDisabled` | `foregroundDisabled` | `backgroundRaised` | — |
| `buttonShortcut` | `warning` | `accent` | — |
| `buttonShadow` | `foregroundDisabled` | `backgroundRaised` | — |
| `clusterNormal` | `foreground` | `backgroundRaised` | — |
| `clusterSelected` | `accent` | `backgroundRaised` | — |
| `clusterShortcut` | `warning` | `backgroundRaised` | — |
| `clusterDisabled` | `foregroundDisabled` | `backgroundRaised` | — |
| `inputNormal` | `foreground` | `backgroundSunken` | — |
| `inputSelected` | `foreground` | `backgroundSunken` | — |
| `inputSelection` | `foregroundOnAccent` | `accent` | — |
| `inputArrows` | `accent` | `backgroundSunken` | — |
| `scrollBarPage` | `foregroundMuted` | `backgroundRaised` | — |
| `scrollBarControls` | `foreground` | `backgroundRaised` | — |
| `listNormal` | `foreground` | `backgroundRaised` | — |
| `listFocused` | `foregroundOnAccent` | `accent` | — |
| `listSelected` | `foreground` | `backgroundSelected` | — |
| `listDivider` | `borderMuted` | `backgroundRaised` | — |
| `tableHeader` | `foregroundOnAccent` | `accent` | — |
| `historyButtonSides` | `accent` | `backgroundRaised` | — |
| `historyButtonArrow` | `foregroundOnAccent` | `accent` | — |
| `historyWindow` | `foreground` | `backgroundRaised` | `border: border`, `icon: accent` (**no** `title`) |
| `historyViewer` | `foreground` | `backgroundRaised` | — |
| `historyViewerFocused` | `foregroundOnAccent` | `accent` | — |
| `outlineNormal` | `foreground` | `backgroundRaised` | — |
| `outlineFocused` | `foregroundOnAccent` | `accent` | — |
| `outlineSelected` | `foreground` | `backgroundSelected` | — |
| `outlineNotExpanded` | `foreground` | `backgroundRaised` | — |
| `tabActive` | `foregroundOnAccent` | `accent` | `hotkey: warning` |
| `tabInactive` | `foregroundOnAccent` | `accentMuted` | `hotkey: warning` |
| `tabDisabled` | `foregroundDisabled` | `accentMuted` | — |
| `progressFill` | `foregroundOnAccent` | `accent` | — |
| `progressTrack` | `foregroundMuted` | `backgroundSunken` | — |
| `calendarNormal` | `foreground` | `backgroundRaised` | — |
| `calendarToday` | `foregroundOnAccent` | `info` | — |
| `calendarSelected` | `foregroundOnAccent` | `accent` | — |
| `calendarCursor` | `foregroundOnAccent` | `accentMuted` | — |
| `calendarDisabled` | `foregroundDisabled` | `backgroundRaised` | — |
| `calendarWeekNumber` | `foregroundMuted` | `backgroundRaised` | — |
| `colorMarker` | `foreground` | `backgroundRaised` | — |
| `fileInfo` | `foregroundMuted` | `backgroundRaised` | — |
| `editorNormal` | `foreground` | `backgroundSunken` | — |
| `editorSelected` | `foregroundOnAccent` | `accent` | — |
| `memoNormal` | `foreground` | `backgroundSunken` | — |
| `memoSelected` | `foregroundOnAccent` | `accent` | — |
| `indicatorNormal` | `foregroundMuted` | `backgroundRaised` | — |
| `indicatorDragging` | `success` | `backgroundRaised` | — |
| `terminalNormal` | `foreground` | `backgroundSunken` | — |
| `statusBar` | `foreground` | `backgroundRaised` | `hotkey: danger` |
| `statusSelected` | `foregroundOnAccent` | `accent` | `hotkey: danger` |
| `shadow` | `foregroundDisabled` | `background` | — |

**Coverage:** all 63 roles listed; all 16 aliases used. Known collapses (documented, not defects):
the default `buttonDefault` brightCyan emphasis, the calendar/editor/list per-family hues, and the
`shadow`/`buttonShadow` dark-block effect fold to the nearest alias — `turboVisionTheme` preserves the
exact `defaultTheme` look for anyone who wants it.

### Integration Points
- `createTheme` consumes `ramp`/`lighten`/`darken`/`mix` (`03-01`) and `toRgb` (validation).
- `rolesFromAliases` output feeds `serializeTheme` (`03-03`) and the presets (`03-04`).

## Code Examples

```ts
import { createTheme, contrastRatio } from '@jsvision/core';

const dark = createTheme({ mode: 'dark', accent: '#3b82f6' });
// dark.button.bg resolves (via toRgb) to an accent-derived color.

const red = createTheme({ mode: 'light', accent: '#3b82f6', overrides: { accent: '#ff0000' } });
// red.button.bg / red.listFocused.bg now derive from '#ff0000'.

const tweaked = createTheme({ mode: 'dark', accent: '#3b82f6', roleOverrides: { desktop: { pattern: '▒' } } });
// only desktop.pattern changes; every other role is generated.
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| `accent`/`neutral`/status seed is `'default'` or unresolvable | `ramp` throws `InvalidColorError` (AR-283) | AR-283 |
| A role would be missing from `rolesFromAliases` | Compile error — return type is `Theme` (completeness guarantee) | AR-267 |
| `overrides`/`roleOverrides` carry a malformed color | Surfaces when the theme is later serialized/encoded via `toRgb` (not silently swallowed) | AR-281 |

> **Traceability:** `00-ambiguity-register.md` (PA-2, PA-8) + `../../requirements/00-ambiguity-register.md` (AR-267/AR-269/AR-283).

## Testing Requirements
- `rolesFromAliases(colors)` returns a value assignable to `Theme`; a runtime test asserts every
  `defaultTheme` role key is present in the output (ST-8).
- `createTheme({ mode:'dark', accent:'#3b82f6' })` → every role `fg`/`bg` parses via `toRgb`; `mode:'light'`
  yields a higher-luminance `background` (ST-9, ST-11).
- `overrides.accent` propagates to accent-derived roles; `roleOverrides` deep-merges one role (ST-10).
