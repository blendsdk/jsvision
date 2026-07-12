/**
 * The framework's default clipboard keymap and the {@link buildKeymap} builder that composes it with
 * an application's own keymap.
 *
 * An event loop with no keymap binds no chords, so clipboard keys do nothing framework-wide. This
 * module supplies the default bindings — Ctrl+A/C/X/V and the classic Turbo Vision chords — as a
 * ready-made {@link Keymap}, and merges an app's keymap on top so the app always wins on a conflict.
 */
import { createKeymap } from '@jsvision/core';
import type { Keymap } from '@jsvision/core';
import { Commands } from '../status/index.js';

/**
 * Which clipboard key set the framework binds by default.
 *
 * - `'modern'` — Ctrl+A (select-all), Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste).
 * - `'classic'` — the Turbo Vision chords Ctrl+Insert (copy), Shift+Insert (paste), Shift+Delete
 *   (cut). There is no classic select-all chord.
 * - `'both'` — the modern chords plus the classic chords as aliases (the default).
 * - `'none'` — no clipboard chords at all; supply your own keymap to bind them.
 */
export type ClipboardKeys = 'modern' | 'classic' | 'both' | 'none';

/** The modern chords: Ctrl+A/C/X/V → select-all / copy / cut / paste. */
const MODERN_BINDINGS: Readonly<Record<string, string>> = {
  'ctrl+a': Commands.selectAll,
  'ctrl+c': Commands.copy,
  'ctrl+x': Commands.cut,
  'ctrl+v': Commands.paste,
};

/** The classic Turbo Vision chords: Ctrl+Insert (copy) / Shift+Insert (paste) / Shift+Delete (cut). */
const CLASSIC_BINDINGS: Readonly<Record<string, string>> = {
  'ctrl+insert': Commands.copy,
  'shift+insert': Commands.paste,
  'shift+delete': Commands.cut,
};

/** The default clipboard chord→command bindings for a mode; an empty record for `'none'`. */
function clipboardBindings(mode: ClipboardKeys): Record<string, string> {
  switch (mode) {
    case 'modern':
      return { ...MODERN_BINDINGS };
    case 'classic':
      return { ...CLASSIC_BINDINGS };
    case 'both':
      return { ...MODERN_BINDINGS, ...CLASSIC_BINDINGS };
    case 'none':
      return {};
  }
}

/**
 * Build the loop's keymap: the framework's default clipboard bindings for `clipboardKeys`, with the
 * caller's own `keymap` merged on top (the caller's bindings win on any conflicting chord).
 *
 * The merge composes at lookup time rather than merging records: a compiled {@link Keymap} exposes
 * only `lookup`, so the caller's chord table cannot be re-read — instead the returned keymap tries the
 * caller's `lookup` first and falls back to the defaults. When `clipboardKeys` is `'none'` there is no
 * default layer, so the caller's keymap is returned as-is (or `undefined` when there is none).
 *
 * @param clipboardKeys Which clipboard key set to bind by default. Defaults to `'both'`.
 * @param userKeymap    An optional app keymap whose bindings override the defaults.
 * @returns A compiled keymap, or `undefined` when there is nothing to bind (`'none'` and no user keymap).
 * @example
 * import { createKeymap } from '@jsvision/core';
 * import { buildKeymap } from '@jsvision/ui';
 *
 * const keymap = buildKeymap('modern', createKeymap({ 'ctrl+s': 'save' }));
 * keymap?.lookup({ type: 'key', key: 'c', ctrl: true, alt: false, shift: false }); // 'copy' (default)
 * keymap?.lookup({ type: 'key', key: 's', ctrl: true, alt: false, shift: false }); // 'save' (user)
 */
export function buildKeymap(clipboardKeys: ClipboardKeys = 'both', userKeymap?: Keymap): Keymap | undefined {
  const bindings = clipboardBindings(clipboardKeys);
  // No default layer to compose (`'none'`): the caller's keymap is the whole map — `undefined` when
  // the caller supplied none, so the loop's `keymap !== undefined` guard globalizes nothing.
  if (Object.keys(bindings).length === 0) return userKeymap;

  const defaults = createKeymap(bindings);
  if (userKeymap === undefined) return defaults;
  return { lookup: (event) => userKeymap.lookup(event) ?? defaults.lookup(event) };
}
