declare const documentOffsetBrand: unique symbol;
declare const documentRevisionBrand: unique symbol;
declare const documentLineBrand: unique symbol;
declare const documentCharacterBrand: unique symbol;
declare const visualColumnBrand: unique symbol;

/** A validated UTF-16 offset into one document snapshot. */
export type DocumentOffset = number & { readonly [documentOffsetBrand]: true };

/** A validated monotonic revision within one document lineage. */
export type DocumentRevision = number & { readonly [documentRevisionBrand]: true };

/** A validated zero-based logical line number. */
export type DocumentLine = number & { readonly [documentLineBrand]: true };

/** A validated zero-based UTF-16 character within a logical line. */
export type DocumentCharacter = number & { readonly [documentCharacterBrand]: true };

/** A validated terminal cell column. */
export type VisualColumn = number & { readonly [visualColumnBrand]: true };

/**
 * Identifies one exact revision within a document lineage.
 */
export interface DocumentIdentity {
  readonly lineage: string;
  readonly revision: DocumentRevision;
}

/**
 * Describes a zero-based UTF-16 line and character position.
 *
 * @example
 * ```ts
 * const position: DocumentPosition = {
 *   line: documentLine(2),
 *   character: documentCharacter(4),
 * };
 * ```
 */
export interface DocumentPosition {
  readonly line: DocumentLine;
  readonly character: DocumentCharacter;
}

/** Untrusted line and character input accepted at a conversion boundary. */
export interface DocumentPositionInput {
  readonly line: number;
  readonly character: number;
}

/**
 * Describes the active single selection using UTF-16 document offsets.
 *
 * @example
 * ```ts
 * const selection = documentSelection({ anchor: 3, head: 8 }, documentLength);
 * ```
 */
export interface DocumentSelection {
  readonly anchor: DocumentOffset;
  readonly head: DocumentOffset;
}

/**
 * Describes one replacement range in UTF-16 document offsets.
 *
 * @example
 * ```ts
 * const edit: DocumentEdit = {
 *   range: { from: documentOffset(0), to: documentOffset(3) },
 *   text: 'let',
 * };
 * ```
 */
export interface DocumentEdit {
  readonly range: {
    readonly from: DocumentOffset;
    readonly to: DocumentOffset;
  };
  readonly text: string;
}

/** Untrusted selection input accepted at the public normalization boundary. */
export interface DocumentSelectionInput {
  readonly anchor: number;
  readonly head: number;
}

/** Untrusted edit input accepted at the public normalization boundary. */
export interface DocumentEditInput {
  readonly range: {
    readonly from: number;
    readonly to: number;
  };
  readonly text: string;
}

/**
 * Identifies the source of one logical editing operation.
 */
export type EditOrigin = 'typing' | 'completion' | 'snippet' | 'format' | 'external' | 'search';

/**
 * A complete set of edits that must either all apply or all be rejected.
 */
export interface DocumentTransaction {
  readonly kind: 'document-transaction';
}

/** Untrusted values used to request one normalized atomic transaction. */
export interface DocumentTransactionInput {
  readonly base?: DocumentIdentity;
  readonly edits: readonly DocumentEditInput[];
  readonly selection?: DocumentSelectionInput;
  readonly origin: EditOrigin;
}

/**
 * Describes a logical line without its line separator.
 */
export interface LogicalLine {
  readonly number: DocumentLine;
  readonly from: DocumentOffset;
  readonly to: DocumentOffset;
  readonly length: number;
  readonly text: string;
}

/**
 * Provides an immutable view of one exact document revision.
 */
export interface DocumentSnapshot {
  readonly lineage: string;
  readonly revision: DocumentRevision;
  readonly length: number;
  readonly lineCount: number;
  slice(from: number, to?: number): string;
  lineAt(offset: number): LogicalLine;
  line(line: number): LogicalLine;
}

/**
 * Reports the result of a mutation request without throwing for untrusted edits.
 */
export type DocumentMutationResult =
  { readonly accepted: true } | { readonly accepted: false; readonly reason: DocumentRejectionReason };

/**
 * Stable rejection categories suitable for command availability and diagnostics.
 */
export type DocumentRejectionReason =
  | 'read-only'
  | 'invalid-edit'
  | 'invalid-selection'
  | 'stale'
  | 'foreign-lineage'
  | 'overlap'
  | 'edit-limit'
  | 'document-limit'
  | 'history-empty';

/**
 * Controls the local feature tier selected from document size.
 */
export type DocumentSizeMode = 'full' | 'bounded' | 'reduced';

/**
 * Describes the line separators observed in exact document text.
 */
export type DocumentLineEnding = 'none' | 'lf' | 'crlf' | 'cr' | 'mixed';

/**
 * Creates an immutable copy of a document identity.
 */
export function copyIdentity(identity: DocumentIdentity): DocumentIdentity {
  return { lineage: identity.lineage, revision: identity.revision };
}

/**
 * Returns whether a number is a safe, non-negative integer document coordinate.
 */
export function isDocumentCoordinate(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validates one selection against a document length.
 */
export function isDocumentSelection(value: DocumentSelectionInput, length: number): boolean {
  return (
    isDocumentCoordinate(value.anchor) &&
    isDocumentCoordinate(value.head) &&
    value.anchor <= length &&
    value.head <= length
  );
}

/**
 * Creates a trusted document offset after validating its numeric domain and optional bound.
 *
 * @example
 * ```ts
 * const start = documentOffset(0, snapshot.length);
 * ```
 */
export function documentOffset(value: number, maximum = Number.MAX_SAFE_INTEGER): DocumentOffset {
  if (!isDocumentCoordinate(value) || value > maximum) {
    throw new RangeError('Document offset is outside the allowed range.');
  }
  return value as DocumentOffset;
}

/**
 * Creates a trusted document revision.
 *
 * @example
 * ```ts
 * const initialRevision = documentRevision(0);
 * ```
 */
export function documentRevision(value: number): DocumentRevision {
  if (!isDocumentCoordinate(value)) {
    throw new RangeError('Document revision must be a non-negative safe integer.');
  }
  return value as DocumentRevision;
}

/**
 * Creates a trusted logical line number.
 *
 * @example
 * ```ts
 * const firstLine = documentLine(0);
 * ```
 */
export function documentLine(value: number): DocumentLine {
  if (!isDocumentCoordinate(value)) {
    throw new RangeError('Document line must be a non-negative safe integer.');
  }
  return value as DocumentLine;
}

/**
 * Creates a trusted UTF-16 character position.
 *
 * @example
 * ```ts
 * const lineStart = documentCharacter(0);
 * ```
 */
export function documentCharacter(value: number): DocumentCharacter {
  if (!isDocumentCoordinate(value)) {
    throw new RangeError('Document character must be a non-negative safe integer.');
  }
  return value as DocumentCharacter;
}

/**
 * Creates a trusted visual cell column.
 *
 * @example
 * ```ts
 * const firstColumn = visualColumn(0);
 * ```
 */
export function visualColumn(value: number): VisualColumn {
  if (!isDocumentCoordinate(value)) {
    throw new RangeError('Visual column must be a non-negative safe integer.');
  }
  return value as VisualColumn;
}

/**
 * Normalizes a public selection input into trusted document offsets.
 *
 * @example
 * ```ts
 * const caret = documentSelection({ anchor: 2, head: 2 }, snapshot.length);
 * ```
 */
export function documentSelection(value: DocumentSelectionInput, length: number): DocumentSelection {
  if (!isDocumentSelection(value, length)) {
    throw new RangeError('Selection is outside the active document.');
  }
  return Object.freeze({
    anchor: documentOffset(value.anchor, length),
    head: documentOffset(value.head, length),
  });
}
