import type { CodeEditorLanguageId } from '../index.js';
import type { DocumentLimits, ResolvedDocumentLimits } from './limits.js';
import type { DocumentSearchMatch, DocumentSearchOptions } from './search.js';
import type {
  DocumentIdentity,
  DocumentLineEnding,
  DocumentMutationResult,
  DocumentSelection,
  DocumentSelectionInput,
  DocumentSizeMode,
  DocumentSnapshot,
  DocumentTransaction,
  DocumentTransactionInput,
} from './types.js';
import { DocumentHistory } from './history.js';
import { DocumentLineExtents } from './line-extents.js';
import { resolveDocumentLimits, resolveDocumentSizeMode, utf8ByteLength } from './limits.js';
import { searchDocument } from './search.js';
import { createDocumentSnapshot, DocumentStorage } from './storage.js';
import { applyDocumentTransaction, createDocumentTransaction } from './transaction.js';
import { documentRevision, documentSelection } from './types.js';

let nextLineage = 0;

/**
 * Initial state for one in-memory code-editor document.
 */
export interface CreateDocumentModelOptions {
  readonly text: string;
  readonly uri?: string;
  readonly languageId?: CodeEditorLanguageId;
  readonly readOnly?: boolean;
  readonly tabSize?: number;
  readonly limits?: DocumentLimits;
  readonly confirmLargeDocument?: (details: LargeDocumentDetails) => boolean;
}

/**
 * Bounded metadata supplied when a document needs reduced-mode confirmation.
 */
export interface LargeDocumentDetails {
  readonly byteLength: number;
  readonly lineCount: number;
}

interface NormalizedCreateOptions {
  readonly text: string;
  readonly uri?: string;
  readonly languageId: CodeEditorLanguageId;
  readonly readOnly: boolean;
  readonly tabSize: number;
  readonly limits?: DocumentLimits;
  readonly confirmLargeDocument?: (details: LargeDocumentDetails) => boolean;
}

/**
 * Pure in-memory document model used by editor, language, and protocol layers.
 *
 * @example
 * ```ts
 * const model = createDocumentModel({ text: 'const value = 1;' });
 * ```
 */
export class CodeEditorDocumentModel {
  #storage: DocumentStorage;
  #lineage: string;
  #revision = 0;
  #selection: DocumentSelection = documentSelection({ anchor: 0, head: 0 }, 0);
  #readOnly: boolean;
  #savedStorage: DocumentStorage;
  #history: DocumentHistory;
  #sizeMode: DocumentSizeMode;
  #limits: ResolvedDocumentLimits;
  #tabSize: number;
  #uri: string | undefined;
  #languageId: CodeEditorLanguageId;
  #lineEnding: DocumentLineEnding;
  #snapshotCache: DocumentSnapshot | undefined;
  #lineExtents: DocumentLineExtents;

  public constructor(options: CreateDocumentModelOptions) {
    const normalized = normalizeCreateOptions(options);
    this.#limits = resolveDocumentLimits(normalized.limits);
    const byteLength = utf8ByteLength(normalized.text);
    const lineCount = countLogicalLines(normalized.text);
    if (byteLength > this.#limits.maxDocumentBytes) {
      throw new RangeError('Document exceeds the configured byte limit.');
    }
    if (lineCount > this.#limits.maxDocumentLines) {
      throw new RangeError('Document exceeds the configured line limit.');
    }
    this.#sizeMode = resolveDocumentSizeMode(byteLength, lineCount, this.#limits);
    confirmReducedMode(this.#sizeMode, byteLength, lineCount, normalized.confirmLargeDocument);
    this.#storage = new DocumentStorage(normalized.text, byteLength);
    this.#lineExtents = new DocumentLineExtents(this.#storage, normalized.tabSize);
    this.#lineage = createLineage();
    this.#readOnly = normalized.readOnly;
    this.#savedStorage = this.#storage;
    this.#history = new DocumentHistory(this.#limits.maxHistoryEntries, this.#limits.maxHistoryBytes);
    this.#tabSize = normalized.tabSize;
    this.#uri = normalized.uri;
    this.#languageId = this.#sizeMode === 'reduced' ? 'plain' : normalized.languageId;
    this.#lineEnding = this.#storage.lineEnding;
  }

  /** Returns the exact active source text. */
  public get text(): string {
    return this.#storage.toString();
  }

  /** Returns an immutable view of the current lineage and revision. */
  public get snapshot(): DocumentSnapshot {
    this.#snapshotCache ??= createDocumentSnapshot(this.#storage, this.#lineage, this.#revision);
    return this.#snapshotCache;
  }

  /** Returns the exact identity required by asynchronous mutation results. */
  public get identity(): DocumentIdentity {
    return Object.freeze({
      lineage: this.#lineage,
      revision: documentRevision(this.#revision),
    });
  }

  /** Returns the active single selection. */
  public get selection(): DocumentSelection {
    return this.#selection;
  }

  /** Returns the number of complete operations available to undo. */
  public get undoDepth(): number {
    return this.#history.undoDepth;
  }

  /** Returns retained undo/redo payload bytes for bounded lifecycle inspection. */
  public get retainedHistoryBytes(): number {
    return this.#history.retainedBytes;
  }

  /** Returns the number of complete operations available to redo. */
  public get redoDepth(): number {
    return this.#history.redoDepth;
  }

  /** Returns the bounded changed-content bytes retained by undo and redo entries. */
  public get historyRetainedBytes(): number {
    return this.#history.retainedBytes;
  }

  /** Reports whether exact text differs from the latest save checkpoint. */
  public get modified(): boolean {
    return !this.#storage.equals(this.#savedStorage);
  }

  /** Reports whether all mutation paths are currently disabled. */
  public get readOnly(): boolean {
    return this.#readOnly;
  }

  /** Returns the active document-size capability tier. */
  public get sizeMode(): DocumentSizeMode {
    return this.#sizeMode;
  }

  /** Returns the optional host-owned document URI. */
  public get uri(): string | undefined {
    return this.#uri;
  }

  /** Returns the explicit local language identifier. */
  public get languageId(): CodeEditorLanguageId {
    return this.#languageId;
  }

  /** Returns the observed exact source line-ending style. */
  public get lineEnding(): DocumentLineEnding {
    return this.#lineEnding;
  }

  /** Returns the validated editor tab size. */
  public get tabSize(): number {
    return this.#tabSize;
  }

  /** Returns the exact greatest terminal-cell width of any logical line. */
  public get maximumVisualColumn(): number {
    return this.#lineExtents.maximum;
  }

  /**
   * Returns the terminal column at a validated UTF-16 document offset.
   *
   * @example
   * ```ts
   * const column = document.visualColumnAt(document.selection.head);
   * ```
   */
  public visualColumnAt(offset: number): number {
    const line = this.snapshot.lineAt(offset);
    if (offset > Number(line.to)) {
      throw new RangeError('Offsets inside a line separator have no visual column.');
    }
    return this.#lineExtents.visualColumnAt(Number(line.number), offset - Number(line.from), line.text);
  }

  /**
   * Returns the document offset at a terminal column on one logical line.
   *
   * @example
   * ```ts
   * const offset = document.offsetAtVisualColumn(0, 12);
   * ```
   */
  public offsetAtVisualColumn(lineNumber: number, column: number): number {
    if (
      !Number.isSafeInteger(lineNumber) ||
      lineNumber < 0 ||
      lineNumber >= this.snapshot.lineCount ||
      !Number.isSafeInteger(column) ||
      column < 0
    ) {
      throw new RangeError('Line and visual column must be valid non-negative integers.');
    }
    const line = this.snapshot.line(lineNumber);
    return Number(line.from) + this.#lineExtents.offsetAtVisualColumn(lineNumber, column, line.text);
  }

  /**
   * Normalizes an untrusted atomic mutation request without changing document state.
   *
   * @example
   * ```ts
   * const tx = model.createTransaction({
   *   edits: [{ range: { from: 0, to: 0 }, text: 'const ' }],
   *   origin: 'typing',
   * });
   * ```
   */
  public createTransaction(transaction: DocumentTransactionInput): DocumentTransaction {
    return createDocumentTransaction(transaction, this.#limits, this.identity);
  }

  /**
   * Applies one normalized transaction or returns a typed rejection without partial mutation.
   */
  public apply(transaction: DocumentTransaction): DocumentMutationResult {
    const priorSelection = this.#selection;
    const applied = applyDocumentTransaction(
      this.#storage,
      priorSelection,
      this.identity,
      transaction,
      this.#limits,
      this.#readOnly,
    );
    if (!applied.result.accepted) {
      return applied.result;
    }
    if (
      applied.forward === undefined ||
      applied.inverse === undefined ||
      applied.beforeByteLength === undefined ||
      applied.afterByteLength === undefined ||
      applied.retainedBytes === undefined ||
      applied.beforeHasCarriageReturn === undefined ||
      applied.afterHasCarriageReturn === undefined
    ) {
      throw new Error('Accepted document transaction omitted reversible state.');
    }
    this.#lineExtents.apply(this.#storage, applied.storage, applied.forward);
    this.#storage = applied.storage;
    this.#selection = applied.selection;
    this.#revision += 1;
    this.#refreshDerivedState();
    this.#history.record({
      forward: applied.forward,
      inverse: applied.inverse,
      beforeSelection: priorSelection,
      afterSelection: this.#selection,
      beforeByteLength: applied.beforeByteLength,
      afterByteLength: applied.afterByteLength,
      retainedBytes: applied.retainedBytes,
      beforeHasCarriageReturn: applied.beforeHasCarriageReturn,
      afterHasCarriageReturn: applied.afterHasCarriageReturn,
    });
    return applied.result;
  }

  /** Restores the exact text and selection before the latest retained operation. */
  public undo(): DocumentMutationResult {
    if (this.#readOnly) {
      return { accepted: false, reason: 'read-only' };
    }
    const entry = this.#history.takeUndo();
    if (entry === undefined) {
      return { accepted: false, reason: 'history-empty' };
    }
    const storage = new DocumentStorage(
      entry.inverse.apply(this.#storage.asText()),
      entry.beforeByteLength,
      entry.beforeHasCarriageReturn,
    );
    this.#lineExtents.apply(this.#storage, storage, entry.inverse);
    this.#storage = storage;
    this.#selection = entry.beforeSelection;
    this.#revision += 1;
    this.#refreshDerivedState();
    return { accepted: true };
  }

  /** Restores the exact text and selection after the next retained operation. */
  public redo(): DocumentMutationResult {
    if (this.#readOnly) {
      return { accepted: false, reason: 'read-only' };
    }
    const entry = this.#history.takeRedo();
    if (entry === undefined) {
      return { accepted: false, reason: 'history-empty' };
    }
    const storage = new DocumentStorage(
      entry.forward.apply(this.#storage.asText()),
      entry.afterByteLength,
      entry.afterHasCarriageReturn,
    );
    this.#lineExtents.apply(this.#storage, storage, entry.forward);
    this.#storage = storage;
    this.#selection = entry.afterSelection;
    this.#revision += 1;
    this.#refreshDerivedState();
    return { accepted: true };
  }

  /** Replaces every document-scoped value and starts a new revision lineage. */
  public replaceDocument(options: CreateDocumentModelOptions): void {
    const replacement = new CodeEditorDocumentModel(options);
    this.#storage = replacement.#storage;
    this.#lineage = replacement.#lineage;
    this.#revision = 0;
    this.#selection = replacement.#selection;
    this.#readOnly = replacement.#readOnly;
    this.#savedStorage = replacement.#savedStorage;
    this.#history = replacement.#history;
    this.#sizeMode = replacement.#sizeMode;
    this.#limits = replacement.#limits;
    this.#tabSize = replacement.#tabSize;
    this.#uri = replacement.#uri;
    this.#languageId = replacement.#languageId;
    this.#lineEnding = replacement.#lineEnding;
    this.#lineExtents = replacement.#lineExtents;
    this.#snapshotCache = undefined;
  }

  /** Enables or disables the centralized mutation boundary without changing editor state. */
  public setReadOnly(readOnly: boolean): void {
    if (typeof readOnly !== 'boolean') {
      throw new TypeError('Read-only state must be a boolean.');
    }
    this.#readOnly = readOnly;
  }

  /** Changes the active selection without creating a text revision or history entry. */
  public setSelection(selection: DocumentSelectionInput): void {
    const anchor = selection.anchor;
    const head = selection.head;
    this.#selection = documentSelection({ anchor, head }, this.#storage.length);
  }

  /** Marks the current exact text as the host's latest successful save. */
  public markSaved(): void {
    this.#savedStorage = this.#storage;
  }

  /** Releases retained undo and redo resources while preserving the active source text. */
  public releaseRetainedResources(): void {
    this.#history.clear();
  }

  /** Applies a controller-owned safety policy before interactive editing begins. */
  public configureSafetyLimits(limits: DocumentLimits): void {
    if (this.#history.undoDepth > 0 || this.#history.redoDepth > 0) {
      throw new Error('Document safety limits must be configured before editing begins.');
    }
    const resolved = resolveDocumentLimits(limits);
    if (this.#storage.byteLength > resolved.maxDocumentBytes || this.#storage.lineCount > resolved.maxDocumentLines) {
      throw new RangeError('Document exceeds the controller safety policy.');
    }
    this.#limits = resolved;
    this.#history = new DocumentHistory(resolved.maxHistoryEntries, resolved.maxHistoryBytes);
    this.#refreshDerivedState();
  }

  /** Finds bounded literal matches without changing revision, selection, or history. */
  public search(query: string, options?: DocumentSearchOptions): readonly DocumentSearchMatch[] {
    return searchDocument(this.snapshot, query, options);
  }

  #refreshDerivedState(): void {
    this.#sizeMode = resolveDocumentSizeMode(this.#storage.byteLength, this.#storage.lineCount, this.#limits);
    this.#lineEnding = this.#storage.lineEnding;
    this.#snapshotCache = undefined;
  }
}

/**
 * Creates one isolated in-memory document model.
 *
 * @example
 * ```ts
 * const model = createDocumentModel({ text: 'select 1;', languageId: 'postgresql' });
 * ```
 */
export function createDocumentModel(options: CreateDocumentModelOptions): CodeEditorDocumentModel {
  return new CodeEditorDocumentModel(options);
}

function normalizeCreateOptions(options: CreateDocumentModelOptions): NormalizedCreateOptions {
  try {
    const text = options.text;
    const uri = options.uri;
    const languageId = options.languageId ?? 'plain';
    const readOnly = options.readOnly ?? false;
    const tabSize = options.tabSize ?? 4;
    const limits = options.limits;
    const confirmLargeDocument = options.confirmLargeDocument;
    if (typeof text !== 'string') {
      throw new TypeError('Document text must be a string.');
    }
    if (uri !== undefined && typeof uri !== 'string') {
      throw new TypeError('Document URI must be a string.');
    }
    if (!isLanguageId(languageId)) {
      throw new TypeError('Document language identifier is not supported.');
    }
    if (typeof readOnly !== 'boolean') {
      throw new TypeError('Read-only state must be a boolean.');
    }
    if (confirmLargeDocument !== undefined && typeof confirmLargeDocument !== 'function') {
      throw new TypeError('Large-document confirmation must be a function.');
    }
    return Object.freeze({
      text,
      uri,
      languageId,
      readOnly,
      tabSize: validateTabSize(tabSize),
      limits,
      confirmLargeDocument,
    });
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      throw error;
    }
    throw new TypeError('Document options could not be read safely.');
  }
}

function validateTabSize(tabSize: number): number {
  if (!Number.isSafeInteger(tabSize) || tabSize < 1 || tabSize > 32) {
    throw new RangeError('Tab size must be an integer from 1 through 32.');
  }
  return tabSize;
}

function confirmReducedMode(
  mode: DocumentSizeMode,
  byteLength: number,
  lineCount: number,
  confirmation: NormalizedCreateOptions['confirmLargeDocument'],
): void {
  if (mode !== 'reduced') {
    return;
  }
  if (confirmation === undefined || confirmation(Object.freeze({ byteLength, lineCount })) !== true) {
    throw new RangeError('Documents above 10 MiB require explicit confirmation.');
  }
}

function createLineage(): string {
  nextLineage += 1;
  return `document-${nextLineage}`;
}

function countLogicalLines(text: string): number {
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x0a) {
      lines += 1;
    } else if (text.charCodeAt(index) === 0x0d) {
      lines += 1;
      if (text.charCodeAt(index + 1) === 0x0a) {
        index += 1;
      }
    }
  }
  return lines;
}

function isLanguageId(value: string): value is CodeEditorLanguageId {
  return value === 'plain' || value === 'javascript' || value === 'typescript' || value === 'postgresql';
}
