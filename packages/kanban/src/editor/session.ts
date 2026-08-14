import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanFieldId } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanSemanticValue, snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { invokeKanbanEditorAsyncCallback, invokeKanbanEditorCallback } from './registry.js';
import {
  defaultKanbanEditorFieldValue,
  expectedKanbanEditorCardPublication,
  sanitizeEditorDisplay,
  snapshotKanbanEditorAuthorityResult,
  snapshotKanbanEditorDiagnostic,
  snapshotKanbanEditorRecordPublication,
  snapshotKanbanEditorResolveResult,
} from './session-boundary.js';
import type {
  KanbanCardEditorField,
  KanbanEditorDiagnostic,
  KanbanEditorFieldCallbackInput,
  KanbanEditorFieldState,
  KanbanEditorRecordState,
  KanbanEditorReloadPolicy,
  KanbanEditorReloadResult,
  KanbanEditorResolveResult,
  KanbanEditorSession,
  KanbanEditorSessionOptions,
  KanbanEditorSessionSnapshot,
  KanbanEditorSetValueResult,
  KanbanEditorSubmissionState,
  KanbanEditorSubmitResult,
} from './types.js';
import { NO_KANBAN_EDITOR_DIAGNOSTICS } from './session-state.js';
import type { BufferedKanbanEditorRecordPublication, MutableKanbanEditorFieldState } from './session-state.js';

/**
 * Owns a detached editor draft and reconciles it with application publications.
 *
 * The session behaves like a small actor: callers observe complete immutable snapshots rather than
 * independently changing signals, so submission, stale, and focus state cannot tear during render.
 */
class KanbanEditorSessionActor<TCard, TDraft> implements KanbanEditorSession {
  readonly #options: KanbanEditorSessionOptions<TCard, TDraft>;
  readonly #cardKey: CardKey;
  readonly #lifetime = new AbortController();
  readonly #fields = new Map<KanbanFieldId, MutableKanbanEditorFieldState>();
  readonly #baselineFields = new Map<KanbanFieldId, string>();
  readonly #listeners = new Set<(snapshot: KanbanEditorSessionSnapshot) => void>();
  #unsubscribeResolver: (() => void) | undefined;
  #card: TCard | undefined;
  #draft: TDraft;
  #draftSnapshot: KanbanSemanticValue;
  #baseRevision: KanbanRevision | undefined;
  #changedFieldIds: readonly KanbanFieldId[] = Object.freeze([]);
  #focusedFieldId: KanbanFieldId | undefined;
  #record: KanbanEditorRecordState;
  #submission: KanbanEditorSubmissionState = Object.freeze({ kind: 'idle' });
  #expectedRevision: KanbanRevision | undefined;
  #submissionGeneration = 0;
  #reloadController: AbortController | undefined;
  #disposed = false;

  /** Constructs a session from one already validated initial resolver result. */
  constructor(options: KanbanEditorSessionOptions<TCard, TDraft>, initial: KanbanEditorResolveResult<TCard>) {
    this.#options = options;
    this.#cardKey = createKanbanCardKey(options.cardKey);
    this.#card = initial.kind === 'record' ? initial.card : undefined;
    this.#baseRevision = initial.kind === 'record' ? initial.revision : undefined;
    this.#record =
      initial.kind === 'record'
        ? Object.freeze({ kind: 'ready' })
        : Object.freeze({ kind: 'unavailable', code: initial.code });
    this.#draft = this.#createDraft(this.#card);
    this.#draftSnapshot = this.#snapshotDraft(this.#draft);
    for (const field of options.adapter.schema.fields) {
      this.#fields.set(field.fieldId, {
        fieldId: field.fieldId,
        touched: false,
        visible: true,
        readOnly: options.mode === 'view',
        displayValue: '',
        diagnostics: NO_KANBAN_EDITOR_DIAGNOSTICS,
        generation: 0,
        controller: undefined,
      });
    }
    this.#captureBaseline();
    this.#refreshPresentation();
  }

  /** Installs the resolver unsubscriber only after construction is complete. */
  attachResolver(unsubscribe: () => void): void {
    if (this.#disposed) unsubscribe();
    else this.#unsubscribeResolver = unsubscribe;
  }

  /** Applies one already validated authoritative publication. */
  publish(publication: BufferedKanbanEditorRecordPublication<TCard>): void {
    if (this.#disposed) return;
    if (publication.kind === 'deleted') {
      this.#record = Object.freeze({ kind: 'deleted' });
      this.#submission = Object.freeze({ kind: 'idle' });
      this.#expectedRevision = undefined;
      this.#notify();
      return;
    }
    if (
      this.#submission.kind === 'awaiting-publication' &&
      this.#expectedRevision !== undefined &&
      kanbanRevisionsEqual(publication.revision, this.#expectedRevision)
    ) {
      const operationId = this.#submission.operationId;
      this.#rebase(publication.card, publication.revision);
      this.#submission = Object.freeze({ kind: 'committed', operationId });
      this.#notify();
      return;
    }
    if (this.#baseRevision !== undefined && kanbanRevisionsEqual(publication.revision, this.#baseRevision)) return;
    if (this.#changedFieldIds.length === 0 && this.#submission.kind === 'idle') {
      this.#rebase(publication.card, publication.revision);
    } else {
      this.#card = publication.card;
      this.#record = Object.freeze({ kind: 'stale' });
      this.#submission = Object.freeze({ kind: 'idle' });
      this.#expectedRevision = undefined;
    }
    this.#notify();
  }

  /** Returns one coherent immutable session snapshot. */
  snapshot(): KanbanEditorSessionSnapshot {
    return Object.freeze({
      mode: this.#options.mode,
      cardKey: this.#cardKey,
      draft: this.#draftSnapshot,
      ...(this.#baseRevision === undefined ? {} : { baseRevision: this.#baseRevision }),
      dirty: this.#changedFieldIds.length > 0,
      changedFieldIds: this.#changedFieldIds,
      ...(this.#focusedFieldId === undefined ? {} : { focusedFieldId: this.#focusedFieldId }),
      record: this.#record,
      submission: this.#submission,
    });
  }

  /** Returns immutable state for one schema field or a safe absent placeholder. */
  fieldState(fieldId: KanbanFieldId): KanbanEditorFieldState {
    let validFieldId: KanbanFieldId;
    try {
      validFieldId = createKanbanFieldId(fieldId);
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
    const state = this.#fields.get(validFieldId);
    if (state === undefined) {
      return Object.freeze({
        fieldId: validFieldId,
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
      diagnostics: state.diagnostics,
    });
  }

  /** Attempts one typed field mutation and starts a new validation generation. */
  setValue(fieldId: KanbanFieldId, rawValue: unknown): KanbanEditorSetValueResult {
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (this.#options.mode === 'view') return Object.freeze({ kind: 'read-only' });
    if (
      this.#submission.kind === 'validating' ||
      this.#submission.kind === 'dispatching' ||
      this.#submission.kind === 'awaiting-publication' ||
      this.#submission.kind === 'committed'
    ) {
      return Object.freeze({ kind: 'sealed' });
    }
    let normalizedFieldId: KanbanFieldId;
    try {
      normalizedFieldId = createKanbanFieldId(fieldId);
    } catch {
      return Object.freeze({ kind: 'unknown-field' });
    }
    const field = this.#options.adapter.schema.field(normalizedFieldId);
    const state = this.#fields.get(normalizedFieldId);
    if (field === undefined || state === undefined) return Object.freeze({ kind: 'unknown-field' });
    this.#refreshFieldPresentation(field, state);
    if (state.readOnly || !state.visible) return Object.freeze({ kind: 'read-only' });

    const controller = this.#replaceFieldGeneration(state);
    const currentValue = this.#readField(field);
    if (currentValue.kind === 'failure') {
      state.diagnostics = Object.freeze([currentValue.diagnostic]);
      this.#notify();
      return Object.freeze({ kind: 'invalid-value' });
    }
    const input = this.#callbackInput(currentValue.value, controller.signal);
    let value: unknown;
    if (field.parse === undefined) {
      try {
        value = defaultKanbanEditorFieldValue(field.kind, rawValue);
      } catch {
        state.diagnostics = Object.freeze([Object.freeze({ code: 'invalid-value' })]);
        this.#notify();
        return Object.freeze({ kind: 'invalid-value' });
      }
    } else {
      const parsed = invokeKanbanEditorCallback(field.parse, [rawValue, input]);
      if (parsed.kind === 'failure') {
        state.diagnostics = Object.freeze([parsed.diagnostic]);
        this.#notify();
        return Object.freeze({ kind: 'invalid-value' });
      }
      value = parsed.value;
    }
    const written = invokeKanbanEditorCallback(field.write, [this.#draft, value]);
    if (written.kind === 'failure') {
      state.diagnostics = Object.freeze([written.diagnostic]);
      this.#notify();
      return Object.freeze({ kind: 'invalid-value' });
    }
    try {
      const draftSnapshot = this.#snapshotDraft(written.value);
      this.#draft = written.value;
      this.#draftSnapshot = draftSnapshot;
    } catch {
      state.diagnostics = Object.freeze([Object.freeze({ code: 'invalid-value' })]);
      this.#notify();
      return Object.freeze({ kind: 'invalid-value' });
    }
    state.touched = true;
    this.#submission = Object.freeze({ kind: 'idle' });
    this.#refreshChangedFields();
    this.#refreshPresentation();
    const settled = this.#validateField(field, state, controller);
    this.#notify();
    return Object.freeze({ kind: 'accepted', settled });
  }

  /** Validates the complete draft and submits one exact lifecycle-free proposal. */
  async submit(): Promise<KanbanEditorSubmitResult> {
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (this.#options.mode === 'view') return Object.freeze({ kind: 'read-only' });
    if (this.#record.kind === 'stale') return Object.freeze({ kind: 'stale' });
    if (this.#record.kind === 'deleted') return Object.freeze({ kind: 'deleted' });
    if (this.#record.kind === 'unavailable') return Object.freeze({ kind: 'unavailable' });
    if (this.#submission.kind !== 'idle' && this.#submission.kind !== 'rejected') {
      return Object.freeze({ kind: 'sealed' });
    }
    const generation = ++this.#submissionGeneration;
    this.#submission = Object.freeze({ kind: 'validating' });
    this.#notify();
    for (const field of this.#options.adapter.schema.fields) {
      const state = this.#fields.get(field.fieldId);
      if (state === undefined) continue;
      state.touched = true;
      const controller = this.#replaceFieldGeneration(state);
      await this.#validateField(field, state, controller);
    }
    if (!this.#submissionIsCurrent(generation)) return Object.freeze({ kind: 'disposed' });
    const firstInvalid = this.#options.adapter.schema.fields.find(
      (field) => (this.#fields.get(field.fieldId)?.diagnostics.length ?? 0) > 0,
    );
    if (firstInvalid !== undefined) {
      this.#focusedFieldId = firstInvalid.fieldId;
      this.#submission = Object.freeze({ kind: 'idle' });
      this.#notify();
      return Object.freeze({ kind: 'invalid', fieldId: firstInvalid.fieldId });
    }

    this.#submission = Object.freeze({ kind: 'dispatching' });
    this.#notify();
    let proposal: KanbanRequestProposal;
    try {
      const result = Object.freeze({
        draft: this.#draft,
        snapshot: this.#draftSnapshot,
        changedFieldIds: this.#changedFieldIds,
        ...(this.#baseRevision === undefined ? {} : { baseRevision: this.#baseRevision }),
      });
      const proposed = this.#options.adapter.proposal(result);
      proposal = snapshotKanbanRequestProposal(
        proposed.kind === 'card-update' && this.#baseRevision !== undefined
          ? {
              ...proposed,
              editor: {
                kind: 'full-draft',
                changedFieldIds: this.#changedFieldIds,
                baseRevision: this.#baseRevision,
              },
            }
          : proposed,
      );
    } catch {
      this.#submission = Object.freeze({ kind: 'idle' });
      this.#notify();
      return Object.freeze({ kind: 'failed' });
    }

    let result: KanbanRequestResult;
    try {
      result = snapshotKanbanEditorAuthorityResult(await this.#options.authority.request(proposal));
    } catch {
      if (this.#submissionIsCurrent(generation)) {
        this.#submission = Object.freeze({ kind: 'idle' });
        this.#notify();
      }
      return Object.freeze({ kind: 'failed' });
    }
    if (!this.#submissionIsCurrent(generation)) return Object.freeze({ kind: 'disposed' });
    return this.#settleSubmissionResult(result);
  }

  /** Explicitly discards a stale draft and reloads the latest authoritative record. */
  async reload(policy: KanbanEditorReloadPolicy): Promise<KanbanEditorReloadResult> {
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (policy !== 'discard-draft') return Object.freeze({ kind: 'failed' });
    this.#reloadController?.abort();
    const controller = new AbortController();
    this.#reloadController = controller;
    const generation = ++this.#submissionGeneration;
    this.#abortFieldValidations();
    try {
      const result = snapshotKanbanEditorResolveResult<TCard>(
        await this.#options.resolver.resolve(this.#cardKey, { signal: controller.signal }),
      );
      if (this.#disposed || controller.signal.aborted || generation !== this.#submissionGeneration) {
        return Object.freeze({ kind: 'disposed' });
      }
      if (result.kind === 'unavailable') {
        this.#record = Object.freeze({ kind: 'unavailable', code: result.code });
        this.#notify();
        return Object.freeze({ kind: 'unavailable', code: result.code });
      }
      this.#rebase(result.card, result.revision);
      this.#notify();
      return Object.freeze({ kind: 'reloaded' });
    } catch {
      if (this.#disposed || controller.signal.aborted) return Object.freeze({ kind: 'disposed' });
      return Object.freeze({ kind: 'failed' });
    }
  }

  /** Subscribes to complete session snapshots. */
  subscribe(listener: (snapshot: KanbanEditorSessionSnapshot) => void): () => void {
    if (this.#disposed) return () => undefined;
    this.#listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.#listeners.delete(listener);
    };
  }

  /** Releases resolver, validation, reload, and pending request ownership idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#submissionGeneration += 1;
    this.#lifetime.abort();
    this.#reloadController?.abort();
    this.#abortFieldValidations();
    if (this.#submission.kind === 'awaiting-publication') {
      try {
        this.#options.authority.cancel?.(this.#submission.operationId);
      } catch {
        // Cancellation is best-effort; disposal still releases every package-owned resource.
      }
    }
    const unsubscribe = this.#unsubscribeResolver;
    this.#unsubscribeResolver = undefined;
    try {
      unsubscribe?.();
    } catch {
      // Application unsubscribe failures cannot retain package listeners or revive the session.
    }
    this.#listeners.clear();
  }

  /** Reports whether all session-owned work has been invalidated. */
  disposed(): boolean {
    return this.#disposed;
  }

  /** Creates one application draft through an exception-isolated adapter callback. */
  #createDraft(card: TCard | undefined): TDraft {
    const context = Object.freeze({ mode: this.#options.mode, signal: this.#lifetime.signal });
    const created = invokeKanbanEditorCallback(this.#options.adapter.create, [card, context]);
    if (created.kind === 'failure') throw new KanbanInvalidSemanticValueError();
    return created.value;
  }

  /** Snapshots one typed draft before it becomes observable or dispatchable. */
  #snapshotDraft(draft: TDraft): KanbanSemanticValue {
    const snapshot = invokeKanbanEditorCallback(this.#options.adapter.snapshot, [draft]);
    if (snapshot.kind === 'failure') throw new KanbanInvalidSemanticValueError();
    return snapshotKanbanSemanticValue(snapshot.value);
  }

  /** Captures schema-ordered field baselines without retaining mutable values. */
  #captureBaseline(): void {
    this.#baselineFields.clear();
    for (const field of this.#options.adapter.schema.fields) {
      const value = this.#readField(field);
      if (value.kind === 'value') {
        try {
          this.#baselineFields.set(field.fieldId, canonicalizeKanbanSemanticValue(value.value));
        } catch {
          this.#baselineFields.set(field.fieldId, '');
        }
      }
    }
    this.#changedFieldIds = Object.freeze([]);
  }

  /** Recomputes changed identities in immutable schema order. */
  #refreshChangedFields(): void {
    const changed: KanbanFieldId[] = [];
    for (const field of this.#options.adapter.schema.fields) {
      const value = this.#readField(field);
      if (value.kind === 'failure') {
        changed.push(field.fieldId);
        continue;
      }
      try {
        if (canonicalizeKanbanSemanticValue(value.value) !== this.#baselineFields.get(field.fieldId)) {
          changed.push(field.fieldId);
        }
      } catch {
        changed.push(field.fieldId);
      }
    }
    this.#changedFieldIds = Object.freeze(changed);
  }

  /** Reads one heterogeneous field without allowing a throwing adapter to escape. */
  #readField(field: KanbanCardEditorField<TDraft, unknown, TCard>) {
    return invokeKanbanEditorCallback(field.read, [this.#draft]);
  }

  /** Builds bounded callback context for the current draft generation. */
  #callbackInput(value: unknown, signal: AbortSignal): KanbanEditorFieldCallbackInput<TCard, TDraft, unknown> {
    return Object.freeze({
      value,
      draft: this.#draft,
      ...(this.#card === undefined ? {} : { card: this.#card }),
      context: Object.freeze({ mode: this.#options.mode, signal }),
      signal,
    });
  }

  /** Aborts the old field generation before returning a new authoritative controller. */
  #replaceFieldGeneration(state: MutableKanbanEditorFieldState): AbortController {
    state.controller?.abort();
    state.generation += 1;
    const controller = new AbortController();
    state.controller = controller;
    return controller;
  }

  /** Runs ordered synchronous and asynchronous validators for one field generation. */
  async #validateField(
    field: KanbanCardEditorField<TDraft, unknown, TCard>,
    state: MutableKanbanEditorFieldState,
    controller: AbortController,
  ): Promise<void> {
    const generation = state.generation;
    const read = this.#readField(field);
    if (read.kind === 'failure') {
      state.diagnostics = Object.freeze([read.diagnostic]);
      return;
    }
    const input = this.#callbackInput(read.value, controller.signal);
    const diagnostics: KanbanEditorDiagnostic[] = [];
    for (const validator of field.validate ?? []) {
      const outcome = invokeKanbanEditorCallback(validator, [input]);
      if (outcome.kind === 'failure') diagnostics.push(outcome.diagnostic);
      else if (outcome.value !== undefined) diagnostics.push(snapshotKanbanEditorDiagnostic(outcome.value));
    }
    state.diagnostics = Object.freeze(diagnostics);
    for (const validator of field.validateAsync ?? []) {
      const outcome = await invokeKanbanEditorAsyncCallback(validator, [input]);
      if (this.#disposed || controller.signal.aborted || state.generation !== generation) return;
      if (outcome.kind === 'failure') diagnostics.push(outcome.diagnostic);
      else if (outcome.value !== undefined) diagnostics.push(snapshotKanbanEditorDiagnostic(outcome.value));
      state.diagnostics = Object.freeze([...diagnostics]);
    }
    if (!this.#disposed && !controller.signal.aborted && state.generation === generation) {
      state.diagnostics = Object.freeze([...diagnostics]);
      this.#notify();
    }
  }

  /** Refreshes safe formatted, visibility, and read-only state for every field. */
  #refreshPresentation(): void {
    for (const field of this.#options.adapter.schema.fields) {
      const state = this.#fields.get(field.fieldId);
      if (state !== undefined) this.#refreshFieldPresentation(field, state);
    }
  }

  /** Refreshes one field's derived presentation through isolated application callbacks. */
  #refreshFieldPresentation(
    field: KanbanCardEditorField<TDraft, unknown, TCard>,
    state: MutableKanbanEditorFieldState,
  ): void {
    const read = this.#readField(field);
    if (read.kind === 'failure') {
      state.readOnly = true;
      state.displayValue = '';
      state.diagnostics = Object.freeze([read.diagnostic]);
      return;
    }
    const signal = state.controller?.signal ?? this.#lifetime.signal;
    const input = this.#callbackInput(read.value, signal);
    const visible = field.visible === undefined ? undefined : invokeKanbanEditorCallback(field.visible, [input]);
    state.visible = visible === undefined ? true : visible.kind === 'value' && visible.value === true;
    const readOnly = field.readOnly === undefined ? undefined : invokeKanbanEditorCallback(field.readOnly, [input]);
    state.readOnly =
      this.#options.mode === 'view' || readOnly?.kind === 'failure' || (readOnly?.kind === 'value' && readOnly.value);
    if (field.format === undefined) {
      state.displayValue = sanitizeEditorDisplay(
        typeof read.value === 'string' ? read.value : this.#safeDisplayFallback(read.value),
      );
      return;
    }
    const formatted = invokeKanbanEditorCallback(field.format, [input]);
    state.displayValue =
      formatted.kind === 'value' && typeof formatted.value === 'string' ? sanitizeEditorDisplay(formatted.value) : '';
    if (formatted.kind === 'failure') state.diagnostics = Object.freeze([formatted.diagnostic]);
  }

  /** Produces a deterministic display fallback only after semantic validation. */
  #safeDisplayFallback(value: unknown): string {
    try {
      return canonicalizeKanbanSemanticValue(value);
    } catch {
      return '';
    }
  }

  /** Converts one authority result into editor lifecycle state. */
  #settleSubmissionResult(result: KanbanRequestResult): KanbanEditorSubmitResult {
    switch (result.kind) {
      case 'rejected': {
        for (const error of result.fieldErrors ?? []) {
          const state = this.#fields.get(error.fieldId);
          if (state === undefined) continue;
          state.touched = true;
          state.diagnostics = Object.freeze([
            ...state.diagnostics,
            Object.freeze({ code: error.code, ...(error.label === undefined ? {} : { label: error.label }) }),
          ]);
        }
        this.#submission = Object.freeze({
          kind: 'rejected',
          operationId: result.operationId,
          code: result.code,
          ...(result.label === undefined ? {} : { label: result.label }),
        });
        this.#notify();
        return Object.freeze({ kind: 'rejected', operationId: result.operationId, code: result.code });
      }
      case 'cancelled':
      case 'superseded':
        this.#submission = Object.freeze({ kind: 'idle' });
        this.#notify();
        return Object.freeze({ kind: result.kind, operationId: result.operationId });
      case 'accepted': {
        const subject = expectedKanbanEditorCardPublication(result, this.#cardKey);
        if (subject === undefined) {
          this.#record = Object.freeze({ kind: 'stale' });
          this.#submission = Object.freeze({ kind: 'idle' });
          this.#notify();
          return Object.freeze({ kind: 'failed' });
        }
        this.#expectedRevision = subject.expectedRevision;
        this.#submission = Object.freeze({ kind: 'awaiting-publication', operationId: result.operationId });
        this.#notify();
        return Object.freeze({ kind: 'awaiting-publication', operationId: result.operationId });
      }
    }
  }

  /** Rebases the complete draft and clears all touched/error state after explicit authority. */
  #rebase(card: TCard, revision: KanbanRevision): void {
    this.#abortFieldValidations();
    this.#card = card;
    this.#baseRevision = revision;
    this.#draft = this.#createDraft(card);
    this.#draftSnapshot = this.#snapshotDraft(this.#draft);
    this.#record = Object.freeze({ kind: 'ready' });
    this.#submission = Object.freeze({ kind: 'idle' });
    this.#expectedRevision = undefined;
    for (const state of this.#fields.values()) {
      state.touched = false;
      state.diagnostics = NO_KANBAN_EDITOR_DIAGNOSTICS;
    }
    this.#captureBaseline();
    this.#refreshPresentation();
  }

  /** Aborts every field generation without removing stable field state. */
  #abortFieldValidations(): void {
    for (const state of this.#fields.values()) {
      state.controller?.abort();
      state.controller = undefined;
      state.generation += 1;
    }
  }

  /** Returns whether an async submit generation may still publish state. */
  #submissionIsCurrent(generation: number): boolean {
    return !this.#disposed && generation === this.#submissionGeneration;
  }

  /** Publishes one post-transition snapshot while containing listener failures. */
  #notify(): void {
    if (this.#disposed) return;
    const snapshot = this.snapshot();
    for (const listener of [...this.#listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A presentation subscriber cannot interrupt session ownership or later subscribers.
      }
    }
  }
}

/**
 * Opens one detached editor session after subscribing to authoritative publications.
 *
 * @example
 * ```ts
 * const session = await createKanbanEditorSession({
 *   mode: 'edit', cardKey: 'work-42', adapter, resolver, authority,
 * });
 * ```
 */
export async function createKanbanEditorSession<TCard, TDraft>(
  options: KanbanEditorSessionOptions<TCard, TDraft>,
): Promise<KanbanEditorSession> {
  const cardKey = createKanbanCardKey(options.cardKey);
  const resolutionController = new AbortController();
  const buffered: BufferedKanbanEditorRecordPublication<TCard>[] = [];
  let actor: KanbanEditorSessionActor<TCard, TDraft> | undefined;
  let unsubscribe = (): void => undefined;
  try {
    const subscribed = options.resolver.subscribe(cardKey, (publication) => {
      let snapshot: BufferedKanbanEditorRecordPublication<TCard>;
      try {
        snapshot = snapshotKanbanEditorRecordPublication<TCard>(publication);
      } catch {
        return;
      }
      if (actor === undefined) buffered.push(snapshot);
      else actor.publish(snapshot);
    });
    if (typeof subscribed !== 'function') throw new KanbanInvalidSemanticValueError();
    unsubscribe = subscribed;
    const initial = snapshotKanbanEditorResolveResult<TCard>(
      await options.resolver.resolve(cardKey, { signal: resolutionController.signal }),
    );
    actor = new KanbanEditorSessionActor(options, initial);
    actor.attachResolver(unsubscribe);
    for (const publication of buffered) actor.publish(publication);
    return actor;
  } catch (error) {
    resolutionController.abort();
    try {
      unsubscribe();
    } catch {
      // Opening failed before a session existed; resolver cleanup remains best-effort and bounded.
    }
    throw error;
  }
}
