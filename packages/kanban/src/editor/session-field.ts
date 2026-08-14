import { canonicalizeKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanFieldId } from '../contract/identity.js';
import { createKanbanFieldId } from '../contract/identity.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { invokeKanbanEditorAsyncCallback, invokeKanbanEditorCallback } from './registry.js';
import { awaitEditorWork } from './session-async.js';
import { sanitizeEditorDisplay, snapshotKanbanEditorDiagnostic } from './session-boundary.js';
import type { MutableKanbanEditorFieldState } from './session-state.js';
import type {
  KanbanCardEditorSchema,
  KanbanCardEditorField,
  KanbanEditorDiagnostic,
  KanbanEditorFieldCallbackInput,
  KanbanEditorFieldState,
  KanbanEditorMode,
} from './types.js';
import { NO_KANBAN_EDITOR_DIAGNOSTICS } from './session-state.js';

/** Session-owned values required to evaluate one field without exposing the actor. */
export interface KanbanEditorFieldRuntime<TCard, TDraft> {
  /** Current detached draft. */
  readonly draft: TDraft;
  /** Current detached application record when available. */
  readonly card: TCard | undefined;
  /** Current create, view, or edit policy. */
  readonly mode: KanbanEditorMode;
  /** Lifetime signal used before a field-specific generation exists. */
  readonly lifetimeSignal: AbortSignal;
}

/** Reads one heterogeneous field without allowing a throwing adapter to escape. */
export function readKanbanEditorField<TCard, TDraft>(
  field: KanbanCardEditorField<TDraft, unknown, TCard>,
  draft: TDraft,
) {
  return invokeKanbanEditorCallback(field.read, [draft]);
}

/** Returns the immutable combined diagnostic view exposed outside mutable field state. */
export function snapshotKanbanEditorFieldDiagnostics(
  state: MutableKanbanEditorFieldState,
): KanbanEditorFieldState['diagnostics'] {
  return Object.freeze([...state.presentationDiagnostics, ...state.validationDiagnostics]);
}

/** Returns immutable public state for one field, including safe placeholders for invalid identities. */
export function snapshotKanbanEditorFieldState<TCard, TDraft>(
  fieldId: KanbanFieldId,
  schema: KanbanCardEditorSchema<TCard, TDraft>,
  states: ReadonlyMap<KanbanFieldId, MutableKanbanEditorFieldState>,
): KanbanEditorFieldState {
  let normalized: KanbanFieldId;
  try {
    normalized = createKanbanFieldId(fieldId);
  } catch {
    return Object.freeze({
      fieldId: '',
      displayValue: '',
      touched: false,
      visible: false,
      readOnly: true,
      diagnostics: NO_KANBAN_EDITOR_DIAGNOSTICS,
    });
  }
  const state = states.get(normalized);
  if (schema.field(normalized) === undefined || state === undefined) {
    return Object.freeze({
      fieldId: normalized,
      displayValue: '',
      touched: false,
      visible: false,
      readOnly: true,
      diagnostics: NO_KANBAN_EDITOR_DIAGNOSTICS,
    });
  }
  return Object.freeze({
    fieldId: state.fieldId,
    displayValue: state.displayValue,
    touched: state.touched,
    visible: state.visible,
    readOnly: state.readOnly,
    diagnostics: snapshotKanbanEditorFieldDiagnostics(state),
  });
}

/** Reads and snapshots one semantic field value without exposing a mutable application object. */
export function snapshotKanbanEditorFieldValue<TCard, TDraft>(
  fieldId: KanbanFieldId,
  schema: KanbanCardEditorSchema<TCard, TDraft>,
  draft: TDraft,
): KanbanSemanticValue | undefined {
  let normalized: KanbanFieldId;
  try {
    normalized = createKanbanFieldId(fieldId);
  } catch {
    return undefined;
  }
  const field = schema.field(normalized);
  if (field === undefined) return undefined;
  const value = readKanbanEditorField(field, draft);
  if (value.kind === 'failure') return undefined;
  try {
    return snapshotKanbanSemanticValue(value.value);
  } catch {
    return undefined;
  }
}

/** Builds bounded callback context for one detached field generation. */
export function createKanbanEditorFieldCallbackInput<TCard, TDraft>(
  value: unknown,
  runtime: KanbanEditorFieldRuntime<TCard, TDraft>,
  signal: AbortSignal,
): KanbanEditorFieldCallbackInput<TCard, TDraft, unknown> {
  return Object.freeze({
    value,
    draft: runtime.draft,
    ...(runtime.card === undefined ? {} : { card: runtime.card }),
    context: Object.freeze({ mode: runtime.mode, signal }),
    signal,
  });
}

/** Runs one field's ordered validators while suppressing stale or aborted generations. */
export async function validateKanbanEditorField<TCard, TDraft>(options: {
  readonly field: KanbanCardEditorField<TDraft, unknown, TCard>;
  readonly state: MutableKanbanEditorFieldState;
  readonly runtime: KanbanEditorFieldRuntime<TCard, TDraft>;
  readonly controller: AbortController;
  readonly disposed: () => boolean;
  readonly notify: () => void;
}): Promise<void> {
  const { field, state, runtime, controller } = options;
  const generation = state.generation;
  const read = readKanbanEditorField(field, runtime.draft);
  if (read.kind === 'failure') {
    state.validationDiagnostics = Object.freeze([read.diagnostic]);
    return;
  }
  const input = createKanbanEditorFieldCallbackInput(read.value, runtime, controller.signal);
  const diagnostics: KanbanEditorDiagnostic[] = [];
  for (const validator of field.validate ?? []) {
    const outcome = invokeKanbanEditorCallback(validator, [input]);
    if (outcome.kind === 'failure') diagnostics.push(outcome.diagnostic);
    else if (outcome.value !== undefined) diagnostics.push(snapshotKanbanEditorDiagnostic(outcome.value));
  }
  state.validationDiagnostics = Object.freeze(diagnostics);
  for (const validator of field.validateAsync ?? []) {
    const awaited = await awaitEditorWork(invokeKanbanEditorAsyncCallback(validator, [input]), controller.signal);
    if (options.disposed() || controller.signal.aborted || state.generation !== generation) return;
    if (awaited.kind !== 'value') return;
    const outcome = awaited.value;
    if (outcome.kind === 'failure') diagnostics.push(outcome.diagnostic);
    else if (outcome.value !== undefined) diagnostics.push(snapshotKanbanEditorDiagnostic(outcome.value));
    state.validationDiagnostics = Object.freeze([...diagnostics]);
  }
  if (!options.disposed() && !controller.signal.aborted && state.generation === generation) {
    state.validationDiagnostics = Object.freeze([...diagnostics]);
    options.notify();
  }
}

/** Refreshes safe formatted, visibility, and read-only state through isolated callbacks. */
export function refreshKanbanEditorFieldPresentation<TCard, TDraft>(
  field: KanbanCardEditorField<TDraft, unknown, TCard>,
  state: MutableKanbanEditorFieldState,
  runtime: KanbanEditorFieldRuntime<TCard, TDraft>,
): void {
  const read = readKanbanEditorField(field, runtime.draft);
  if (read.kind === 'failure') {
    state.visible = false;
    state.readOnly = true;
    state.displayValue = '';
    state.presentationDiagnostics = Object.freeze([read.diagnostic]);
    return;
  }
  const presentationDiagnostics: KanbanEditorDiagnostic[] = [];
  const signal = state.controller?.signal ?? runtime.lifetimeSignal;
  const input = createKanbanEditorFieldCallbackInput(read.value, runtime, signal);
  const visible = field.visible === undefined ? undefined : invokeKanbanEditorCallback(field.visible, [input]);
  state.visible = visible === undefined ? true : visible.kind === 'value' && visible.value === true;
  if (visible !== undefined && (visible.kind === 'failure' || typeof visible.value !== 'boolean')) {
    presentationDiagnostics.push(
      visible.kind === 'failure' ? visible.diagnostic : Object.freeze({ code: 'callback-failed' }),
    );
  }
  const readOnly = field.readOnly === undefined ? undefined : invokeKanbanEditorCallback(field.readOnly, [input]);
  state.readOnly =
    runtime.mode === 'view' || readOnly?.kind === 'failure' || (readOnly?.kind === 'value' && readOnly.value);
  if (readOnly !== undefined && (readOnly.kind === 'failure' || typeof readOnly.value !== 'boolean')) {
    presentationDiagnostics.push(
      readOnly.kind === 'failure' ? readOnly.diagnostic : Object.freeze({ code: 'callback-failed' }),
    );
    state.readOnly = true;
  }
  if (field.format === undefined) {
    state.displayValue = sanitizeEditorDisplay(
      typeof read.value === 'string' ? read.value : safeDisplayFallback(read.value),
    );
    state.presentationDiagnostics = Object.freeze(presentationDiagnostics);
    return;
  }
  const formatted = invokeKanbanEditorCallback(field.format, [input]);
  state.displayValue =
    formatted.kind === 'value' && typeof formatted.value === 'string' ? sanitizeEditorDisplay(formatted.value) : '';
  if (formatted.kind === 'failure' || typeof formatted.value !== 'string') {
    presentationDiagnostics.push(
      formatted.kind === 'failure' ? formatted.diagnostic : Object.freeze({ code: 'callback-failed' }),
    );
  }
  state.presentationDiagnostics = Object.freeze(presentationDiagnostics);
}

/** Produces a deterministic display fallback only after semantic validation. */
function safeDisplayFallback(value: unknown): string {
  try {
    return canonicalizeKanbanSemanticValue(value);
  } catch {
    return '';
  }
}

/** Replaces a field's validation generation and aborts its obsolete asynchronous work. */
export function replaceKanbanEditorFieldGeneration(state: MutableKanbanEditorFieldState): AbortController {
  state.controller?.abort();
  state.generation += 1;
  const controller = new AbortController();
  state.controller = controller;
  return controller;
}

/** Rebuilds schema-ordered canonical baselines without retaining mutable field values. */
export function captureKanbanEditorFieldBaselines<TCard, TDraft>(
  fields: readonly KanbanCardEditorField<TDraft, unknown, TCard>[],
  draft: TDraft,
  baselines: Map<KanbanFieldId, string>,
): void {
  baselines.clear();
  for (const field of fields) {
    const value = readKanbanEditorField(field, draft);
    if (value.kind !== 'value') continue;
    try {
      baselines.set(field.fieldId, canonicalizeKanbanSemanticValue(value.value));
    } catch {
      baselines.set(field.fieldId, '');
    }
  }
}

/** Returns field identities whose canonical values differ from a captured baseline. */
export function collectChangedKanbanEditorFieldIds<TCard, TDraft>(
  fields: readonly KanbanCardEditorField<TDraft, unknown, TCard>[],
  draft: TDraft,
  baselines: ReadonlyMap<KanbanFieldId, string>,
): readonly KanbanFieldId[] {
  const changed: KanbanFieldId[] = [];
  for (const field of fields) {
    const value = readKanbanEditorField(field, draft);
    if (value.kind === 'failure') {
      changed.push(field.fieldId);
      continue;
    }
    try {
      if (canonicalizeKanbanSemanticValue(value.value) !== baselines.get(field.fieldId)) changed.push(field.fieldId);
    } catch {
      changed.push(field.fieldId);
    }
  }
  return Object.freeze(changed);
}
