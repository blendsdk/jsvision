/**
 * OSC (Operating System Command) feature surface: hyperlinks, clipboard, window
 * title, bell, and desktop notifications.
 *
 * Each function is pure — it returns the ANSI string for you to write to the
 * terminal (like {@link serialize}) — and routes every text/url argument through
 * {@link sanitize} first, so embedded escape/OSC sequences cannot break out. Each
 * feature is gated on the relevant terminal `osc` capability; an unsupported
 * feature degrades gracefully to plain text or an empty string.
 *
 * These functions never log the text you pass. Debounce/rate-limiting of bells and
 * notifications is your app's responsibility.
 */

import { sanitize } from '../safety/sanitize.js';
import type { CapabilityProfile } from '../capability/index.js';

/** BEL terminator (`\x07`) used by several OSC sequences. */
const BEL = '\x07';
/** String Terminator (`ESC \`) used by OSC 8 and the Kitty OSC 99 form. */
const ST = '\x1b\\';

/**
 * Emit an OSC 8 hyperlink wrapping `text` with `url`. When the terminal lacks
 * hyperlink support, returns the sanitized text as plain text (so it still reads
 * correctly, just without the clickable link).
 *
 * @param text Visible link text (sanitized).
 * @param url Target URL (sanitized).
 * @param caps Resolved terminal capabilities.
 * @returns The ANSI string to write to the terminal.
 * @example
 * import { hyperlink, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 * process.stdout.write(hyperlink('jsvision docs', 'https://example.com', caps));
 */
export function hyperlink(text: string, url: string, caps: CapabilityProfile): string {
  const t = sanitize(text);
  if (!caps.osc.hyperlink8) return t;
  const u = sanitize(url);
  return `\x1b]8;;${u}${ST}${t}\x1b]8;;${ST}`;
}

/**
 * Emit an OSC 52 clipboard-write of `text`. The text is base64-encoded **verbatim**
 * (no sanitize) so the exact bytes — including newlines — land on the clipboard;
 * base64 output cannot break out of the OSC 52 frame, so the sequence stays
 * injection-safe regardless. Returns `''` when the terminal lacks clipboard support.
 *
 * @param text Text to place on the clipboard; encoded byte-for-byte.
 * @param caps Resolved terminal capabilities.
 * @returns The ANSI string to write to the terminal, or `''` if unsupported.
 * @example
 * import { setClipboard, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 * process.stdout.write(setClipboard('copied from my TUI', caps));
 */
export function setClipboard(text: string, caps: CapabilityProfile): string {
  if (!caps.osc.clipboard52) return '';
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  return `\x1b]52;c;${b64}${BEL}`;
}

/**
 * Emit an OSC 0/2 window-title set. Returns `''` when the terminal does not
 * support setting the title.
 *
 * @param text New window title (sanitized).
 * @param caps Resolved terminal capabilities.
 * @returns The ANSI string to write to the terminal, or `''` if unsupported.
 * @example
 * import { setTitle, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 * process.stdout.write(setTitle('My App — editing report.txt', caps));
 */
export function setTitle(text: string, caps: CapabilityProfile): string {
  if (!caps.osc.title) return '';
  return `\x1b]0;${sanitize(text)}${BEL}`;
}

/**
 * Emit a literal terminal bell (`\x07`). You own any debounce/rate-limit policy.
 *
 * @returns The BEL byte to write to the terminal.
 * @example
 * import { bell } from '@jsvision/core';
 * process.stdout.write(bell());
 */
export function bell(): string {
  return BEL;
}

/**
 * Emit a desktop notification via the first protocol the terminal supports (Kitty,
 * iTerm2, urxvt, or Windows Terminal/ConEmu), falling back to a single bell when
 * none is available. Title and body are sanitized, so an embedded escape cannot
 * open a second sequence.
 *
 * @param title Notification title (sanitized).
 * @param body Notification body (sanitized).
 * @param caps Resolved terminal capabilities.
 * @returns The ANSI string to write to the terminal.
 * @example
 * import { notify, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 * process.stdout.write(notify('Build finished', 'All tests passed', caps));
 */
export function notify(title: string, body: string, caps: CapabilityProfile): string {
  const t = sanitize(title);
  const b = sanitize(body);
  if (caps.osc.notify99) return `\x1b]99;;${t} — ${b}${ST}`;
  if (caps.osc.notify9) return `\x1b]9;${t} — ${b}${BEL}`;
  if (caps.osc.notify777) return `\x1b]777;notify;${t};${b}${BEL}`;
  if (caps.osc.progress9_4) return `\x1b]9;4;1;0${BEL}`;
  return BEL;
}

export { cursor } from './cursor.js';
