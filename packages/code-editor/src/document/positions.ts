import { charWidth } from '@jsvision/core';

import type { DocumentPosition, DocumentSnapshot, LogicalLine } from './types.js';
import { isDocumentCoordinate } from './types.js';

const DEFAULT_TAB_SIZE = 4;
const graphemeSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

/**
 * Converts a UTF-16 document offset to a zero-based line and character.
 *
 * @example
 * ```ts
 * const position = offsetToPosition(snapshot, 4);
 * ```
 */
export function offsetToPosition(snapshot: DocumentSnapshot, offset: number): DocumentPosition {
  validateOffset(snapshot, offset);
  const line = snapshot.lineAt(offset);
  if (offset > line.to) {
    throw new RangeError('Offsets inside a line separator have no protocol position.');
  }
  return { line: line.number, character: offset - line.from };
}

/**
 * Converts a zero-based UTF-16 line and character to a document offset.
 *
 * @example
 * ```ts
 * const offset = positionToOffset(snapshot, { line: 1, character: 2 });
 * ```
 */
export function positionToOffset(snapshot: DocumentSnapshot, position: DocumentPosition): number {
  if (!isDocumentCoordinate(position.line) || !isDocumentCoordinate(position.character)) {
    throw new RangeError('Document position must contain non-negative safe integers.');
  }
  const line = snapshot.line(position.line);
  if (position.character > line.length) {
    throw new RangeError('Document character is outside the logical line.');
  }
  return line.from + position.character;
}

/**
 * Calculates the terminal cell column at a UTF-16 document offset.
 *
 * @example
 * ```ts
 * const column = offsetToVisualColumn(snapshot, caretOffset, 4);
 * ```
 */
export function offsetToVisualColumn(snapshot: DocumentSnapshot, offset: number, tabSize = DEFAULT_TAB_SIZE): number {
  validateTabSize(tabSize);
  validateOffset(snapshot, offset);
  const line = snapshot.lineAt(offset);
  if (offset > line.to) {
    throw new RangeError('Offsets inside a line separator have no visual column.');
  }
  return visualWidth(line, offset, tabSize);
}

function validateOffset(snapshot: DocumentSnapshot, offset: number): void {
  if (!isDocumentCoordinate(offset) || offset > snapshot.length) {
    throw new RangeError('Document offset is outside the snapshot.');
  }
}

function validateTabSize(tabSize: number): void {
  if (!Number.isSafeInteger(tabSize) || tabSize < 1 || tabSize > 32) {
    throw new RangeError('Tab size must be an integer from 1 through 32.');
  }
}

function visualWidth(line: LogicalLine, offset: number, tabSize: number): number {
  const prefixLength = offset - line.from;
  let column = 0;
  for (const part of graphemeSegmenter.segment(line.text)) {
    const segmentEnd = part.index + part.segment.length;
    if (segmentEnd > prefixLength) {
      const visiblePrefix = part.segment.slice(0, prefixLength - part.index);
      if (!endsWithUnpairedHighSurrogate(visiblePrefix)) {
        column += graphemeWidth(visiblePrefix);
      }
      break;
    }
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
      continue;
    }
    column += graphemeWidth(part.segment);
  }
  return column;
}

function endsWithUnpairedHighSurrogate(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  const finalCodeUnit = text.charCodeAt(text.length - 1);
  return finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff;
}

function graphemeWidth(grapheme: string): number {
  let width = 0;
  for (const character of grapheme) {
    width = Math.max(width, charWidth(character.codePointAt(0) ?? 0, 'wcwidth'));
  }
  return width;
}
