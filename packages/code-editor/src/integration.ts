import type { CodeEditorDocumentModel } from './document/model.js';
import type {
  DocumentEditInput,
  DocumentIdentity,
  DocumentMutationResult,
  DocumentSelectionInput,
  EditOrigin,
} from './document/types.js';
import { documentRevision } from './document/types.js';

/** A small lifecycle handle used by editor-owned subscriptions and bindings. */
export interface CodeEditorDisposable {
  /** Releases the associated listener or binding. Calling this more than once is safe. */
  dispose(): void;
}

/** One validated logical document mutation submitted to the controller boundary. */
export interface CodeEditorMutationInput {
  /** Exact document identity required for stale-result rejection. */
  readonly base?: DocumentIdentity;
  /** Non-empty atomic replacement list in UTF-16 document offsets. */
  readonly edits: readonly DocumentEditInput[];
  /** Optional selection installed after every edit succeeds. */
  readonly selection?: DocumentSelectionInput;
  /** Durable source used by history, observability, and host integrations. */
  readonly origin: EditOrigin;
}

/**
 * A single-owner mutation adapter used by a language-service coordinator.
 *
 * The document identity is part of the adapter so a coordinator cannot accidentally bind to a
 * controller for another document.
 */
export interface CodeEditorMutationSink {
  /** Exact model owned by this sink. */
  readonly document: CodeEditorDocumentModel;
  /** Applies one normalized mutation or returns a typed inert rejection. */
  apply(input: CodeEditorMutationInput): DocumentMutationResult;
}

/**
 * Snapshots an untrusted mutation without invoking host accessors.
 *
 * @param input - Public mutation-shaped input to inspect.
 * @param maximumEdits - Maximum number of edits retained in the snapshot.
 * @returns A detached immutable mutation, or `undefined` when any field is unsafe.
 *
 * @example
 * ```ts
 * const safe = snapshotCodeEditorMutationInput(input, 100);
 * ```
 */
export function snapshotCodeEditorMutationInput(
  input: CodeEditorMutationInput,
  maximumEdits: number,
): CodeEditorMutationInput | undefined {
  try {
    if (!Number.isSafeInteger(maximumEdits) || maximumEdits < 1) return undefined;
    const editsValue = ownData(input, 'edits');
    const length = ownData(editsValue, 'length');
    const origin = ownData(input, 'origin');
    if (
      !Array.isArray(editsValue) ||
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > maximumEdits
    ) {
      return undefined;
    }
    if (!isEditOrigin(origin)) return undefined;
    const edits: DocumentEditInput[] = [];
    for (let index = 0; index < length; index += 1) {
      const edit = ownData(editsValue, String(index));
      const range = ownData(edit, 'range');
      const from = ownData(range, 'from');
      const to = ownData(range, 'to');
      const text = ownData(edit, 'text');
      if (!isCoordinate(from) || !isCoordinate(to) || from > to || typeof text !== 'string') return undefined;
      edits.push(Object.freeze({ range: Object.freeze({ from, to }), text }));
    }
    const baseValue = ownData(input, 'base');
    const base = baseValue === undefined ? undefined : snapshotIdentity(baseValue);
    if (baseValue !== undefined && base === undefined) return undefined;
    const selectionValue = ownData(input, 'selection');
    const selection = selectionValue === undefined ? undefined : snapshotSelection(selectionValue);
    if (selectionValue !== undefined && selection === undefined) return undefined;
    return Object.freeze({
      ...(base === undefined ? {} : { base }),
      edits: Object.freeze(edits),
      ...(selection === undefined ? {} : { selection }),
      origin,
    });
  } catch {
    return undefined;
  }
}

/**
 * Applies one mutation directly when no controller has claimed the coordinator.
 *
 * @param document - Exact model that receives the transaction.
 * @param input - Mutation request to validate and apply.
 * @returns The accepted result or a typed inert rejection.
 *
 * @example
 * ```ts
 * applyCodeEditorMutation(document, {
 *   edits: [{ range: { from: 0, to: 0 }, text: 'const ' }],
 *   origin: 'external',
 * });
 * ```
 */
export function applyCodeEditorMutation(
  document: CodeEditorDocumentModel,
  input: CodeEditorMutationInput,
): DocumentMutationResult {
  const snapshot = snapshotCodeEditorMutationInput(input, 5_000);
  if (snapshot === undefined) return Object.freeze({ accepted: false, reason: 'invalid-edit' });
  try {
    return document.apply(
      document.createTransaction({
        ...(snapshot.base === undefined ? {} : { base: snapshot.base }),
        edits: snapshot.edits,
        ...(snapshot.selection === undefined ? {} : { selection: snapshot.selection }),
        origin: snapshot.origin,
      }),
    );
  } catch {
    return Object.freeze({ accepted: false, reason: 'invalid-edit' });
  }
}

function snapshotIdentity(value: unknown): DocumentIdentity | undefined {
  const lineage = ownData(value, 'lineage');
  const revision = ownData(value, 'revision');
  return typeof lineage === 'string' && isCoordinate(revision)
    ? Object.freeze({ lineage, revision: documentRevision(revision) })
    : undefined;
}

function snapshotSelection(value: unknown): DocumentSelectionInput | undefined {
  const anchor = ownData(value, 'anchor');
  const head = ownData(value, 'head');
  return isCoordinate(anchor) && isCoordinate(head) ? Object.freeze({ anchor, head }) : undefined;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isEditOrigin(value: unknown): value is EditOrigin {
  return (
    value === 'typing' ||
    value === 'completion' ||
    value === 'snippet' ||
    value === 'format' ||
    value === 'external' ||
    value === 'search'
  );
}

function ownData(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}
