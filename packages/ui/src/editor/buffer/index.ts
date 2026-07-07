/**
 * The view-free text core of the editor family: the gap buffer, grapheme-cluster segmentation,
 * cursor/word/line navigation, and the line-ending policy. Everything here is internal to
 * `@jsvision/ui`; the only symbol that reaches consumers is the `LineEnding` type, re-exported from
 * the editor's public surface.
 */
export { GapBuffer } from './gap.js';
export type { BufText } from './gap.js';
export { nextClusterEnd, prevClusterStart, isClusterStart } from './segment.js';
export {
  lineStart,
  lineEnd,
  nextChar,
  prevChar,
  nextLine,
  prevLine,
  nextWord,
  prevWord,
  charPos,
  charPtr,
  lineMove,
} from './navigate.js';
export { detectEol, eolOf, convertNewEdit } from './eol.js';
export type { LineEnding } from './eol.js';
