import { Text } from '@codemirror/state';

import type { DocumentLineEnding, DocumentSnapshot, LogicalLine } from './types.js';
import { documentLine, documentOffset, documentRevision, isDocumentCoordinate } from './types.js';
import { utf8ByteLength } from './limits.js';

/**
 * Internal immutable text storage backed by CodeMirror's headless text tree.
 */
export class DocumentStorage {
  readonly #text: Text;
  readonly #byteLength: number;
  readonly #carriageReturnLines: readonly LogicalLine[] | undefined;
  readonly #lineEnding: DocumentLineEnding;

  public constructor(text: string | Text, byteLength?: number, mayContainCarriageReturn = false) {
    this.#text = typeof text === 'string' ? Text.of(text.split('\n')) : text;
    this.#byteLength = byteLength ?? utf8ByteLength(typeof text === 'string' ? text : text.toString());
    const source =
      typeof text === 'string'
        ? text.includes('\r')
          ? text
          : undefined
        : mayContainCarriageReturn
          ? text.toString()
          : undefined;
    this.#carriageReturnLines = source !== undefined && source.includes('\r') ? buildLogicalLines(source) : undefined;
    this.#lineEnding = source === undefined ? (this.#text.lines > 1 ? 'lf' : 'none') : detectLineEnding(source);
  }

  public get length(): number {
    return this.#text.length;
  }

  public get lineCount(): number {
    return this.#carriageReturnLines?.length ?? this.#text.lines;
  }

  public get byteLength(): number {
    return this.#byteLength;
  }

  public get hasCarriageReturn(): boolean {
    return this.#carriageReturnLines !== undefined;
  }

  public get lineEnding(): DocumentLineEnding {
    return this.#lineEnding;
  }

  public slice(from: number, to: number = this.length): string {
    validateRange(from, to, this.length);
    return this.#text.sliceString(from, to);
  }

  public lineAt(offset: number): LogicalLine {
    validateOffset(offset, this.length);
    if (this.#carriageReturnLines !== undefined) {
      return lineAtOffset(this.#carriageReturnLines, offset);
    }
    return toLogicalLine(this.#text.lineAt(offset));
  }

  public line(line: number): LogicalLine {
    if (!isDocumentCoordinate(line) || line >= this.lineCount) {
      throw new RangeError('Document line is outside the snapshot.');
    }
    if (this.#carriageReturnLines !== undefined) {
      return this.#carriageReturnLines[line] as LogicalLine;
    }
    return toLogicalLine(this.#text.line(line + 1));
  }

  /**
   * Provides the immutable backing value to sibling document-engine modules.
   */
  public asText(): Text {
    return this.#text;
  }

  public equals(other: DocumentStorage): boolean {
    return this.#text.eq(other.#text);
  }

  public toString(): string {
    return this.#text.toString();
  }
}

function buildLogicalLines(text: string): readonly LogicalLine[] {
  const lines: LogicalLine[] = [];
  let from = 0;
  let number = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit !== 0x0a && codeUnit !== 0x0d) {
      continue;
    }
    lines.push(createLogicalLine(number, from, index, text.slice(from, index)));
    number += 1;
    if (codeUnit === 0x0d && text.charCodeAt(index + 1) === 0x0a) {
      index += 1;
    }
    from = index + 1;
  }
  lines.push(createLogicalLine(number, from, text.length, text.slice(from)));
  return Object.freeze(lines);
}

function createLogicalLine(number: number, from: number, to: number, text: string): LogicalLine {
  return Object.freeze({
    number: documentLine(number),
    from: documentOffset(from),
    to: documentOffset(to),
    length: to - from,
    text,
  });
}

function lineAtOffset(lines: readonly LogicalLine[], offset: number): LogicalLine {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lines[middle]?.from ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return lines[low] as LogicalLine;
}

function detectLineEnding(text: string): DocumentLineEnding {
  const hasCrLf = text.includes('\r\n');
  const withoutCrLf = hasCrLf ? text.replaceAll('\r\n', '') : text;
  const hasLf = withoutCrLf.includes('\n');
  const hasCr = withoutCrLf.includes('\r');
  if ((hasCrLf && (hasLf || hasCr)) || (hasLf && hasCr)) {
    return 'mixed';
  }
  if (hasCrLf) {
    return 'crlf';
  }
  if (hasLf) {
    return 'lf';
  }
  return hasCr ? 'cr' : 'none';
}

/**
 * Creates a frozen snapshot over immutable storage.
 */
export function createDocumentSnapshot(storage: DocumentStorage, lineage: string, revision: number): DocumentSnapshot {
  return Object.freeze({
    lineage,
    revision: documentRevision(revision),
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
    number: documentLine(line.number - 1),
    from: documentOffset(line.from),
    to: documentOffset(to),
    length: text.length,
    text,
  };
}
