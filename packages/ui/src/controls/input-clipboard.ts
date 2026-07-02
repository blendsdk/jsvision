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
 * the validator's `fill` transform runs on the candidate — it may insert mask **literals** before
 * and/or after the char (a leading `(`, a trailing `-`) and apply case transforms — and the FILLED
 * candidate is checked against `isValidInput` + `maxLength`. Filling **before** validation is what
 * lets a leading literal auto-appear as you type the first digit (TV `TPXPictureValidator` fills
 * literals during input). A plain filter/range validator has no `fill`, so the filled candidate equals
 * the raw candidate and behaviour is unchanged.
 *
 * @param ch        The code point to insert (already the single char / space).
 * @param value     The current value.
 * @param pos       The caret index to insert at.
 * @param maxLength The stored-length cap.
 * @param validator Optional live validator.
 * @returns The new `{ value, curPos }` (caret past the char + any auto-filled literals), or `null` when rejected.
 */
export function insertFilled(
  ch: string,
  value: string,
  pos: number,
  maxLength: number,
  validator?: Validator,
): PasteResult | null {
  const candidate = value.slice(0, pos) + ch + value.slice(pos);
  const filled = validator?.fill?.(candidate) ?? candidate;
  if (filled.length > maxLength) return null; // bounded (security, AC-15)
  if (validator && !validator.isValidInput(filled)) return null; // reject an invalid keystroke
  return { value: filled, curPos: pos + (filled.length - value.length) };
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
    const r = insertFilled(ch, out, pos, maxLength, validator);
    if (r === null) continue; // drop an invalid / over-cap code point
    out = r.value;
    pos = r.curPos;
  }
  return { value: out, curPos: pos };
}
