/**
 * Identifies one exact revision within a document lineage.
 *
 * @example
 * ```ts
 * const identity: DocumentIdentity = { lineage: 'document-1', revision: 0 };
 * ```
 */
export interface DocumentIdentity {
  readonly lineage: string;
  readonly revision: number;
}

/**
 * Describes a zero-based UTF-16 line and character position.
 *
 * @example
 * ```ts
 * const position: DocumentPosition = { line: 2, character: 4 };
 * ```
 */
export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

/**
 * Describes the active single selection using UTF-16 document offsets.
 *
 * @example
 * ```ts
 * const selection: DocumentSelection = { anchor: 3, head: 8 };
 * ```
 */
export interface DocumentSelection {
  readonly anchor: number;
  readonly head: number;
}

/**
 * Describes one replacement range in UTF-16 document offsets.
 *
 * @example
 * ```ts
 * const edit: DocumentEdit = { range: { from: 0, to: 3 }, text: 'let' };
 * ```
 */
export interface DocumentEdit {
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
  readonly base: DocumentIdentity;
  readonly edits: readonly DocumentEdit[];
  readonly selection?: DocumentSelection;
  readonly origin: EditOrigin;
}

/**
 * Describes a logical line without its line separator.
 */
export interface LogicalLine {
  readonly number: number;
  readonly from: number;
  readonly to: number;
  readonly length: number;
  readonly text: string;
}

/**
 * Provides an immutable view of one exact document revision.
 */
export interface DocumentSnapshot {
  readonly lineage: string;
  readonly revision: number;
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
export function isDocumentSelection(value: DocumentSelection, length: number): boolean {
  return (
    isDocumentCoordinate(value.anchor) &&
    isDocumentCoordinate(value.head) &&
    value.anchor <= length &&
    value.head <= length
  );
}
