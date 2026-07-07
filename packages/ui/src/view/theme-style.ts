/**
 * Adapter from a theme role to a paint `Style`. A `Style` is `{fg, bg, attrs?}`; a `ThemeRole` is
 * `{fg, bg, hotkey?}` (plus `border`/`title`/`pattern` on some roles). This maps only the foreground
 * and background and ignores the role-only extras (which chrome widgets read directly). Widgets pick
 * which role to use from their own state; this just turns the chosen role into fill/text colors.
 */
import type { Style, ThemeRole } from '@jsvision/core';

/**
 * Adapt a theme role to a paint `Style` (foreground/background only; role-only extras ignored).
 *
 * @param role A resolved theme role.
 * @returns A `Style` carrying the role's foreground and background.
 */
export function themeRoleToStyle(role: ThemeRole): Style {
  return { fg: role.fg, bg: role.bg };
}
