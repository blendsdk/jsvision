/**
 * Blink helpers for the preview's "flash the edited color" feedback: when a role or alias is
 * selected, the designer momentarily recolors every theme cell currently painted in that color, so
 * the widgets using it blink in the live preview. Kept pure (no clock, no view) so the blink's
 * visuals are unit-testable; the app owns the timer that toggles the flash on and off.
 */
import { toRgb } from '@jsvision/core';
import type { Color, Theme, ThemeRole } from '@jsvision/core';

/** A writable view of a role type — the readonly modifiers stripped so a copy's fields can be set. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * A copy of `theme` with every role color field (`fg`/`bg`/`hotkey` and a chrome role's
 * `border`/`title`/`icon`) equal to `from` replaced by `to`. Non-color fields — a desktop's `pattern`
 * glyph, an `attrs` mask — are left untouched. Matching is by exact value (the same way the model
 * stores role colors), so passing the exact color a role uses flags every cell painted in it. The
 * input theme is not mutated.
 *
 * @param theme The theme to transform.
 * @param from  The color to look for across every role's color fields.
 * @param to    The color to substitute wherever `from` is found.
 * @returns A new theme with the substitution applied.
 * @example
 * import { flashColor, flashColorFor } from './model/flash.js';
 * const c = theme.button.bg;
 * const flashed = flashColor(theme, c, flashColorFor(c)); // every button.bg cell now flashes
 */
export function flashColor(theme: Theme, from: Color, to: Color): Theme {
  // Copy the theme, then overwrite each role with its flashed form. `Object.assign` per key keeps this
  // type-safe without an indexed union write (`out[key] = …` over `keyof Theme` narrows to `never`).
  const out = { ...theme };
  for (const key of Object.keys(theme) as (keyof Theme)[]) {
    Object.assign(out, { [key]: flashRole(theme[key], from, to) });
  }
  return out;
}

/**
 * Swap a single role's color fields (`fg`/`bg`/`hotkey`, plus a chrome role's `border`/`title`/`icon`)
 * from `from` to `to`. Non-color fields (`attrs`, the desktop `pattern`) are left untouched.
 */
function flashRole<R extends ThemeRole>(role: R, from: Color, to: Color): R {
  const swap = (c: Color): Color => (c === from ? to : c);
  const out: Writable<R> = { ...role };
  out.fg = swap(role.fg);
  out.bg = swap(role.bg);
  if (role.hotkey !== undefined) out.hotkey = swap(role.hotkey);
  // Chrome roles (window/dialog/desktop) add border/title/icon; swap them when present.
  const extra = role as Partial<Record<'border' | 'title' | 'icon', Color>>;
  const writableExtra = out as Partial<Record<'border' | 'title' | 'icon', Color>>;
  if (extra.border !== undefined) writableExtra.border = swap(extra.border);
  if (extra.title !== undefined) writableExtra.title = swap(extra.title);
  if (extra.icon !== undefined) writableExtra.icon = swap(extra.icon);
  return out;
}

/**
 * A high-contrast flash color for `c` — its photographic negative (per-channel `255 − v`), which is
 * always visibly distinct from `c`. A color with no RGB form (e.g. `'default'`) falls back to white.
 *
 * @param c The color being flashed against.
 * @returns A `#rrggbb` color that contrasts with `c`.
 * @example
 * import { flashColorFor } from './model/flash.js';
 * flashColorFor('#1010a0'); // → a light color, clearly different from the dark blue
 */
export function flashColorFor(c: Color): Color {
  const rgb = toRgb(c);
  if (rgb === null) return '#ffffff';
  const hex = (n: number): string => (255 - n).toString(16).padStart(2, '0');
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}
