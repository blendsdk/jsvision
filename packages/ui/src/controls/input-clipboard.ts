/**
 * Clipboard helpers for {@link Input}: classifying cut/copy/paste key chords and command names, and
 * inserting pasted text one code point at a time through the field's length cap and validator. Pure
 * functions over strings and events — no view or reactive dependency.
 */
import type { Validator } from './validators/index.js';
import { Commands } from '../status/index.js';

/** A clipboard action an `Input` performs. `paste` here is a no-op — the real paste arrives as a paste event. */
export type ClipboardAction = 'copy' | 'cut' | 'paste';

/** The new value + caret after inserting pasted text. */
export interface PasteResult {
  readonly value: string;
  readonly curPos: number;
}

/**
 * Map a command name (e.g. one raised by a menu or status item) to a clipboard action, or `null` if
 * it is not a clipboard command.
 *
 * @param command The command name.
 * @returns The clipboard action, or `null`.
 */
export function clipboardCommand(command: string): ClipboardAction | null {
  if (command === Commands.copy) return 'copy';
  if (command === Commands.cut) return 'cut';
  if (command === Commands.paste) return 'paste';
  return null;
}

/**
 * Insert one code point at `pos`, apply the validator's optional auto-fill, validate, and clamp to
 * the length cap. The character is inserted; the validator's `fill` may append trailing formatting
 * (e.g. a `-` after a completed group in a picture mask); the filled candidate is then checked
 * against `isValidInput` and truncated to `maxLength` if needed. A validator without `fill` (filter,
 * range, lookup) leaves the candidate unchanged.
 *
 * @param ch        The single character (or space) to insert.
 * @param value     The current value.
 * @param pos       The caret index to insert at.
 * @param maxLength The stored-length cap.
 * @param validator Optional live validator.
 * @returns The new `{ value, curPos }` (the caret sits past the typed character, not past any
 *   auto-filled trailing literals), or `null` when the keystroke is rejected.
 */
export function insertFilled(
  ch: string,
  value: string,
  pos: number,
  maxLength: number,
  validator?: Validator,
): PasteResult | null {
  const candidate = value.slice(0, pos) + ch + value.slice(pos);
  let filled = validator?.fill?.(candidate) ?? candidate;
  if (validator && !validator.isValidInput(filled)) return null; // reject an invalid keystroke
  // Over the cap: truncate and accept rather than reject the keystroke, but always stay bounded.
  if (filled.length > maxLength) filled = filled.slice(0, maxLength);
  // The caret advances past the typed character only. Auto-fill may append trailing literals, but we
  // only jump the caret to the new end when the insert happened at (or past) the end of the field —
  // a mid-string insert whose fill adds trailing punctuation must leave the caret where the user typed.
  let caret = pos + ch.length;
  if (caret >= candidate.length && filled.length > candidate.length) caret = filled.length;
  if (caret > filled.length) caret = filled.length; // keep the caret within a truncated result
  return { value: filled, curPos: caret };
}

/**
 * Sanitize a pasted code point before insertion: tab / CR / LF become a single space; other C0
 * control characters and DEL are dropped (a single-line field never stores a control character). Any
 * other code point passes through unchanged.
 *
 * @param ch A single pasted code point.
 * @returns The mapped code point, or `null` to drop it.
 */
export function mapPasteChar(ch: string): string | null {
  if (ch === '\t' || ch === '\r' || ch === '\n') return ' ';
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x20 || code === 0x7f) return null; // drop other C0 / DEL
  return ch;
}

/**
 * Insert pasted text one code point at a time via {@link insertFilled}: each is sanitized, filled,
 * and checked against the validator and the `maxLength` cap; invalid or over-cap code points are
 * dropped individually rather than failing the whole paste. The caller deletes any selection first.
 * The result can never exceed `maxLength`.
 *
 * @param text      The pasted text (untrusted).
 * @param value     The current value (after any selection has been deleted).
 * @param curPos    The caret index to insert at.
 * @param maxLength The stored-length cap.
 * @param validator Optional live validator.
 * @returns The resulting `{ value, curPos }`.
 */
export function applyPaste(
  text: string,
  value: string,
  curPos: number,
  maxLength: number,
  validator?: Validator,
): PasteResult {
  let out = value;
  let pos = curPos;
  for (const ch of text) {
    if (out.length >= maxLength) break; // stay bounded
    const mapped = mapPasteChar(ch); // tab/CR/LF -> space, drop other control chars before inserting
    if (mapped === null) continue;
    const r = insertFilled(mapped, out, pos, maxLength, validator);
    if (r === null) continue; // drop an invalid / over-cap code point
    out = r.value;
    pos = r.curPos;
  }
  return { value: out, curPos: pos };
}
