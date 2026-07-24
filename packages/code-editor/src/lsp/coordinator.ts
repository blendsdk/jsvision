import type { CodeEditorDocumentModel } from '../document/model.js';
import { positionToOffset } from '../document/positions.js';
import type {
  CodeEditorHostEffect,
  CodeEditorLspOperation,
  CodeEditorLspPresentation,
  CreateCodeEditorLspCoordinatorOptions,
  LocalCapabilityState,
  LspServiceState,
  LspOperationOutcome,
  PresentedNavigationTarget,
  ProtocolPosition,
} from './types.js';
import type { CodeEditorLspSession } from './session.js';
import { applyPresentedCompletion, validateCompletionItems } from './completion.js';
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
  mapSnippetRanges,
  resolveCommandAvailability,
  resolveLspLimits,
  type LspCommandAvailability,
  type ResolvedLspLimits,
  unavailableOperation,
} from './coordinator-support.js';
import { isAllowedUri, recordValue, validateWorkspaceEdit } from './validation.js';

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

interface MutableOperation extends CodeEditorLspOperation {
  resolve(outcome: LspOperationOutcome): void;
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
  public serviceState: LspServiceState;
  public operationState: 'idle' | 'waiting' | 'pending' = 'idle';
  public closed = false;
  public readonly localCapabilities = defaultLocalCapabilities;
  public presentation: CodeEditorLspPresentation = emptyPresentation();
  public snippet: SnippetInteractionState | undefined;
  readonly #document: CodeEditorDocumentModel;
  readonly #session: CodeEditorLspSession | undefined;
  #limits: ResolvedLspLimits;
  readonly #now: () => number;
  readonly #schedule: (callback: () => void, delayMilliseconds: number) => { dispose(): void };
  readonly #interactiveTimeoutMs: number;
  readonly #host: (effect: CodeEditorHostEffect) => Promise<boolean>;
  readonly #pending = new Map<number, { readonly operation: MutableOperation; readonly startedAt: number }>();
  #uri: string;
  #languageId: string;
  #formatOnSave: boolean;
  #coordinatorGeneration = 1;
  #syncPromise: Promise<void> | undefined;
  #documentReady: Promise<void> = Promise.resolve();
  #resolveDocumentReady: (() => void) | undefined;
  #documentSynchronized = true;
  #lastSynchronizedText: string;
  #opened = false;
  readonly #navigationBack: number[] = [];
  #unsubscribeDiagnostics: (() => void) | undefined;
  #unsubscribeState: (() => void) | undefined;

  public constructor(options: CreateCodeEditorLspCoordinatorOptions) {
    if (!isAllowedUri(options.uri)) throw new TypeError('The active document URI is not allowed.');
    this.#document = options.document;
    this.#session = options.session;
    this.#uri = options.uri;
    this.#languageId = options.languageId;
    this.#formatOnSave = options.formatOnSave ?? false;
    this.#lastSynchronizedText = options.document.text;
    this.#limits = resolveLspLimits(options.limits);
    this.#now = options.clock?.now ?? options.now ?? Date.now;
    this.#schedule =
      options.clock?.schedule ??
      ((callback, delay) => {
        const timer = setTimeout(callback, delay);
        return { dispose: () => clearTimeout(timer) };
      });
    this.#interactiveTimeoutMs = boundedLimit(options.interactiveTimeoutMs, 5_000, 60_000);
    this.#host = options.host ?? (async () => false);
    this.serviceState =
      this.#session === undefined ? 'plain' : this.#session.state === 'ready' ? 'ready' : 'connecting';
    if (this.#session !== undefined && this.#session.state !== 'ready') {
      this.#documentSynchronized = false;
      this.#documentReady = new Promise((resolve) => {
        this.#resolveDocumentReady = resolve;
      });
    }
    if (this.#session !== undefined) {
      this.#unsubscribeDiagnostics = this.#session.subscribeDiagnostics((uri, version, diagnostics, metadata) => {
        this.#receiveDiagnostics(uri, version, diagnostics, metadata.generation);
      });
      this.#unsubscribeState = this.#session.subscribeState((state) => {
        if (state === 'connecting') {
          this.serviceState = 'connecting';
          this.#coordinatorGeneration += 1;
          this.#cancelAll();
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
    }
  }

  /** Applies a controller-owned limit projection before protocol requests begin. */
  public configureLimits(limits: CreateCodeEditorLspCoordinatorOptions['limits']): void {
    if (this.#opened || this.#pending.size > 0) {
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
      pendingRequests: this.#pending.size,
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
    const prior = this.#syncPromise ?? Promise.resolve();
    const snapshot = { text: this.#document.text, version: Number(this.#document.identity.revision) };
    const promise = prior.then(async () => {
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
    });
    const synchronized = promise.finally(() => {
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
    this.closed = true;
    this.#coordinatorGeneration += 1;
    this.#cancelAll();
    if (this.#session !== undefined && this.#opened) {
      await this.#session.notify('textDocument/didClose', { textDocument: { uri: this.#uri } });
    }
    this.#opened = false;
    this.#unsubscribeDiagnostics?.();
    this.#unsubscribeState?.();
    this.presentation = emptyPresentation();
  }

  /** Requests completion for one current UTF-16 position. */
  public requestCompletion(position: ProtocolPosition): CodeEditorLspOperation {
    if (!this.commandAvailability.completion) return unavailableOperation();
    return this.#request('textDocument/completion', position, (result) => {
      const items = validateCompletionItems(result, this.#limits.completionItems, this.#limits.contentCharacters);
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
    });
  }

  /** Requests completion only for a currently negotiated trigger character. */
  public triggerCompletion(character: string, position: ProtocolPosition): CodeEditorLspOperation {
    return this.#session?.capabilities.completionTriggers?.includes(character) === true
      ? this.requestCompletion(position)
      : unavailableOperation();
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
    if (!this.commandAvailability.signatureHelp) return unavailableOperation();
    return this.#request('textDocument/signatureHelp', position, (result) => {
      const lines = presentSignature(result, this.#limits.contentCharacters);
      this.presentation = {
        ...this.presentation,
        ...(lines === undefined ? {} : { signature: Object.freeze({ lines }) }),
      };
    });
  }

  /** Requests signature help only for a currently negotiated trigger character. */
  public triggerSignature(character: string, position: ProtocolPosition): CodeEditorLspOperation {
    return this.#session?.capabilities.signatureTriggers?.includes(character) === true
      ? this.requestSignature(position)
      : unavailableOperation();
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
    if (!this.commandAvailability.documentFormatting) return unavailableOperation();
    return this.#request('textDocument/formatting', undefined, (result) => {
      this.#applyFormatting(result);
    });
  }

  /** Requests formatting for one validated selected range. */
  public formatRange(range: import('./types.js').ProtocolRange): CodeEditorLspOperation {
    if (!this.commandAvailability.rangeFormatting) return unavailableOperation();
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
    const normalized = applyPresentedCompletion(
      this.#document,
      item,
      this.#limits.edits,
      this.#limits.replacementCharacters,
    );
    if (normalized === undefined) return;
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
    const result = routeAssistanceKey(this.presentation.completion, this.snippet, key);
    this.snippet = result.snippet;
    if (result.snippet !== undefined) this.#selectSnippetPlaceholder(result.snippet.activePlaceholder);
    this.presentation = { ...this.presentation, completion: result.completion };
    if (result.acceptCompletion) this.acceptCompletion();
    return result.owner;
  }

  /** Ends snippet mode after an external or conflicting document edit. */
  public documentChanged(): void {
    this.snippet = undefined;
  }

  /** Invalidates caret-context assistance after a local caret move. */
  public caretChanged(): void {
    this.presentation = { ...this.presentation, hover: undefined, signature: undefined };
  }

  /** Chooses one current-document symbol. */
  public chooseDocumentSymbol(index: number): boolean {
    const symbol = this.presentation.symbolChooser?.items[index];
    if (symbol === undefined) return false;
    const offset = positionToOffset(this.#document.snapshot, symbol.range.start);
    this.#navigationBack.push(Number(this.#document.selection.head));
    if (this.#navigationBack.length > 64) this.#navigationBack.shift();
    this.#document.setSelection({ anchor: offset, head: offset });
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
    for (const value of this.#pending.values()) {
      if (this.#now() - value.startedAt >= 150) {
        this.operationState = 'pending';
        return;
      }
    }
  }

  /** Reports commands enabled by the current negotiated session capabilities. */
  public get commandAvailability(): LspCommandAvailability {
    return resolveCommandAvailability(this.#languageId, this.#session?.capabilities);
  }

  #request(
    method: string,
    position: ProtocolPosition | undefined,
    accept: (result: unknown) => void,
    fail?: (error: Error) => void,
    stale?: () => void,
    extraParams: Readonly<Record<string, unknown>> = {},
  ): CodeEditorLspOperation {
    const id = this.#session?.reserveRequestId() ?? 0;
    let settle: ((result: { readonly outcome: LspOperationOutcome }) => void) | undefined;
    const timers: {
      deadline?: { dispose(): void };
      pendingIndicator?: { dispose(): void };
    } = {};
    const settled = new Promise<{ readonly outcome: LspOperationOutcome }>((resolve) => {
      settle = resolve;
    });
    const operation: MutableOperation = {
      requestId: id,
      settled,
      cancel: () => {
        this.#session?.cancel(id);
        this.#pending.delete(id);
        operation.resolve('cancelled');
      },
      resolve: (outcome) => {
        timers.deadline?.dispose();
        timers.pendingIndicator?.dispose();
        this.#pending.delete(id);
        if (this.#pending.size === 0) this.operationState = 'idle';
        settle?.({ outcome });
      },
    };
    if (this.#session === undefined || this.closed) {
      operation.resolve('unavailable');
      return operation;
    }
    if (this.#pending.size >= 64) {
      operation.resolve('failed');
      return operation;
    }
    const stamp = this.#stamp();
    this.#pending.set(id, { operation, startedAt: this.#now() });
    this.operationState = 'waiting';
    timers.pendingIndicator = this.#schedule(() => {
      if (this.#pending.has(id)) this.operationState = 'pending';
    }, 150);
    timers.deadline = this.#schedule(() => {
      if (!this.#pending.has(id)) return;
      this.#session?.cancel(id);
      this.serviceState = 'degraded';
      fail?.(new Error('LSP request timed out.'));
      operation.resolve('timeout');
    }, this.#interactiveTimeoutMs);
    const issue = () => {
      if (!this.#pending.has(id) || !this.#matches(stamp) || this.#session?.state !== 'ready') return;
      this.#session?.request(
        id,
        method,
        {
          textDocument: { uri: this.#uri },
          ...(position === undefined ? {} : { position }),
          ...extraParams,
        },
        (result, error) => {
          if (error !== undefined) {
            this.serviceState = 'degraded';
            fail?.(error);
            operation.resolve('failed');
          } else if (this.#matches(stamp)) {
            accept(result);
            operation.resolve('completed');
          } else {
            stale?.();
            operation.resolve('stale');
          }
        },
      );
    };
    if (this.#documentSynchronized && this.#syncPromise === undefined) {
      issue();
    } else if (this.#documentSynchronized && this.#syncPromise !== undefined) {
      void this.#syncPromise.then(issue, () => operation.resolve('failed'));
    } else {
      void Promise.all([this.#documentReady, this.#syncPromise ?? Promise.resolve()]).then(issue, () =>
        operation.resolve('failed'),
      );
    }
    return operation;
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
    try {
      const transaction = this.#document.createTransaction({
        base: this.#document.identity,
        edits,
        origin: 'format',
      });
      return this.#document.apply(transaction).accepted;
    } catch {
      return false;
    }
  }

  #selectSnippetPlaceholder(number: number): void {
    const range = this.snippet?.ranges.get(number);
    if (range !== undefined) this.#document.setSelection({ anchor: range[0], head: range[1] });
  }

  async #replaceProtocolIdentity(uri: string, languageId: string): Promise<void> {
    this.#coordinatorGeneration += 1;
    this.#cancelAll();
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

  #cancelAll(): void {
    for (const [id, value] of this.#pending) {
      this.#session?.cancel(id);
      value.operation.resolve('cancelled');
    }
    this.#pending.clear();
    this.operationState = 'idle';
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
