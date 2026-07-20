/**
 * Build a full {@link Theme} from a handful of seed colors.
 *
 * `createTheme` is the front door of the theming system: give it a `mode` and an
 * `accent` (plus optional neutral/status seeds), and it derives the 18 semantic
 * aliases with perceptual {@link ramp}s and hands them to {@link rolesFromAliases}
 * to fill in every role. Two override hooks let you steer the result — `overrides`
 * adjusts the aliases (and so re-drives every role that uses them), while
 * `roleOverrides` patches individual roles as a final escape hatch.
 */
import type { Color } from '../render/types.js';

import type { ThemeColors } from './aliases.js';
import { contrastRatio } from './contrast.js';
import { darken, ramp } from './ramp.js';
import { rolesFromAliases } from './roles.js';
import type { Theme, ThemeRole } from './theme.js';

/** Seed colors and override hooks for {@link createTheme}. */
/**
 * A per-role, per-field patch onto a generated theme: every role is optional, and so is every field
 * within a role. Patching one field leaves the rest of that role exactly as generated.
 */
export type RoleOverrides = { readonly [K in keyof Theme]?: Partial<Theme[K]> };

export interface ThemeOptions {
  /** Light or dark: inverts which end of the neutral ramp becomes surface vs. text. */
  readonly mode: 'light' | 'dark';
  /** The brand/accent seed — a resolvable color (hex or named), **not** `'default'`. */
  readonly accent: Color;
  /** Neutral seed for the surface/text ramp; defaults to a mode-neutral gray. Low-chroma works best. */
  readonly neutral?: Color;
  /** In-dialog control hotkey (accelerator) seed; defaults to an amber. Independent of `warning`. */
  readonly accelerator?: Color;
  /** Menu-bar / status-line hotkey (accelerator) seed; defaults to a red. Independent of `danger`. */
  readonly menuAccelerator?: Color;
  /** Danger signal seed; defaults to a red. Drives the `dangerText` role a `Text` paints at `severity: 'error'`. */
  readonly danger?: Color;
  /** Warning signal seed; defaults to an amber. Drives the `warningText` role a `Text` paints at `severity: 'warning'`. */
  readonly warning?: Color;
  /** Success signal seed; defaults to a green. */
  readonly success?: Color;
  /** Info signal seed; defaults to a blue. */
  readonly info?: Color;
  /** Per-alias overrides merged after generation — an overridden alias re-drives every role that uses it. */
  readonly overrides?: Partial<ThemeColors>;
  /**
   * Per-role overrides deep-merged last — surgical single-role/single-field fixes.
   *
   * Each role is optional, and so is each field within it: patching one field leaves the rest of that
   * role as generated. `Partial<Theme>` cannot express that — it would make every field of a named
   * role mandatory, forcing a caller to restate the values it does not want to change.
   */
  readonly roleOverrides?: RoleOverrides;
}

/** Indices into a 9-step neutral ramp (0 = darkest … 8 = lightest). */
const RAMP_STEPS = 9;

/** Pick black or white for text drawn on `bg`, whichever contrasts more. */
function foregroundOn(bg: Color): Color {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#000000') ? '#ffffff' : '#000000';
}

/**
 * Derive the 18 semantic {@link ThemeColors} aliases from a set of seeds — the step {@link createTheme}
 * runs before it merges `overrides` and expands the roles.
 *
 * Give it the same `mode`/`accent`/neutral/status seeds you would pass to {@link createTheme} and it
 * returns the resolved alias palette: a perceptual neutral ramp yields the surfaces and text, the
 * accent yields the focus/selection colors, and the status seeds fill the rest. Any `overrides` or
 * `roleOverrides` on the options are ignored here — this is purely the seed→alias derivation, exposed
 * so a tool (e.g. a theme editor) can show the aliases a given seed set produces without building the
 * full theme.
 *
 * @param options Seeds (`mode`, `accent`, optional `neutral`/accelerator/status). `overrides`/`roleOverrides` are ignored.
 * @returns The 18 resolved aliases, before any override merge.
 * @throws InvalidColorError when a seed is `'default'` or otherwise unresolvable.
 * @example
 * import { aliasesFromSeeds } from '@jsvision/core';
 *
 * const aliases = aliasesFromSeeds({ mode: 'dark', accent: '#3b82f6' });
 * aliases.accent; // '#3b82f6' — the seed, surfaced as the accent alias
 */
export function aliasesFromSeeds(options: ThemeOptions): ThemeColors {
  const neutral = ramp(options.neutral ?? '#808080', RAMP_STEPS);
  const accent = options.accent;
  const dark = options.mode === 'dark';

  // Dark mode reads text off the light end of the ramp and surfaces off the dark end; light inverts.
  // The dark surfaces sit near the ramp floor (bg at step 1, the well at step 0) so a generated dark
  // theme reads as genuinely dark with a clear raised/sunken separation, rather than a flat mid-gray.
  const surface = dark
    ? {
        bg: neutral[1],
        raised: neutral[2],
        sunken: neutral[0],
        selected: neutral[3],
        border: neutral[4],
        borderMuted: neutral[3],
      }
    : {
        bg: neutral[7],
        raised: neutral[8],
        sunken: neutral[6],
        selected: neutral[5],
        border: neutral[4],
        borderMuted: neutral[5],
      };
  const text = dark
    ? { fg: neutral[8], muted: neutral[6], disabled: neutral[5] }
    : { fg: neutral[0], muted: neutral[2], disabled: neutral[3] };

  return {
    foreground: text.fg,
    foregroundMuted: text.muted,
    foregroundDisabled: text.disabled,
    foregroundOnAccent: foregroundOn(accent),
    background: surface.bg,
    backgroundRaised: surface.raised,
    backgroundSunken: surface.sunken,
    backgroundSelected: surface.selected,
    accent,
    accentMuted: darken(accent, 0.1),
    accelerator: options.accelerator ?? '#f59e0b',
    menuAccelerator: options.menuAccelerator ?? '#ef4444',
    border: surface.border,
    borderMuted: surface.borderMuted,
    danger: options.danger ?? '#ef4444',
    warning: options.warning ?? '#f59e0b',
    success: options.success ?? '#22c55e',
    info: options.info ?? '#0ea5e9',
  };
}

/** Deep-merge per-role overrides onto a base theme (per-role field-level merge). */
function applyRoleOverrides(base: Theme, overrides: RoleOverrides): Theme {
  const out: Theme = { ...base };
  // Widen to a role map for the write; each merged value keeps its base role's extras at runtime.
  const writable = out as Record<keyof Theme, ThemeRole>;
  for (const name of Object.keys(overrides) as (keyof Theme)[]) {
    const patch = overrides[name];
    if (patch === undefined) continue;
    writable[name] = { ...base[name], ...patch };
  }
  return out;
}

/**
 * Build a complete {@link Theme} from seed colors.
 *
 * Required: a `mode` and an `accent`. Everything else is derived — a perceptual
 * neutral ramp yields the surfaces and text, the accent yields the focus/selection
 * colors, and sensible status colors fill the rest. Every produced color is a
 * resolvable {@link Color}, so the theme encodes and downsamples like any other.
 *
 * @param options Seeds (`mode`, `accent`, optional `neutral`/status) plus the
 *   `overrides` (alias-level) and `roleOverrides` (role-level) hooks.
 * @returns A full theme ready to render or serialize.
 * @throws InvalidColorError when a seed is `'default'` or otherwise unresolvable.
 * @example
 * import { createTheme } from '@jsvision/core';
 *
 * const dark = createTheme({ mode: 'dark', accent: '#3b82f6' });
 * const brandRed = createTheme({ mode: 'light', accent: '#3b82f6', overrides: { accent: '#ff0000' } });
 * brandRed.button.bg; // '#ff0000' — the override re-drove every accent role
 */
export function createTheme(options: ThemeOptions): Theme {
  const aliases: ThemeColors = { ...aliasesFromSeeds(options), ...options.overrides };
  const roles = rolesFromAliases(aliases);
  return options.roleOverrides ? applyRoleOverrides(roles, options.roleOverrides) : roles;
}
