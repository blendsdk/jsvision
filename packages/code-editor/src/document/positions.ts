import { charWidth } from '@jsvision/core';

import type {
  DocumentOffset,
  DocumentPosition,
  DocumentPositionInput,
  DocumentSnapshot,
  LogicalLine,
  VisualColumn,
} from './types.js';
import { documentCharacter, documentLine, documentOffset, isDocumentCoordinate, visualColumn } from './types.js';

const DEFAULT_TAB_SIZE = 4;
const graphemeSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const CHECKPOINT_INTERVAL = 256;

interface VisualCheckpoint {
  readonly offset: number;
  readonly column: number;
}

const visualCheckpoints = new WeakMap<DocumentSnapshot, Map<string, readonly VisualCheckpoint[]>>();

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
  return {
    line: documentLine(line.number),
    character: documentCharacter(offset - line.from),
  };
}

/**
 * Converts a zero-based UTF-16 line and character to a document offset.
 *
 * @example
 * ```ts
 * const offset = positionToOffset(snapshot, { line: 1, character: 2 });
 * ```
 */
export function positionToOffset(snapshot: DocumentSnapshot, position: DocumentPositionInput): DocumentOffset {
  if (!isDocumentCoordinate(position.line) || !isDocumentCoordinate(position.character)) {
    throw new RangeError('Document position must contain non-negative safe integers.');
  }
  const line = snapshot.line(position.line);
  if (position.character > line.length) {
    throw new RangeError('Document character is outside the logical line.');
  }
  return documentOffset(line.from + position.character, snapshot.length);
}

/**
 * Calculates the terminal cell column at a UTF-16 document offset.
 *
 * @example
 * ```ts
 * const column = offsetToVisualColumn(snapshot, caretOffset, 4);
 * ```
 */
export function offsetToVisualColumn(
  snapshot: DocumentSnapshot,
  offset: number,
  tabSize = DEFAULT_TAB_SIZE,
): VisualColumn {
  validateTabSize(tabSize);
  validateOffset(snapshot, offset);
  const line = snapshot.lineAt(offset);
  if (offset > line.to) {
    throw new RangeError('Offsets inside a line separator have no visual column.');
  }
  return visualColumn(visualWidth(snapshot, line, offset, tabSize));
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

function visualWidth(snapshot: DocumentSnapshot, line: LogicalLine, offset: number, tabSize: number): number {
  const prefixLength = offset - line.from;
  const checkpoints = checkpointsFor(snapshot, line, tabSize);
  const checkpoint = findCheckpoint(checkpoints, prefixLength);
  let column = checkpoint.column;
  const remaining = line.text.slice(checkpoint.offset, prefixLength);
  for (const part of graphemeSegmenter.segment(remaining)) {
    const absoluteIndex = checkpoint.offset + part.index;
    const segmentEnd = absoluteIndex + part.segment.length;
    if (segmentEnd > prefixLength) {
      const visiblePrefix = part.segment.slice(0, prefixLength - absoluteIndex);
      if (!endsWithUnpairedHighSurrogate(visiblePrefix)) {
        column += graphemeWidth(visiblePrefix);
      }
      break;
    }
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
      continue;
    }
    if (!endsWithUnpairedHighSurrogate(part.segment)) {
      column += graphemeWidth(part.segment);
    }
  }
  return column;
}

function checkpointsFor(snapshot: DocumentSnapshot, line: LogicalLine, tabSize: number): readonly VisualCheckpoint[] {
  let snapshotEntries = visualCheckpoints.get(snapshot);
  if (snapshotEntries === undefined) {
    snapshotEntries = new Map();
    visualCheckpoints.set(snapshot, snapshotEntries);
  }
  const key = `${line.number}:${tabSize}`;
  const existing = snapshotEntries.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const asciiCheckpoints = buildAsciiCheckpoints(line.text, tabSize);
  if (asciiCheckpoints !== undefined) {
    snapshotEntries.set(key, asciiCheckpoints);
    return asciiCheckpoints;
  }
  const checkpoints: VisualCheckpoint[] = [{ offset: 0, column: 0 }];
  let column = 0;
  let nextCheckpoint = CHECKPOINT_INTERVAL;
  for (const part of graphemeSegmenter.segment(line.text)) {
    if (part.index >= nextCheckpoint) {
      checkpoints.push({ offset: part.index, column });
      nextCheckpoint = part.index + CHECKPOINT_INTERVAL;
    }
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
    } else {
      column += graphemeWidth(part.segment);
    }
  }
  const frozen = Object.freeze(checkpoints);
  snapshotEntries.set(key, frozen);
  return frozen;
}

function buildAsciiCheckpoints(text: string, tabSize: number): readonly VisualCheckpoint[] | undefined {
  if (/^[\x20-\x7e]*$/u.test(text)) {
    const checkpoints: VisualCheckpoint[] = [];
    for (let offset = 0; offset < text.length; offset += CHECKPOINT_INTERVAL) {
      checkpoints.push({ offset, column: offset });
    }
    return Object.freeze(checkpoints);
  }
  const checkpoints: VisualCheckpoint[] = [{ offset: 0, column: 0 }];
  let column = 0;
  for (let offset = 0; offset < text.length; offset += 1) {
    const codeUnit = text.charCodeAt(offset);
    if (codeUnit !== 0x09 && (codeUnit < 0x20 || codeUnit > 0x7e)) {
      return undefined;
    }
    if (offset > 0 && offset % CHECKPOINT_INTERVAL === 0) {
      checkpoints.push({ offset, column });
    }
    column += codeUnit === 0x09 ? tabSize - (column % tabSize) : 1;
  }
  return Object.freeze(checkpoints);
}

function findCheckpoint(checkpoints: readonly VisualCheckpoint[], offset: number): VisualCheckpoint {
  let low = 0;
  let high = checkpoints.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((checkpoints[middle]?.offset ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return checkpoints[low] ?? { offset: 0, column: 0 };
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
