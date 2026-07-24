import { ChangeSet } from '@codemirror/state';

import type {
  DocumentEdit,
  DocumentIdentity,
  DocumentMutationResult,
  DocumentRejectionReason,
  DocumentSelection,
  DocumentTransaction,
} from './types.js';
import type { ResolvedDocumentLimits } from './limits.js';
import { utf8ByteLength } from './limits.js';
import { DocumentStorage } from './storage.js';
import { isDocumentCoordinate, isDocumentSelection } from './types.js';

/**
 * The validated result of applying one atomic document transaction.
 */
export interface AppliedDocumentTransaction {
  readonly result: DocumentMutationResult;
  readonly storage: DocumentStorage;
  readonly selection: DocumentSelection;
}

/**
 * Creates an immutable defensive copy of an untrusted transaction request.
 */
export function createDocumentTransaction(input: DocumentTransaction): DocumentTransaction {
  return Object.freeze({
    base: Object.freeze({ lineage: input.base.lineage, revision: input.base.revision }),
    edits: Object.freeze(
      input.edits.map((edit) =>
        Object.freeze({
          range: Object.freeze({ from: edit.range.from, to: edit.range.to }),
          text: edit.text,
        }),
      ),
    ),
    selection:
      input.selection === undefined
        ? undefined
        : Object.freeze({ anchor: input.selection.anchor, head: input.selection.head }),
    origin: input.origin,
  });
}

/**
 * Validates and applies a complete edit set without exposing partial mutation.
 */
export function applyDocumentTransaction(
  storage: DocumentStorage,
  selection: DocumentSelection,
  identity: DocumentIdentity,
  transaction: DocumentTransaction,
  limits: ResolvedDocumentLimits,
  readOnly: boolean,
): AppliedDocumentTransaction {
  const rejection = validateTransaction(storage, identity, transaction, limits, readOnly);
  if (rejection !== undefined) {
    return { result: { accepted: false, reason: rejection }, storage, selection };
  }

  const edits = [...transaction.edits].sort((left, right) => left.range.from - right.range.from);
  const changes = ChangeSet.of(
    edits.map((edit) => ({ from: edit.range.from, to: edit.range.to, insert: edit.text })),
    storage.length,
  );
  const nextStorage = new DocumentStorage(changes.apply(storage.asText()));
  if (utf8ByteLength(nextStorage.toString()) > limits.maxDocumentBytes) {
    return { result: { accepted: false, reason: 'document-limit' }, storage, selection };
  }

  const nextSelection =
    transaction.selection === undefined
      ? {
          anchor: changes.mapPos(selection.anchor),
          head: changes.mapPos(selection.head),
        }
      : transaction.selection;
  if (!isDocumentSelection(nextSelection, nextStorage.length)) {
    return { result: { accepted: false, reason: 'invalid-selection' }, storage, selection };
  }
  return {
    result: { accepted: true },
    storage: nextStorage,
    selection: Object.freeze({ ...nextSelection }),
  };
}

function validateTransaction(
  storage: DocumentStorage,
  identity: DocumentIdentity,
  transaction: DocumentTransaction,
  limits: ResolvedDocumentLimits,
  readOnly: boolean,
): DocumentRejectionReason | undefined {
  if (readOnly) {
    return 'read-only';
  }
  if (transaction.base.lineage !== identity.lineage) {
    return 'foreign-lineage';
  }
  if (transaction.base.revision !== identity.revision) {
    return 'stale';
  }
  if (transaction.edits.length < 1 || transaction.edits.length > limits.maxEditsPerTransaction) {
    return 'edit-limit';
  }
  const edits = [...transaction.edits].sort((left, right) => left.range.from - right.range.from);
  let priorEnd = -1;
  let insertedBytes = 0;
  for (const edit of edits) {
    if (!isValidEdit(edit, storage.length)) {
      return 'invalid-edit';
    }
    if (edit.range.from < priorEnd) {
      return 'overlap';
    }
    priorEnd = edit.range.to;
    insertedBytes += utf8ByteLength(edit.text);
    if (insertedBytes > limits.maxDocumentBytes) {
      return 'document-limit';
    }
  }
  return undefined;
}

function isValidEdit(edit: DocumentEdit, documentLength: number): boolean {
  return (
    typeof edit.text === 'string' &&
    isDocumentCoordinate(edit.range.from) &&
    isDocumentCoordinate(edit.range.to) &&
    edit.range.from <= edit.range.to &&
    edit.range.to <= documentLength
  );
}
