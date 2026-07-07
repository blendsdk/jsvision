/**
 * Per-buffer EOL policy (RD-08 AR-252 / PF-008).
 *
 * TV reads file bytes VERBATIM (`tfiledtr.cpp:126-132`) and converts only newly-inserted text to
 * the buffer's line-ending type (`insertText` conversion; `detectLineEndingType` decode
 * `teditor2.cpp:66-80` — the FIRST line break decides). Ours mirrors that split: loaded/`setText`
 * content stores verbatim (mixed EOLs round-trip byte-identical), and only new edits
 * (typed/pasted/clipboard) pass through {@link convertNewEdit}. A break-less buffer defaults to
 * `'lf'` (AR-252 — TV's platform default `eolCrLf` is a DOS-ism; documented deviation).
 */

/** A buffer's line-ending kind. */
export type LineEnding = 'lf' | 'crlf' | 'cr';

/** Detect the ending from the FIRST line break (`teditor2.cpp:66-80`); none ⇒ `'lf'` (AR-252). */
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

/** Normalize every `\r\n`/`\r`/`\n` run in NEW-edit text to the buffer's ending (AR-252). */
export function convertNewEdit(text: string, kind: LineEnding): string {
  return text.replace(/\r\n|\r|\n/g, eolOf(kind));
}
