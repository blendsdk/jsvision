/**
 * Color-depth downsampling — how a color (and a whole {@link Theme}) renders once collapsed to a
 * lower terminal color depth. The designer uses this to preview a truecolor theme as it would look on
 * a 256-color, 16-color, or monochrome terminal: the live preview is recolored through
 * {@link downsampleTheme} while the authored (exported) theme keeps its original truecolor values.
 *
 * The 16-color mapping deliberately emits the **Borland/DOS-16** hex for each slot so the preview
 * stays in the same palette vocabulary as the rest of the designer.
 */
import { nearest256, nearest16, rgb256, toRgb, PALETTE } from '@jsvision/core';
import type { Color, ColorDepth, Rgb, Theme, ThemeRole } from '@jsvision/core';

/**
 * The 16 terminal color slots (in `nearest16`'s index order) mapped to the Borland/DOS-16 `PALETTE`
 * keys — the canonical CGA correspondence. `PALETTE` *is* the Borland palette in this order under DOS
 * names: ANSI "yellow" is dark yellow (brown), low-intensity "white" is lightGray, "brightBlack" is
 * darkGray, "brightYellow" is yellow, "brightWhite" is white.
 */
const DOS16_BY_SLOT: readonly (keyof typeof PALETTE)[] = [
  'black',
  'red',
  'green',
  'brown',
  'blue',
  'magenta',
  'cyan',
  'lightGray',
  'darkGray',
  'brightRed',
  'brightGreen',
  'yellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'white',
];

/** `#rrggbb` for an Rgb. */
export function hexOf(rgb: Rgb): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Black or white, whichever a simple luminance threshold picks for `rgb` at mono depth. */
function monoOf(rgb: Rgb): string {
  const luma = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luma >= 128 ? '#ffffff' : '#000000';
}

/**
 * The `#rrggbb` a single color collapses to at a given terminal depth. A `'default'` or otherwise
 * unresolvable color has no fixed RGB, so it is returned unchanged (it stays "terminal default").
 *
 * @param color The color to downsample.
 * @param depth The target terminal color depth.
 * @returns The resulting color: an exact `#rrggbb` for a resolvable color, or `color` unchanged when
 *   it has no RGB (e.g. `'default'`).
 * @example
 * import { colorAtDepth } from './model/downsample.js';
 *
 * colorAtDepth('#3b82f6', '16');   // e.g. '#0000aa' — the nearest DOS-16 blue
 * colorAtDepth('#3b82f6', 'mono'); // '#000000'
 * colorAtDepth('default', '16');   // 'default' — unchanged
 */
export function colorAtDepth(color: Color, depth: ColorDepth): Color {
  const rgb = toRgb(color);
  if (rgb === null) return color; // 'default' / unresolvable → no fixed RGB to downsample
  switch (depth) {
    case 'truecolor':
      return hexOf(rgb) as Color;
    case '256':
      return hexOf(rgb256(nearest256(rgb))) as Color;
    case '16':
      // The DOS-16 palette hex for the slot the downsampler emits (kept in the designer's vocabulary).
      return PALETTE[DOS16_BY_SLOT[nearest16(rgb)]] as Color;
    case 'mono':
      return monoOf(rgb) as Color;
  }
}

/**
 * Downsample every color in a theme to a terminal depth, producing a new theme that previews how the
 * original renders on a shallower terminal. Each role's color-valued fields (`fg`/`bg`/`hotkey` and a
 * chrome role's `border`/`title`/`icon`) are collapsed via {@link colorAtDepth}; non-color fields (a
 * role's `attrs` mask, the desktop `pattern` glyph) pass through untouched. At `'truecolor'` the theme
 * is returned unchanged.
 *
 * This is a **preview transform only** — the designer applies it to the live app so an author sees the
 * theme at a chosen depth, while the exported/serialized theme keeps its authored truecolor values.
 *
 * @param theme The authored theme.
 * @param depth The target terminal color depth.
 * @returns A new theme with every color downsampled (or the same theme at `'truecolor'`).
 * @example
 * import { downsampleTheme } from './model/downsample.js';
 * import { defaultTheme } from '@jsvision/core';
 *
 * const at16 = downsampleTheme(defaultTheme, '16'); // every role color snapped to the DOS-16 palette
 * app.setTheme(at16);                               // the whole app now previews at 16 colors
 */
export function downsampleTheme(theme: Theme, depth: ColorDepth): Theme {
  if (depth === 'truecolor') return theme;
  // Copy the theme, then overwrite each role with its downsampled form. `Object.assign` per key keeps
  // this type-safe without an indexed union write (`out[key] = …` over `keyof Theme` would be `never`).
  const out = { ...theme };
  for (const key of Object.keys(theme) as (keyof Theme)[]) {
    Object.assign(out, { [key]: downsampleRole(theme[key], depth) });
  }
  return out;
}

/** A writable view of a role type — the readonly modifiers stripped so a copy's fields can be set. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Downsample a single role's color fields: `fg`/`bg`/`hotkey` and a chrome role's
 * `border`/`title`/`icon`. Non-color fields (`attrs`, the desktop `pattern`) are left untouched.
 */
function downsampleRole<R extends ThemeRole>(role: R, depth: ColorDepth): R {
  const map = (c: Color): Color => colorAtDepth(c, depth);
  const out: Writable<R> = { ...role };
  out.fg = map(role.fg);
  out.bg = map(role.bg);
  if (role.hotkey !== undefined) out.hotkey = map(role.hotkey);
  // Chrome roles (window/dialog/desktop) add border/title/icon; map them when present.
  const extra = role as Partial<Record<'border' | 'title' | 'icon', Color>>;
  const writableExtra = out as Partial<Record<'border' | 'title' | 'icon', Color>>;
  if (extra.border !== undefined) writableExtra.border = map(extra.border);
  if (extra.title !== undefined) writableExtra.title = map(extra.title);
  if (extra.icon !== undefined) writableExtra.icon = map(extra.icon);
  return out;
}
