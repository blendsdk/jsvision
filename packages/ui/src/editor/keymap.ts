/**
 * The classic WordStar-style editor keymap — pure data plus a resolver.
 *
 * Three tables drive it: a set of direct key bindings, the Ctrl-Q "quick" prefix table, and the
 * Ctrl-K "block" prefix table. Ctrl-Q and Ctrl-K arm a prefix state (see {@link KeyState}); the
 * next key is looked up in the matching table, case-insensitively, and may keep Ctrl held (as in
 * WordStar's Ctrl-Q Ctrl-F). An unrecognized follow-up simply clears the prefix — consumed, no
 * edit. Within a table, the first matching entry wins.
 *
 * Behaviors a caller should know:
 *   • Ctrl-Del maps to "delete word"; the "clear selection" action is reachable by command/menu.
 *   • Ctrl-P is intentionally unbound (it drove a DOS single-byte input mode with no modern
 *     analogue) and falls through unconsumed.
 *   • Backspace and Enter are matched by their named keys, so Ctrl-H / Ctrl-M work as expected.
 *   • Arrows, Home/End, and PgUp/PgDn ignore Shift in the lookup — selection extension comes from
 *     the Shift state the editor reads alongside the resolved motion, not from a different binding.
 *     Shift+Insert, Shift+Delete, and Ctrl+Insert are distinct bindings and match modifiers exactly.
 *
 * Resolved actions are internal {@link EditorAction} ids, not app-level command names; run one with
 * `Editor.execute(action)`.
 */

/** An internal editor action id — a camelCase name for one editor operation. */
export type EditorAction =
  | 'charLeft'
  | 'charRight'
  | 'wordLeft'
  | 'wordRight'
  | 'lineStart'
  | 'lineEnd'
  | 'lineUp'
  | 'lineDown'
  | 'pageUp'
  | 'pageDown'
  | 'textStart'
  | 'textEnd'
  | 'newLine'
  | 'backSpace'
  | 'delChar'
  | 'delWord'
  | 'delWordLeft'
  | 'delStart'
  | 'delEnd'
  | 'delLine'
  | 'toggleInsert'
  | 'toggleIndent'
  | 'startSelect'
  | 'hideSelect'
  | 'selectAll'
  | 'clear' // delete the selection; reached by menu/command, no direct key
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'replace'
  | 'searchAgain'
  | 'undo'
  | 'redo'; // reached by menu/command; no WordStar key

/** The prefix state: idle, or armed after a Ctrl-Q / Ctrl-K prefix awaiting its follow-up key. */
export type KeyState = 0 | 'ctrlQ' | 'ctrlK';

/**
 * Which editor key set is active. `'modern'` (the default) overlays the universal Ctrl+X/C/V/A
 * (cut/copy/paste/selectAll) + Ctrl+Z/Y (undo/redo) keys on top of the WordStar table; `'wordstar'`
 * keeps the classic WordStar layout verbatim (Ctrl-C = pageDown, Ctrl-V = insert-mode toggle,
 * Ctrl-X = lineDown, Ctrl-Y = delete line, Ctrl-U = undo). Modern is the default because few users
 * still reach for the WordStar diamond; the full WordStar table stays available via `'wordstar'`.
 */
export type EditorKeyBindings = 'modern' | 'wordstar';

/** The resolver's verdict for one key event. */
export interface KeyResolution {
  /** The action to execute, when the key (or prefix follow-up) mapped to one. */
  action?: EditorAction;
  /** The prefix state to carry to the next key. */
  nextState: KeyState;
  /** Whether the editor consumes the event (an unmapped idle key falls through to typing). */
  consumed: boolean;
}

/** The key-event shape the resolver reads (a structural subset of the core decoder's KeyEvent). */
export interface KeymapKeyEvent {
  readonly key: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

/** One `firstKeys` row: the key + exact ctrl/alt match, shift matched only when specified. */
interface FirstKeyEntry {
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  /** `undefined` → Shift is ignored for this entry (selection extension comes from Shift state); else Shift must match exactly. */
  readonly shift?: boolean;
  /** The action, or the prefix the entry escapes into. */
  readonly to: EditorAction | 'ctrlQ' | 'ctrlK';
}

/**
 * The direct (unprefixed) key bindings, in priority order — the first matching entry wins. This is
 * the classic WordStar control-key set plus the usual arrows/Home/End/PgUp/PgDn and
 * Insert/Delete editing keys. Ctrl-P is deliberately left unbound.
 */
const FIRST_KEYS: readonly FirstKeyEntry[] = [
  { key: 'a', ctrl: true, alt: false, to: 'selectAll' },
  { key: 'c', ctrl: true, alt: false, to: 'pageDown' },
  { key: 'd', ctrl: true, alt: false, to: 'charRight' },
  { key: 'e', ctrl: true, alt: false, to: 'lineUp' },
  { key: 'f', ctrl: true, alt: false, to: 'wordRight' },
  { key: 'g', ctrl: true, alt: false, to: 'delChar' },
  { key: 'h', ctrl: true, alt: false, to: 'backSpace' }, // the Backspace byte
  { key: 'k', ctrl: true, alt: false, to: 'ctrlK' }, // arm the Ctrl-K block prefix
  { key: 'l', ctrl: true, alt: false, to: 'searchAgain' },
  { key: 'm', ctrl: true, alt: false, to: 'newLine' }, // the Enter/CR byte
  { key: 'o', ctrl: true, alt: false, to: 'toggleIndent' },
  { key: 'q', ctrl: true, alt: false, to: 'ctrlQ' }, // arm the Ctrl-Q quick prefix
  { key: 'r', ctrl: true, alt: false, to: 'pageUp' },
  { key: 's', ctrl: true, alt: false, to: 'charLeft' },
  { key: 't', ctrl: true, alt: false, to: 'delWord' },
  { key: 'u', ctrl: true, alt: false, to: 'undo' },
  { key: 'v', ctrl: true, alt: false, to: 'toggleInsert' },
  { key: 'x', ctrl: true, alt: false, to: 'lineDown' },
  { key: 'y', ctrl: true, alt: false, to: 'delLine' },
  { key: 'left', ctrl: false, alt: false, to: 'charLeft' },
  { key: 'right', ctrl: false, alt: false, to: 'charRight' },
  { key: 'backspace', ctrl: false, alt: true, to: 'delWordLeft' },
  { key: 'backspace', ctrl: true, alt: false, to: 'delWordLeft' },
  { key: 'delete', ctrl: true, alt: false, shift: false, to: 'delWord' }, // Ctrl-Del deletes a word
  { key: 'left', ctrl: true, alt: false, to: 'wordLeft' },
  { key: 'right', ctrl: true, alt: false, to: 'wordRight' },
  { key: 'home', ctrl: false, alt: false, to: 'lineStart' },
  { key: 'end', ctrl: false, alt: false, to: 'lineEnd' },
  { key: 'up', ctrl: false, alt: false, to: 'lineUp' },
  { key: 'down', ctrl: false, alt: false, to: 'lineDown' },
  { key: 'pageup', ctrl: false, alt: false, to: 'pageUp' },
  { key: 'pagedown', ctrl: false, alt: false, to: 'pageDown' },
  { key: 'home', ctrl: true, alt: false, to: 'textStart' },
  { key: 'end', ctrl: true, alt: false, to: 'textEnd' },
  { key: 'insert', ctrl: false, alt: false, shift: false, to: 'toggleInsert' },
  { key: 'delete', ctrl: false, alt: false, shift: false, to: 'delChar' },
  { key: 'insert', ctrl: false, alt: false, shift: true, to: 'paste' }, // Shift+Insert = paste
  { key: 'delete', ctrl: false, alt: false, shift: true, to: 'cut' }, // Shift+Delete = cut
  { key: 'insert', ctrl: true, alt: false, shift: false, to: 'copy' }, // Ctrl+Insert = copy
  { key: 'enter', ctrl: false, alt: false, to: 'newLine' },
  { key: 'backspace', ctrl: false, alt: false, to: 'backSpace' },
];

/** The Ctrl-Q "quick" prefix table, keyed by the follow-up letter (case-normalized to uppercase). */
const QUICK_KEYS: Readonly<Record<string, EditorAction>> = {
  A: 'replace',
  C: 'textEnd',
  D: 'lineEnd',
  F: 'find',
  H: 'delStart',
  R: 'textStart',
  S: 'lineStart',
  Y: 'delEnd',
};

/** The Ctrl-K "block" prefix table, keyed by the follow-up letter (case-normalized to uppercase). */
const BLOCK_KEYS: Readonly<Record<string, EditorAction>> = {
  B: 'startSelect',
  C: 'paste',
  H: 'hideSelect',
  K: 'copy',
  Y: 'cut',
};

/**
 * The modern key overrides applied on top of the WordStar table in the default binding set —
 * universal Ctrl+X/C/V/A (cut/copy/paste/selectAll) + Ctrl+Z/Y (undo/redo). Each shadows a WordStar
 * meaning that survives elsewhere: Ctrl-C's page-down is still on PgDn, Ctrl-V's insert-mode toggle
 * on Insert, Ctrl-X's line-down on the arrow. Ctrl-A was already select-all and Ctrl-U is still undo.
 */
const MODERN_KEYS: Readonly<Record<string, EditorAction>> = {
  x: 'cut',
  c: 'copy',
  v: 'paste',
  a: 'selectAll',
  z: 'undo',
  y: 'redo',
};

/**
 * Resolve the modern Ctrl+X/C/V/A + Ctrl+Z/Y overlay for one key event — the default binding set's
 * addition over the WordStar table. Matches Ctrl+letter with **Alt up** and **Shift ignored**: a
 * terminal that surfaces `Ctrl+Shift+C` distinctly (kitty / modifyOtherKeys) still copies; one that
 * grabs it for its own copy simply never delivers it, so the alias is harmless. Callers consult this
 * ONLY when idle (no WordStar prefix armed), leaving Ctrl-K / Ctrl-Q sequences untouched.
 *
 * @param ev The key event (core decoder shape).
 * @returns The overriding action, or `undefined` to fall through to the WordStar table.
 */
export function resolveModernKey(ev: KeymapKeyEvent): EditorAction | undefined {
  if (!ev.ctrl || ev.alt || ev.key.length !== 1) return undefined;
  return MODERN_KEYS[ev.key.toLowerCase()];
}

/** Whether a `firstKeys` entry matches the event (case-insensitive letters; Shift per the entry). */
function matches(e: FirstKeyEntry, ev: KeymapKeyEvent): boolean {
  const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (key !== e.key) return false;
  if (ev.ctrl !== e.ctrl || ev.alt !== e.alt) return false;
  return e.shift === undefined || ev.shift === e.shift;
}

/**
 * Resolve one key event against the current prefix state — walk the direct table (first match
 * wins), arm a Ctrl-Q / Ctrl-K prefix, or look up a prefix follow-up.
 *
 * @param state The prefix state carried from the previous key.
 * @param ev The key event (core decoder shape).
 * @returns The action (if any), the next prefix state, and whether the event was consumed.
 */
export function resolveKey(state: KeyState, ev: KeymapKeyEvent): KeyResolution {
  if (state !== 0) {
    // Inside a prefix: look up the follow-up letter case-insensitively; Ctrl may stay held
    // (as in WordStar's Ctrl-Q Ctrl-F).
    const table = state === 'ctrlQ' ? QUICK_KEYS : BLOCK_KEYS;
    const letter = ev.key.length === 1 ? ev.key.toUpperCase() : '';
    const action = table[letter];
    if (action !== undefined) return { action, nextState: 0, consumed: true };
    return { nextState: 0, consumed: true }; // an unknown follow-up just clears the prefix, no edit
  }
  for (const e of FIRST_KEYS) {
    if (!matches(e, ev)) continue;
    if (e.to === 'ctrlQ' || e.to === 'ctrlK') return { nextState: e.to, consumed: true };
    return { action: e.to, nextState: 0, consumed: true };
  }
  return { nextState: 0, consumed: false }; // unmapped idle key → typing falls through
}
