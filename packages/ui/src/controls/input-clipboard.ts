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
 * Insert pasted text code point by code point (PA-8): each is checked against `validator.isValidInput`
 * and the `maxLength` cap; invalid or over-cap code points are dropped individually. The caller
 * deletes any selection first. Bounded — no unbounded growth (AC-15); the upstream `PasteEvent` is
 * already size-capped by core's `PASTE_CAP_BYTES`.
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
    const candidate = out.slice(0, pos) + ch + out.slice(pos);
    if (validator && !validator.isValidInput(candidate)) continue; // drop an invalid code point
    out = candidate;
    pos += ch.length;
  }
  return { value: out, curPos: pos };
}
