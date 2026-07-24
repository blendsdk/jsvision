import { Text } from '@codemirror/state';

import type { DocumentSnapshot, LogicalLine } from './types.js';
import { isDocumentCoordinate } from './types.js';

/**
 * Internal immutable text storage backed by CodeMirror's headless text tree.
 */
export class DocumentStorage {
  readonly #text: Text;

  public constructor(text: string | Text) {
    this.#text = typeof text === 'string' ? Text.of(text.split('\n')) : text;
  }

  public get length(): number {
    return this.#text.length;
  }

  public get lineCount(): number {
    return this.#text.lines;
  }

  public slice(from: number, to: number = this.length): string {
    validateRange(from, to, this.length);
    return this.#text.sliceString(from, to);
  }

  public lineAt(offset: number): LogicalLine {
    validateOffset(offset, this.length);
    return toLogicalLine(this.#text.lineAt(offset));
  }

  public line(line: number): LogicalLine {
    if (!isDocumentCoordinate(line) || line >= this.lineCount) {
      throw new RangeError('Document line is outside the snapshot.');
    }
    return toLogicalLine(this.#text.line(line + 1));
  }

  public replace(from: number, to: number, text: string): DocumentStorage {
    validateRange(from, to, this.length);
    return new DocumentStorage(this.#text.replace(from, to, Text.of(text.split('\n'))));
  }

  /**
   * Provides the immutable backing value to sibling document-engine modules.
   */
  public asText(): Text {
    return this.#text;
  }

  public toString(): string {
    return this.#text.toString();
  }
}

/**
 * Creates a frozen snapshot over immutable storage.
 */
export function createDocumentSnapshot(storage: DocumentStorage, lineage: string, revision: number): DocumentSnapshot {
  return Object.freeze({
    lineage,
    revision,
    length: storage.length,
    lineCount: storage.lineCount,
    slice: (from: number, to?: number) => storage.slice(from, to),
    lineAt: (offset: number) => storage.lineAt(offset),
    line: (line: number) => storage.line(line),
  });
}

function validateOffset(offset: number, length: number): void {
  if (!isDocumentCoordinate(offset) || offset > length) {
    throw new RangeError('Document offset is outside the snapshot.');
  }
}

function validateRange(from: number, to: number, length: number): void {
  validateOffset(from, length);
  validateOffset(to, length);
  if (from > to) {
    throw new RangeError('Document range is reversed.');
  }
}

function toLogicalLine(line: {
  readonly number: number;
  readonly from: number;
  readonly to: number;
  readonly text: string;
}): LogicalLine {
  const text = line.text.endsWith('\r') ? line.text.slice(0, -1) : line.text;
  const to = line.from + text.length;
  return {
    number: line.number - 1,
    from: line.from,
    to,
    length: text.length,
    text,
  };
}
