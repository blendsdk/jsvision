import type { CodeEditorLanguageId } from '../index.js';
import type { DocumentLimits, ResolvedDocumentLimits } from './limits.js';
import type {
  DocumentIdentity,
  DocumentMutationResult,
  DocumentSelection,
  DocumentSizeMode,
  DocumentSnapshot,
  DocumentTransaction,
} from './types.js';
import type { DocumentSearchMatch, DocumentSearchOptions } from './search.js';
import { DocumentHistory } from './history.js';
import { resolveDocumentLimits, resolveDocumentSizeMode, utf8ByteLength } from './limits.js';
import { searchDocument } from './search.js';
import { createDocumentSnapshot, DocumentStorage } from './storage.js';
import { applyDocumentTransaction, createDocumentTransaction } from './transaction.js';

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
  #selection: DocumentSelection = Object.freeze({ anchor: 0, head: 0 });
  #readOnly: boolean;
  #savedText: string;
  #history: DocumentHistory;
  #sizeMode: DocumentSizeMode;
  readonly #limits: ResolvedDocumentLimits;
  readonly #tabSize: number;
  #uri: string | undefined;
  #languageId: CodeEditorLanguageId;

  public constructor(options: CreateDocumentModelOptions) {
    validateText(options.text);
    this.#limits = resolveDocumentLimits(options.limits);
    this.#storage = new DocumentStorage(options.text);
    const byteLength = utf8ByteLength(options.text);
    if (byteLength > this.#limits.maxDocumentBytes) {
      throw new RangeError('Document exceeds the configured byte limit.');
    }
    this.#sizeMode = resolveDocumentSizeMode(byteLength, this.#storage.lineCount, this.#limits);
    confirmReducedMode(this.#sizeMode, byteLength, this.#storage.lineCount, options.confirmLargeDocument);
    this.#lineage = createLineage();
    this.#readOnly = options.readOnly ?? false;
    this.#savedText = options.text;
    this.#history = new DocumentHistory(this.#limits.maxHistoryEntries);
    this.#tabSize = validateTabSize(options.tabSize ?? 4);
    this.#uri = options.uri;
    this.#languageId = this.#sizeMode === 'reduced' ? 'plain' : (options.languageId ?? 'plain');
  }

  public get text(): string {
    return this.#storage.toString();
  }

  public get snapshot(): DocumentSnapshot {
    return createDocumentSnapshot(this.#storage, this.#lineage, this.#revision);
  }

  public get identity(): DocumentIdentity {
    return Object.freeze({ lineage: this.#lineage, revision: this.#revision });
  }

  public get selection(): DocumentSelection {
    return this.#selection;
  }

  public get undoDepth(): number {
    return this.#history.undoDepth;
  }

  public get redoDepth(): number {
    return this.#history.redoDepth;
  }

  public get modified(): boolean {
    return this.text !== this.#savedText;
  }

  public get readOnly(): boolean {
    return this.#readOnly;
  }

  public get sizeMode(): DocumentSizeMode {
    return this.#sizeMode;
  }

  public get uri(): string | undefined {
    return this.#uri;
  }

  public get languageId(): CodeEditorLanguageId {
    return this.#languageId;
  }

  public get tabSize(): number {
    return this.#tabSize;
  }

  public createTransaction(
    transaction: Omit<DocumentTransaction, 'base'> & { readonly base?: DocumentIdentity },
  ): DocumentTransaction {
    return createDocumentTransaction({
      ...transaction,
      base: transaction.base ?? this.identity,
    });
  }

  public apply(transaction: DocumentTransaction): DocumentMutationResult {
    const priorStorage = this.#storage;
    const priorSelection = this.#selection;
    const applied = applyDocumentTransaction(
      priorStorage,
      priorSelection,
      this.identity,
      transaction,
      this.#limits,
      this.#readOnly,
    );
    if (!applied.result.accepted) {
      return applied.result;
    }
    this.#storage = applied.storage;
    this.#selection = applied.selection;
    this.#revision += 1;
    this.#sizeMode = resolveDocumentSizeMode(utf8ByteLength(this.text), this.#storage.lineCount, this.#limits);
    this.#history.record({
      beforeStorage: priorStorage,
      beforeSelection: priorSelection,
      afterStorage: this.#storage,
      afterSelection: this.#selection,
    });
    return applied.result;
  }

  public undo(): DocumentMutationResult {
    if (this.#readOnly) {
      return { accepted: false, reason: 'read-only' };
    }
    const entry = this.#history.takeUndo();
    if (entry === undefined) {
      return { accepted: false, reason: 'history-empty' };
    }
    this.#storage = entry.beforeStorage;
    this.#selection = entry.beforeSelection;
    this.#revision += 1;
    this.#refreshSizeMode();
    return { accepted: true };
  }

  public redo(): DocumentMutationResult {
    if (this.#readOnly) {
      return { accepted: false, reason: 'read-only' };
    }
    const entry = this.#history.takeRedo();
    if (entry === undefined) {
      return { accepted: false, reason: 'history-empty' };
    }
    this.#storage = entry.afterStorage;
    this.#selection = entry.afterSelection;
    this.#revision += 1;
    this.#refreshSizeMode();
    return { accepted: true };
  }

  public replaceDocument(options: CreateDocumentModelOptions): void {
    const replacement = new CodeEditorDocumentModel(options);
    this.#storage = replacement.#storage;
    this.#lineage = replacement.#lineage;
    this.#revision = 0;
    this.#selection = replacement.#selection;
    this.#readOnly = replacement.#readOnly;
    this.#savedText = replacement.#savedText;
    this.#history = replacement.#history;
    this.#sizeMode = replacement.#sizeMode;
    this.#uri = replacement.#uri;
    this.#languageId = replacement.#languageId;
  }

  public setReadOnly(readOnly: boolean): void {
    this.#readOnly = readOnly;
  }

  public markSaved(): void {
    this.#savedText = this.text;
  }

  public search(query: string, options?: DocumentSearchOptions): readonly DocumentSearchMatch[] {
    return searchDocument(this.snapshot, query, options);
  }

  #refreshSizeMode(): void {
    this.#sizeMode = resolveDocumentSizeMode(utf8ByteLength(this.text), this.#storage.lineCount, this.#limits);
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

function validateText(text: string): void {
  if (typeof text !== 'string') {
    throw new TypeError('Document text must be a string.');
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
  confirmation: CreateDocumentModelOptions['confirmLargeDocument'],
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
