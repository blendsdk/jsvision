/**
 * Adapter from a theme role to a paint `Style`. A `Style` is `{fg, bg, attrs?}`; a `ThemeRole` is
 * `{fg, bg, hotkey?}` (plus `border`/`title`/`pattern` on some roles). This maps only the foreground
 * and background and ignores the role-only extras (which chrome widgets read directly). Widgets pick
 * which role to use from their own state; this just turns the chosen role into fill/text colors.
 */
import type { Style, ThemeRole } from '@jsvision/core';

/**
 * Adapt a theme role to a paint `Style` (foreground/background, plus attributes
 * when the role carries them; role-only extras ignored).
 *
 * A role's optional `attrs` mask is copied through **only when present**, so an
 * attribute-free role returns exactly `{ fg, bg }` — no stray `attrs` key. That
 * keeps an untouched role's paint identical to before the attribute axis existed.
 *
 * @param role A resolved theme role.
 * @returns A `Style` with the role's foreground/background, and `attrs` iff the role set one.
 */
export function themeRoleToStyle(role: ThemeRole): Style {
  return role.attrs === undefined ? { fg: role.fg, bg: role.bg } : { fg: role.fg, bg: role.bg, attrs: role.attrs };
}
