/**
 * Buffer-core barrel (RD-08 03-01) — the view-free pure core of the editor family: the gap
 * buffer, grapheme segmentation, TV-transcribed navigation, and the EOL policy. INTERNAL to
 * `@jsvision/ui` — none of these symbols ride the package barrel (03-07 §Packaging); the public
 * `LineEnding` type re-exports from the editor surface.
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
