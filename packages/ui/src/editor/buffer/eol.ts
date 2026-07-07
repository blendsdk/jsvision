/**
 * Per-buffer line-ending policy.
 *
 * Loaded content (via `setText`) is stored verbatim, so a file with mixed line endings round-trips
 * byte-identical. Only new edits — typed, pasted, or clipboard text — are normalized to the
 * buffer's detected ending via {@link convertNewEdit}. The ending is decided by the first line
 * break in the loaded text; a buffer with no line break defaults to `'lf'`.
 */

/** A buffer's line-ending kind. */
export type LineEnding = 'lf' | 'crlf' | 'cr';

/** Detect the ending from the first line break in `text`; a break-less string yields `'lf'`. */
export function detectEol(text: string): LineEnding {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\r') return text[i + 1] === '\n' ? 'crlf' : 'cr';
    if (c === '\n') return 'lf';
  }
  return 'lf';
}

/** The byte sequence of a line-ending kind. */
export function eolOf(kind: LineEnding): string {
  return kind === 'crlf' ? '\r\n' : kind === 'cr' ? '\r' : '\n';
}

/** Normalize every `\r\n`/`\r`/`\n` in newly-edited text to the buffer's line ending. */
export function convertNewEdit(text: string, kind: LineEnding): string {
  return text.replace(/\r\n|\r|\n/g, eolOf(kind));
}
