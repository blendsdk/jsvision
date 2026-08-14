import { snapshotKanbanLabel, snapshotKanbanReasonCode } from '../contract/capability.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanCardPublicationSubject, KanbanRequestResult } from '../contract/request.js';
import { snapshotKanbanRequestResult } from '../contract/request-validation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanSemanticValue, snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type {
  KanbanCardEditorAdapter,
  KanbanCardEditorField,
  KanbanEditorDiagnostic,
  KanbanEditorMode,
  KanbanEditorRecordPublication,
  KanbanEditorResolveResult,
} from './types.js';
import { invokeKanbanEditorCallback } from './registry.js';

/** Exact resolver record members. */
const RESOLVED_RECORD_KEYS = new Set(['kind', 'card', 'revision']);
/** Exact resolver absence members. */
const UNAVAILABLE_RECORD_KEYS = new Set(['kind', 'code']);
/** Exact deletion publication members. */
const DELETED_PUBLICATION_KEYS = new Set(['kind']);
/** Exact diagnostic members accepted from application callbacks. */
const DIAGNOSTIC_KEYS = new Set(['code', 'messageId', 'label']);
/** Conservative display ceiling for one formatted editor value. */
const MAX_DISPLAY_CHARACTERS = 4_096;

/** Creates one detached draft and converts an application callback failure into a contract error. */
export function createKanbanEditorDraft<TCard, TDraft>(
  adapter: KanbanCardEditorAdapter<TCard, TDraft>,
  card: TCard | undefined,
  mode: KanbanEditorMode,
  signal: AbortSignal,
): TDraft {
  const created = invokeKanbanEditorCallback(adapter.create, [card, Object.freeze({ mode, signal })]);
  if (created.kind === 'failure') throw new KanbanInvalidSemanticValueError();
  return created.value;
}

/** Snapshots one typed draft before the session exposes or dispatches it. */
export function snapshotKanbanEditorDraft<TCard, TDraft>(
  adapter: KanbanCardEditorAdapter<TCard, TDraft>,
  draft: TDraft,
): KanbanSemanticValue {
  const snapshot = invokeKanbanEditorCallback(adapter.snapshot, [draft]);
  if (snapshot.kind === 'failure') throw new KanbanInvalidSemanticValueError();
  return snapshotKanbanSemanticValue(snapshot.value);
}

/** Removes whole terminal escape sequences before the general control-code sanitizer runs. */
export function sanitizeEditorDisplay(value: string): string {
  const withoutEscapes = value.replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\\|.)/gu, '');
  return sanitizeContractText(withoutEscapes, MAX_DISPLAY_CHARACTERS);
}

/** Creates one payload-free callback failure used at every generic application seam. */
function callbackFailure(): KanbanEditorDiagnostic {
  return Object.freeze({ code: 'callback-failed' });
}

/** Validates and sanitizes one application diagnostic without retaining rejected data. */
export function snapshotKanbanEditorDiagnostic(value: unknown): KanbanEditorDiagnostic {
  try {
    const properties = snapshotKanbanDataProperties(value, DIAGNOSTIC_KEYS.size);
    validateKanbanDataKeys(properties, DIAGNOSTIC_KEYS);
    const code = snapshotKanbanReasonCode(properties.code);
    if (code === undefined) return callbackFailure();
    const messageId = snapshotKanbanLabel(properties.messageId);
    const label = snapshotKanbanLabel(properties.label);
    return Object.freeze({
      code,
      ...(messageId === undefined ? {} : { messageId }),
      ...(label === undefined ? {} : { label }),
    });
  } catch {
    return callbackFailure();
  }
}

/** Validates one exact resolver result while treating the generic record as application-owned data. */
export function snapshotKanbanEditorResolveResult<TCard>(
  value: KanbanEditorResolveResult<TCard>,
): KanbanEditorResolveResult<TCard> {
  const properties = snapshotKanbanDataProperties(value);
  if (properties.kind === 'record' && value.kind === 'record') {
    validateKanbanDataKeys(properties, RESOLVED_RECORD_KEYS);
    return Object.freeze({
      kind: properties.kind,
      card: value.card,
      revision: snapshotKanbanRevision(properties.revision),
    });
  }
  if (properties.kind === 'unavailable' && value.kind === 'unavailable') {
    validateKanbanDataKeys(properties, UNAVAILABLE_RECORD_KEYS);
    const code = snapshotKanbanReasonCode(properties.code);
    if (code === undefined) throw new KanbanInvalidSemanticValueError();
    return Object.freeze({ kind: properties.kind, code });
  }
  throw new KanbanInvalidSemanticValueError();
}

/** Validates one exact authoritative publication before it can alter session state. */
export function snapshotKanbanEditorRecordPublication<TCard>(
  value: KanbanEditorRecordPublication<TCard>,
): KanbanEditorRecordPublication<TCard> {
  const properties = snapshotKanbanDataProperties(value);
  if (properties.kind === 'deleted') {
    validateKanbanDataKeys(properties, DELETED_PUBLICATION_KEYS);
    return Object.freeze({ kind: properties.kind });
  }
  if (value.kind !== 'record') throw new KanbanInvalidSemanticValueError();
  const resolved = snapshotKanbanEditorResolveResult<TCard>(value);
  if (resolved.kind !== 'record') throw new KanbanInvalidSemanticValueError();
  return resolved;
}

/** Returns a safe default parser result without invoking coercive object behavior. */
export function defaultKanbanEditorFieldValue<TDraft, TCard>(
  field: KanbanCardEditorField<TDraft, unknown, TCard>,
  value: unknown,
): unknown {
  switch (field.kind) {
    case 'text':
    case 'multiline':
    case 'date':
      if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new KanbanInvalidSemanticValueError();
      return Object.is(value, -0) ? 0 : value;
    case 'boolean':
      if (typeof value !== 'boolean') throw new KanbanInvalidSemanticValueError();
      return value;
    case 'single-choice': {
      const selected = snapshotKanbanSemanticValue(value);
      const key = canonicalizeKanbanSemanticValue(selected);
      if (!field.choices?.some((choice) => canonicalizeKanbanSemanticValue(choice.value) === key)) {
        throw new KanbanInvalidSemanticValueError();
      }
      return selected;
    }
    case 'multiple-choice': {
      const selected = snapshotKanbanSemanticValue(value);
      if (!Array.isArray(selected)) throw new KanbanInvalidSemanticValueError();
      const allowed = new Set(field.choices?.map((choice) => canonicalizeKanbanSemanticValue(choice.value)) ?? []);
      const keys = selected.map(canonicalizeKanbanSemanticValue);
      if (new Set(keys).size !== keys.length || keys.some((key) => !allowed.has(key))) {
        throw new KanbanInvalidSemanticValueError();
      }
      return selected;
    }
    case 'custom':
      return snapshotKanbanSemanticValue(value);
  }
}

/** Extracts the exact card publication expectation correlated to this editor record. */
export function expectedKanbanEditorCardPublication(
  result: Extract<KanbanRequestResult, { readonly kind: 'accepted' }>,
  cardKey: CardKey,
): KanbanCardPublicationSubject | undefined {
  return result.publication?.subjects.find(
    (subject): subject is KanbanCardPublicationSubject => subject.kind === 'card' && subject.cardKey === cardKey,
  );
}

/** Reads and validates an operation-correlated result returned by the editor authority. */
export function snapshotKanbanEditorAuthorityResult(value: unknown): KanbanRequestResult {
  const properties = snapshotKanbanDataProperties(value);
  if (typeof properties.operationId !== 'string') throw new KanbanInvalidSemanticValueError();
  const operationId = createKanbanOperationId(properties.operationId);
  return snapshotKanbanRequestResult(properties, operationId);
}
