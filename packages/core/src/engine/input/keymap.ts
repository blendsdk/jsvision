/**
 * A pluggable keymap — a pure, stateless lookup from a decoded key to a command
 * name of your choosing.
 *
 * `createKeymap({ 'ctrl+s': 'save', … })` compiles chord→name bindings once into
 * a canonical table. `lookup(event)` canonicalises a {@link KeyEvent} the same way
 * and returns the bound name (or `undefined`). The keymap never consumes or alters
 * the event stream — you call it on events you have already decoded.
 *
 * Chord grammar: `'+'`-joined and case-insensitive — zero or more modifiers
 * (`ctrl`, `alt`, `shift`, `meta`, `primary`) followed by exactly one key (a named key from
 * {@link KEY_NAMES} or a single character). A malformed binding (no key, unknown
 * modifier, or unknown key name) throws at build time so mistakes surface early.
 */
import type { KeyEvent } from './events.js';
import { KEY_NAMES } from './events.js';

/** A compiled keymap: a pure lookup from a decoded {@link KeyEvent} to a bound name. */
export interface Keymap {
  /** Return the bound name for the event's chord, or `undefined` if unbound. */
  lookup(event: KeyEvent): string | undefined;
}

/** Host-specific interpretation of the semantic `Primary` chord modifier. */
export interface KeymapOptions {
  /** Command/Meta on capable macOS browser hosts; Ctrl on native terminals and other hosts. */
  readonly primary?: 'ctrl' | 'meta';
}

/** The recognised modifier tokens in a chord binding. */
const MODIFIERS = new Set(['ctrl', 'alt', 'shift', 'meta', 'primary']);

/** The named keys allowed as a chord's key part. */
const NAMED_KEYS: ReadonlySet<string> = new Set(KEY_NAMES);

/**
 * Build a keymap from chord→name bindings.
 *
 * @param bindings A map of chord strings (e.g. `'ctrl+s'`) to command names (e.g. `'save'`).
 * @returns A compiled {@link Keymap} with a pure `lookup`.
 * @throws If any binding is malformed (no key, unknown modifier, or unknown key name).
 * @example
 * import { createKeymap, createDecoderState, decode } from '@jsvision/core';
 *
 * const keymap = createKeymap({ 'ctrl+s': 'save', 'escape': 'cancel' });
 *
 * // Ctrl+S arrives as the control byte 0x13.
 * const { events } = decode(Uint8Array.from([0x13]), createDecoderState());
 * for (const ev of events) {
 *   if (ev.type === 'key') {
 *     const command = keymap.lookup(ev); // 'save'
 *     if (command) console.log('run command:', command);
 *   }
 * }
 */
export function createKeymap(bindings: Readonly<Record<string, string>>, options: KeymapOptions = {}): Keymap {
  const primary = options.primary ?? 'ctrl';
  const table = new Map<string, string>();
  for (const [chord, name] of Object.entries(bindings)) {
    table.set(parseChord(chord, primary), name);
  }
  return {
    lookup(event: KeyEvent): string | undefined {
      const meta = event.meta === true;
      const primaryHeld = primary === 'meta' ? meta : event.ctrl;
      if (event.primary === true && (!primaryHeld || (event.ctrl && meta))) return undefined;
      return table.get(canonicalize(event.ctrl, event.alt, event.shift, meta, event.key.toLowerCase()));
    },
  };
}

/** Parse and validate one chord binding into its canonical key. */
function parseChord(chord: string, primary: NonNullable<KeymapOptions['primary']>): string {
  const parts = chord.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (key === '') {
    throw new Error(`Invalid key binding '${chord}': missing a key`);
  }
  if (!isValidKey(key)) {
    throw new Error(`Invalid key binding '${chord}': unknown key '${key}'`);
  }

  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  for (const mod of mods) {
    if (!MODIFIERS.has(mod)) {
      throw new Error(`Invalid key binding '${chord}': unknown modifier '${mod}'`);
    }
    ctrl = ctrl || mod === 'ctrl';
    alt = alt || mod === 'alt';
    shift = shift || mod === 'shift';
    meta = meta || mod === 'meta';
    if (mod === 'primary') {
      ctrl = ctrl || primary === 'ctrl';
      meta = meta || primary === 'meta';
    }
  }
  return canonicalize(ctrl, alt, shift, meta, key);
}

/** A key is valid when it is a single character or a known named key. */
function isValidKey(key: string): boolean {
  return Array.from(key).length === 1 || NAMED_KEYS.has(key);
}

/** Canonical chord string with modifiers in a fixed order, so input order is irrelevant. */
function canonicalize(ctrl: boolean, alt: boolean, shift: boolean, meta: boolean, key: string): string {
  return `${ctrl ? 'ctrl+' : ''}${alt ? 'alt+' : ''}${shift ? 'shift+' : ''}${meta ? 'meta+' : ''}${key}`;
}
