# Theming

A theme is a set of named color roles (border, title, button faces, list rows, etc.). jsvision ships
ready-made presets, lets you generate one from a few seed colors, and downsamples colors to whatever
depth the terminal supports.

## Use a preset

Pass a preset to `createApplication`, or switch at runtime:

```ts
import { createApplication, nordTheme, draculaTheme } from '@jsvision/ui';

const app = createApplication({ theme: nordTheme });
app.onCommand('theme:dracula', () => app.setTheme(draculaTheme));
```

There are 13 tree-shakeable presets: `turboVisionTheme`, `monochromeTheme`, `slateTheme`,
`nordTheme`, `draculaTheme`, `solarizedDarkTheme`, `gruvboxDarkTheme`, and the retro-desktop set
`janusTheme`, `warpTheme`, `solsticeTheme`, `platinumTheme`, `workbenchTheme`, `horizonTheme`.

## Generate one from seeds

`createTheme(...)` builds a full role set from a small palette (background/foreground/accent/border,
light or dark mode), so you don't hand-author 60+ roles:

```ts
import { createTheme } from '@jsvision/ui';

const theme = createTheme({/* seed colors + mode: 'dark' | 'light' */});
const app = createApplication({ theme });
```

## Runtime switch

`app.setTheme(theme)` swaps the palette and repaints every view in one coalesced frame — safe from a
command handler or a bare call.

## Depth downsampling is automatic

You always author in truecolor. The render engine downsamples per frame to the terminal's real depth
(truecolor → 256 → 16 → monochrome) using a perceptual nearest-color match, and honors `NO_COLOR`.
You do not manage depth yourself; just pick good truecolor roles and trust the downsample.

## Authoring themes interactively

For hands-on theme design there is a standalone TUI (`yarn designer`) that previews a live gallery
under any preset and depth and exports the theme as JSON you can load with the core `parseTheme`.
