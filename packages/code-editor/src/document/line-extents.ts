import type { ChangeSet, Text } from '@codemirror/state';
import { charWidth } from '@jsvision/core';

import type { DocumentStorage } from './storage.js';
import { graphemeDisplayWidth, visualGraphemeSegments } from './visual-geometry.js';

const CHECKPOINT_INTERVAL = 256;
const dependentUnicodePattern =
  /[\p{Mark}\p{Emoji_Modifier}\u0000-\u001f\u007f-\u009f\u200d\ufe00-\ufe0f\u{1f1e6}-\u{1f1ff}\u1100-\u11ff\ua960-\ua97f\ud7b0-\ud7ff]/u;

type LineGeometryMode = 'printable-ascii' | 'ascii-tabs' | 'independent-unicode' | 'complex';

interface VisualCheckpoint {
  readonly offset: number;
  readonly column: number;
}

interface LineExtent {
  readonly width: number;
  readonly mode: LineGeometryMode;
  readonly checkpoints: readonly VisualCheckpoint[];
  readonly lastGraphemeFrom?: number;
}

interface ChangedLineRange {
  readonly beforeFrom: number;
  readonly beforeTo: number;
  readonly afterFrom: number;
  readonly afterTo: number;
}

interface SingleLineEdit {
  readonly from: number;
  readonly to: number;
  readonly inserted: string;
}

/**
 * Maintains exact per-line terminal widths and sparse source-to-column checkpoints.
 *
 * Printable ASCII needs no checkpoints because source offsets and columns are identical.
 * ASCII-plus-tab lines use a manual scanner, and Unicode lines retain checkpoints across
 * revisions so an independent local edit shifts the unaffected suffix instead of re-segmenting
 * the full line. Complex grapheme text still uses the shared Unicode segmenter for correctness.
 */
export class DocumentLineExtents {
  readonly #tabSize: number;
  readonly #extents: LineExtent[];
  readonly #counts = new Map<number, number>();
  #maximum = 0;

  /**
   * Builds the initial visual index while the document is already paying its one-time load cost.
   *
   * @param storage Initial immutable document storage.
   * @param tabSize Configured terminal tab width.
   */
  public constructor(storage: DocumentStorage, tabSize: number) {
    this.#tabSize = tabSize;
    this.#extents = Array.from({ length: storage.lineCount }, (_, line) =>
      measureLine(storage.line(line).text, tabSize),
    );
    for (const extent of this.#extents) this.#addWidth(extent.width);
  }

  /** Returns the greatest visual column occupied by any logical line. */
  public get maximum(): number {
    return this.#maximum;
  }

  /** Maps a validated relative UTF-16 line offset to its terminal column. */
  public visualColumnAt(lineNumber: number, relativeOffset: number, text: string): number {
    const extent = this.#extents[lineNumber];
    if (extent === undefined) return 0;
    const target = clamp(relativeOffset, 0, text.length);
    if (extent.mode === 'printable-ascii') return target;
    const checkpoint = checkpointAtOffset(extent.checkpoints, target);
    return scanColumn(text, checkpoint.offset, target, checkpoint.column, this.#tabSize, extent.mode);
  }

  /** Maps a terminal column to the start of its tab or grapheme cluster on one logical line. */
  public offsetAtVisualColumn(lineNumber: number, column: number, text: string): number {
    const extent = this.#extents[lineNumber];
    if (extent === undefined) return 0;
    const target = Math.max(0, column);
    if (extent.mode === 'printable-ascii') return Math.min(target, text.length);
    const checkpoint = checkpointAtColumn(extent.checkpoints, target);
    return scanOffset(text, checkpoint.offset, target, checkpoint.column, this.#tabSize, extent.mode);
  }

  /**
   * Updates geometry for the logical line regions touched by an accepted change set.
   *
   * Processing from the bottom upward keeps earlier indices stable while line splices change the
   * line count. A single-line independent edit reuses and shifts persistent Unicode checkpoints.
   */
  public apply(before: DocumentStorage, after: DocumentStorage, changes: ChangeSet): void {
    const ranges = changedLineRanges(before, after, changes);
    const localEdits = singleLineEdits(before, changes);
    let removedMaximum = false;
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      if (range === undefined) continue;
      const removeCount = range.beforeTo - range.beforeFrom + 1;
      const replacementCount = range.afterTo - range.afterFrom + 1;
      const replacements: LineExtent[] = [];
      for (let line = range.afterFrom; line <= range.afterTo; line += 1) {
        const priorLine = range.beforeFrom + (line - range.afterFrom);
        const prior = this.#extents[priorLine];
        const edit = localEdits.get(priorLine);
        const afterLine = after.line(line).text;
        replacements.push(
          removeCount === replacementCount && prior !== undefined && edit !== undefined
            ? updateSingleLineExtent(prior, before.line(priorLine).text, afterLine, edit, this.#tabSize)
            : measureLine(afterLine, this.#tabSize),
        );
      }
      const removed =
        removeCount === replacements.length
          ? this.#replaceEqualLength(range.beforeFrom, replacements)
          : this.#extents.splice(range.beforeFrom, removeCount, ...replacements);
      for (const extent of removed) {
        this.#removeWidth(extent.width);
        if (extent.width === this.#maximum) removedMaximum = true;
      }
      for (const extent of replacements) this.#addWidth(extent.width);
    }
    if (removedMaximum && (this.#counts.get(this.#maximum) ?? 0) === 0) this.#recalculateMaximum();
  }

  #addWidth(width: number): void {
    this.#counts.set(width, (this.#counts.get(width) ?? 0) + 1);
    this.#maximum = Math.max(this.#maximum, width);
  }

  /** Replaces equal-count line geometry without shifting a large unaffected suffix array. */
  #replaceEqualLength(from: number, replacements: readonly LineExtent[]): LineExtent[] {
    const removed: LineExtent[] = [];
    for (let offset = 0; offset < replacements.length; offset += 1) {
      const index = from + offset;
      removed.push(this.#extents[index] ?? emptyExtent());
      this.#extents[index] = replacements[offset] ?? emptyExtent();
    }
    return removed;
  }

  #removeWidth(width: number): void {
    const count = this.#counts.get(width) ?? 0;
    if (count <= 1) this.#counts.delete(width);
    else this.#counts.set(width, count - 1);
  }

  #recalculateMaximum(): void {
    let maximum = 0;
    for (const width of this.#counts.keys()) maximum = Math.max(maximum, width);
    this.#maximum = maximum;
  }
}

/** Measures one complete line and builds checkpoints using its cheapest exact geometry mode. */
function measureLine(text: string, tabSize: number): LineExtent {
  const ascii = measureAscii(text, tabSize);
  if (ascii !== undefined) return ascii;
  if (!dependentUnicodePattern.test(text)) return measureIndependentUnicode(text);
  return measureComplex(text, tabSize);
}

/** Scans printable ASCII and tabs without invoking the Unicode segmenter. */
function measureAscii(text: string, tabSize: number): LineExtent | undefined {
  let column = 0;
  let hasTab = false;
  const checkpoints: VisualCheckpoint[] = [{ offset: 0, column: 0 }];
  for (let offset = 0; offset < text.length; offset += 1) {
    const code = text.charCodeAt(offset);
    if (code === 0x09) hasTab = true;
    else if (code < 0x20 || code > 0x7e) return undefined;
    if (offset > 0 && offset % CHECKPOINT_INTERVAL === 0) checkpoints.push({ offset, column });
    column += code === 0x09 ? tabSize - (column % tabSize) : 1;
  }
  return {
    width: column,
    mode: hasTab ? 'ascii-tabs' : 'printable-ascii',
    checkpoints: hasTab ? Object.freeze(checkpoints) : Object.freeze([]),
  };
}

/** Measures Unicode whose grapheme clusters are independent single code points. */
function measureIndependentUnicode(text: string): LineExtent {
  let column = 0;
  let nextCheckpoint = CHECKPOINT_INTERVAL;
  const checkpoints: VisualCheckpoint[] = [{ offset: 0, column: 0 }];
  for (let offset = 0; offset < text.length;) {
    const codePoint = text.codePointAt(offset) ?? 0;
    if (offset >= nextCheckpoint) {
      checkpoints.push({ offset, column });
      nextCheckpoint = offset + CHECKPOINT_INTERVAL;
    }
    column += charWidth(codePoint, 'wcwidth');
    offset += codePoint > 0xffff ? 2 : 1;
  }
  return {
    width: column,
    mode: 'independent-unicode',
    checkpoints: Object.freeze(checkpoints),
  };
}

/** Measures text containing dependent grapheme code points with the shared Unicode segmenter. */
function measureComplex(text: string, tabSize: number): LineExtent {
  let column = 0;
  let nextCheckpoint = CHECKPOINT_INTERVAL;
  let lastGraphemeFrom = 0;
  const checkpoints: VisualCheckpoint[] = [{ offset: 0, column: 0 }];
  for (const part of visualGraphemeSegments(text)) {
    lastGraphemeFrom = part.index;
    if (part.index >= nextCheckpoint) {
      checkpoints.push({ offset: part.index, column });
      nextCheckpoint = part.index + CHECKPOINT_INTERVAL;
    }
    column += part.segment === '\t' ? tabSize - (column % tabSize) : graphemeDisplayWidth(part.segment);
  }
  return {
    width: column,
    mode: 'complex',
    checkpoints: Object.freeze(checkpoints),
    lastGraphemeFrom,
  };
}

/** Applies one same-line edit using arithmetic or shifted Unicode checkpoints when safe. */
function updateSingleLineExtent(
  prior: LineExtent,
  before: string,
  after: string,
  edit: SingleLineEdit,
  tabSize: number,
): LineExtent {
  if (prior.mode === 'printable-ascii' && /^[\x20-\x7e]*$/u.test(edit.inserted)) {
    return {
      width: prior.width + edit.inserted.length - (edit.to - edit.from),
      mode: 'printable-ascii',
      checkpoints: Object.freeze([]),
    };
  }
  if (prior.mode === 'ascii-tabs' && /^[\t\x20-\x7e]*$/u.test(edit.inserted)) {
    return updateAsciiTabs(prior, before, after, edit, tabSize);
  }
  if (prior.mode === 'independent-unicode' && !dependentUnicodePattern.test(edit.inserted)) {
    return updateIndependentUnicode(prior, before, edit);
  }
  if (
    prior.mode === 'complex' &&
    edit.from === before.length &&
    edit.to === before.length &&
    hasIndependentAppendBoundary(prior, before, edit.inserted)
  ) {
    return appendComplexUnicode(prior, before.length, edit.inserted, tabSize);
  }
  return measureLine(after, tabSize);
}

/**
 * Rebuilds tab geometry only through the next unchanged tab, where tab-stop alignment converges.
 *
 * After that synchronization point, every suffix checkpoint can shift arithmetically. An edit at
 * the end has no suffix and therefore touches only its local inserted fragment.
 */
function updateAsciiTabs(
  prior: LineExtent,
  before: string,
  after: string,
  edit: SingleLineEdit,
  tabSize: number,
): LineExtent {
  const offsetDelta = edit.inserted.length - (edit.to - edit.from);
  const columnAtFrom = scanColumnFromExtent(prior, before, edit.from, tabSize);
  const nextUnchangedTab = before.indexOf('\t', edit.to);
  const syncOld = nextUnchangedTab < 0 ? edit.to : nextUnchangedTab + 1;
  const syncNew = syncOld + offsetDelta;
  const oldColumnAtSync = scanColumnFromExtent(prior, before, syncOld, tabSize);
  const newColumnAtSync = scanAsciiColumns(after, edit.from, syncNew, columnAtFrom, tabSize);
  const columnDelta = newColumnAtSync - oldColumnAtSync;
  const checkpoints: VisualCheckpoint[] = [];
  for (const checkpoint of prior.checkpoints) {
    if (checkpoint.offset < edit.from) checkpoints.push(checkpoint);
    else if (checkpoint.offset >= syncOld) {
      checkpoints.push({
        offset: checkpoint.offset + offsetDelta,
        column: checkpoint.column + columnDelta,
      });
    }
  }
  checkpoints.push({ offset: edit.from, column: columnAtFrom });
  let column = columnAtFrom;
  let nextCheckpoint = edit.from + CHECKPOINT_INTERVAL;
  for (let offset = edit.from; offset < syncNew; offset += 1) {
    if (offset >= nextCheckpoint) {
      checkpoints.push({ offset, column });
      nextCheckpoint = offset + CHECKPOINT_INTERVAL;
    }
    column += after.charCodeAt(offset) === 0x09 ? tabSize - (column % tabSize) : 1;
  }
  return {
    width: prior.width + columnDelta,
    mode: 'ascii-tabs',
    checkpoints: normalizeCheckpoints(checkpoints),
  };
}

/** Shifts an independent-Unicode checkpoint suffix and rebuilds only the inserted local region. */
function updateIndependentUnicode(prior: LineExtent, before: string, edit: SingleLineEdit): LineExtent {
  const removed = before.slice(edit.from, edit.to);
  const removedWidth = independentWidth(removed);
  const insertedWidth = independentWidth(edit.inserted);
  const offsetDelta = edit.inserted.length - (edit.to - edit.from);
  const columnDelta = insertedWidth - removedWidth;
  const columnAtFrom = columnAtIndependentOffset(prior, before, edit.from);
  const checkpoints: VisualCheckpoint[] = [];
  for (const checkpoint of prior.checkpoints) {
    if (checkpoint.offset < edit.from) checkpoints.push(checkpoint);
    else if (checkpoint.offset >= edit.to) {
      checkpoints.push({
        offset: checkpoint.offset + offsetDelta,
        column: checkpoint.column + columnDelta,
      });
    }
  }
  checkpoints.push({ offset: edit.from, column: columnAtFrom });
  let insertedColumn = columnAtFrom;
  let nextCheckpoint = edit.from + CHECKPOINT_INTERVAL;
  for (let offset = 0; offset < edit.inserted.length;) {
    const absoluteOffset = edit.from + offset;
    const codePoint = edit.inserted.codePointAt(offset) ?? 0;
    if (absoluteOffset >= nextCheckpoint) {
      checkpoints.push({ offset: absoluteOffset, column: insertedColumn });
      nextCheckpoint = absoluteOffset + CHECKPOINT_INTERVAL;
    }
    insertedColumn += charWidth(codePoint, 'wcwidth');
    offset += codePoint > 0xffff ? 2 : 1;
  }
  return {
    width: prior.width + columnDelta,
    mode: 'independent-unicode',
    checkpoints: normalizeCheckpoints(checkpoints),
  };
}

/**
 * Extends complex grapheme geometry when the insertion is proven to begin a new cluster.
 *
 * Existing checkpoints remain valid because no prior grapheme can change. Insertions beginning
 * with a mark, joiner, variation selector, modifier, or regional/Jamo component use the exact
 * full-line fallback instead.
 */
function appendComplexUnicode(prior: LineExtent, sourceLength: number, inserted: string, tabSize: number): LineExtent {
  const checkpoints: VisualCheckpoint[] = [...prior.checkpoints, { offset: sourceLength, column: prior.width }];
  let column = prior.width;
  let nextCheckpoint = sourceLength + CHECKPOINT_INTERVAL;
  let lastGraphemeFrom = sourceLength;
  for (const part of visualGraphemeSegments(inserted)) {
    const offset = sourceLength + part.index;
    lastGraphemeFrom = offset;
    if (offset >= nextCheckpoint) {
      checkpoints.push({ offset, column });
      nextCheckpoint = offset + CHECKPOINT_INTERVAL;
    }
    column += part.segment === '\t' ? tabSize - (column % tabSize) : graphemeDisplayWidth(part.segment);
  }
  return {
    width: column,
    mode: 'complex',
    checkpoints: normalizeCheckpoints(checkpoints),
    lastGraphemeFrom,
  };
}

/**
 * Proves that appended text begins a new grapheme without scanning the complete prior line.
 *
 * The prior extent remembers the exact start of its final grapheme, so the shared segmenter sees
 * the complete cluster even when it contains an unbounded combining or joiner sequence.
 */
function hasIndependentAppendBoundary(prior: LineExtent, before: string, inserted: string): boolean {
  const first = inserted[Symbol.iterator]().next().value;
  if (first === undefined || dependentUnicodePattern.test(first)) return false;
  const tail = before.slice(prior.lastGraphemeFrom ?? 0);
  const boundary = tail.length;
  const segment = visualGraphemeSegments(tail + first).containing(boundary);
  return segment?.index === boundary;
}

/** Resolves a relative offset from an extent's nearest persistent checkpoint. */
function scanColumnFromExtent(extent: LineExtent, text: string, offset: number, tabSize: number): number {
  const checkpoint = checkpointAtOffset(extent.checkpoints, offset);
  return scanColumn(text, checkpoint.offset, offset, checkpoint.column, tabSize, extent.mode);
}

/** Measures an ASCII-plus-tab fragment from an existing visual column. */
function scanAsciiColumns(text: string, from: number, to: number, startingColumn: number, tabSize: number): number {
  let column = startingColumn;
  for (let offset = from; offset < to; offset += 1) {
    column += text.charCodeAt(offset) === 0x09 ? tabSize - (column % tabSize) : 1;
  }
  return column;
}

/** Returns the width of an already-classified independent-Unicode fragment. */
function independentWidth(text: string): number {
  let width = 0;
  for (const character of text) width += charWidth(character.codePointAt(0) ?? 0, 'wcwidth');
  return width;
}

/** Resolves a relative offset using the prior independent-Unicode checkpoint set. */
function columnAtIndependentOffset(extent: LineExtent, text: string, offset: number): number {
  const checkpoint = checkpointAtOffset(extent.checkpoints, offset);
  let column = checkpoint.column;
  const fragment = text.slice(checkpoint.offset, offset);
  for (const character of fragment) column += charWidth(character.codePointAt(0) ?? 0, 'wcwidth');
  return column;
}

/** Sorts, deduplicates, and freezes a shifted checkpoint set. */
function normalizeCheckpoints(checkpoints: VisualCheckpoint[]): readonly VisualCheckpoint[] {
  checkpoints.sort((left, right) => left.offset - right.offset || left.column - right.column);
  const normalized: VisualCheckpoint[] = [];
  for (const checkpoint of checkpoints) {
    const prior = normalized.at(-1);
    if (prior?.offset === checkpoint.offset) normalized[normalized.length - 1] = checkpoint;
    else normalized.push(checkpoint);
  }
  if (normalized[0]?.offset !== 0) normalized.unshift({ offset: 0, column: 0 });
  return Object.freeze(normalized);
}

/** Scans from a sparse checkpoint to a requested relative source offset. */
function scanColumn(
  text: string,
  from: number,
  to: number,
  startingColumn: number,
  tabSize: number,
  mode: LineGeometryMode,
): number {
  let column = startingColumn;
  if (mode === 'ascii-tabs') {
    for (let offset = from; offset < to; offset += 1) {
      column += text.charCodeAt(offset) === 0x09 ? tabSize - (column % tabSize) : 1;
    }
    return column;
  }
  if (mode === 'independent-unicode') {
    for (const character of text.slice(from, to)) {
      column += charWidth(character.codePointAt(0) ?? 0, 'wcwidth');
    }
    return column;
  }
  const fragment = text.slice(from, to);
  for (const part of visualGraphemeSegments(fragment)) {
    if (part.index + part.segment.length === fragment.length && endsWithUnpairedHighSurrogate(part.segment)) {
      continue;
    }
    column += part.segment === '\t' ? tabSize - (column % tabSize) : graphemeDisplayWidth(part.segment);
  }
  return column;
}

/** Scans forward from a sparse checkpoint until a requested terminal column is reached. */
function scanOffset(
  text: string,
  from: number,
  target: number,
  startingColumn: number,
  tabSize: number,
  mode: LineGeometryMode,
): number {
  let column = startingColumn;
  if (mode === 'ascii-tabs') {
    for (let offset = from; offset < text.length; offset += 1) {
      const width = text.charCodeAt(offset) === 0x09 ? tabSize - (column % tabSize) : 1;
      if (target < column + width) return offset;
      column += width;
    }
    return text.length;
  }
  if (mode === 'independent-unicode') {
    for (let offset = from; offset < text.length;) {
      const codePoint = text.codePointAt(offset) ?? 0;
      const width = charWidth(codePoint, 'wcwidth');
      if (target < column + Math.max(1, width)) return offset;
      column += width;
      offset += codePoint > 0xffff ? 2 : 1;
    }
    return text.length;
  }
  const fragment = text.slice(from);
  for (const part of visualGraphemeSegments(fragment)) {
    const width = part.segment === '\t' ? tabSize - (column % tabSize) : graphemeDisplayWidth(part.segment);
    if (target < column + Math.max(1, width)) return from + part.index;
    column += width;
  }
  return text.length;
}

/** Finds the last checkpoint at or before a relative source offset. */
function checkpointAtOffset(checkpoints: readonly VisualCheckpoint[], offset: number): VisualCheckpoint {
  return checkpointBy(checkpoints, (checkpoint) => checkpoint.offset <= offset);
}

/** Finds the last checkpoint at or before a terminal column. */
function checkpointAtColumn(checkpoints: readonly VisualCheckpoint[], column: number): VisualCheckpoint {
  return checkpointBy(checkpoints, (checkpoint) => checkpoint.column <= column);
}

/** Performs a monotonic binary search over immutable visual checkpoints. */
function checkpointBy(
  checkpoints: readonly VisualCheckpoint[],
  accepts: (checkpoint: VisualCheckpoint) => boolean,
): VisualCheckpoint {
  let low = 0;
  let high = checkpoints.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const checkpoint = checkpoints[middle];
    if (checkpoint !== undefined && accepts(checkpoint)) low = middle;
    else high = middle - 1;
  }
  return checkpoints[low] ?? { offset: 0, column: 0 };
}

/** Collects one safe same-line edit per line for persistent checkpoint updates. */
function singleLineEdits(before: DocumentStorage, changes: ChangeSet): ReadonlyMap<number, SingleLineEdit> {
  const edits = new Map<number, SingleLineEdit>();
  const invalid = new Set<number>();
  if (before.hasCarriageReturn) return edits;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted: Text) => {
    const line = before.lineAt(fromA);
    const lineNumber = Number(line.number);
    if (invalid.has(lineNumber)) return;
    if (edits.has(lineNumber) || toA > Number(line.to) || inserted.lines !== 1) {
      invalid.add(lineNumber);
      edits.delete(lineNumber);
      return;
    }
    edits.set(lineNumber, {
      from: fromA - Number(line.from),
      to: toA - Number(line.from),
      inserted: inserted.toString(),
    });
  });
  return edits;
}

/** Converts changed offsets to merged logical-line ranges in both document revisions. */
function changedLineRanges(
  before: DocumentStorage,
  after: DocumentStorage,
  changes: ChangeSet,
): readonly ChangedLineRange[] {
  const ranges: ChangedLineRange[] = [];
  changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    ranges.push({
      beforeFrom: Number(before.lineAt(fromA).number),
      beforeTo: Number(before.lineAt(toA).number),
      afterFrom: Number(after.lineAt(fromB).number),
      afterTo: Number(after.lineAt(toB).number),
    });
  }, true);
  ranges.sort((left, right) => left.beforeFrom - right.beforeFrom);
  const merged: ChangedLineRange[] = [];
  for (const range of ranges) {
    const prior = merged.at(-1);
    if (prior !== undefined && (range.beforeFrom <= prior.beforeTo + 1 || range.afterFrom <= prior.afterTo + 1)) {
      merged[merged.length - 1] = {
        beforeFrom: prior.beforeFrom,
        beforeTo: Math.max(prior.beforeTo, range.beforeTo),
        afterFrom: prior.afterFrom,
        afterTo: Math.max(prior.afterTo, range.afterTo),
      };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

/** Returns an immutable zero-width line geometry fallback. */
function emptyExtent(): LineExtent {
  return { width: 0, mode: 'printable-ascii', checkpoints: Object.freeze([]) };
}

/** Detects a UTF-16 prefix that stops between a surrogate pair. */
function endsWithUnpairedHighSurrogate(text: string): boolean {
  if (text.length === 0) return false;
  const final = text.charCodeAt(text.length - 1);
  return final >= 0xd800 && final <= 0xdbff;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
