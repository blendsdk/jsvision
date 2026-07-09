/**
 * `attachKeyReclaim` — stop the browser from stealing keys from a focused terminal.
 *
 * A browser reserves chords like F-keys, `Ctrl+W`, `Tab`, and `Alt+<letter>` for itself. This adds a
 * **capture-phase** `keydown` listener on the document that, **only while the terminal is focused**,
 * calls `preventDefault()` on those chords so they reach the TUI instead of the browser. The listener
 * is document-global (a minimal terminal handle is enough), and the focus check is injectable so it
 * works for a real DOM terminal and in headless tests alike.
 *
 * Some chords are reserved by the OS/browser even against `preventDefault()` — they are enumerated in
 * {@link UNRECLAIMABLE_CHORDS} so an app can document a remap.
 */
import type { TerminalLike } from './host.js';

/** The subset of a `KeyboardEvent` the matcher reads (a narrow local type — no DOM lib). */
interface ReclaimKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  preventDefault(): void;
}

/** The currently-focused element, as far as the focus heuristic needs it. */
interface FocusableElement {
  readonly className?: string;
}

/** The subset of `document` the reclaim listener uses (a narrow local type — no DOM lib). */
interface KeyEventTarget {
  addEventListener(type: string, handler: (event: ReclaimKeyEvent) => void, options?: { capture?: boolean }): void;
  removeEventListener(type: string, handler: (event: ReclaimKeyEvent) => void, options?: { capture?: boolean }): void;
  readonly activeElement?: FocusableElement | null;
}

/** Options for {@link attachKeyReclaim}. */
export interface KeyReclaimOptions {
  /** Extra chords to reclaim beyond the defaults (e.g. `'Ctrl+X'`), or `['*']` to reclaim every chord. */
  readonly also?: readonly string[];
  /**
   * Predicate for "is the terminal focused". Defaults to a DOM check for a focused xterm textarea; a
   * headless terminal has none, so headless runs and tests inject this predicate.
   */
  readonly isFocused?: () => boolean;
  /**
   * The event target to attach the capture-phase listener to. Defaults to the global `document`; a test
   * injects a hand-mocked target (the repo avoids a jsdom devDependency).
   */
  readonly target?: KeyEventTarget;
}

/** The function-key finals `F1`…`F12`. */
const FUNCTION_KEYS: ReadonlySet<string> = new Set(Array.from({ length: 12 }, (_v, i) => `F${i + 1}`));

/** The default chords reclaimed from the browser (Alt+<letter> is handled as a category). */
const DEFAULT_CHORDS: ReadonlySet<string> = new Set([
  ...FUNCTION_KEYS,
  'Ctrl+W',
  'Ctrl+N',
  'Ctrl+T',
  'Ctrl+S',
  'Ctrl+P',
  'Tab',
  'Shift+Tab',
  'Backspace',
]);

/**
 * Chords a browser (or the OS) will not release even with `preventDefault()` — a curated best-effort
 * list (some browsers reserve `Ctrl+W`/`Ctrl+N`/`Ctrl+T` and their `Shift` variants regardless). Not
 * probed at runtime; exported so an app can document a remap.
 */
export const UNRECLAIMABLE_CHORDS: readonly string[] = [
  'Ctrl+W',
  'Ctrl+N',
  'Ctrl+T',
  'Ctrl+Shift+N',
  'Ctrl+Shift+T',
  'Ctrl+Shift+W',
];

/** Canonicalize an event into a chord string (`'F1'`, `'Ctrl+W'`, `'Shift+Tab'`, `'Alt+A'`) or null. */
function chordOf(event: ReclaimKeyEvent): string | null {
  const { key, ctrlKey, altKey, shiftKey } = event;
  if (FUNCTION_KEYS.has(key)) return key;
  if (key === 'Tab') return shiftKey ? 'Shift+Tab' : 'Tab';
  if (key === 'Backspace') return 'Backspace';
  const letter = key.length === 1 ? key.toUpperCase() : null;
  if (ctrlKey && letter) return `Ctrl+${letter}`;
  if (altKey && letter) return `Alt+${letter}`;
  return null; // plain text or an unhandled key
}

/** Decide whether `event` should be reclaimed, given the caller's extra chords and wildcard flag. */
function shouldReclaim(event: ReclaimKeyEvent, extra: ReadonlySet<string>, wildcard: boolean): boolean {
  const chord = chordOf(event);
  if (chord === null) {
    // Wildcard mode reclaims any modified non-text chord (a plain letter is left as text).
    return wildcard && (event.ctrlKey || event.altKey || event.metaKey);
  }
  if (wildcard) return true;
  if (DEFAULT_CHORDS.has(chord)) return true;
  if (chord.startsWith('Alt+')) return true; // every Alt+<letter> is in the default set
  return extra.has(chord);
}

/** The global `document`, if present (undefined in a headless/no-DOM environment). */
function globalDocument(): KeyEventTarget | undefined {
  // `document?` is optional, so this annotation is a plain assignment (no cast) whether or not the DOM
  // global exists; in a browser it resolves to the real Document, which satisfies KeyEventTarget.
  const scope: { document?: KeyEventTarget } = globalThis;
  return scope.document;
}

/** Default focus check: the active element is an xterm helper textarea (class contains `xterm`). */
function isTerminalFocused(target: KeyEventTarget): boolean {
  const active = target.activeElement;
  return active != null && typeof active.className === 'string' && active.className.includes('xterm');
}

/**
 * Attach key-chord reclaim to a terminal.
 *
 * @param _term - the terminal the reclaim serves (the listener is document-global; a minimal handle is
 *   enough). Reserved to document intent and for forward compatibility.
 * @param options - extra chords, an `isFocused` predicate, and/or a custom event target.
 * @returns an unsubscribe function that removes the listener.
 *
 * @example
 * import { attachKeyReclaim } from '@jsvision/web';
 *
 * // Reclaim the defaults plus Ctrl+X while the terminal is focused.
 * const detach = attachKeyReclaim(term, { also: ['Ctrl+X'] });
 * // later: detach();
 */
export function attachKeyReclaim(_term: TerminalLike, options: KeyReclaimOptions = {}): () => void {
  const target = options.target ?? globalDocument();
  if (!target) return () => {}; // no DOM to attach to (headless) — nothing to reclaim

  const isFocused = options.isFocused ?? (() => isTerminalFocused(target));
  const also = options.also ?? [];
  const wildcard = also.includes('*');
  const extra = new Set(also.filter((chord) => chord !== '*'));

  const handler = (event: ReclaimKeyEvent): void => {
    if (isFocused() && shouldReclaim(event, extra, wildcard)) event.preventDefault();
  };

  target.addEventListener('keydown', handler, { capture: true });
  return () => target.removeEventListener('keydown', handler, { capture: true });
}
