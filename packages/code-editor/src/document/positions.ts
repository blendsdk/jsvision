import type {
  DocumentOffset,
  DocumentPosition,
  DocumentPositionInput,
  DocumentSnapshot,
  LogicalLine,
  VisualColumn,
} from './types.js';
import { documentCharacter, documentLine, documentOffset, isDocumentCoordinate, visualColumn } from './types.js';
import { graphemeDisplayWidth, visualGraphemeSegments } from './visual-geometry.js';

const DEFAULT_TAB_SIZE = 4;
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

/**
 * Measures source text in terminal cells from an optional starting column.
 *
 * Tabs advance to the next configured tab stop and each grapheme contributes its terminal display
 * width. The starting column matters when measuring a suffix that follows already projected text.
 *
 * @param text Source text without a logical line separator.
 * @param tabSize Number of terminal columns between tab stops.
 * @param startingColumn Existing visual column before `text`.
 * @returns The visual column immediately after the measured text.
 */
export function textToVisualColumn(text: string, tabSize = DEFAULT_TAB_SIZE, startingColumn = 0): number {
  validateTabSize(tabSize);
  if (!Number.isSafeInteger(startingColumn) || startingColumn < 0) {
    throw new RangeError('Starting visual column must be a non-negative safe integer.');
  }
  if (/^[\x20-\x7e]*$/u.test(text)) return startingColumn + text.length;
  let column = startingColumn;
  for (const part of visualGraphemeSegments(text)) {
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
    } else {
      column += graphemeDisplayWidth(part.segment);
    }
  }
  return column;
}

/**
 * Converts a visual terminal column on one logical line to a UTF-16 document offset.
 *
 * Columns landing inside a tab or wide grapheme resolve to the start of that source cluster.
 * Sparse per-snapshot checkpoints keep horizontally scrolled projection bounded near the visible
 * region instead of rescanning a long line from its beginning.
 *
 * @example
 * ```ts
 * const offset = visualColumnToOffset(snapshot, 0, 12, 4);
 * ```
 */
export function visualColumnToOffset(
  snapshot: DocumentSnapshot,
  lineNumber: number,
  column: number,
  tabSize = DEFAULT_TAB_SIZE,
): DocumentOffset {
  validateTabSize(tabSize);
  if (!isDocumentCoordinate(lineNumber) || lineNumber >= snapshot.lineCount) {
    throw new RangeError('Document line is outside the snapshot.');
  }
  if (!isDocumentCoordinate(column)) {
    throw new RangeError('Visual column must be a non-negative safe integer.');
  }
  const line = snapshot.line(lineNumber);
  const checkpoints = checkpointsFor(snapshot, line, tabSize);
  const checkpointIndex = findColumnCheckpointIndex(checkpoints, column);
  const checkpoint = checkpoints[checkpointIndex] ?? { offset: 0, column: 0 };
  const nextOffset = checkpoints[checkpointIndex + 1]?.offset ?? line.text.length;
  let visual = checkpoint.column;
  const remaining = line.text.slice(checkpoint.offset, nextOffset);
  for (const part of visualGraphemeSegments(remaining)) {
    const width = part.segment === '\t' ? tabSize - (visual % tabSize) : graphemeDisplayWidth(part.segment);
    if (column < visual + Math.max(1, width)) {
      return documentOffset(line.from + checkpoint.offset + part.index, snapshot.length);
    }
    visual += width;
  }
  return documentOffset(line.to, snapshot.length);
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
  for (const part of visualGraphemeSegments(remaining)) {
    const absoluteIndex = checkpoint.offset + part.index;
    const segmentEnd = absoluteIndex + part.segment.length;
    if (segmentEnd > prefixLength) {
      const visiblePrefix = part.segment.slice(0, prefixLength - absoluteIndex);
      if (!endsWithUnpairedHighSurrogate(visiblePrefix)) {
        column += graphemeDisplayWidth(visiblePrefix);
      }
      break;
    }
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
      continue;
    }
    if (!endsWithUnpairedHighSurrogate(part.segment)) {
      column += graphemeDisplayWidth(part.segment);
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
  for (const part of visualGraphemeSegments(line.text)) {
    if (part.index >= nextCheckpoint) {
      checkpoints.push({ offset: part.index, column });
      nextCheckpoint = part.index + CHECKPOINT_INTERVAL;
    }
    if (part.segment === '\t') {
      column += tabSize - (column % tabSize);
    } else {
      column += graphemeDisplayWidth(part.segment);
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

/** Finds the last sparse checkpoint at or before a visual column. */
function findColumnCheckpointIndex(checkpoints: readonly VisualCheckpoint[], column: number): number {
  let low = 0;
  let high = checkpoints.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((checkpoints[middle]?.column ?? 0) <= column) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function endsWithUnpairedHighSurrogate(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  const finalCodeUnit = text.charCodeAt(text.length - 1);
  return finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff;
}
