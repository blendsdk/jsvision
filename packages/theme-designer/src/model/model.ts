/**
 * The pure, headless-testable state machine behind the theme designer. It owns the editing state and
 * derives the live {@link Theme}; the view is a thin reactive shell over it. It performs no I/O —
 * `exportJson`/`importJson` produce/consume strings; the host layer does the actual filesystem work.
 *
 * See {@link DesignerState} for the two-mode (derive / roles) design. The model holds a single reactive
 * `state` signal and derives the theme by plain function (identity-memoized), so a reactive consumer
 * that reads `state()`/`theme()` inside an effect re-runs on every edit, with no extra reactive nodes.
 */
import {
  createTheme,
  aliasesFromSeeds,
  serializeTheme,
  parseTheme,
  defaultTheme,
  monochromeTheme,
  PRESET_SEEDS,
} from '@jsvision/core';
import type { Color, Theme, ThemeColors, ThemeRole } from '@jsvision/core';
import { signal } from '@jsvision/ui';

import type { DesignerState, EditTarget, PresetName, RoleOverrides, ThemeSeeds } from './types.js';

/** The starting seeds — a generated dark palette (the exact DOS-16 look is `loadPreset('turbo-vision')`). */
const DEFAULT_SEEDS: ThemeSeeds = { mode: 'dark', accent: '#3b82f6' };

/** The reactive theme-authoring model. Every mutator produces a fresh {@link DesignerState}. */
export interface DesignerModel {
  /** The current editing state (reactive: reading inside an effect tracks it). */
  readonly state: () => DesignerState;
  /** The derived live theme (identity-memoized on the state). */
  readonly theme: () => Theme;

  /** Point the inspector at an alias or role. */
  select(target: EditTarget): void;
  /**
   * The current color for a target. An alias target has a single color (the `field` is ignored); a
   * role target has both a background and a foreground — `field` selects which (default `'bg'`).
   */
  colorOf(target: EditTarget, field?: 'fg' | 'bg'): Color;
  /** The 18 resolved aliases (seed-derived + overrides) — for the rail's alias chips. */
  resolvedAliases(): ThemeColors;

  /** Edit an alias; transitions roles→derive so the edit is immediately visible. */
  setAlias(name: keyof ThemeColors, color: Color): void;
  /** Set the light/dark mode; transitions roles→derive. */
  setMode(mode: 'light' | 'dark'): void;
  /** Override a single role's fields (applied last in both modes). */
  setRole(name: keyof Theme, patch: Partial<ThemeRole>): void;
  /** Drop a role override, reverting it to the derived/snapshot value. */
  clearRole(name: keyof Theme): void;

  /** Set the depth the sample strip previews at (not a theme edit; does not set dirty). */
  setDepth(depth: DesignerState['depth']): void;

  /** Load a preset — derived presets enter derive mode, literals enter roles mode. Clears dirty. */
  loadPreset(name: PresetName): void;
  /** Reset to the default generated palette (derive mode). Clears dirty. */
  reset(): void;

  /** Serialize the live theme to JSON. */
  exportJson(): string;
  /** Adopt a theme from JSON (roles mode). Throws `InvalidThemeError` on bad input, leaving state untouched. */
  importJson(json: string): void;
  /** Clear the dirty flag after a successful save. */
  markSaved(): void;
}

/** Deep-merge per-role overrides onto a base theme (partial per-role field merge; extras preserved). */
function applyRoleOverrides(base: Theme, overrides: RoleOverrides): Theme {
  const keys = Object.keys(overrides) as (keyof Theme)[];
  if (keys.length === 0) return base;
  const out: Theme = { ...base };
  const writable = out as Record<keyof Theme, ThemeRole>;
  for (const name of keys) {
    const patch = overrides[name];
    if (patch === undefined) continue;
    writable[name] = { ...base[name], ...patch };
  }
  return out;
}

/** Derive the live theme: the snapshot (roles mode) or a `createTheme` result (derive mode), + role edits. */
function deriveTheme(s: DesignerState): Theme {
  const base = s.roleSnapshot ?? createTheme({ ...s.seeds, overrides: s.aliasOverrides });
  return applyRoleOverrides(base, s.roleOverrides);
}

/** Split a core `ThemeOptions`-shaped preset seed set into our {@link ThemeSeeds} + alias overrides. */
function seedsOf(opts: (typeof PRESET_SEEDS)[keyof typeof PRESET_SEEDS]): {
  seeds: ThemeSeeds;
  aliasOverrides: Partial<ThemeColors>;
} {
  const { overrides, ...seeds } = opts;
  return { seeds, aliasOverrides: overrides ?? {} };
}

/**
 * Create a fresh theme-designer model, starting in derive mode on a generated dark palette.
 *
 * @returns A {@link DesignerModel}.
 * @example
 * import { createDesignerModel } from './model/model.js';
 *
 * const model = createDesignerModel();
 * model.setAlias('accent', '#3b82f6'); // re-drives every accent role; model is now dirty
 * model.theme().button.bg;             // '#3b82f6'
 */
export function createDesignerModel(): DesignerModel {
  const initial: DesignerState = {
    seeds: DEFAULT_SEEDS,
    aliasOverrides: {},
    roleOverrides: {},
    roleSnapshot: null,
    selected: { kind: 'alias', name: 'accent' },
    depth: 'truecolor',
    dirty: false,
  };
  const stateSig = signal<DesignerState>(initial);

  // Identity-memoize the derived theme so repeated reads (and `setTheme` dedup) return one instance
  // until the state object changes. The `stateSig()` read keeps reactive tracking intact.
  let cachedFrom: DesignerState | null = null;
  let cachedTheme: Theme | null = null;
  function theme(): Theme {
    const s = stateSig();
    if (s !== cachedFrom || cachedTheme === null) {
      cachedTheme = deriveTheme(s);
      cachedFrom = s;
    }
    return cachedTheme;
  }

  const set = (next: DesignerState): void => stateSig.set(next);

  function resolvedAliases(): ThemeColors {
    const s = stateSig();
    return { ...aliasesFromSeeds(s.seeds), ...s.aliasOverrides };
  }

  return {
    state: () => stateSig(),
    theme,
    resolvedAliases,

    select(target) {
      set({ ...stateSig(), selected: target });
    },

    colorOf(target, field = 'bg') {
      if (target.kind === 'alias') return resolvedAliases()[target.name];
      return theme()[target.name][field];
    },

    setAlias(name, color) {
      const s = stateSig();
      // Any alias edit drops the opaque snapshot (roles→derive) so the edit is visible.
      set({
        ...s,
        roleSnapshot: null,
        aliasOverrides: { ...s.aliasOverrides, [name]: color },
        dirty: true,
      });
    },

    setMode(mode) {
      const s = stateSig();
      set({ ...s, roleSnapshot: null, seeds: { ...s.seeds, mode }, dirty: true });
    },

    setRole(name, patch) {
      const s = stateSig();
      const prev = s.roleOverrides[name] ?? {};
      set({
        ...s,
        roleOverrides: { ...s.roleOverrides, [name]: { ...prev, ...patch } },
        dirty: true,
      });
    },

    clearRole(name) {
      const s = stateSig();
      if (s.roleOverrides[name] === undefined) return;
      const rest = { ...s.roleOverrides };
      delete rest[name];
      set({ ...s, roleOverrides: rest, dirty: true });
    },

    setDepth(depth) {
      set({ ...stateSig(), depth });
    },

    loadPreset(name) {
      const s = stateSig();
      if (name === 'turbo-vision' || name === 'monochrome') {
        // Literal presets have no seed form — load as an opaque role snapshot (roles mode).
        const snapshot = name === 'turbo-vision' ? defaultTheme : monochromeTheme;
        set({ ...s, roleSnapshot: snapshot, aliasOverrides: {}, roleOverrides: {}, dirty: false });
        return;
      }
      // Derived presets load as editable seeds (derive mode).
      const { seeds, aliasOverrides } = seedsOf(PRESET_SEEDS[name]);
      set({ ...s, seeds, aliasOverrides, roleOverrides: {}, roleSnapshot: null, dirty: false });
    },

    reset() {
      const s = stateSig();
      set({
        ...s,
        seeds: DEFAULT_SEEDS,
        aliasOverrides: {},
        roleOverrides: {},
        roleSnapshot: null,
        dirty: false,
      });
    },

    exportJson() {
      return serializeTheme(theme());
    },

    importJson(json) {
      // parseTheme throws InvalidThemeError on bad input BEFORE we mutate, so a failed import is a no-op.
      const parsed = parseTheme(json);
      const s = stateSig();
      set({ ...s, roleSnapshot: parsed, aliasOverrides: {}, roleOverrides: {}, dirty: false });
    },

    markSaved() {
      set({ ...stateSig(), dirty: false });
    },
  };
}
