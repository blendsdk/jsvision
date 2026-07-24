import { ChangeSet } from '@codemirror/state';

import type { ResolvedDocumentLimits } from './limits.js';
import type {
  DocumentIdentity,
  DocumentMutationResult,
  DocumentOffset,
  DocumentRejectionReason,
  DocumentRevision,
  DocumentSelection,
  DocumentTransaction,
  DocumentTransactionInput,
  EditOrigin,
} from './types.js';
import { utf8ByteLength } from './limits.js';
import { DocumentStorage } from './storage.js';
import { documentOffset, documentRevision, documentSelection, isDocumentCoordinate } from './types.js';

const EDIT_ORIGINS = new Set<EditOrigin>(['typing', 'completion', 'snippet', 'format', 'external', 'search']);

interface NormalizedEdit {
  readonly from: DocumentOffset;
  readonly to: DocumentOffset;
  readonly text: string;
}

interface NormalizedTransaction {
  readonly base: { readonly lineage: string; readonly revision: DocumentRevision };
  readonly edits: readonly NormalizedEdit[];
  readonly selection?: { readonly anchor: number; readonly head: number };
  readonly origin: EditOrigin;
  readonly rejection?: DocumentRejectionReason;
}

const normalizedTransactions = new WeakMap<DocumentTransaction, NormalizedTransaction>();

/**
 * The validated result of applying one atomic document transaction.
 */
export interface AppliedDocumentTransaction {
  readonly result: DocumentMutationResult;
  readonly storage: DocumentStorage;
  readonly selection: DocumentSelection;
  readonly forward?: ChangeSet;
  readonly inverse?: ChangeSet;
  readonly beforeByteLength?: number;
  readonly afterByteLength?: number;
  readonly retainedBytes?: number;
  readonly beforeHasCarriageReturn?: boolean;
  readonly afterHasCarriageReturn?: boolean;
}

/**
 * Reads untrusted transaction properties once, bounds them before copying, and stores the
 * normalized data outside the public object so forged transactions fail closed.
 */
export function createDocumentTransaction(
  input: DocumentTransactionInput,
  limits: ResolvedDocumentLimits,
  defaultIdentity: DocumentIdentity,
): DocumentTransaction {
  const transaction: DocumentTransaction = Object.freeze({ kind: 'document-transaction' });
  normalizedTransactions.set(transaction, normalizeTransaction(input, limits, defaultIdentity));
  return transaction;
}

/**
 * Validates and applies a normalized complete edit set without exposing partial mutation.
 */
export function applyDocumentTransaction(
  storage: DocumentStorage,
  selection: DocumentSelection,
  identity: DocumentIdentity,
  transaction: DocumentTransaction,
  limits: ResolvedDocumentLimits,
  readOnly: boolean,
): AppliedDocumentTransaction {
  const normalized = normalizedTransactions.get(transaction);
  if (normalized === undefined) {
    return rejected(storage, selection, 'invalid-edit');
  }
  if (normalized.rejection !== undefined) {
    return rejected(storage, selection, normalized.rejection);
  }
  if (readOnly) {
    return rejected(storage, selection, 'read-only');
  }
  if (normalized.base.lineage !== identity.lineage) {
    return rejected(storage, selection, 'foreign-lineage');
  }
  if (normalized.base.revision !== identity.revision) {
    return rejected(storage, selection, 'stale');
  }

  const validation = validateEdits(storage, normalized.edits, limits);
  if (typeof validation === 'string') {
    return rejected(storage, selection, validation);
  }
  const { afterByteLength, retainedBytes } = validation;
  const forward = ChangeSet.of(
    normalized.edits.map((edit) => ({ from: edit.from, to: edit.to, insert: edit.text })),
    storage.length,
  );
  const inverse = forward.invert(storage.asText());
  const mayContainCarriageReturn =
    storage.hasCarriageReturn || normalized.edits.some((edit) => edit.text.includes('\r'));
  const nextStorage = new DocumentStorage(forward.apply(storage.asText()), afterByteLength, mayContainCarriageReturn);
  const nextSelection = resolveSelection(normalized.selection, selection, nextStorage.length, forward);
  if (nextSelection === undefined) {
    return rejected(storage, selection, 'invalid-selection');
  }
  return {
    result: { accepted: true },
    storage: nextStorage,
    selection: nextSelection,
    forward,
    inverse,
    beforeByteLength: storage.byteLength,
    afterByteLength,
    retainedBytes,
    beforeHasCarriageReturn: storage.hasCarriageReturn,
    afterHasCarriageReturn: nextStorage.hasCarriageReturn,
  };
}

function normalizeTransaction(
  input: DocumentTransactionInput,
  limits: ResolvedDocumentLimits,
  defaultIdentity: DocumentIdentity,
): NormalizedTransaction {
  try {
    const base = input.base ?? defaultIdentity;
    const edits = input.edits;
    const selection = input.selection;
    const origin = input.origin;
    if (base === undefined || !Array.isArray(edits) || !EDIT_ORIGINS.has(origin)) {
      return invalidTransaction('invalid-edit');
    }
    if (edits.length < 1 || edits.length > limits.maxEditsPerTransaction) {
      return invalidTransaction('edit-limit');
    }
    const lineage = base.lineage;
    const revision = base.revision;
    if (typeof lineage !== 'string' || !isDocumentCoordinate(revision)) {
      return invalidTransaction('invalid-edit');
    }
    const normalizedEdits: NormalizedEdit[] = [];
    for (const edit of edits) {
      const range = edit.range;
      const from = range.from;
      const to = range.to;
      const text = edit.text;
      if (!isDocumentCoordinate(from) || !isDocumentCoordinate(to) || from > to || typeof text !== 'string') {
        return invalidTransaction('invalid-edit');
      }
      normalizedEdits.push(
        Object.freeze({
          from: documentOffset(from),
          to: documentOffset(to),
          text,
        }),
      );
    }
    const normalizedSelection =
      selection === undefined ? undefined : Object.freeze({ anchor: selection.anchor, head: selection.head });
    return Object.freeze({
      base: Object.freeze({ lineage, revision: documentRevision(revision) }),
      edits: Object.freeze(normalizedEdits.sort((left, right) => left.from - right.from)),
      selection: normalizedSelection,
      origin,
    });
  } catch {
    return invalidTransaction('invalid-edit');
  }
}

function validateEdits(
  storage: DocumentStorage,
  edits: readonly NormalizedEdit[],
  limits: ResolvedDocumentLimits,
): { readonly afterByteLength: number; readonly retainedBytes: number } | DocumentRejectionReason {
  let priorEnd = -1;
  let insertedBytes = 0;
  let removedBytes = 0;
  for (const edit of edits) {
    if (edit.to > storage.length) {
      return 'invalid-edit';
    }
    if (edit.from < priorEnd) {
      return 'overlap';
    }
    priorEnd = edit.to;
    const editBytes = utf8ByteLength(edit.text);
    insertedBytes += editBytes;
    removedBytes += utf8ByteLength(storage.slice(edit.from, edit.to));
    if (insertedBytes > limits.maxReplacementBytes || insertedBytes + removedBytes > limits.maxHistoryBytes) {
      return 'document-limit';
    }
  }
  if (storage.lineCount + lineBreakDelta(storage, edits) > limits.maxDocumentLines) {
    return 'document-limit';
  }
  const afterByteLength = storage.byteLength - removedBytes + insertedBytes;
  if (afterByteLength > limits.maxDocumentBytes) {
    return 'document-limit';
  }
  return { afterByteLength, retainedBytes: insertedBytes + removedBytes };
}

function lineBreakDelta(storage: DocumentStorage, edits: readonly NormalizedEdit[]): number {
  let delta = 0;
  let groupStart = -1;
  let groupEnd = -1;
  let groupEdits: NormalizedEdit[] = [];

  const applyGroup = (): void => {
    if (groupStart < 0) {
      return;
    }
    const before = storage.slice(groupStart, groupEnd);
    let after = before;
    for (let index = groupEdits.length - 1; index >= 0; index -= 1) {
      const edit = groupEdits[index];
      const from = edit.from - groupStart;
      const to = edit.to - groupStart;
      after = `${after.slice(0, from)}${edit.text}${after.slice(to)}`;
    }
    delta += countLineBreaks(after) - countLineBreaks(before);
  };

  for (const edit of edits) {
    const contextStart = Math.max(0, edit.from - 1);
    const contextEnd = Math.min(storage.length, edit.to + 1);
    if (groupStart >= 0 && contextStart > groupEnd) {
      applyGroup();
      groupEdits = [];
      groupStart = contextStart;
      groupEnd = contextEnd;
    } else if (groupStart < 0) {
      groupStart = contextStart;
      groupEnd = contextEnd;
    } else {
      groupEnd = Math.max(groupEnd, contextEnd);
    }
    groupEdits.push(edit);
  }
  applyGroup();
  return delta;
}

function resolveSelection(
  requested: NormalizedTransaction['selection'],
  current: DocumentSelection,
  nextLength: number,
  changes: ChangeSet,
): DocumentSelection | undefined {
  try {
    if (requested !== undefined) {
      return documentSelection(requested, nextLength);
    }
    if (current.anchor === current.head) {
      const mapped = changes.mapPos(current.anchor, 1);
      return documentSelection({ anchor: mapped, head: mapped }, nextLength);
    }
    const forward = current.anchor < current.head;
    return documentSelection(
      {
        anchor: changes.mapPos(current.anchor, forward ? -1 : 1),
        head: changes.mapPos(current.head, forward ? 1 : -1),
      },
      nextLength,
    );
  } catch {
    return undefined;
  }
}

function rejected(
  storage: DocumentStorage,
  selection: DocumentSelection,
  reason: DocumentRejectionReason,
): AppliedDocumentTransaction {
  return { result: { accepted: false, reason }, storage, selection };
}

function invalidTransaction(reason: DocumentRejectionReason): NormalizedTransaction {
  return Object.freeze({
    base: Object.freeze({ lineage: '', revision: documentRevision(0) }),
    edits: Object.freeze([]),
    origin: 'external',
    rejection: reason,
  });
}

function countLineBreaks(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit === 0x0a) {
      count += 1;
    } else if (codeUnit === 0x0d) {
      count += 1;
      if (text.charCodeAt(index + 1) === 0x0a) {
        index += 1;
      }
    }
  }
  return count;
}
