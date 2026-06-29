/**
 * Theme-role → Style adapter (RD-03, AR-45 / PA-6). Core's `Style` is `{fg, bg, attrs?}`; a
 * `ThemeRole` is `{fg, bg, hotkey?}` (+ `border`/`title`/`pattern` on some roles). The adapter
 * maps `fg`/`bg`, leaves `attrs` unset (`Attr.none`), and ignores the role-only extras — those are
 * RD-05 chrome concerns. The widget owns role selection from its state; RD-03 only resolves names.
 */
import type { Style, ThemeRole } from '@jsvision/core';

/**
 * Adapt a theme role to a paint `Style` (fg/bg only; extras ignored, AR-45).
 *
 * @param role A resolved theme role.
 * @returns A `Style` carrying the role's foreground and background.
 */
export function themeRoleToStyle(role: ThemeRole): Style {
  return { fg: role.fg, bg: role.bg };
}
