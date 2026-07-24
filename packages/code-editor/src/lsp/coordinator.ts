import type { CodeEditorDocumentModel } from '../document/model.js';
import type { DocumentMutationResult } from '../document/types.js';
import { positionToOffset } from '../document/positions.js';
import {
  applyCodeEditorMutation,
  type CodeEditorDisposable,
  type CodeEditorMutationInput,
  type CodeEditorMutationSink,
} from '../integration.js';
import type {
  CodeEditorHostEffect,
  CodeEditorLspCommandAvailability,
  CodeEditorLspOperation,
  CodeEditorLspPresentation,
  CodeEditorLspStateSnapshot,
  CreateCodeEditorLspCoordinatorOptions,
  LocalCapabilityState,
  LspServiceState,
  PresentedNavigationTarget,
  ProtocolPosition,
} from './types.js';
import type { CodeEditorLspSession } from './session.js';
import { completionEdits, validateCompletionItems } from './completion.js';
import { validateDiagnostics } from './diagnostics.js';
import { validateFormattingEdits } from './formatting.js';
import { presentHover, presentSignature } from './hover.js';
import { routeAssistanceKey, type SnippetInteractionState } from './interaction.js';
import { validateDocumentSymbols, validateNavigationTargets } from './navigation.js';
import {
  boundedCommandArguments,
  boundedLimit,
  emptyPresentation,
  endPosition,
  immutablePresentation,
  mapSnippetRanges,
  resolveCommandAvailability,
  resolveLspLimits,
  type ResolvedLspLimits,
  unavailableOperation,
} from './coordinator-support.js';
import { isAllowedUri, recordValue, validateWorkspaceEdit } from './validation.js';
import { LspRequestLifecycle } from './request-lifecycle.js';

const defaultLocalCapabilities: LocalCapabilityState = Object.freeze({
  editing: true,
  parsing: true,
  search: true,
  gutter: true,
  status: true,
  save: true,
  close: true,
});

interface RequestStamp {
  readonly lineage: string;
  readonly revision: number;
  readonly uri: string;
  readonly languageId: string;
  readonly sessionGeneration: number;
  readonly coordinatorGeneration: number;
}

/**
 * Coordinates one document with an optional transport-neutral LSP session.
 *
 * @example
 * ```ts
 * const coordinator = new CodeEditorLspCoordinator({ document, uri, languageId: 'typescript' });
 * await coordinator.open();
 * ```
 */
export class CodeEditorLspCoordinator {
  public closed = false;
  public readonly localCapabilities = defaultLocalCapabilities;
  #serviceState: LspServiceState = 'plain';
  #operationState: 'idle' | 'waiting' | 'pending' = 'idle';
  #presentation: CodeEditorLspPresentation = emptyPresentation();
  #snippet: SnippetInteractionState | undefined;
  readonly #document: CodeEditorDocumentModel;
  readonly #session: CodeEditorLspSession | undefined;
  #limits: ResolvedLspLimits;
  readonly #host: (effect: CodeEditorHostEffect) => Promise<boolean>;
  readonly #requests: LspRequestLifecycle<RequestStamp>;
  #uri: string;
  #languageId: string;
  #formatOnSave: boolean;
  #coordinatorGeneration = 1;
  #syncPromise: Promise<void> | undefined;
  #syncRequested = false;
  #documentReady: Promise<void> = Promise.resolve();
  #resolveDocumentReady: (() => void) | undefined;
  #documentSynchronized = true;
  #lastSynchronizedText: string;
  #opened = false;
  readonly #navigationBack: number[] = [];
  #unsubscribeDiagnostics: (() => void) | undefined;
  #unsubscribeState: (() => void) | undefined;
  #stateSnapshot!: CodeEditorLspStateSnapshot;
  readonly #stateListeners = new Set<(state: CodeEditorLspStateSnapshot) => void>();
  #stateNotificationsReady = false;
  #stateBatchDepth = 0;
  #stateChanged = false;
  #mutationSink: CodeEditorMutationSink | undefined;
  #completionTrigger: CodeEditorLspOperation | undefined;
  #signatureTrigger: CodeEditorLspOperation | undefined;

  /** Current language-service lifecycle state. */
  public get serviceState(): LspServiceState {
    return this.#serviceState;
  }

  public set serviceState(value: LspServiceState) {
    if (this.#serviceState === value) return;
    this.#serviceState = value;
    this.#markStateChanged();
  }

  /** Current request indicator used by status and accessibility presentation. */
  public get operationState(): 'idle' | 'waiting' | 'pending' {
    return this.#operationState;
  }

  public set operationState(value: 'idle' | 'waiting' | 'pending') {
    if (this.#operationState === value) return;
    this.#operationState = value;
    this.#markStateChanged();
  }

  /** Current bounded assistance presentation. */
  public get presentation(): CodeEditorLspPresentation {
    return this.#presentation;
  }

  public set presentation(value: CodeEditorLspPresentation) {
    if (this.#presentation === value) return;
    try {
      this.#presentation = immutablePresentation(value, this.#limits, this.#presentation);
    } catch {
      this.#presentation = emptyPresentation();
    }
    this.#markStateChanged();
  }

  /** Current internal snippet traversal state retained for compatibility. */
  public get snippet(): SnippetInteractionState | undefined {
    return this.#snippet;
  }

  public set snippet(value: SnippetInteractionState | undefined) {
    if (this.#snippet === value) return;
    this.#snippet = value;
    this.#markStateChanged();
  }

  public constructor(options: CreateCodeEditorLspCoordinatorOptions) {
    if (!isAllowedUri(options.uri)) throw new TypeError('The active document URI is not allowed.');
    this.#document = options.document;
    this.#session = options.session;
    this.#uri = options.uri;
    this.#languageId = options.languageId;
    this.#formatOnSave = options.formatOnSave ?? false;
    this.#lastSynchronizedText = options.document.text;
    this.#limits = resolveLspLimits(options.limits);
    const now = options.clock?.now ?? options.now ?? Date.now;
    const schedule =
      options.clock?.schedule ??
      ((callback, delay) => {
        const timer = setTimeout(callback, delay);
        return { dispose: () => clearTimeout(timer) };
      });
    const interactiveTimeoutMs = boundedLimit(options.interactiveTimeoutMs, 5_000, 60_000);
    this.#host = options.host ?? (async () => false);
    this.serviceState =
      this.#session === undefined ? 'plain' : this.#session.state === 'ready' ? 'ready' : 'connecting';
    if (this.#session !== undefined && this.#session.state !== 'ready') {
      this.#documentSynchronized = false;
      this.#documentReady = new Promise((resolve) => {
        this.#resolveDocumentReady = resolve;
      });
    }
    this.#requests = new LspRequestLifecycle({
      session: this.#session,
      scheduler: { now, schedule },
      timeoutMilliseconds: interactiveTimeoutMs,
      captureStamp: () => this.#stamp(),
      stampIsCurrent: (stamp) => this.#matches(stamp),
      issueBarrier: (afterSynchronousNotification) => this.#requestBarrier(afterSynchronousNotification),
      batchStateChange: (change) => this.#batchStateChange(change),
      setOperationState: (state) => {
        this.operationState = state;
      },
      markTimeoutDegraded: () => {
        this.serviceState = 'degraded';
      },
      markFailureDegraded: () => {
        this.serviceState = 'degraded';
      },
    });
    if (this.#session !== undefined) {
      this.#unsubscribeDiagnostics = this.#session.subscribeDiagnostics((uri, version, diagnostics, metadata) => {
        this.#receiveDiagnostics(uri, version, diagnostics, metadata.generation);
      });
      this.#unsubscribeState = this.#session.subscribeState((state) => {
        this.#batchStateChange(() => {
          if (state === 'connecting') {
            this.serviceState = 'connecting';
            this.#coordinatorGeneration += 1;
            this.#requests.cancelAll();
            this.#documentSynchronized = false;
            this.presentation = emptyPresentation();
            this.snippet = undefined;
            this.#documentReady = new Promise((resolve) => {
              this.#resolveDocumentReady = resolve;
            });
          } else if (state === 'ready') {
            this.serviceState = 'ready';
            if (!this.#documentSynchronized) void this.resynchronize();
          } else if (state === 'degraded') {
            this.serviceState = 'degraded';
          }
        });
      });
    }
    this.#stateSnapshot = this.#createStateSnapshot();
    this.#stateNotificationsReady = true;
  }

  /** Applies a controller-owned limit projection before protocol requests begin. */
  public configureLimits(limits: CreateCodeEditorLspCoordinatorOptions['limits']): void {
    if (this.#opened || this.#requests.size > 0) {
      throw new Error('LSP limits must be configured before opening the document.');
    }
    this.#limits = resolveLspLimits(limits);
  }

  /** Returns content-free retained protocol counters for lifecycle inspection. */
  public get retainedState(): {
    readonly pendingRequests: number;
    readonly diagnostics: number;
    readonly completions: number;
    readonly symbols: number;
    readonly snippetPlaceholders: number;
  } {
    return Object.freeze({
      pendingRequests: this.#requests.size,
      diagnostics: this.presentation.diagnostics.items.length,
      completions: this.presentation.completion?.items.length ?? 0,
      symbols: this.presentation.symbolChooser?.items.length ?? 0,
      snippetPlaceholders: this.snippet?.ranges.size ?? 0,
    });
  }

  /** Returns the document model controlled by this coordinator. */
  public get document(): CodeEditorDocumentModel {
    return this.#document;
  }

  /** Returns the latest immutable render-facing coordinator state. */
  public get state(): CodeEditorLspStateSnapshot {
    return this.#stateSnapshot;
  }

  /**
   * Subscribes to coalesced render-facing coordinator changes.
   *
   * Listener failures are isolated so one embedding host cannot block other editors.
   *
   * @throws {RangeError} When the bounded listener capacity has been reached.
   */
  public subscribeState(listener: (state: CodeEditorLspStateSnapshot) => void): CodeEditorDisposable {
    if (typeof listener !== 'function') throw new TypeError('The coordinator state listener must be a function.');
    if (this.#stateListeners.size >= 16) throw new RangeError('The coordinator state listener limit was reached.');
    this.#stateListeners.add(listener);
    let active = true;
    return Object.freeze({
      dispose: () => {
        if (!active) return;
        active = false;
        this.#stateListeners.delete(listener);
      },
    });
  }

  /**
   * Delegates provider mutations to one controller for this exact document.
   *
   * Standalone coordinators continue to use their validated direct-document fallback until bound.
   *
   * @throws {TypeError} When the sink belongs to another document.
   * @throws {Error} When another live sink already owns mutation integration.
   */
  public bindMutationSink(sink: CodeEditorMutationSink): CodeEditorDisposable {
    if (sink.document !== this.#document) throw new TypeError('The mutation sink belongs to another document.');
    if (this.#mutationSink !== undefined) throw new Error('The coordinator already has a mutation sink.');
    this.#mutationSink = sink;
    let active = true;
    return Object.freeze({
      dispose: () => {
        if (!active) return;
        active = false;
        if (this.#mutationSink === sink) this.#mutationSink = undefined;
      },
    });
  }

  /** Opens the active protocol document after validating its URI. */
  public async open(): Promise<void> {
    if (this.closed || this.#session === undefined || this.#opened) return;
    if (this.#session.state !== 'ready') {
      await this.#documentReady;
      return;
    }
    await this.#session.notify('textDocument/didOpen', this.#textDocumentPayload());
    this.#opened = true;
    this.#lastSynchronizedText = this.#document.text;
  }

  /** Sends the current revision in protocol order and releases queued requests. */
  public synchronize(): Promise<void> {
    if (this.#session === undefined || !this.#opened || this.closed) return Promise.resolve();
    this.#syncRequested = true;
    if (this.#syncPromise !== undefined) return this.#syncPromise;
    const drain = async () => {
      while (this.#syncRequested && !this.closed) {
        this.#syncRequested = false;
        const snapshot = { text: this.#document.text, version: Number(this.#document.identity.revision) };
        const incremental = this.#session?.capabilities.textDocumentSync === 'incremental';
        await this.#session?.notify('textDocument/didChange', {
          textDocument: { uri: this.#uri, version: snapshot.version },
          contentChanges: incremental
            ? [
                {
                  range: { start: { line: 0, character: 0 }, end: endPosition(this.#lastSynchronizedText) },
                  text: snapshot.text,
                },
              ]
            : [{ text: snapshot.text }],
        });
        this.#lastSynchronizedText = snapshot.text;
      }
    };
    const synchronized = drain().finally(() => {
      if (this.#syncPromise === synchronized) this.#syncPromise = undefined;
    });
    this.#syncPromise = synchronized;
    return synchronized;
  }

  /** Reopens the current document after a session generation change. */
  public async resynchronize(): Promise<void> {
    if (this.#session === undefined || this.closed) return;
    if (this.#session.state !== 'ready') return;
    const prior = this.#syncPromise ?? Promise.resolve();
    this.#documentSynchronized = false;
    const resynchronization = prior.then(async () => {
      if (this.#opened) await this.#session?.notify('textDocument/didClose', { textDocument: { uri: this.#uri } });
      await this.#session?.notify('textDocument/didOpen', this.#textDocumentPayload());
      this.#opened = true;
      this.#lastSynchronizedText = this.#document.text;
      this.serviceState = 'ready';
      this.#resolveDocumentReady?.();
      this.#resolveDocumentReady = undefined;
      this.#documentSynchronized = true;
      this.#session?.markReady();
    });
    this.#syncPromise = resynchronization;
    await resynchronization;
    if (this.#syncPromise === resynchronization) this.#syncPromise = undefined;
  }

  /** Replaces the active language while preserving document text and resynchronizing protocol state. */
  public async setLanguage(languageId: string): Promise<void> {
    if (typeof languageId !== 'string' || languageId.length === 0 || languageId.length > 128) {
      throw new TypeError('Language identifier is invalid.');
    }
    await this.#replaceProtocolIdentity(this.#uri, languageId);
  }

  /** Replaces the active URI while preserving document text and resynchronizing protocol state. */
  public async setUri(uri: string): Promise<void> {
    if (!isAllowedUri(uri)) throw new TypeError('The active document URI is not allowed.');
    await this.#replaceProtocolIdentity(uri, this.#languageId);
  }

  /** Closes protocol state and leaves local save/edit/close behavior available. */
  public async close(): Promise<void> {
    if (this.closed) return;
    const notifyClose = this.#session !== undefined && this.#opened;
    this.closed = true;
    this.#stateListeners.clear();
    this.#mutationSink = undefined;
    this.#coordinatorGeneration += 1;
    this.#requests.cancelAll();
    this.#opened = false;
    this.#unsubscribeDiagnostics?.();
    this.#unsubscribeDiagnostics = undefined;
    this.#unsubscribeState?.();
    this.#unsubscribeState = undefined;
    this.#resolveDocumentReady?.();
    this.#resolveDocumentReady = undefined;
    this.#documentSynchronized = true;
    this.#presentation = emptyPresentation();
    if (notifyClose) {
      void this.#session?.notify('textDocument/didClose', { textDocument: { uri: this.#uri } }).catch(() => undefined);
    }
  }

  /** Requests completion for one current UTF-16 position. */
  public requestCompletion(position: ProtocolPosition): CodeEditorLspOperation {
    return this.#requestCompletion(position);
  }

  #requestCompletion(position: ProtocolPosition, afterSynchronousNotification = false): CodeEditorLspOperation {
    if (!this.commandAvailability.completion) return unavailableOperation();
    return this.#request(
      'textDocument/completion',
      position,
      (result) => {
        const items = validateCompletionItems(
          result,
          this.#limits.completionItems,
          this.#limits.contentCharacters,
          this.#limits.edits,
          this.#limits.replacementCharacters,
        );
        this.presentation = {
          ...this.presentation,
          completion: Object.freeze({
            items,
            selected: 0,
            filter: this.#document.text,
            lineage: this.#document.identity.lineage,
            revision: Number(this.#document.identity.revision),
            sessionGeneration: this.#session?.generation ?? 0,
            coordinatorGeneration: this.#coordinatorGeneration,
          }),
        };
      },
      undefined,
      undefined,
      {},
      afterSynchronousNotification,
    );
  }

  /** Requests completion only for a currently negotiated trigger character. */
  public triggerCompletion(character: string, position: ProtocolPosition): CodeEditorLspOperation {
    if (this.#session?.capabilities.completionTriggers?.includes(character) !== true) return unavailableOperation();
    this.#completionTrigger?.cancel();
    const operation = this.#requestCompletion(position, true);
    this.#completionTrigger = operation;
    void operation.settled.finally(() => {
      if (this.#completionTrigger === operation) this.#completionTrigger = undefined;
    });
    return operation;
  }

  /** Requests explicit hover content for one caret position. */
  public requestHover(
    position: ProtocolPosition,
    viewport?: { readonly width: number; readonly height: number },
  ): CodeEditorLspOperation {
    if (!this.commandAvailability.hover) return unavailableOperation();
    return this.#request('textDocument/hover', position, (result) => {
      const hover = presentHover(result, this.#limits.contentCharacters, viewport);
      this.presentation = { ...this.presentation, ...(hover === undefined ? {} : { hover }) };
    });
  }

  /** Requests signature help and a non-color active-parameter marker. */
  public requestSignature(position: ProtocolPosition): CodeEditorLspOperation {
    return this.#requestSignature(position);
  }

  #requestSignature(position: ProtocolPosition, afterSynchronousNotification = false): CodeEditorLspOperation {
    if (!this.commandAvailability.signatureHelp) return unavailableOperation();
    return this.#request(
      'textDocument/signatureHelp',
      position,
      (result) => {
        const lines = presentSignature(result, this.#limits.contentCharacters);
        this.presentation = {
          ...this.presentation,
          ...(lines === undefined ? {} : { signature: Object.freeze({ lines }) }),
        };
      },
      undefined,
      undefined,
      {},
      afterSynchronousNotification,
    );
  }

  /** Requests signature help only for a currently negotiated trigger character. */
  public triggerSignature(character: string, position: ProtocolPosition): CodeEditorLspOperation {
    if (this.#session?.capabilities.signatureTriggers?.includes(character) !== true) return unavailableOperation();
    this.#signatureTrigger?.cancel();
    const operation = this.#requestSignature(position, true);
    this.#signatureTrigger = operation;
    void operation.settled.finally(() => {
      if (this.#signatureTrigger === operation) this.#signatureTrigger = undefined;
    });
    return operation;
  }

  /** Requests definition-style navigation. */
  public requestDefinition(position: ProtocolPosition): CodeEditorLspOperation {
    if (!this.commandAvailability.definition) return unavailableOperation();
    return this.#request('textDocument/definition', position, (result) => {
      const targets = validateNavigationTargets(this.#document.snapshot, result, this.#uri);
      if (targets.length === 1) {
        void this.#navigate(targets[0]);
      } else if (targets.length > 1) {
        this.presentation = {
          ...this.presentation,
          navigationChooser: Object.freeze({ items: targets }),
        };
      }
    });
  }

  /** Requests bounded document symbols. */
  public requestDocumentSymbols(): CodeEditorLspOperation {
    if (!this.commandAvailability.documentSymbols) return unavailableOperation();
    return this.#request('textDocument/documentSymbol', undefined, (result) => {
      const items = validateDocumentSymbols(this.#document.snapshot, result);
      this.presentation = { ...this.presentation, symbolChooser: Object.freeze({ items }) };
    });
  }

  /** Requests whole-document formatting. */
  public formatDocument(): CodeEditorLspOperation {
    if (this.#document.readOnly || !this.commandAvailability.documentFormatting) return unavailableOperation();
    return this.#request('textDocument/formatting', undefined, (result) => {
      this.#applyFormatting(result);
    });
  }

  /** Requests formatting for one validated selected range. */
  public formatRange(range: import('./types.js').ProtocolRange): CodeEditorLspOperation {
    if (this.#document.readOnly || !this.commandAvailability.rangeFormatting) return unavailableOperation();
    return this.#request(
      'textDocument/rangeFormatting',
      undefined,
      (result) => {
        this.#applyFormatting(result);
      },
      undefined,
      undefined,
      { range },
    );
  }

  /** Applies the selected completion atomically, without executing its command field. */
  public acceptCompletion(_options?: { readonly execute?: (value: unknown) => void }): void {
    const completion = this.presentation.completion;
    if (completion === undefined) return;
    const item = completion.items[completion.selected];
    if (item === undefined) return;
    if (
      completion.lineage !== this.#document.identity.lineage ||
      completion.revision !== Number(this.#document.identity.revision) ||
      completion.sessionGeneration !== (this.#session?.generation ?? 0) ||
      completion.coordinatorGeneration !== this.#coordinatorGeneration
    ) {
      this.presentation = { ...this.presentation, completion: undefined };
      return;
    }
    const normalized = completionEdits(this.#document, item, this.#limits.edits, this.#limits.replacementCharacters);
    if (normalized === undefined) return;
    const applied = this.#applyMutation({
      base: this.#document.identity,
      edits: normalized.edits,
      origin: 'completion',
    });
    if (!applied.accepted) return;
    const numbered = [...(normalized.snippet?.placeholders.keys() ?? [])]
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    const ranges = mapSnippetRanges(normalized);
    const placeholders = Object.freeze([...numbered, ...(ranges.has(0) ? [0] : [])]);
    this.snippet =
      placeholders.length === 0
        ? undefined
        : Object.freeze({ placeholders, activePlaceholder: placeholders[0] ?? 0, ranges });
    if (this.snippet !== undefined) this.#selectSnippetPlaceholder(this.snippet.activePlaceholder);
    this.presentation = { ...this.presentation, completion: undefined };
  }

  /** Routes assistance keys without consuming unrelated editor commands. */
  public handleKey(key: {
    readonly key: string;
    readonly text?: string;
    readonly shift?: boolean;
  }): 'completion' | 'snippet' | 'editor' | 'unhandled' {
    let owner: 'completion' | 'snippet' | 'editor' | 'unhandled' = 'unhandled';
    this.#batchStateChange(() => {
      const result = routeAssistanceKey(this.presentation.completion, this.snippet, key);
      owner = result.owner;
      this.snippet = result.snippet;
      if (result.snippet !== undefined) this.#selectSnippetPlaceholder(result.snippet.activePlaceholder);
      if (result.acceptCompletion) {
        this.acceptCompletion();
      } else {
        this.presentation = { ...this.presentation, completion: result.completion };
      }
    });
    return owner;
  }

  /** Ends snippet mode after an external or conflicting document edit. */
  public documentChanged(): void {
    this.#navigationBack.splice(0);
    this.#batchStateChange(() => {
      this.snippet = undefined;
      this.presentation = emptyPresentation();
    });
  }

  /** Invalidates caret-context assistance after a local caret move. */
  public caretChanged(): void {
    if (this.presentation.hover === undefined && this.presentation.signature === undefined) return;
    this.presentation = { ...this.presentation, hover: undefined, signature: undefined };
  }

  /**
   * Dismisses transient popups while preserving diagnostics and local editing state.
   *
   * @example
   * ```ts
   * coordinator.dismissTransientAssistance();
   * ```
   */
  public dismissTransientAssistance(): void {
    this.presentation = {
      diagnostics: this.presentation.diagnostics,
    };
  }

  /** Chooses one current-document symbol. */
  public chooseDocumentSymbol(index: number): boolean {
    const symbol = this.presentation.symbolChooser?.items[index];
    if (symbol === undefined) return false;
    const offset = positionToOffset(this.#document.snapshot, symbol.range.start);
    this.#navigationBack.push(Number(this.#document.selection.head));
    if (this.#navigationBack.length > 64) this.#navigationBack.shift();
    this.#document.setSelection({ anchor: offset, head: offset });
    this.presentation = { ...this.presentation, symbolChooser: undefined };
    return true;
  }

  /** Returns to the latest bounded local navigation origin. */
  public navigateBack(): boolean {
    const offset = this.#navigationBack.pop();
    if (offset === undefined) return false;
    this.#document.setSelection({ anchor: offset, head: offset });
    return true;
  }

  /** Chooses one previously validated navigation target. */
  public async chooseNavigationTarget(index: number): Promise<void> {
    const target = this.presentation.navigationChooser?.items[index];
    if (target !== undefined) await this.#navigate(target);
  }

  /** Forwards a cross-document edit proposal to the host without applying it. */
  public async proposeWorkspaceEdit(edit: unknown): Promise<boolean> {
    const validated = validateWorkspaceEdit(edit, this.#limits.edits, this.#limits.replacementCharacters);
    if (validated === undefined) return false;
    return this.#host({
      kind: 'workspace-edit',
      originUri: this.#uri,
      originRevision: Number(this.#document.identity.revision),
      sessionGeneration: this.#session?.generation ?? 0,
      edit: validated,
      atomic: true,
    });
  }

  /** Forwards only a bounded command identifier to the host authorization seam. */
  public async forwardCommand(command: unknown): Promise<boolean> {
    const record = recordValue(command);
    if (record === undefined || typeof record.command !== 'string' || !/^[A-Za-z0-9._-]{1,256}$/u.test(record.command))
      return false;
    const argumentsValue = boundedCommandArguments(record.arguments);
    if (argumentsValue === undefined) return false;
    return this.#host({
      kind: 'command-authorization',
      originUri: this.#uri,
      originRevision: Number(this.#document.identity.revision),
      sessionGeneration: this.#session?.generation ?? 0,
      command: record.command,
      arguments: argumentsValue,
    });
  }

  /** Returns text for host saving, applying opt-in valid current formatting when available. */
  public async save(): Promise<{ readonly text: string; readonly formatting: string }> {
    if (!this.#formatOnSave || this.#session?.capabilities.documentFormatting !== true) {
      return { text: this.#document.text, formatting: 'disabled' };
    }
    return new Promise((resolve) => {
      const stamp = this.#stamp();
      const operation = this.#request(
        'textDocument/formatting',
        undefined,
        (result) => {
          if (!this.#matches(stamp)) {
            resolve({ text: this.#document.text, formatting: 'stale' });
            return;
          }
          const applied = this.#applyFormatting(result);
          resolve({ text: this.#document.text, formatting: applied ? 'applied' : 'invalid' });
        },
        (error) => {
          resolve({
            text: this.#document.text,
            formatting: error.message.toLowerCase().includes('timed out') ? 'timeout' : 'failure',
          });
        },
        () => {
          resolve({ text: this.#document.text, formatting: 'stale' });
        },
      );
      void operation;
    });
  }

  /** Advances the pending indicator using the injected monotonic clock. */
  public tick(): void {
    this.#requests.tick();
  }

  /** Reports commands enabled by the current negotiated session capabilities. */
  public get commandAvailability(): CodeEditorLspCommandAvailability {
    return resolveCommandAvailability(this.#languageId, this.#session?.capabilities);
  }

  #request(
    method: string,
    position: ProtocolPosition | undefined,
    accept: (result: unknown) => void,
    fail?: (error: Error) => void,
    stale?: () => void,
    extraParams: Readonly<Record<string, unknown>> = {},
    afterSynchronousNotification = false,
  ): CodeEditorLspOperation {
    if (this.closed) return unavailableOperation();
    return this.#requests.request({
      method,
      params: {
        textDocument: { uri: this.#uri },
        ...(position === undefined ? {} : { position }),
        ...extraParams,
      },
      accept,
      ...(fail === undefined ? {} : { fail }),
      ...(stale === undefined ? {} : { stale }),
      afterSynchronousNotification,
    });
  }

  #requestBarrier(afterSynchronousNotification: boolean): Promise<void> | undefined {
    if (this.#documentSynchronized) {
      if (this.#syncPromise === undefined) return undefined;
      if (afterSynchronousNotification && this.#session?.notificationOrdering === 'synchronous-enqueue') {
        return undefined;
      }
      return this.#syncPromise;
    }
    return Promise.all([this.#documentReady, this.#syncPromise ?? Promise.resolve()]).then(() => undefined);
  }

  #stamp(): RequestStamp {
    return Object.freeze({
      lineage: this.#document.identity.lineage,
      revision: Number(this.#document.identity.revision),
      uri: this.#uri,
      languageId: this.#languageId,
      sessionGeneration: this.#session?.generation ?? 0,
      coordinatorGeneration: this.#coordinatorGeneration,
    });
  }

  #matches(stamp: RequestStamp): boolean {
    return (
      !this.closed &&
      stamp.lineage === this.#document.identity.lineage &&
      stamp.revision === Number(this.#document.identity.revision) &&
      stamp.uri === this.#uri &&
      stamp.languageId === this.#languageId &&
      stamp.sessionGeneration === (this.#session?.generation ?? 0) &&
      stamp.coordinatorGeneration === this.#coordinatorGeneration
    );
  }

  #receiveDiagnostics(uri: string, version: number | undefined, diagnostics: unknown, generation: number): void {
    if (this.closed || uri !== this.#uri || generation !== (this.#session?.generation ?? 0)) return;
    const revision = Number(this.#document.identity.revision);
    if (version !== undefined && version !== revision) return;
    const result = validateDiagnostics(
      this.#document.snapshot,
      diagnostics,
      this.#limits.diagnostics,
      this.#limits.contentCharacters,
    );
    this.presentation = {
      ...this.presentation,
      diagnostics: Object.freeze({ ...result, versioned: version !== undefined }),
    };
  }

  async #navigate(target: PresentedNavigationTarget): Promise<void> {
    if (target.uri === this.#uri) {
      this.#navigationBack.push(Number(this.#document.selection.head));
      if (this.#navigationBack.length > 64) this.#navigationBack.shift();
      const offset = positionToOffset(this.#document.snapshot, target.range.start);
      this.#document.setSelection({ anchor: offset, head: offset });
      this.presentation = { ...this.presentation, navigationChooser: undefined };
      return;
    }
    await this.#host({
      kind: 'navigate',
      originUri: this.#uri,
      originRevision: Number(this.#document.identity.revision),
      sessionGeneration: this.#session?.generation ?? 0,
      targetUri: target.uri,
      range: target.range,
      focus: true,
    });
  }

  #applyFormatting(result: unknown): boolean {
    const edits = validateFormattingEdits(
      this.#document,
      result,
      this.#limits.edits,
      this.#limits.replacementCharacters,
    );
    if (edits === undefined) return false;
    return this.#applyMutation({
      base: this.#document.identity,
      edits,
      origin: 'format',
    }).accepted;
  }

  #selectSnippetPlaceholder(number: number): void {
    const range = this.snippet?.ranges.get(number);
    if (range !== undefined) this.#document.setSelection({ anchor: range[0], head: range[1] });
  }

  async #replaceProtocolIdentity(uri: string, languageId: string): Promise<void> {
    this.#coordinatorGeneration += 1;
    this.#requests.cancelAll();
    if (this.#session !== undefined && this.#opened) {
      await this.#session.notify('textDocument/didClose', { textDocument: { uri: this.#uri } });
    }
    this.#uri = uri;
    this.#languageId = languageId;
    this.presentation = emptyPresentation();
    if (this.#session !== undefined && !this.closed) {
      await this.#session.notify('textDocument/didOpen', this.#textDocumentPayload());
      this.#opened = true;
    }
  }

  #applyMutation(input: CodeEditorMutationInput): DocumentMutationResult {
    return this.#mutationSink?.apply(input) ?? applyCodeEditorMutation(this.#document, input);
  }

  #createStateSnapshot(): CodeEditorLspStateSnapshot {
    const snippet =
      this.#snippet === undefined
        ? undefined
        : Object.freeze({
            placeholders: Object.freeze([...this.#snippet.placeholders]),
            activePlaceholder: this.#snippet.activePlaceholder,
            ranges: Object.freeze(
              [...this.#snippet.ranges].map(([placeholder, range]) =>
                Object.freeze({ placeholder, from: range[0], to: range[1] }),
              ),
            ),
          });
    return Object.freeze({
      presentation: this.#presentation,
      ...(snippet === undefined ? {} : { snippet }),
      serviceState: this.#serviceState,
      operationState: this.#operationState,
      commandAvailability: this.commandAvailability,
    });
  }

  #markStateChanged(): void {
    if (!this.#stateNotificationsReady || this.closed) return;
    this.#stateChanged = true;
    if (this.#stateBatchDepth === 0) this.#publishState();
  }

  #batchStateChange(change: () => void): void {
    this.#stateBatchDepth += 1;
    try {
      change();
    } finally {
      this.#stateBatchDepth -= 1;
      if (this.#stateBatchDepth === 0 && this.#stateChanged) this.#publishState();
    }
  }

  #publishState(): void {
    if (!this.#stateNotificationsReady || this.closed || !this.#stateChanged) return;
    this.#stateChanged = false;
    this.#stateSnapshot = this.#createStateSnapshot();
    for (const listener of [...this.#stateListeners]) {
      if (!this.#stateListeners.has(listener) || this.closed) continue;
      try {
        listener(this.#stateSnapshot);
      } catch {
        // Subscriber failures are isolated because protocol state must remain usable by other views.
      }
    }
  }

  #textDocumentPayload(): Readonly<Record<string, unknown>> {
    return {
      textDocument: {
        uri: this.#uri,
        languageId: this.#languageId,
        version: Number(this.#document.identity.revision),
        text: this.#document.text,
      },
    };
  }
}

/**
 * Creates one document-scoped LSP coordinator.
 *
 * @example
 * ```ts
 * const coordinator = createCodeEditorLspCoordinator({ document, uri, languageId: 'typescript' });
 * ```
 */
export function createCodeEditorLspCoordinator(
  options: CreateCodeEditorLspCoordinatorOptions,
): CodeEditorLspCoordinator {
  return new CodeEditorLspCoordinator(options);
}
