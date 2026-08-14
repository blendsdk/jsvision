import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanFieldId } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { invokeKanbanEditorCallback } from './registry.js';
import { awaitEditorWork } from './session-async.js';
import {
  defaultKanbanEditorFieldValue,
  createKanbanEditorDraft,
  expectedKanbanEditorCardPublication,
  snapshotKanbanEditorDraft,
  snapshotKanbanEditorAuthorityResult,
  snapshotKanbanEditorResolveResult,
} from './session-boundary.js';
import {
  captureKanbanEditorFieldBaselines,
  collectChangedKanbanEditorFieldIds,
  createKanbanEditorFieldCallbackInput,
  readKanbanEditorField,
  replaceKanbanEditorFieldGeneration,
  refreshKanbanEditorFieldPresentation,
  snapshotKanbanEditorFieldDiagnostics,
  validateKanbanEditorField,
} from './session-field.js';
import { KanbanEditorSessionNotifier } from './session-notifier.js';
import type {
  KanbanCardEditorField,
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
import { NO_KANBAN_EDITOR_DIAGNOSTICS, settledKanbanEditorValueOutcome } from './session-state.js';
import type { BufferedKanbanEditorRecordPublication, MutableKanbanEditorFieldState } from './session-state.js';

/**
 * Owns a detached editor draft and reconciles it with application publications.
 *
 * The session behaves like a small actor: callers observe complete immutable snapshots rather than
 * independently changing signals, so submission, stale, and focus state cannot tear during render.
 */
export class KanbanEditorSessionActor<TCard, TDraft> implements KanbanEditorSession {
  readonly #options: KanbanEditorSessionOptions<TCard, TDraft>;
  readonly #cardKey: CardKey;
  readonly #lifetime = new AbortController();
  readonly #fields = new Map<KanbanFieldId, MutableKanbanEditorFieldState>();
  readonly #baselineFields = new Map<KanbanFieldId, string>();
  readonly #notifier = new KanbanEditorSessionNotifier();
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
  #submissionController: AbortController | undefined;
  #dispatchPublication: BufferedKanbanEditorRecordPublication<TCard> | undefined;
  #reloadController: AbortController | undefined;
  #reloadPublication: BufferedKanbanEditorRecordPublication<TCard> | undefined;
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
        validationDiagnostics: NO_KANBAN_EDITOR_DIAGNOSTICS,
        presentationDiagnostics: NO_KANBAN_EDITOR_DIAGNOSTICS,
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
    if (this.#reloadController !== undefined && !this.#reloadController.signal.aborted) {
      this.#reloadPublication = publication;
      return;
    }
    if (this.#submission.kind === 'dispatching') {
      this.#dispatchPublication = publication;
      return;
    }
    this.#applyPublication(publication);
  }

  /** Applies one publication that is no longer waiting for dispatch or reload correlation. */
  #applyPublication(publication: BufferedKanbanEditorRecordPublication<TCard>): void {
    if (publication.kind === 'deleted') {
      this.#interruptValidationSubmission();
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
    this.#interruptValidationSubmission();
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

  /** Invalidates validation work before a changed authoritative record can reach dispatch. */
  #interruptValidationSubmission(): void {
    if (this.#submission.kind !== 'validating') return;
    this.#submissionGeneration += 1;
    this.#submissionController?.abort();
    this.#submissionController = undefined;
    this.#abortFieldValidations();
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
      diagnostics: snapshotKanbanEditorFieldDiagnostics(state),
    });
  }

  /** Attempts one typed field mutation and starts a new validation generation. */
  setValue(fieldId: KanbanFieldId, rawValue: unknown): KanbanEditorSetValueResult {
    if (this.#disposed) return settledKanbanEditorValueOutcome('disposed');
    if (this.#options.mode === 'view') return settledKanbanEditorValueOutcome('read-only');
    if (this.#reloadController !== undefined) return settledKanbanEditorValueOutcome('sealed');
    if (
      this.#submission.kind === 'validating' ||
      this.#submission.kind === 'dispatching' ||
      this.#submission.kind === 'awaiting-publication' ||
      this.#submission.kind === 'committed'
    ) {
      return settledKanbanEditorValueOutcome('sealed');
    }
    let normalizedFieldId: KanbanFieldId;
    try {
      normalizedFieldId = createKanbanFieldId(fieldId);
    } catch {
      return settledKanbanEditorValueOutcome('unknown-field');
    }
    const field = this.#options.adapter.schema.field(normalizedFieldId);
    const state = this.#fields.get(normalizedFieldId);
    if (field === undefined || state === undefined) return settledKanbanEditorValueOutcome('unknown-field');
    refreshKanbanEditorFieldPresentation(field, state, this.#fieldRuntime());
    if (state.readOnly || !state.visible) return settledKanbanEditorValueOutcome('read-only');

    const controller = replaceKanbanEditorFieldGeneration(state);
    const currentValue = readKanbanEditorField(field, this.#draft);
    if (currentValue.kind === 'failure') {
      state.validationDiagnostics = Object.freeze([currentValue.diagnostic]);
      this.#notify();
      return settledKanbanEditorValueOutcome('invalid-value');
    }
    const input = createKanbanEditorFieldCallbackInput(currentValue.value, this.#fieldRuntime(), controller.signal);
    let value: unknown;
    if (field.parse === undefined) {
      try {
        value = defaultKanbanEditorFieldValue(field, rawValue);
      } catch {
        state.validationDiagnostics = Object.freeze([Object.freeze({ code: 'invalid-value' })]);
        this.#notify();
        return settledKanbanEditorValueOutcome('invalid-value');
      }
    } else {
      const parsed = invokeKanbanEditorCallback(field.parse, [rawValue, input]);
      if (parsed.kind === 'failure') {
        state.validationDiagnostics = Object.freeze([parsed.diagnostic]);
        this.#notify();
        return settledKanbanEditorValueOutcome('invalid-value');
      }
      value = parsed.value;
    }
    const written = invokeKanbanEditorCallback(field.write, [this.#draft, value]);
    if (written.kind === 'failure') {
      state.validationDiagnostics = Object.freeze([written.diagnostic]);
      this.#notify();
      return settledKanbanEditorValueOutcome('invalid-value');
    }
    try {
      const draftSnapshot = this.#snapshotDraft(written.value);
      this.#draft = written.value;
      this.#draftSnapshot = draftSnapshot;
    } catch {
      state.validationDiagnostics = Object.freeze([Object.freeze({ code: 'invalid-value' })]);
      this.#notify();
      return settledKanbanEditorValueOutcome('invalid-value');
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
    const submissionController = new AbortController();
    this.#submissionController?.abort();
    this.#submissionController = submissionController;
    this.#dispatchPublication = undefined;
    this.#submission = Object.freeze({ kind: 'validating' });
    this.#notify();
    for (const field of this.#options.adapter.schema.fields) {
      const state = this.#fields.get(field.fieldId);
      if (state === undefined) continue;
      state.touched = true;
      const controller = replaceKanbanEditorFieldGeneration(state);
      await this.#validateField(field, state, controller);
      if (!this.#submissionIsCurrent(generation, submissionController)) {
        return this.#interruptedSubmissionResult();
      }
    }
    const firstInvalid = this.#options.adapter.schema.fields.find((field) => {
      const state = this.#fields.get(field.fieldId);
      return (state?.presentationDiagnostics.length ?? 0) + (state?.validationDiagnostics.length ?? 0) > 0;
    });
    if (firstInvalid !== undefined) {
      this.#focusedFieldId = firstInvalid.fieldId;
      this.#submission = Object.freeze({ kind: 'idle' });
      this.#submissionController = undefined;
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
      if (
        (this.#options.mode === 'edit' &&
          (proposal.kind !== 'card-update' || !Object.is(proposal.cardKey, this.#cardKey))) ||
        (this.#options.mode === 'create' && proposal.kind !== 'card-create')
      ) {
        throw new KanbanInvalidSemanticValueError();
      }
    } catch {
      return this.#failSubmission();
    }

    let requested: Promise<KanbanRequestResult>;
    try {
      requested = Promise.resolve(this.#options.authority.request(proposal));
    } catch {
      if (this.#submissionIsCurrent(generation, submissionController)) {
        return this.#failSubmission();
      }
      return Object.freeze({ kind: 'failed' });
    }
    const awaited = await awaitEditorWork(requested, submissionController.signal);
    if (!this.#submissionIsCurrent(generation, submissionController) || awaited.kind === 'aborted') {
      return this.#interruptedSubmissionResult();
    }
    if (awaited.kind === 'failed') {
      return this.#failSubmission();
    }
    let result: KanbanRequestResult;
    try {
      result = snapshotKanbanEditorAuthorityResult(awaited.value);
    } catch {
      return this.#failSubmission();
    }
    this.#submissionController = undefined;
    return this.#settleSubmissionResult(result);
  }

  /** Explicitly discards a stale draft and reloads the latest authoritative record. */
  async reload(policy: KanbanEditorReloadPolicy): Promise<KanbanEditorReloadResult> {
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (policy !== 'discard-draft') return Object.freeze({ kind: 'failed' });
    if (
      this.#reloadController !== undefined ||
      (this.#submission.kind !== 'idle' && this.#submission.kind !== 'rejected')
    ) {
      return Object.freeze({ kind: 'sealed' });
    }
    if (this.#record.kind !== 'stale') return Object.freeze({ kind: 'failed' });
    const controller = new AbortController();
    this.#reloadController = controller;
    this.#reloadPublication = undefined;
    const generation = ++this.#submissionGeneration;
    this.#abortFieldValidations();
    let pending: Promise<KanbanEditorResolveResult<TCard>>;
    try {
      pending = Promise.resolve(this.#options.resolver.resolve(this.#cardKey, { signal: controller.signal }));
    } catch {
      this.#reloadController = undefined;
      const publication = this.#takeReloadPublication();
      if (publication?.kind === 'deleted') {
        this.#applyPublication(publication);
        return Object.freeze({ kind: 'deleted' });
      }
      if (publication !== undefined) {
        this.#rebase(publication.card, publication.revision);
        this.#notify();
        return Object.freeze({ kind: 'reloaded' });
      }
      return Object.freeze({ kind: 'failed' });
    }
    const awaited = await awaitEditorWork(pending, controller.signal);
    if (this.#disposed || controller.signal.aborted || generation !== this.#submissionGeneration) {
      return Object.freeze({ kind: 'disposed' });
    }
    this.#reloadController = undefined;
    const publication = this.#takeReloadPublication();
    if (publication?.kind === 'deleted') {
      this.#applyPublication(publication);
      return Object.freeze({ kind: 'deleted' });
    }
    if (publication !== undefined) {
      this.#rebase(publication.card, publication.revision);
      this.#notify();
      return Object.freeze({ kind: 'reloaded' });
    }
    if (awaited.kind === 'aborted') return Object.freeze({ kind: 'disposed' });
    if (awaited.kind === 'failed') return Object.freeze({ kind: 'failed' });
    try {
      const result = snapshotKanbanEditorResolveResult<TCard>(awaited.value);
      if (result.kind === 'unavailable') {
        this.#record = Object.freeze({ kind: 'unavailable', code: result.code });
        this.#notify();
        return Object.freeze({ kind: 'unavailable', code: result.code });
      }
      this.#rebase(result.card, result.revision);
      this.#notify();
      return Object.freeze({ kind: 'reloaded' });
    } catch {
      return Object.freeze({ kind: 'failed' });
    }
  }

  /** Subscribes to complete session snapshots. */
  subscribe(listener: (snapshot: KanbanEditorSessionSnapshot) => void): () => void {
    if (this.#disposed) return () => undefined;
    return this.#notifier.subscribe(listener);
  }

  /** Releases resolver, validation, reload, and pending request ownership idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#submissionGeneration += 1;
    this.#lifetime.abort();
    this.#submissionController?.abort();
    this.#submissionController = undefined;
    this.#reloadController?.abort();
    this.#reloadController = undefined;
    this.#dispatchPublication = undefined;
    this.#reloadPublication = undefined;
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
    this.#notifier.clear();
  }

  /** Reports whether all session-owned work has been invalidated. */
  disposed(): boolean {
    return this.#disposed;
  }

  /** Creates one application draft through an exception-isolated adapter callback. */
  #createDraft(card: TCard | undefined): TDraft {
    return createKanbanEditorDraft(this.#options.adapter, card, this.#options.mode, this.#lifetime.signal);
  }

  /** Snapshots one typed draft before it becomes observable or dispatchable. */
  #snapshotDraft(draft: TDraft): KanbanSemanticValue {
    return snapshotKanbanEditorDraft(this.#options.adapter, draft);
  }

  /** Captures schema-ordered field baselines without retaining mutable values. */
  #captureBaseline(): void {
    captureKanbanEditorFieldBaselines(this.#options.adapter.schema.fields, this.#draft, this.#baselineFields);
    this.#changedFieldIds = Object.freeze([]);
  }

  /** Recomputes changed identities in immutable schema order. */
  #refreshChangedFields(): void {
    this.#changedFieldIds = collectChangedKanbanEditorFieldIds(
      this.#options.adapter.schema.fields,
      this.#draft,
      this.#baselineFields,
    );
  }

  /** Returns the bounded field runtime shared by presentation and validation helpers. */
  #fieldRuntime() {
    return Object.freeze({
      draft: this.#draft,
      card: this.#card,
      mode: this.#options.mode,
      lifetimeSignal: this.#lifetime.signal,
    });
  }

  /** Runs ordered synchronous and asynchronous validators for one field generation. */
  async #validateField(
    field: KanbanCardEditorField<TDraft, unknown, TCard>,
    state: MutableKanbanEditorFieldState,
    controller: AbortController,
  ): Promise<void> {
    await validateKanbanEditorField({
      field,
      state,
      runtime: this.#fieldRuntime(),
      controller,
      disposed: () => this.#disposed,
      notify: () => this.#notify(),
    });
  }

  /** Refreshes safe formatted, visibility, and read-only state for every field. */
  #refreshPresentation(): void {
    for (const field of this.#options.adapter.schema.fields) {
      const state = this.#fields.get(field.fieldId);
      if (state !== undefined) refreshKanbanEditorFieldPresentation(field, state, this.#fieldRuntime());
    }
  }

  /** Converts one authority result into editor lifecycle state. */
  #settleSubmissionResult(result: KanbanRequestResult): KanbanEditorSubmitResult {
    const dispatchedPublication = this.#dispatchPublication;
    this.#dispatchPublication = undefined;
    switch (result.kind) {
      case 'rejected': {
        for (const error of result.fieldErrors ?? []) {
          const state = this.#fields.get(error.fieldId);
          if (state === undefined) continue;
          state.touched = true;
          state.validationDiagnostics = Object.freeze([
            ...state.validationDiagnostics,
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
        if (dispatchedPublication !== undefined) this.#applyPublication(dispatchedPublication);
        return Object.freeze({ kind: 'rejected', operationId: result.operationId, code: result.code });
      }
      case 'cancelled':
      case 'superseded':
        this.#submission = Object.freeze({ kind: 'idle' });
        this.#notify();
        if (dispatchedPublication !== undefined) this.#applyPublication(dispatchedPublication);
        return Object.freeze({ kind: result.kind, operationId: result.operationId });
      case 'accepted': {
        const subject = expectedKanbanEditorCardPublication(result, this.#cardKey);
        if (subject === undefined) {
          this.#record = Object.freeze({ kind: 'stale' });
          this.#submission = Object.freeze({ kind: 'idle' });
          this.#notify();
          if (dispatchedPublication !== undefined) this.#applyPublication(dispatchedPublication);
          return Object.freeze({ kind: 'failed' });
        }
        if (dispatchedPublication?.kind === 'deleted') {
          this.#record = Object.freeze({ kind: 'deleted' });
          this.#submission = Object.freeze({ kind: 'idle' });
          this.#expectedRevision = undefined;
          this.#notify();
          return Object.freeze({ kind: 'deleted' });
        }
        if (dispatchedPublication !== undefined) {
          if (kanbanRevisionsEqual(dispatchedPublication.revision, subject.expectedRevision)) {
            this.#rebase(dispatchedPublication.card, dispatchedPublication.revision);
            this.#submission = Object.freeze({ kind: 'committed', operationId: result.operationId });
            this.#notify();
            return Object.freeze({ kind: 'committed', operationId: result.operationId });
          }
          this.#card = dispatchedPublication.card;
          this.#record = Object.freeze({ kind: 'stale' });
          this.#submission = Object.freeze({ kind: 'idle' });
          this.#expectedRevision = undefined;
          this.#notify();
          return Object.freeze({ kind: 'stale' });
        }
        this.#expectedRevision = subject.expectedRevision;
        this.#submission = Object.freeze({ kind: 'awaiting-publication', operationId: result.operationId });
        this.#notify();
        return Object.freeze({ kind: 'awaiting-publication', operationId: result.operationId });
      }
    }
  }

  /** Returns one failed submit while preserving any publication observed during dispatch. */
  #failSubmission(): KanbanEditorSubmitResult {
    this.#submission = Object.freeze({ kind: 'idle' });
    this.#submissionController = undefined;
    const publication = this.#dispatchPublication;
    this.#dispatchPublication = undefined;
    if (publication === undefined) this.#notify();
    else this.#applyPublication(publication);
    return Object.freeze({ kind: 'failed' });
  }

  /** Takes the latest reload-time publication without relying on async control-flow inference. */
  #takeReloadPublication(): BufferedKanbanEditorRecordPublication<TCard> | undefined {
    const publication = this.#reloadPublication;
    this.#reloadPublication = undefined;
    return publication;
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
      state.validationDiagnostics = NO_KANBAN_EDITOR_DIAGNOSTICS;
      state.presentationDiagnostics = NO_KANBAN_EDITOR_DIAGNOSTICS;
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
  #submissionIsCurrent(generation: number, controller?: AbortController): boolean {
    return (
      !this.#disposed &&
      generation === this.#submissionGeneration &&
      (controller === undefined || !controller.signal.aborted)
    );
  }

  /** Maps an invalidated async submit to the authoritative record state that interrupted it. */
  #interruptedSubmissionResult(): KanbanEditorSubmitResult {
    this.#submissionController = undefined;
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (this.#record.kind === 'stale') return Object.freeze({ kind: 'stale' });
    if (this.#record.kind === 'deleted') return Object.freeze({ kind: 'deleted' });
    if (this.#record.kind === 'unavailable') return Object.freeze({ kind: 'unavailable' });
    return Object.freeze({ kind: 'failed' });
  }

  /** Publishes one post-transition snapshot while containing listener failures. */
  #notify(): void {
    this.#notifier.publish(
      () => this.snapshot(),
      () => this.#disposed,
    );
  }
}
