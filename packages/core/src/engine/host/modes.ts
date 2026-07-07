/**
 * Builders for the escape sequences that switch the terminal into and out of
 * full-screen TUI mode.
 *
 * Both are pure string builders driven by the capability profile (no I/O): they
 * emit the private-mode enable/disable pairs (alternate screen, cursor hide,
 * line-wrap off, mouse tracking, bracketed paste, focus reporting), each gated on
 * the matching capability. `leaveMode` is the **strict inverse** of `enterMode` —
 * the same toggles, the opposite value, in reverse order — so the terminal
 * unwinds to exactly the state it was in before.
 *
 * Note: the Kitty / `modifyOtherKeys` enhanced-keyboard protocol is intentionally
 * not enabled here, because the input decoder does not yet parse its key
 * encodings; no keyboard-protocol bytes are emitted regardless of `caps.keyboard`.
 */
import { CSI } from '../render/ansi.js';
import type { CapabilityProfile } from '../capability/profile.js';

/** Host-policy mode toggles that no capability models. */
export interface ModeOptions {
  /** Enable terminal focus reporting. Host policy, default on. */
  readonly focus?: boolean;
}

/**
 * One private-mode toggle. `enter` is the value written on enter (`h` or `l`);
 * leave writes the opposite. `on` decides whether this toggle is emitted at all.
 */
interface ModeToggle {
  readonly code: number;
  readonly on: boolean;
  readonly enter: 'h' | 'l';
}

/**
 * The ordered mode table. Cursor (25) and line-wrap (7) are toggled **off** on
 * enter (`enter: 'l'`); every other mode is toggled **on** (`'h'`). Order matters:
 * leave replays this list in reverse so it is the strict inverse of enter.
 */
function modeTable(caps: CapabilityProfile, options: ModeOptions): readonly ModeToggle[] {
  return [
    { code: 1049, on: caps.altScreen, enter: 'h' }, // alternate screen
    { code: 25, on: true, enter: 'l' }, // hide cursor
    { code: 7, on: true, enter: 'l' }, // line wrap off
    { code: 1006, on: caps.mouse.sgr, enter: 'h' }, // SGR mouse encoding
    { code: 1000, on: caps.mouse.sgr, enter: 'h' }, // basic button tracking
    { code: 1002, on: caps.mouse.sgr && caps.mouse.drag, enter: 'h' }, // button-event (drag)
    { code: 2004, on: caps.bracketedPaste, enter: 'h' }, // bracketed paste
    { code: 1004, on: options.focus !== false, enter: 'h' }, // focus reporting (host policy)
  ];
}

/** The opposite private-mode value (`h`↔`l`). */
function invert(value: 'h' | 'l'): 'h' | 'l' {
  return value === 'h' ? 'l' : 'h';
}

/**
 * Build the enter-TUI-mode byte string, gating each mode on `caps`.
 *
 * @param caps - the detected capability profile (gates each mode).
 * @param options - host-policy toggles; `focus` defaults to on.
 * @returns the concatenated private-mode enable sequence.
 */
export function enterMode(caps: CapabilityProfile, options: ModeOptions = {}): string {
  let out = '';
  for (const { code, on, enter } of modeTable(caps, options)) {
    if (on) out += `${CSI}?${code}${enter}`;
  }
  return out;
}

/**
 * Build the exact inverse leave-TUI-mode string: every enabled mode toggled the
 * opposite way, in reverse order, so the terminal returns to its prior state.
 *
 * @param caps - the same capability profile passed to {@link enterMode}.
 * @param options - the same host-policy toggles passed to {@link enterMode}.
 * @returns the concatenated private-mode disable sequence (the strict inverse of enter).
 */
export function leaveMode(caps: CapabilityProfile, options: ModeOptions = {}): string {
  let out = '';
  const table = modeTable(caps, options);
  for (let i = table.length - 1; i >= 0; i -= 1) {
    const { code, on, enter } = table[i];
    if (on) out += `${CSI}?${code}${invert(enter)}`;
  }
  return out;
}
