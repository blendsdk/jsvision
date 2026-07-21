/**
 * The datagrid's remappable input keymap — a pure, view-free model. It is the data-plane twin of the
 * sort/filter/selection models: a {@link GridAction} vocabulary, a frozen {@link DEFAULT_KEYMAP}
 * chord→action table, a {@link resolveGridAction} lookup, and a {@link mergeKeymap} that layers a
 * caller's overrides on top of the default. The body dispatch resolves a key to a `GridAction` and
 * routes it; this module never touches a view.
 *
 * The chord grammar is the core keymap grammar — `'ctrl+alt+shift+key'`, case-insensitive, with the
 * key being a named key (`left`, `f2`, `pageup`, …) or a single character. Resolution reuses that
 * grammar verbatim (it compiles the merged table into a core keymap once and looks up against it), so
 * a chord's canonical form here is identical to everywhere else in the framework.
 *
 * Both merge validations fail soft, never hard: an entry naming an unknown action, or one whose chord
 * is malformed, is dropped with a development warning rather than thrown — so a single typo in a
 * caller's keymap can never blow up grid construction.
 */
import { createKeymap } from '@jsvision/ui';
import type { Keymap } from '@jsvision/ui';
import { devWarn } from './dev.js';

/**
 * One grid input intent — the vocabulary a chord resolves to and the body dispatch acts on.
 *
 * The navigation actions (including the ones the underlying row engine owns, `moveUp`/`moveDown`/
 * `pageUp`/`pageDown`) are all here so the whole navigation table is remappable in one place.
 * `nextCell`/`prevCell` exist for completeness but are never bound in {@link DEFAULT_KEYMAP}: `Tab`
 * cell traversal is delivered as a loop command, not a body key. `commit`/`cancel` are likewise part
 * of the vocabulary but owned by the open cell editor (which handles `Enter`/`Esc`), not the body.
 *
 * @example
 * ```ts
 * import type { GridAction } from '@jsvision/datagrid';
 * const action: GridAction = 'beginEdit';
 * ```
 */
export type GridAction =
  // navigation (the row-engine-owned keys are included so the whole nav table is remappable)
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd'
  | 'pageUp'
  | 'pageDown'
  | 'nextCell' // command-triggered (Tab); never bound as a body key
  | 'prevCell'
  // editing
  | 'beginEdit'
  | 'commit' // editor-host-scoped (documented here, not body-resolved)
  | 'cancel'
  // selection
  | 'toggleSelect'
  | 'extendUp'
  | 'extendDown'
  // value help + filter
  | 'valueHelp'
  | 'openFilter';

/**
 * A chord→action map. Chord grammar is the core keymap grammar (`'ctrl+alt+shift+key'`).
 *
 * Named `GridKeymap` (not `Keymap`) to avoid colliding with the compiled {@link Keymap} lookup type
 * exported by `@jsvision/core`/`@jsvision/ui`: this is the raw, user-authorable table, not a compiled
 * lookup.
 *
 * @example
 * ```ts
 * import type { GridKeymap } from '@jsvision/datagrid';
 * const remap: GridKeymap = { 'ctrl+e': 'beginEdit' };
 * ```
 */
export type GridKeymap = Record<string, GridAction>;

/** The structural key-event subset {@link resolveGridAction} reads (a subset of the core `KeyEvent`). */
export interface KeymapKeyEvent {
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/** Every valid {@link GridAction} literal, for config-time validation of a caller's map. */
const GRID_ACTIONS: ReadonlySet<GridAction> = new Set<GridAction>([
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'rowStart',
  'rowEnd',
  'gridStart',
  'gridEnd',
  'pageUp',
  'pageDown',
  'nextCell',
  'prevCell',
  'beginEdit',
  'commit',
  'cancel',
  'toggleSelect',
  'extendUp',
  'extendDown',
  'valueHelp',
  'openFilter',
]);

/**
 * The one documented default binding table. Frozen so a caller cannot mutate the shared default; a
 * per-grid override is layered on top with {@link mergeKeymap}, which never touches this object.
 *
 * | Chord | Action | | Chord | Action |
 * |-------|--------|-|-------|--------|
 * | `left`/`right` | `moveLeft`/`moveRight` | | `f2`/`enter` | `beginEdit` |
 * | `up`/`down` | `moveUp`/`moveDown` | | `f4` | `valueHelp` |
 * | `home`/`end` | `rowStart`/`rowEnd` | | `space` | `toggleSelect` |
 * | `ctrl+home`/`ctrl+end` | `gridStart`/`gridEnd` | | `shift+up`/`shift+down` | `extendUp`/`extendDown` |
 * | `pageup`/`pagedown` | `pageUp`/`pageDown` | | `alt+down` | `openFilter` |
 */
export const DEFAULT_KEYMAP: GridKeymap = {
  left: 'moveLeft',
  right: 'moveRight',
  up: 'moveUp',
  down: 'moveDown',
  home: 'rowStart',
  end: 'rowEnd',
  'ctrl+home': 'gridStart',
  'ctrl+end': 'gridEnd',
  pageup: 'pageUp',
  pagedown: 'pageDown',
  f2: 'beginEdit',
  enter: 'beginEdit',
  f4: 'valueHelp',
  space: 'toggleSelect',
  'shift+up': 'extendUp',
  'shift+down': 'extendDown',
  'alt+down': 'openFilter',
};
Object.freeze(DEFAULT_KEYMAP);

/**
 * Compiled-lookup cache, keyed by the (frozen) merged-map identity. `mergeKeymap` and `DEFAULT_KEYMAP`
 * both hand out stable, frozen objects, so compiling each into a core keymap exactly once — rather
 * than rebuilding the table on every keystroke — is a pure win with no cache-invalidation concern.
 */
const compiledCache = new WeakMap<GridKeymap, Keymap>();

/** Compile (once, memoized) a merged grid keymap into a core keymap lookup. */
function compiled(keymap: GridKeymap): Keymap {
  let lookup = compiledCache.get(keymap);
  if (lookup === undefined) {
    // Every surviving entry parsed cleanly through mergeKeymap, so this never throws.
    lookup = createKeymap(keymap);
    compiledCache.set(keymap, lookup);
  }
  return lookup;
}

/**
 * Resolve one key event to a {@link GridAction} against a merged keymap, or `undefined` when the chord
 * is unmapped (the body dispatch then applies its printable/base fallbacks). Never throws.
 *
 * Pass a keymap produced by {@link mergeKeymap} (or {@link DEFAULT_KEYMAP} directly) — a map whose
 * chords are all valid. The merged table is compiled once and reused, so this is cheap per keystroke.
 *
 * @param ev The key event (a structural subset of the core `KeyEvent`).
 * @param keymap A merged chord→action map (from {@link mergeKeymap} or {@link DEFAULT_KEYMAP}).
 * @returns The bound `GridAction`, or `undefined` when the chord is unmapped.
 * @example
 * ```ts
 * import { DEFAULT_KEYMAP, resolveGridAction } from '@jsvision/datagrid';
 * resolveGridAction({ key: 'f2', ctrl: false, alt: false, shift: false }, DEFAULT_KEYMAP); // 'beginEdit'
 * resolveGridAction({ key: 'j', ctrl: true, alt: false, shift: false }, DEFAULT_KEYMAP); // undefined
 * ```
 */
export function resolveGridAction(ev: KeymapKeyEvent, keymap: GridKeymap): GridAction | undefined {
  // The core lookup reads only key/ctrl/alt/shift; wrap the structural event as a full KeyEvent.
  const name = compiled(keymap).lookup({
    type: 'key',
    key: ev.key,
    ctrl: ev.ctrl,
    alt: ev.alt,
    shift: ev.shift,
  });
  // Every value in the compiled table came from a GridKeymap, so a hit is always a GridAction.
  return name as GridAction | undefined;
}

/** Whether a chord parses cleanly under the core grammar (compile it in isolation and catch the throw). */
function chordParses(chord: string): boolean {
  try {
    createKeymap({ [chord]: 'x' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge a caller's keymap over {@link DEFAULT_KEYMAP} (the caller wins per-chord) and return a fresh,
 * frozen table safe to compile and share.
 *
 * Each caller entry is validated on both axes and dropped — warned via the dev sink, never thrown — on
 * either failure: an unknown `GridAction` value, or a chord that is malformed under the core grammar
 * (an unknown modifier or key, which `createKeymap` would otherwise throw on). A valid but unbound
 * chord is simply absent from the map and resolves to `undefined` at runtime. So one typo can never
 * break grid construction, and every surviving chord parses cleanly.
 *
 * @param user The caller's chord→action overrides (optional).
 * @returns A fresh frozen map: the default table with the caller's valid overrides applied.
 * @example
 * ```ts
 * import { mergeKeymap, resolveGridAction } from '@jsvision/datagrid';
 * const km = mergeKeymap({ 'ctrl+e': 'beginEdit' });   // Ctrl+E now edits; F2 still does
 * resolveGridAction({ key: 'e', ctrl: true, alt: false, shift: false }, km); // 'beginEdit'
 * ```
 */
export function mergeKeymap(user?: GridKeymap): GridKeymap {
  const merged: GridKeymap = { ...DEFAULT_KEYMAP };
  if (user !== undefined) {
    for (const [chord, action] of Object.entries(user)) {
      if (!GRID_ACTIONS.has(action)) {
        devWarn('keymap', `ignoring '${chord}': unknown action '${action}'`);
        continue;
      }
      if (!chordParses(chord)) {
        devWarn('keymap', `ignoring binding for '${chord}': malformed chord`);
        continue;
      }
      merged[chord] = action;
    }
  }
  Object.freeze(merged);
  return merged;
}
