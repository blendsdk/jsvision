/**
 * The output sanitizer — the SDK's terminal-injection boundary. Strips
 * terminal-control bytes from untrusted text before it reaches the screen, so
 * app- or network-supplied strings can never open or close an escape/OSC
 * sequence and hijack the terminal.
 *
 * Every text-accepting output path in the SDK already routes through this (the
 * screen buffer's text writes, the OSC helpers such as `hyperlink`/`setClipboard`/
 * `setTitle`/`notify`, and window titles), so you rarely need to call it directly —
 * but do call it yourself on any string you write to the terminal outside those
 * paths.
 */

/**
 * Remove escape and other terminal-control bytes from untrusted text, returning
 * a string that is safe to write to the terminal.
 *
 * Stripped: `ESC` (0x1b) and the two-byte `ESC \` String Terminator, `BEL`
 * (0x07), the single-byte `ST` (0x9c), all C0 controls (0x00–0x1f) **except** tab
 * (0x09) and newline (0x0a), and all C1 controls (0x80–0x9f). Printable and valid
 * UTF-8 text (including emoji and other astral characters) passes through
 * unchanged. Pure — it never mutates or logs its input.
 *
 * @param text Untrusted input (app- or network-supplied).
 * @returns `text` with control bytes removed; tab and newline are preserved.
 * @example
 * import { sanitize } from '@jsvision/core';
 *
 * // Only the control bytes are removed. The ESC that armed the color sequence is
 * // gone, so its parameters render as harmless literal text instead of a command.
 * sanitize('hi\x1b[31mred\x07');   // => 'hi[31mred'  (ESC + BEL stripped)
 * sanitize('col1\tcol2\nline2');   // => 'col1\tcol2\nline2'  (tab + newline kept)
 * sanitize('emoji 🎉 ok');         // => 'emoji 🎉 ok'  (unchanged)
 */
export function sanitize(text: string): string {
  // Iterate by code point so astral characters (emoji, CJK ext) stay intact.
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x1b) {
      // ESC: drop it, and the following backslash too when it forms `ESC \` (ST).
      if (chars[i + 1] === '\\') i += 1;
      continue;
    }
    if (cp === 0x09 || cp === 0x0a) {
      out += ch; // keep tab and newline
      continue;
    }
    if (cp < 0x20) continue; // other C0 controls (incl. BEL 0x07)
    if (cp >= 0x80 && cp <= 0x9f) continue; // C1 controls (incl. ST 0x9c)
    out += ch;
  }
  return out;
}
