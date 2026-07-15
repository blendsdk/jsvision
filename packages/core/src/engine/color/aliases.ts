/**
 * The semantic alias tier — the small, human-authored vocabulary a theme is
 * expressed in, one level below the 68 concrete UI roles.
 *
 * A {@link ThemeColors} object is 18 named colors describing *intent* (body text,
 * a raised surface, the brand accent, the highlighted hotkey letter) rather than a
 * specific widget. `createTheme` produces one of these from a handful of seeds, and
 * `rolesFromAliases` expands it into a full {@link Theme}. Author at this tier and
 * every control stays coherent; you never hand-write 68 roles.
 */
import type { Color } from '../render/types.js';

/**
 * The 18 semantic color aliases a generated theme is built from.
 *
 * Each token is a {@link Color} (hex, a named ANSI-16 color, or `'default'`) and
 * carries a fixed meaning — the groups are text, surface, accent, accelerator, line,
 * and status. `rolesFromAliases` maps every one of the 68 UI roles onto its nearest
 * token by purpose, so changing (say) `accent` re-colors every focus/selection
 * surface at once.
 *
 * This is a type — it has no runtime footprint and is exempt from the `@example`
 * doc rule; build a value with `createTheme` (or an object literal) instead.
 */
export interface ThemeColors {
  // --- text (4) ---
  /** Primary body text — the default readable foreground on a normal surface. */
  readonly foreground: Color;
  /** De-emphasized text — captions, dividers, inactive titles; sits on the same surfaces as {@link foreground}. */
  readonly foregroundMuted: Color;
  /** Disabled text — a greyed control's label; deliberately low-contrast. */
  readonly foregroundDisabled: Color;
  /** Text drawn *on* the {@link accent} fill — a button caption, a focused row; must contrast the accent. */
  readonly foregroundOnAccent: Color;

  // --- surface (4) ---
  /** The base backdrop — the desktop field behind all windows. */
  readonly background: Color;
  /** A raised surface — window/dialog interiors, menus, list bodies; sits above {@link background}. */
  readonly backgroundRaised: Color;
  /** A sunken surface — the well of an input/editor field, visually recessed below {@link backgroundRaised}. */
  readonly backgroundSunken: Color;
  /** A selected-but-unfocused row's fill — a quiet highlight distinct from the {@link accent} focus fill. */
  readonly backgroundSelected: Color;

  // --- accent (2) ---
  /** The brand/focus color — focused rows, the default button, selected menu/tab fills. */
  readonly accent: Color;
  /** A dimmer/pressed step of {@link accent} — a focused button face, an inactive tab. */
  readonly accentMuted: Color;

  // --- accelerator (2) ---
  /** The highlighted hotkey letter of an in-dialog control — a focused button, a tab, a label/cluster shortcut. */
  readonly accelerator: Color;
  /** The highlighted hotkey letter of the global chrome — the menu bar and the status line. */
  readonly menuAccelerator: Color;

  // --- line (2) ---
  /** Frame and border lines on an active surface. */
  readonly border: Color;
  /** Dimmed border lines — an inactive window frame, an inter-column divider. */
  readonly borderMuted: Color;

  // --- status (4) ---
  /** Danger / destructive signal — error emphasis, a destructive action. Drives the `dangerText` UI role. */
  readonly danger: Color;
  /** Warning / attention signal. Drives the `warningText` UI role. */
  readonly warning: Color;
  /** Success / positive signal — a completed action, a drag-in-progress indicator. */
  readonly success: Color;
  /** Informational signal — a "today" marker, a neutral highlight. */
  readonly info: Color;
}
