/**
 * The pure state types behind the theme designer — no view, no I/O.
 *
 * The model is **two-mode**, discriminated by `roleSnapshot`:
 * - `roleSnapshot === null` ⇒ *derive* mode — the theme is generated from editable {@link ThemeSeeds}
 *   plus per-alias overrides via `createTheme`, so editing an alias re-drives every role that uses it.
 * - `roleSnapshot !== null` ⇒ *roles* mode — an opaque 63-role theme (from an import or a literal
 *   preset) is shown verbatim; the first alias/seed edit transitions back to derive mode.
 *
 * In both modes, per-role overrides are layered last, so a direct role edit always wins.
 */
import type { Color, ColorDepth, Theme, ThemeColors } from '@jsvision/core';

/** The seed inputs for `createTheme`-based derivation — the source of truth in *derive* mode. */
export interface ThemeSeeds {
  /** Light or dark: inverts which end of the neutral ramp becomes surface vs. text. */
  readonly mode: 'light' | 'dark';
  /** The brand/accent seed — a resolvable color, not `'default'`. */
  readonly accent: Color;
  /** Neutral seed for the surface/text ramp; defaults to a mode-neutral gray. */
  readonly neutral?: Color;
  /** Danger signal seed; defaults to a red. */
  readonly danger?: Color;
  /** Warning signal seed; defaults to an amber. */
  readonly warning?: Color;
  /** Success signal seed; defaults to a green. */
  readonly success?: Color;
  /** Info signal seed; defaults to a blue. */
  readonly info?: Color;
}

/** What the inspector currently edits — one of the 18 aliases, or one of the 63 concrete roles. */
export type EditTarget =
  { readonly kind: 'alias'; readonly name: keyof ThemeColors } | { readonly kind: 'role'; readonly name: keyof Theme };

/** Per-role overrides — a partial patch per role (only the fields the user changed). */
export type RoleOverrides = { readonly [K in keyof Theme]?: Partial<Theme[K]> };

/** The full editing state. Every field is immutable; mutators produce a fresh state object. */
export interface DesignerState {
  /** The active seeds (the derive-mode source of truth; retained through roles mode as a preview). */
  readonly seeds: ThemeSeeds;
  /** Per-alias edits merged over the seed-derived aliases (derive mode). */
  readonly aliasOverrides: Partial<ThemeColors>;
  /** Per-role edits, applied last in both modes. */
  readonly roleOverrides: RoleOverrides;
  /** Non-null ⇒ roles mode: an opaque theme (import / literal preset) shown verbatim. */
  readonly roleSnapshot: Theme | null;
  /** What the inspector edits. */
  readonly selected: EditTarget;
  /** The color depth the sample strip previews at. */
  readonly depth: ColorDepth;
  /** True when there are unsaved edits since the last load/save. */
  readonly dirty: boolean;
}

/** The designer's own preset registry (core exposes presets as `Theme`s, not by a name type). */
export type PresetName =
  | 'turbo-vision'
  | 'monochrome'
  | 'slate'
  | 'nord'
  | 'dracula'
  | 'solarized-dark'
  | 'gruvbox-dark'
  | 'janus'
  | 'warp'
  | 'solstice'
  | 'platinum'
  | 'workbench'
  | 'horizon';
