import type { DocumentSizeMode } from './types.js';
import { HARD_CODE_EDITOR_LIMITS } from '../limits.js';

const MEBIBYTE = 1_048_576;

/**
 * Host-configurable document limits. Values may only lower immutable safety ceilings.
 */
export interface DocumentLimits {
  readonly maxDocumentBytes?: number;
  readonly maxEditsPerTransaction?: number;
  readonly maxHistoryEntries?: number;
  readonly maxHistoryBytes?: number;
  readonly maxReplacementBytes?: number;
  readonly maxDocumentLines?: number;
}

/**
 * Fully validated limits used by the document engine.
 */
export interface ResolvedDocumentLimits {
  readonly maxDocumentBytes: number;
  readonly maxEditsPerTransaction: number;
  readonly maxHistoryEntries: number;
  readonly maxHistoryBytes: number;
  readonly maxReplacementBytes: number;
  readonly maxDocumentLines: number;
  readonly fullFeatureBytes: number;
  readonly fullFeatureLines: number;
  readonly reducedModeBytes: number;
}

const HARD_MAX_DOCUMENT_BYTES = HARD_CODE_EDITOR_LIMITS.documentBytes;
const HARD_MAX_EDITS_PER_TRANSACTION = HARD_CODE_EDITOR_LIMITS.editsPerTransaction;
const HARD_MAX_HISTORY_ENTRIES = HARD_CODE_EDITOR_LIMITS.historyEntries;
const HARD_MAX_HISTORY_BYTES = HARD_CODE_EDITOR_LIMITS.historyBytes;
const HARD_MAX_REPLACEMENT_BYTES = HARD_CODE_EDITOR_LIMITS.replacementBytes;
const HARD_MAX_DOCUMENT_LINES = HARD_CODE_EDITOR_LIMITS.documentLines;

/**
 * Resolves optional host limits against immutable safety ceilings.
 *
 * @example
 * ```ts
 * const limits = resolveDocumentLimits({ maxHistoryEntries: 100 });
 * ```
 */
export function resolveDocumentLimits(limits: DocumentLimits = {}): ResolvedDocumentLimits {
  return Object.freeze({
    maxDocumentBytes: boundedLimit(limits.maxDocumentBytes, HARD_MAX_DOCUMENT_BYTES, 'Maximum document bytes'),
    maxEditsPerTransaction: boundedLimit(
      limits.maxEditsPerTransaction,
      HARD_MAX_EDITS_PER_TRANSACTION,
      'Maximum edits per transaction',
    ),
    maxHistoryEntries: boundedLimit(
      limits.maxHistoryEntries,
      1_000,
      'Maximum history entries',
      HARD_MAX_HISTORY_ENTRIES,
    ),
    maxHistoryBytes: boundedLimit(
      limits.maxHistoryBytes,
      16 * MEBIBYTE,
      'Maximum retained history bytes',
      HARD_MAX_HISTORY_BYTES,
    ),
    maxReplacementBytes: boundedLimit(
      limits.maxReplacementBytes,
      MEBIBYTE,
      'Maximum replacement bytes',
      HARD_MAX_REPLACEMENT_BYTES,
    ),
    maxDocumentLines: boundedLimit(limits.maxDocumentLines, HARD_MAX_DOCUMENT_LINES, 'Maximum document lines'),
    fullFeatureBytes: MEBIBYTE,
    fullFeatureLines: 50_000,
    reducedModeBytes: 10 * MEBIBYTE,
  });
}

/**
 * Selects the feature tier without changing document content.
 */
export function resolveDocumentSizeMode(
  byteLength: number,
  lineCount: number,
  limits: ResolvedDocumentLimits,
): DocumentSizeMode {
  if (byteLength > limits.reducedModeBytes) {
    return 'reduced';
  }
  if (byteLength > limits.fullFeatureBytes || lineCount > limits.fullFeatureLines) {
    return 'bounded';
  }
  return 'full';
}

/**
 * Counts UTF-8 bytes without allocating an encoded copy of hostile or oversized text.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < text.length) {
      const following = text.charCodeAt(index + 1);
      if (following >= 0xdc00 && following <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function boundedLimit(value: number | undefined, fallback: number, label: string, hardMaximum = fallback): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > hardMaximum) {
    throw new RangeError(`${label} must be an integer from 1 through ${hardMaximum}.`);
  }
  return resolved;
}
