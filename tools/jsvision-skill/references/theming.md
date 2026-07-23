# Theming

A theme maps semantic UI roles to colors. Keep theme/color APIs in `@jsvision/core` and application
and widget APIs in `@jsvision/ui`; never use deep imports.

- [Use installed public exports](#use-installed-public-exports)
- [Author a generated theme](#author-a-generated-theme)
- [Preserve contextual on-colors](#preserve-contextual-on-colors)
- [Audit contrast](#audit-contrast)
- [Treat shadows as a dedicated depth role](#treat-shadows-as-a-dedicated-depth-role)
- [Switch and design themes at runtime](#switch-and-design-themes-at-runtime)
- [Rely on automatic depth conversion](#rely-on-automatic-depth-conversion)

## Use installed public exports

Inspect the installed barrels before relying on a preset list because names and re-exports can vary
by release. In `@jsvision/core` 1.0.0 the public presets are:

`classicTheme`, `monochromeTheme`, `slateTheme`, `nordTheme`, `draculaTheme`,
`solarizedDarkTheme`, `gruvboxDarkTheme`, `janusTheme`, `warpTheme`, `solsticeTheme`,
`platinumTheme`, `workbenchTheme`, and `horizonTheme`.

```ts
import { draculaTheme, nordTheme } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const app = createApplication({ theme: nordTheme });
app.onCommand('theme.dracula', () => app.setTheme(draculaTheme));
```

If another release documents `turboVisionTheme`, verify whether that version aliases or renamed it
to `classicTheme`. Check `package.json` exports and `dist/index.d.ts`; do not guess a deep path.

## Author a generated theme

Use `createTheme` to expand a small semantic seed set into the complete role map. Type source colors
as `Color` or a constrained hex literal, not an unrestricted `string`.

```ts
import { createTheme, type Theme } from '@jsvision/core';

type HexColor = `#${string}`;

export function fromSource(accent: HexColor): Theme {
  return createTheme({ mode: 'light', accent });
}
```

Follow this order:

1. Pick `mode`, `accent`, and optional neutral/status seeds.
2. Generate the base theme.
3. Audit the concrete foreground/background role pairs.
4. Use `overrides` for semantic aliases that should update many roles.
5. Use `roleOverrides` only where one role needs a context-specific exception.
6. Render normal, focused, selected, disabled, dialog, and shadow states at supported color depths.

## Preserve contextual on-colors

One shortcut color may not contrast on both a light surface and a primary fill. Patch selected roles
with their existing on-color after generation:

```ts
const generated = createTheme({ mode: 'light', accent });
const theme: Theme = {
  ...generated,
  menuSelected: { ...generated.menuSelected, hotkey: generated.menuSelected.fg },
  buttonShortcut: { ...generated.buttonShortcut, fg: generated.button.fg },
  tabActive: { ...generated.tabActive, hotkey: generated.tabActive.fg },
  statusSelected: { ...generated.statusSelected, hotkey: generated.statusSelected.fg },
};
```

Apply the same reasoning to focused buttons and inactive tabs: inspect the actual container/on-color
pair rather than assuming an accelerator seed works everywhere.

## Audit contrast

Use `contrastRatio(fg, bg)` on concrete theme roles. As practical targets, use 4.5:1 for normal text
and 3:1 for component boundaries and non-text indicators. Disabled content and decorative texture
need separate judgment; never use those exemptions to excuse unreadable functional content.

```ts
import { contrastRatio } from '@jsvision/core';

expect(contrastRatio(theme.staticText.fg, theme.staticText.bg)).toBeGreaterThanOrEqual(4.5);
expect(contrastRatio(theme.window.border, theme.window.bg)).toBeGreaterThanOrEqual(3);
```

Run [audit-theme-contrast.mjs](../scripts/audit-theme-contrast.mjs) for a broad role report, then add
focused tests for the roles the application actually uses. ASCII snapshots prove geometry, not color
correctness; assert cell `fg`, `bg`, and `attrs` where color behavior matters.

## Treat shadows as a dedicated depth role

Window shadows use `theme.shadow`; button shadows use the separate `buttonShadow` role. A window
shadow preserves the underlying glyph and replaces only its foreground, background, and attributes,
so choose a deliberately dark neutral pair rather than inheriting a disabled-text token:

```ts
const theme: Theme = {
  ...generated,
  shadow: { fg: '#26332E', bg: '#18211D' },
};
```

Currently `shadow.fg` also supplies disabled foregrounds in menu/status rendering. Inspect those
states after changing it; see [gotchas.md](gotchas.md).

Enable window casting separately with `app.desktop.shadow = true`. The setter updates existing
windows and makes later windows inherit the setting.

## Switch and design themes at runtime

`app.setTheme(theme)` repaints the full retained tree in one coalesced frame. Keep an explicit
`activeTheme` when a preview must support Cancel rollback. Use one registry of label, command, and
theme to build menus and handlers together so they cannot drift.

For source-color selection, live preview, modal cleanup, compact lists, and Apply/Cancel behavior,
read [recipes/theme-designer.md](recipes/theme-designer.md).

## Rely on automatic depth conversion

Author resolvable truecolor values. The renderer downsamples truecolor → 256 → 16 → monochrome per
the terminal capability profile and honors `NO_COLOR`. Verify important states at the depths the
application supports.
