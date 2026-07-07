/**
 * The faithful 3-table WordStar keymap — pure data + resolver (RD-08 03-02, PA-15).
 *
 * Decode (`teditor1.cpp:44-111`, re-verified 2026-07-07 @ 57b6f56): `firstKeys` (41 entries),
 * `quickKeys` (the Ctrl-Q table, 8 entries), `blockKeys` (the Ctrl-K table, 5 entries), resolved
 * by `scanKeyMap` (`teditor1.cpp:117-167`) — FIRST MATCH WINS. TV's prefix escapes
 * `kbCtrlQ → 0xFF01` / `kbCtrlK → 0xFF02` (`:59,:54`) become the tiny {@link KeyState} machine;
 * the follow-up key is case-normalized (TV `:344-350`) and may keep Ctrl held (WordStar Ctrl-Q
 * Ctrl-F); an unknown follow-up clears the prefix, consumed, with no edit.
 *
 * Decode nuances recorded per PF-005 + the RD:
 *   • `firstKeys` lists `kbCtrlDel` TWICE — `cmDelWord` (entry 25, `teditor1.cpp:71`) and a DEAD
 *     trailing `cmClear` (entry 41, `:87`; first match wins) — so Ctrl-Del resolves to `delWord`
 *     and menus reach `clear` by command.
 *   • `kbCtrlP → cmEncoding` (`:57`) is the RD-sanctioned OMISSION (single-byte mode is a DOS-ism
 *     our UTF-16 buffer has no analogue for); Ctrl-P falls through unconsumed.
 *   • `kbCtrlH` (`:52`) IS the Backspace byte — the decoder emits it as `'backspace'`, covered by
 *     the `kbBack`-shaped entry; a distinctly-reported Ctrl+H (kitty protocol) matches too.
 *   • `kbCtrlM → cmNewLine` (`:55`) is Enter (CR) — covered by `'enter'`.
 *   • Arrows/Home/End/PgUp/PgDn ignore Shift in the MATCH: TV's selection extension comes from the
 *     Shift STATE (`smExtend`, `teditor1.cpp` handleEvent), not a different key code — the editor
 *     reads `ev.shift` alongside the resolved motion. `kbShiftIns`/`kbShiftDel`/`kbCtrlIns` are
 *     DISTINCT TV codes, so Insert/Delete entries match modifiers exactly.
 *
 * Actions are internal `EditorAction` ids mirroring TV's `cm` names (`editors.h:52-84`) — NOT
 * RD-04 registry commands (the PA-15 split surface); `Editor.execute(action)` runs them.
 */

/** An internal editor action id — TV's `cmXXX` editor constants as camelCase strings (PA-15). */
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
  | 'clear' // PF-005 — deleteSelect semantics (cmClear, teditor2.cpp:633); menu-reached, no live chord
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'replace'
  | 'searchAgain'
  | 'undo'
  | 'redo'; // RD-08 extension — command-only (PA-1); no keymap entry by design

/** The prefix state: idle, or holding TV's `0xFF01`/`0xFF02` escape after Ctrl-Q / Ctrl-K. */
export type KeyState = 0 | 'ctrlQ' | 'ctrlK';

/**
 * Which editor key set is active. `'modern'` (the default) overlays the universal Ctrl+X/C/V/A
 * (cut/copy/paste/selectAll) + Ctrl+Z/Y (undo/redo) keys on top of the WordStar table; `'wordstar'`
 * keeps the faithful Turbo Vision decode verbatim (Ctrl-C = pageDown, Ctrl-V = insert-mode,
 * Ctrl-X = lineDown, Ctrl-Y = delLine, Ctrl-U = undo). A deliberate, user-sanctioned break from TV
 * fidelity (30 years on, no one reaches for the WordStar diamond) — the faithful table is preserved
 * and still fully reachable, just no longer the default.
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
  /** `undefined` → shift ignored (TV arrows carry Shift as STATE); else must match exactly. */
  readonly shift?: boolean;
  /** The action, or the prefix the entry escapes into. */
  readonly to: EditorAction | 'ctrlQ' | 'ctrlK';
}

/**
 * `firstKeys` transcribed 1:1 in TV order (`teditor1.cpp:46-87`); first match wins. Per-entry
 * cites are the table rows top-to-bottom; Ctrl-P (`cmEncoding`) is the sanctioned omission.
 */
const FIRST_KEYS: readonly FirstKeyEntry[] = [
  { key: 'a', ctrl: true, alt: false, to: 'selectAll' }, // kbCtrlA cmSelectAll :47
  { key: 'c', ctrl: true, alt: false, to: 'pageDown' }, // kbCtrlC cmPageDown :48
  { key: 'd', ctrl: true, alt: false, to: 'charRight' }, // kbCtrlD cmCharRight :49
  { key: 'e', ctrl: true, alt: false, to: 'lineUp' }, // kbCtrlE cmLineUp :50
  { key: 'f', ctrl: true, alt: false, to: 'wordRight' }, // kbCtrlF cmWordRight :51
  { key: 'g', ctrl: true, alt: false, to: 'delChar' }, // kbCtrlG cmDelChar :52
  { key: 'h', ctrl: true, alt: false, to: 'backSpace' }, // kbCtrlH cmBackSpace :53 (BS byte)
  { key: 'k', ctrl: true, alt: false, to: 'ctrlK' }, // kbCtrlK 0xFF02 :54
  { key: 'l', ctrl: true, alt: false, to: 'searchAgain' }, // kbCtrlL cmSearchAgain :55
  { key: 'm', ctrl: true, alt: false, to: 'newLine' }, // kbCtrlM cmNewLine :56 (CR)
  { key: 'o', ctrl: true, alt: false, to: 'toggleIndent' }, // kbCtrlO cmIndentMode :57
  // kbCtrlP cmEncoding :58 — RD-sanctioned omission (falls through unconsumed).
  { key: 'q', ctrl: true, alt: false, to: 'ctrlQ' }, // kbCtrlQ 0xFF01 :59
  { key: 'r', ctrl: true, alt: false, to: 'pageUp' }, // kbCtrlR cmPageUp :60
  { key: 's', ctrl: true, alt: false, to: 'charLeft' }, // kbCtrlS cmCharLeft :61
  { key: 't', ctrl: true, alt: false, to: 'delWord' }, // kbCtrlT cmDelWord :62
  { key: 'u', ctrl: true, alt: false, to: 'undo' }, // kbCtrlU cmUndo :63
  { key: 'v', ctrl: true, alt: false, to: 'toggleInsert' }, // kbCtrlV cmInsMode :64
  { key: 'x', ctrl: true, alt: false, to: 'lineDown' }, // kbCtrlX cmLineDown :65
  { key: 'y', ctrl: true, alt: false, to: 'delLine' }, // kbCtrlY cmDelLine :66
  { key: 'left', ctrl: false, alt: false, to: 'charLeft' }, // kbLeft :67
  { key: 'right', ctrl: false, alt: false, to: 'charRight' }, // kbRight :68
  { key: 'backspace', ctrl: false, alt: true, to: 'delWordLeft' }, // kbAltBack :69
  { key: 'backspace', ctrl: true, alt: false, to: 'delWordLeft' }, // kbCtrlBack :70
  { key: 'delete', ctrl: true, alt: false, shift: false, to: 'delWord' }, // kbCtrlDel cmDelWord :71 (entry 25 — wins)
  { key: 'left', ctrl: true, alt: false, to: 'wordLeft' }, // kbCtrlLeft :72
  { key: 'right', ctrl: true, alt: false, to: 'wordRight' }, // kbCtrlRight :73
  { key: 'home', ctrl: false, alt: false, to: 'lineStart' }, // kbHome :74
  { key: 'end', ctrl: false, alt: false, to: 'lineEnd' }, // kbEnd :75
  { key: 'up', ctrl: false, alt: false, to: 'lineUp' }, // kbUp :76
  { key: 'down', ctrl: false, alt: false, to: 'lineDown' }, // kbDown :77
  { key: 'pageup', ctrl: false, alt: false, to: 'pageUp' }, // kbPgUp :78
  { key: 'pagedown', ctrl: false, alt: false, to: 'pageDown' }, // kbPgDn :79
  { key: 'home', ctrl: true, alt: false, to: 'textStart' }, // kbCtrlHome :80
  { key: 'end', ctrl: true, alt: false, to: 'textEnd' }, // kbCtrlEnd :81
  { key: 'insert', ctrl: false, alt: false, shift: false, to: 'toggleInsert' }, // kbIns :82
  { key: 'delete', ctrl: false, alt: false, shift: false, to: 'delChar' }, // kbDel :83
  { key: 'insert', ctrl: false, alt: false, shift: true, to: 'paste' }, // kbShiftIns :84
  { key: 'delete', ctrl: false, alt: false, shift: true, to: 'cut' }, // kbShiftDel :85
  { key: 'insert', ctrl: true, alt: false, shift: false, to: 'copy' }, // kbCtrlIns :86
  // kbCtrlDel cmClear :87 (entry 41) — DEAD: first match wins in scanKeyMap (PF-005).
  { key: 'enter', ctrl: false, alt: false, to: 'newLine' }, // kbCtrlM as the decoder's 'enter'
  { key: 'backspace', ctrl: false, alt: false, to: 'backSpace' }, // kbCtrlH as the decoder's 'backspace'
];

/** `quickKeys` — the Ctrl-Q table (`teditor1.cpp:90-99`), keyed by the normalized letter. */
const QUICK_KEYS: Readonly<Record<string, EditorAction>> = {
  A: 'replace', // :91
  C: 'textEnd', // :92
  D: 'lineEnd', // :93
  F: 'find', // :94
  H: 'delStart', // :95
  R: 'textStart', // :96
  S: 'lineStart', // :97
  Y: 'delEnd', // :98
};

/** `blockKeys` — the Ctrl-K table (`teditor1.cpp:102-108`), keyed by the normalized letter. */
const BLOCK_KEYS: Readonly<Record<string, EditorAction>> = {
  B: 'startSelect', // :103
  C: 'paste', // :104
  H: 'hideSelect', // :105
  K: 'copy', // :106
  Y: 'cut', // :107
};

/**
 * The modern key overrides (the default {@link EditorKeyBindings}) — universal Ctrl+X/C/V/A
 * (cut/copy/paste/selectAll) + Ctrl+Z/Y (undo/redo). NOT a TV decode: an intentional modernization.
 * Each shadows a WordStar meaning whose function survives elsewhere (Ctrl-C→PgDn, Ctrl-V→Insert,
 * Ctrl-X→↓, Ctrl-Y→delLine is dropped in modern mode; Ctrl-A already selectAll, Ctrl-U still undo).
 * Ctrl-Z had no WordStar binding at all.
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
 * @returns The overriding action, or `undefined` to fall through to the faithful WordStar table.
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
 * Resolve one key event against the current prefix state — the `scanKeyMap` walk
 * (`teditor1.cpp:117-167`, first match wins) plus TV's prefix-escape handling.
 *
 * @param state The prefix state carried from the previous key.
 * @param ev The key event (core decoder shape).
 * @returns The action (if any), the next prefix state, and whether the event was consumed.
 */
export function resolveKey(state: KeyState, ev: KeymapKeyEvent): KeyResolution {
  if (state !== 0) {
    // Inside a prefix: case-normalize (TV :344-350); Ctrl may stay held (WordStar Ctrl-Q Ctrl-F).
    const table = state === 'ctrlQ' ? QUICK_KEYS : BLOCK_KEYS;
    const letter = ev.key.length === 1 ? ev.key.toUpperCase() : '';
    const action = table[letter];
    if (action !== undefined) return { action, nextState: 0, consumed: true };
    return { nextState: 0, consumed: true }; // unknown clears the prefix without editing (decode)
  }
  for (const e of FIRST_KEYS) {
    if (!matches(e, ev)) continue;
    if (e.to === 'ctrlQ' || e.to === 'ctrlK') return { nextState: e.to, consumed: true };
    return { action: e.to, nextState: 0, consumed: true };
  }
  return { nextState: 0, consumed: false }; // unmapped idle key → typing falls through
}
