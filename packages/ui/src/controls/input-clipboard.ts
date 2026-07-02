/**
 * Clipboard helpers for {@link Input} (RD-07), extracted so `input.ts` stays under the 500-line cap
 * (AC-13). Faithful to Turbo Vision `TInputLine` cmCut/cmCopy/cmPaste (`tinputli.cpp:469-489`) + the
 * char-by-char paste (`:418-446`, PA-8). Pure functions over strings/events — no `View`/reactive
 * dependency. The `.js` extension is required by NodeNext ESM resolution.
 */
import type { KeyEvent } from '@jsvision/core';
import type { Validator } from './validators/index.js';
import { Commands } from '../status/index.js';

/** A clipboard action the `Input` performs. `paste` is a no-op without a system read (PA-16). */
export type ClipboardAction = 'copy' | 'cut' | 'paste';

/** The new value + caret after inserting pasted text. */
export interface PasteResult {
  readonly value: string;
  readonly curPos: number;
}

/**
 * Classify a SIGINT-safe clipboard key chord (PA-7): Ctrl+Insert = copy, Shift+Insert = paste,
 * Shift+Delete = cut. Returns `null` for any other key (it flows on to the edit machine).
 *
 * @param inner The decoded key event.
 * @returns The clipboard action, or `null`.
 */
export function clipboardChord(inner: KeyEvent): ClipboardAction | null {
  if (inner.key === 'insert' && inner.ctrl) return 'copy';
  if (inner.key === 'insert' && inner.shift) return 'paste';
  if (inner.key === 'delete' && inner.shift) return 'cut';
  return null;
}

/**
 * Map a command name to a clipboard action (TV cmCut/cmCopy/cmPaste; PA-7), or `null` if it is not
 * a clipboard command.
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
 * Insert one code point at `pos` with picture autoFill (PA-17), then validate. The char is inserted,
 * the validator's `fill` transform runs on the candidate — TV `TPXPictureValidator` appends **trailing**
 * mask literals (e.g. a `-` after a completed group) and applies case transforms (HR-55: it does NOT
 * auto-insert leading literals) — and the FILLED candidate is checked against `isValidInput`, then
 * clamped to `maxLength` (HR-58 clamp-and-accept). A plain filter/range validator has no `fill`, so the
 * filled candidate equals the raw candidate and behaviour is unchanged.
 *
 * @param ch        The code point to insert (already the single char / space).
 * @param value     The current value.
 * @param pos       The caret index to insert at.
 * @param maxLength The stored-length cap.
 * @param validator Optional live validator.
 * @returns The new `{ value, curPos }` (caret past the typed char, not trailing autoFill; HR-45), or `null` when rejected.
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
  // HR-58 (tinputli.cpp:284-287): clamp-and-accept — TV truncates `newData` at `maxLen` rather than
  // rejecting the keystroke; still bounded (security, AC-15).
  if (filled.length > maxLength) filled = filled.slice(0, maxLength);
  // HR-45 (tinputli.cpp:443,315-320): the caret advances past the TYPED char only. `checkValid`'s
  // autoFill may append TRAILING literals, but TV only jumps the caret to the new end when it was
  // already at/past the post-insert length (typing at the very end). `candidate` = post-insert,
  // pre-fill; so a mid-string insert whose fill appends trailing literals keeps the caret local.
  let caret = pos + ch.length;
  if (caret >= candidate.length && filled.length > candidate.length) caret = filled.length;
  if (caret > filled.length) caret = filled.length; // keep the caret within a clamped result (HR-58)
  return { value: filled, curPos: caret };
}

/**
 * Map a pasted code point for insertion (HR-43, `tinputli.cpp:430-431`): tab/CR/LF → a single space;
 * other C0 controls + DEL are dropped (our stricter allowlist posture + the HR-05 no-control-in-cell
 * invariant). Any other code point passes through unchanged.
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
 * Insert pasted text code point by code point (PA-8) via {@link insertFilled}: each is filled +
 * checked against `validator.isValidInput` and the `maxLength` cap; invalid or over-cap code points
 * are dropped individually. The caller deletes any selection first. Bounded — no unbounded growth
 * (AC-15); the upstream `PasteEvent` is already size-capped by core's `PASTE_CAP_BYTES`.
 *
 * @param text      The pasted text (untrusted).
 * @param value     The current value (post selection-delete).
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
    if (out.length >= maxLength) break; // bounded (security, AC-15)
    const mapped = mapPasteChar(ch); // HR-43: \t\r\n→space, drop other C0/DEL before insert
    if (mapped === null) continue;
    const r = insertFilled(mapped, out, pos, maxLength, validator);
    if (r === null) continue; // drop an invalid / over-cap code point
    out = r.value;
    pos = r.curPos;
  }
  return { value: out, curPos: pos };
}
