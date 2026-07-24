import type { CodeEditorHostEffect } from './lsp/types.js';
import type { CodeEditorDocumentModel } from './document/model.js';
import {
  copyIdentity,
  type DocumentEditInput,
  type DocumentIdentity,
  type DocumentMutationResult,
  type DocumentSelectionInput,
  type EditOrigin,
} from './document/types.js';
import type { CodeEditorLspCoordinator } from './lsp/coordinator.js';
import type { CodeEditorLspStateSnapshot } from './lsp/types.js';
import {
  snapshotCodeEditorMutationInput,
  type CodeEditorDisposable,
  type CodeEditorMutationInput,
} from './integration.js';
import { offsetToPosition, positionToOffset } from './document/positions.js';
import type { LocalLanguageResult } from './languages/contracts.js';
import { createDegradationState, type CodeEditorDegradationState } from './degradation.js';
import { utf8ByteLength } from './document/limits.js';
import { resolveCodeEditorLimits, type CodeEditorLimits, type CodeEditorLimitsInput } from './limits.js';
import {
  createObservabilityChannel,
  type CodeEditorObservabilityChannel,
  type CodeEditorObservabilityOptions,
} from './observability.js';
import {
  buildCollapsedHierarchy,
  collapsedHeadersContaining,
  type CollapsedFoldNode,
  type FoldableRegion,
  validateFoldableRegions,
} from './fold-regions.js';
import {
  codeEditorCompletionWordRange,
  normalizeCodeEditorCompletionItems,
  projectCodeEditorControllerPresentation,
  type CodeEditorCompletionItem,
  type CodeEditorCompletionPresentation,
  type CodeEditorControllerPresentation,
} from './presentation.js';

/** Host-owned effects raised by keyboard commands that leave the editor boundary. */
export type CodeEditorControllerHostEffect =
  | CodeEditorHostEffect
  | {
      readonly kind: 'save' | 'close';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
    };

/** Observable counters proving presentation-only work remains semantically inert. */
export interface CodeEditorControllerMetrics {
  readonly parserRuns: number;
  readonly lspRequests: number;
  readonly assistanceRequests: number;
}

/** Machine-readable state for host-provided status and accessible presentation. */
export interface CodeEditorControllerPublicState {
  readonly commandAvailability: Readonly<Record<string, boolean>>;
  readonly language: string;
  readonly serviceState: string;
  readonly line: number;
  readonly visualColumn: number;
  readonly selectionSize: number;
  readonly modified: boolean;
  readonly readOnly: boolean;
  readonly degradation: ReturnType<CodeEditorDegradationState['snapshot']>;
}

/** Metadata for one accepted mutation after every document invariant has been updated. */
export interface CodeEditorControllerMutationEvent {
  /** Source of the accepted atomic operation. */
  readonly origin: EditOrigin;
  /** Exact identity before the operation was applied. */
  readonly before: DocumentIdentity;
  /** Exact identity after the operation was applied. */
  readonly after: DocumentIdentity;
}

/** One coalesced controller change delivered to a terminal view. */
export type CodeEditorControllerEvent =
  | {
      /** Identifies a render-only state transition. */
      readonly kind: 'presentation';
      /** Latest immutable state for terminal projection. */
      readonly presentation: CodeEditorControllerPresentation;
    }
  | {
      /** Identifies one accepted source transaction. */
      readonly kind: 'document';
      /** Latest immutable state after the transaction. */
      readonly presentation: CodeEditorControllerPresentation;
      /** Exact transaction metadata delivered once to each live subscriber. */
      readonly mutation: CodeEditorControllerMutationEvent;
    };

/** Options for one document-scoped code-editor controller. */
export interface CreateCodeEditorControllerOptions {
  readonly document: CodeEditorDocumentModel;
  readonly host?: (effect: CodeEditorControllerHostEffect) => Promise<boolean>;
  readonly lsp?: CodeEditorLspCoordinator;
  readonly languageResult?: LocalLanguageResult;
  readonly limits?: CodeEditorLimitsInput;
  readonly observability?: CodeEditorObservabilityOptions;
}

/**
 * Owns public editor state and funnels every source mutation through document transactions.
 *
 * @example
 * ```ts
 * const controller = new CodeEditorController({ document });
 * ```
 */
export class CodeEditorController {
  public readonly document: CodeEditorDocumentModel;
  public readonly limits: CodeEditorLimits;
  public readonly degradation: CodeEditorDegradationState;
  public readonly observations: CodeEditorObservabilityChannel;
  readonly #host: (effect: CodeEditorControllerHostEffect) => Promise<boolean>;
  readonly #lsp: CodeEditorLspCoordinator | undefined;
  #languageResult: LocalLanguageResult | undefined;
  #foldableRegions: readonly FoldableRegion[] = Object.freeze([]);
  #foldableRegionLines: readonly { readonly from: number; readonly to: number }[] = Object.freeze([]);
  #foldableByKey: ReadonlyMap<string, FoldableRegion> = new Map();
  #foldableByLine: ReadonlyMap<number, FoldableRegion> = new Map();
  #collapsedFoldKeys: ReadonlySet<string> = new Set();
  #collapsedRegionLines: readonly { readonly from: number; readonly to: number }[] = Object.freeze([]);
  #collapsedRoots: readonly CollapsedFoldNode[] = Object.freeze([]);
  #reconciliationSourceRevision: number | undefined;
  #reconciliationTargetRevision: number | undefined;
  #invalidatedFoldKeys: ReadonlySet<string> = new Set();
  #parserRuns = 0;
  #lspRequests = 0;
  #assistanceRequests = 0;
  #disposed = false;
  #presentation: CodeEditorControllerPresentation;
  #manualCompletion: CodeEditorCompletionPresentation | undefined;
  readonly #listeners = new Set<(event: CodeEditorControllerEvent) => void>();
  readonly #pendingDocumentEvents: Extract<CodeEditorControllerEvent, { readonly kind: 'document' }>[] = [];
  #pendingPresentationEvent: Extract<CodeEditorControllerEvent, { readonly kind: 'presentation' }> | undefined;
  #notificationScheduled = false;
  #pendingRecipients: readonly ((event: CodeEditorControllerEvent) => void)[] = Object.freeze([]);
  #notificationGeneration = 0;
  readonly #lspStateSubscription: CodeEditorDisposable | undefined;
  readonly #lspMutationBinding: CodeEditorDisposable | undefined;

  public constructor(options: CreateCodeEditorControllerOptions) {
    this.document = options.document;
    this.#host = options.host ?? (async () => false);
    this.#lsp = options.lsp;
    if (this.#lsp !== undefined && this.#lsp.document !== this.document) {
      throw new TypeError('The language-service coordinator belongs to another document.');
    }
    this.#languageResult = undefined;
    this.limits = resolveCodeEditorLimits(options.limits);
    this.document.configureSafetyLimits({
      maxDocumentBytes: this.limits.documentBytes,
      maxDocumentLines: this.limits.documentLines,
      maxHistoryEntries: this.limits.historyEntries,
      maxHistoryBytes: this.limits.historyBytes,
      maxEditsPerTransaction: this.limits.editsPerTransaction,
      maxReplacementBytes: this.limits.replacementBytes,
    });
    this.#lsp?.configureLimits({
      completionItems: this.limits.completionItems,
      diagnostics: this.limits.diagnostics,
      edits: this.limits.editsPerTransaction,
      replacementCharacters: this.limits.replacementBytes,
      contentCharacters: Math.min(this.limits.protocolMessageBytes, 65_536),
    });
    this.degradation = createDegradationState();
    this.observations = createObservabilityChannel(options.observability);
    this.#presentation = projectCodeEditorControllerPresentation(this.#lsp?.state);
    let mutationBinding: CodeEditorDisposable | undefined;
    let stateSubscription: CodeEditorDisposable | undefined;
    try {
      mutationBinding = this.#lsp?.bindMutationSink({
        document: this.document,
        apply: (input) => this.applyMutation(input),
      });
      stateSubscription = this.#lsp?.subscribeState((state) => this.#receiveLspState(state));
      if (options.languageResult !== undefined) this.setLanguageResult(options.languageResult);
    } catch (error) {
      stateSubscription?.dispose();
      mutationBinding?.dispose();
      throw error;
    }
    this.#lspMutationBinding = mutationBinding;
    this.#lspStateSubscription = stateSubscription;
  }

  /** Returns a current immutable observability snapshot. */
  public get metrics(): CodeEditorControllerMetrics {
    return Object.freeze({
      parserRuns: this.#parserRuns,
      lspRequests: this.#lspRequests,
      assistanceRequests: this.#assistanceRequests,
    });
  }

  /** Returns the immutable assistance and service snapshot consumed by terminal views. */
  public get presentation(): CodeEditorControllerPresentation {
    return this.#presentation;
  }

  /**
   * Subscribes to coalesced presentation and accepted-document changes.
   *
   * Notifications normally run in a microtask. Accepted mutations retain their order, while a
   * presentation update in the same logical operation is folded into the final mutation event.
   * A hostile synchronous burst is drained at a fixed ceiling instead of growing without bound.
   *
   * @param listener - Callback invoked for each accepted mutation and coalesced presentation update.
   * @returns An idempotent handle that stops future callbacks.
   *
   * @throws {RangeError} When the bounded listener capacity has been reached.
   *
   * @example
   * ```ts
   * const subscription = controller.subscribe(() => render());
   * subscription.dispose();
   * ```
   */
  public subscribe(listener: (event: CodeEditorControllerEvent) => void): CodeEditorDisposable {
    if (typeof listener !== 'function') throw new TypeError('The controller listener must be a function.');
    if (this.#listeners.size >= 16) throw new RangeError('The controller listener limit was reached.');
    this.#listeners.add(listener);
    let active = true;
    return Object.freeze({
      dispose: () => {
        if (!active) return;
        active = false;
        this.#listeners.delete(listener);
      },
    });
  }

  /** Returns current content-free state for status and accessibility adapters. */
  public get publicState(): CodeEditorControllerPublicState {
    const position = offsetToPosition(this.document.snapshot, Number(this.document.selection.head));
    return Object.freeze({
      commandAvailability: Object.freeze({
        edit: !this.document.readOnly,
        search: true,
        fold: true,
        assist: true,
        navigate: true,
        format: !this.document.readOnly,
        save: true,
        close: true,
      }),
      language: this.document.languageId,
      serviceState: this.#lsp?.serviceState ?? 'plain',
      line: Number(position.line) + 1,
      visualColumn: Number(position.character) + 1,
      selectionSize: Math.abs(Number(this.document.selection.head) - Number(this.document.selection.anchor)),
      modified: this.document.modified,
      readOnly: this.document.readOnly,
      degradation: this.degradation.snapshot(),
    });
  }

  /** Returns content-free counters for controller-owned retained resources. */
  public get retainedState(): {
    readonly historyBytes: number;
    readonly folds: number;
    readonly diagnostics: number;
    readonly completions: number;
    readonly symbols: number;
    readonly requests: number;
    readonly telemetryEvents: number;
  } {
    const protocol = this.#lsp?.retainedState;
    return Object.freeze({
      historyBytes: this.document.retainedHistoryBytes,
      folds: this.folds.length,
      diagnostics: protocol?.diagnostics ?? 0,
      completions: protocol?.completions ?? 0,
      symbols: protocol?.symbols ?? 0,
      requests: protocol?.pendingRequests ?? 0,
      telemetryEvents: this.observations.snapshot().retainedEvents.length,
    });
  }

  /** Current validated local syntax/structure result, if available. */
  public get languageResult(): LocalLanguageResult | undefined {
    const result = this.#languageResult;
    if (result === undefined) return undefined;
    const identity = this.document.identity;
    return result.identity.lineage === identity.lineage &&
      Number(result.identity.revision) === Number(identity.revision)
      ? result
      : undefined;
  }

  /** Current validated multi-line structural regions, expressed as inclusive logical lines. */
  public get foldableRegions(): readonly { readonly from: number; readonly to: number }[] {
    return this.languageResult === undefined ? Object.freeze([]) : this.#foldableRegionLines;
  }

  /**
   * Current collapsed structural regions.
   *
   * Stale language results never hide source: when the document revision advances, this getter
   * returns an empty list until matching fresh analysis is installed.
   */
  public get folds(): readonly { readonly from: number; readonly to: number }[] {
    if (this.languageResult === undefined) return Object.freeze([]);
    return this.#collapsedRegionLines;
  }

  /**
   * Compatibility assignment for the original writable fold collection.
   *
   * Only ranges that exactly match current parser-validated structures are accepted. New code
   * should use the explicit fold commands so selection relocation and intent remain clear.
   */
  public set folds(regions: readonly { readonly from: number; readonly to: number }[]) {
    if (!Array.isArray(regions) || this.languageResult === undefined) return;
    const keys = new Set<string>();
    for (const value of regions.slice(0, this.limits.folds)) {
      const region = this.#foldableByLine.get(value.from);
      if (
        region !== undefined &&
        Number.isSafeInteger(value.from) &&
        Number.isSafeInteger(value.to) &&
        region.to === value.to
      )
        keys.add(region.key);
    }
    this.#relocateSelectionForCollapse(
      [...keys].flatMap((key) => {
        const region = this.#foldableByKey.get(key);
        return region === undefined ? [] : [region];
      }),
    );
    this.#collapsedFoldKeys = keys;
    this.#refreshCollapsedRegionLines();
  }

  /**
   * Replaces local presentation data only when it matches the active document identity.
   *
   * Fold ranges are treated as hostile adapter output even though the TypeScript contract is
   * typed. Invalid, crossing, duplicate, single-line, and over-limit ranges are removed before any
   * presentation consumer can hide source.
   */
  public setLanguageResult(result: LocalLanguageResult | undefined): void {
    if (this.#disposed) return;
    if (
      result === undefined ||
      (result.identity.lineage === this.document.identity.lineage &&
        Number(result.identity.revision) === Number(this.document.identity.revision))
    ) {
      if (result === undefined) {
        this.#languageResult = undefined;
        this.#foldableRegions = Object.freeze([]);
        this.#foldableRegionLines = Object.freeze([]);
        this.#foldableByKey = new Map();
        this.#foldableByLine = new Map();
        this.#collapsedFoldKeys = new Set();
        this.#collapsedRegionLines = Object.freeze([]);
        this.#collapsedRoots = Object.freeze([]);
      } else {
        const regions = validateFoldableRegions(this.document, result.folds, this.limits.folds, result.adapterId);
        const priorRevision = Number(this.#languageResult?.identity.revision ?? result.identity.revision);
        const incomingRevision = Number(result.identity.revision);
        const canPreserve =
          priorRevision === incomingRevision ||
          (this.#reconciliationSourceRevision === priorRevision &&
            this.#reconciliationTargetRevision === incomingRevision);
        const survivingKeys = new Set(
          regions
            .filter(
              (region) =>
                canPreserve && this.#collapsedFoldKeys.has(region.key) && !this.#invalidatedFoldKeys.has(region.key),
            )
            .map((region) => region.key),
        );
        this.#foldableRegions = regions;
        this.#foldableRegionLines = Object.freeze(regions.map(({ from, to }) => Object.freeze({ from, to })));
        this.#foldableByKey = new Map(regions.map((region) => [region.key, region]));
        this.#foldableByLine = new Map(regions.map((region) => [region.from, region]));
        this.#collapsedFoldKeys = survivingKeys;
        this.#refreshCollapsedRegionLines();
        this.#languageResult = Object.freeze({
          ...result,
          folds: Object.freeze(
            regions.map((region) => Object.freeze({ from: region.sourceFrom, to: region.sourceTo })),
          ),
        });
        this.#reconciliationSourceRevision = undefined;
        this.#reconciliationTargetRevision = undefined;
        this.#invalidatedFoldKeys = new Set();
      }
      this.#parserRuns += 1;
      if (result?.state === 'degraded') {
        this.degradation.fail('parser');
        this.observations.record({ kind: 'degradation', degradedTransitions: 1 });
      } else {
        this.degradation.recover('parser');
      }
    }
  }

  /** Maps sanitized LSP diagnostics into document-offset presentation spans. */
  public get diagnostics(): readonly {
    readonly from: number;
    readonly to: number;
    readonly severity: 'error' | 'warning' | 'information' | 'hint';
  }[] {
    const result: { from: number; to: number; severity: 'error' | 'warning' | 'information' | 'hint' }[] = [];
    for (const diagnostic of this.#lsp?.presentation.diagnostics.items ?? []) {
      try {
        result.push({
          from: Number(positionToOffset(this.document.snapshot, diagnostic.range.start)),
          to: Number(positionToOffset(this.document.snapshot, diagnostic.range.end)),
          severity: diagnostic.severity,
        });
      } catch {
        // A stale presentation is omitted instead of contaminating current geometry.
      }
    }
    return Object.freeze(result);
  }

  /** Maps current snippet placeholders into document-offset presentation spans. */
  public get snippets(): readonly { readonly from: number; readonly to: number; readonly active: boolean }[] {
    const snippet = this.#lsp?.snippet;
    if (snippet === undefined) return Object.freeze([]);
    return Object.freeze(
      [...snippet.ranges].map(([number, range]) =>
        Object.freeze({ from: range[0], to: range[1], active: number === snippet.activePlaceholder }),
      ),
    );
  }

  /** Applies one text replacement at the current selection. */
  public replaceSelection(text: string): boolean {
    if (this.#disposed || utf8ByteLength(text) > this.limits.replacementBytes) return false;
    const from = Math.min(Number(this.document.selection.anchor), Number(this.document.selection.head));
    const to = Math.max(Number(this.document.selection.anchor), Number(this.document.selection.head));
    return this.applyDocumentEdits([{ range: { from, to }, text }], {
      anchor: from + text.length,
      head: from + text.length,
    });
  }

  /**
   * Applies one origin-aware transaction and publishes exactly one accepted document event.
   *
   * Rejected, stale, overlapping, read-only, and over-limit requests remain semantically inert and
   * do not notify parsers, protocol synchronization, or terminal views.
   *
   * @param input - Untrusted mutation request to snapshot, validate, and apply atomically.
   * @returns The accepted result or a typed reason for an inert rejection.
   *
   * @example
   * ```ts
   * controller.applyMutation({
   *   edits: [{ range: { from: 0, to: 0 }, text: 'const ' }],
   *   origin: 'external',
   * });
   * ```
   */
  public applyMutation(input: CodeEditorMutationInput): DocumentMutationResult {
    if (this.#disposed) {
      return Object.freeze({ accepted: false, reason: 'invalid-edit' });
    }
    const normalized = snapshotCodeEditorMutationInput(input, this.limits.editsPerTransaction);
    if (normalized === undefined) return Object.freeze({ accepted: false, reason: 'invalid-edit' });
    const before = copyIdentity(this.document.identity);
    const touched = this.#touchedFoldKeys(normalized.edits);
    let result: DocumentMutationResult;
    try {
      result = this.document.apply(
        this.document.createTransaction({
          ...(normalized.base === undefined ? {} : { base: normalized.base }),
          edits: normalized.edits,
          ...(normalized.selection === undefined ? {} : { selection: normalized.selection }),
          origin: normalized.origin,
        }),
      );
    } catch {
      return Object.freeze({ accepted: false, reason: 'invalid-edit' });
    }
    if (!result.accepted) return result;
    if (this.#reconciliationTargetRevision !== undefined) {
      this.#invalidatedFoldKeys = new Set(this.#collapsedFoldKeys);
    } else {
      this.#reconciliationSourceRevision = Number(before.revision);
      this.#invalidatedFoldKeys = touched;
    }
    this.#reconciliationTargetRevision = Number(this.document.identity.revision);
    const mutation = Object.freeze({
      origin: normalized.origin,
      before,
      after: copyIdentity(this.document.identity),
    });
    this.#queueEvent(Object.freeze({ kind: 'document', presentation: this.#presentation, mutation }));
    void this.#lsp?.synchronize().catch(() => {
      this.degradation.fail('languageService');
      this.observations.record({ kind: 'degradation', degradedTransitions: 1 });
    });
    return result;
  }

  /**
   * Applies a validated editor transaction while recording which collapsed structures it touches.
   *
   * This shared mutation boundary lets fresh parser analysis preserve a fold after one unrelated
   * edit while conservatively expanding touched or ambiguously shifted structures.
   *
   * @param edits - Replacement list to apply as one typing transaction.
   * @param selection - Selection installed after successful application.
   * @returns `true` only when the complete transaction is accepted.
   */
  public applyDocumentEdits(edits: readonly DocumentEditInput[], selection: DocumentSelectionInput): boolean {
    return this.applyMutation({ edits, selection, origin: 'typing' }).accepted;
  }

  /** Sends a bounded, typed editor action to the embedding host. */
  public async hostAction(kind: 'navigate' | 'save' | 'close'): Promise<boolean> {
    if (this.#disposed) return false;
    const originUri = this.document.uri ?? 'untitled:///document';
    const common = {
      originUri,
      originRevision: Number(this.document.identity.revision),
      sessionGeneration: 0,
    };
    try {
      if (kind === 'navigate') {
        if (this.#lsp !== undefined) {
          this.#lspRequests += 1;
          this.#lsp.requestDefinition(toProtocolPosition(this.document));
        }
        return (
          (await this.#host({
            kind,
            ...common,
            targetUri: originUri,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            focus: true,
          })) === true
        );
      }
      return (await this.#host({ kind, ...common })) === true;
    } catch {
      this.degradation.fail('hostCallback');
      this.observations.record({ kind: 'degradation', degradedTransitions: 1 });
      return false;
    }
  }

  /** Requests completion through the optional document-scoped LSP coordinator. */
  public requestAssistance(): void {
    if (this.#disposed) return;
    this.#assistanceRequests += 1;
    if (this.#lsp !== undefined) {
      this.#lspRequests += 1;
      this.#lsp.requestCompletion(toProtocolPosition(this.document));
    }
  }

  /**
   * Opens one bounded manual completion list in the controller-owned assistance model.
   *
   * @param items - Host candidates to sanitize, detach, and retain within configured limits.
   * @returns `true` when the list is safe, including a safe empty list.
   *
   * @example
   * ```ts
   * controller.openCompletion([{ label: 'console', insertText: 'console' }]);
   * ```
   */
  public openCompletion(items: readonly CodeEditorCompletionItem[]): boolean {
    if (this.#disposed) return false;
    const normalized = normalizeCodeEditorCompletionItems(
      items,
      this.limits.completionItems,
      this.limits.popupWidth,
      this.document.text.length,
    );
    if (normalized === undefined) return false;
    this.#manualCompletion = Object.freeze({
      source: 'manual',
      items: normalized,
      selected: 0,
      lineage: this.document.identity.lineage,
      revision: Number(this.document.identity.revision),
    });
    this.#refreshPresentation(this.#lsp?.state);
    return true;
  }

  /** Dismisses completion and other transient assistance without changing the document. */
  public dismissAssistance(): void {
    if (this.#disposed) return;
    if (this.#manualCompletion !== undefined) {
      this.#manualCompletion = undefined;
      this.#refreshPresentation(this.#lsp?.state);
      return;
    }
    if (this.#lsp?.presentation.completion !== undefined) {
      this.#lsp.handleKey({ key: 'Escape' });
    }
  }

  /**
   * Routes assistance navigation before editor commands and text insertion.
   *
   * Manual and protocol completion share selection, acceptance, dismissal, and stale-revision
   * behavior even though the coordinator retains protocol-specific edit validation.
   *
   * @param key - Canonical terminal key routed by the active editor.
   * @returns The interaction owner that consumed the key, or `unhandled`.
   */
  public routeAssistanceKey(key: {
    readonly key: string;
    readonly text?: string;
    readonly shift?: boolean;
  }): 'completion' | 'snippet' | 'editor' | 'unhandled' {
    const completion = this.#manualCompletion;
    if (completion === undefined) return this.#lsp?.handleKey(key) ?? 'unhandled';
    if (key.key === 'Escape') {
      this.dismissAssistance();
      return 'completion';
    }
    if (key.key === 'ArrowDown' || key.key === 'PageDown' || key.key === 'ArrowUp' || key.key === 'PageUp') {
      const delta = key.key === 'ArrowDown' ? 1 : key.key === 'PageDown' ? 5 : key.key === 'ArrowUp' ? -1 : -5;
      this.#manualCompletion = Object.freeze({
        ...completion,
        selected: Math.max(0, Math.min(completion.items.length - 1, completion.selected + delta)),
      });
      this.#refreshPresentation(this.#lsp?.state);
      return 'completion';
    }
    if (key.key === 'Enter' || key.key === 'Tab') {
      this.#acceptManualCompletion(completion);
      return 'completion';
    }
    return 'unhandled';
  }

  /** Requests whole-document formatting through the optional LSP coordinator. */
  public requestFormatting(): void {
    if (this.#disposed) return;
    if (this.#lsp !== undefined) {
      this.#lspRequests += 1;
      this.#lsp.formatDocument();
    }
  }

  /** Collapses the structural region starting at the active line, when one exists. */
  public fold(): void {
    if (this.#disposed) return;
    const line = Number(offsetToPosition(this.document.snapshot, Number(this.document.selection.head)).line);
    this.foldLine(line);
  }

  /** Expands the collapsed structural region starting at the active line. */
  public unfold(): void {
    if (this.#disposed) return;
    const line = Number(offsetToPosition(this.document.snapshot, Number(this.document.selection.head)).line);
    this.unfoldLine(line);
  }

  /** Collapses every currently validated structural region. */
  public foldAll(): void {
    if (this.#disposed || this.languageResult === undefined) return;
    this.#relocateSelectionForCollapse(this.#foldableRegions);
    this.#collapsedFoldKeys = new Set(this.#foldableRegions.map((region) => region.key));
    this.#refreshCollapsedRegionLines();
  }

  /** Expands every collapsed structural region. */
  public unfoldAll(): void {
    if (this.#disposed) return;
    this.#collapsedFoldKeys = new Set();
    this.#collapsedRegionLines = Object.freeze([]);
    this.#collapsedRoots = Object.freeze([]);
  }

  /** Toggles the structural region at the active line. */
  public toggleFold(): void {
    if (this.#disposed) return;
    const line = Number(offsetToPosition(this.document.snapshot, Number(this.document.selection.head)).line);
    this.toggleFoldLine(line);
  }

  /** Collapses a validated structural region by its logical header line. */
  public foldLine(line: number): void {
    const region = this.#foldableByLine.get(line);
    if (region === undefined || this.languageResult === undefined || this.#collapsedFoldKeys.has(region.key)) return;
    this.#relocateSelectionForCollapse([region]);
    this.#collapsedFoldKeys = new Set([...this.#collapsedFoldKeys, region.key]);
    this.#refreshCollapsedRegionLines();
  }

  /** Expands a collapsed structural region by its logical header line. */
  public unfoldLine(line: number): void {
    const region = this.#foldableByLine.get(line);
    if (region === undefined || !this.#collapsedFoldKeys.has(region.key)) return;
    const next = new Set(this.#collapsedFoldKeys);
    next.delete(region.key);
    this.#collapsedFoldKeys = next;
    this.#refreshCollapsedRegionLines();
  }

  /** Toggles a structural region by its logical header line. */
  public toggleFoldLine(line: number): void {
    const region = this.#foldableByLine.get(line);
    if (region === undefined) return;
    if (this.#collapsedFoldKeys.has(region.key)) this.unfoldLine(line);
    else this.foldLine(line);
  }

  /**
   * Expands a collapsed structure when an editor action targets one of its hidden lines.
   *
   * @returns `true` when a fold was expanded.
   */
  public revealOffset(offset: number): boolean {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > this.document.snapshot.length) return false;
    const line = Number(offsetToPosition(this.document.snapshot, offset).line);
    const headers = collapsedHeadersContaining(this.#collapsedRoots, line);
    if (headers.length === 0) return false;
    const next = new Set(this.#collapsedFoldKeys);
    for (const header of headers) {
      const region = this.#foldableByLine.get(header);
      if (region !== undefined) next.delete(region.key);
    }
    this.#collapsedFoldKeys = next;
    this.#refreshCollapsedRegionLines();
    return true;
  }

  #acceptManualCompletion(completion: CodeEditorCompletionPresentation): void {
    const item = completion.items[completion.selected];
    const identity = this.document.identity;
    this.#manualCompletion = undefined;
    if (
      item === undefined ||
      completion.lineage !== identity.lineage ||
      completion.revision !== Number(identity.revision)
    ) {
      this.#refreshPresentation(this.#lsp?.state);
      return;
    }
    const selection = this.document.selection;
    const defaultRange = codeEditorCompletionWordRange(this.document.text, Number(selection.head));
    const from = item.from ?? defaultRange.from;
    const to = item.to ?? defaultRange.to;
    const text = item.insertText ?? item.label;
    this.applyMutation({
      base: identity,
      edits: [{ range: { from, to }, text }],
      selection: { anchor: from + text.length, head: from + text.length },
      origin: 'completion',
    });
    this.#refreshPresentation(this.#lsp?.state);
  }

  #receiveLspState(state: CodeEditorLspStateSnapshot): void {
    if (this.#disposed) return;
    if (state.presentation.completion !== undefined) this.#manualCompletion = undefined;
    this.#refreshPresentation(state);
  }

  #refreshPresentation(state: CodeEditorLspStateSnapshot | undefined): void {
    this.#presentation = projectCodeEditorControllerPresentation(state, this.#manualCompletion);
    this.#queueEvent(Object.freeze({ kind: 'presentation', presentation: this.#presentation }));
  }

  #queueEvent(event: CodeEditorControllerEvent): void {
    if (this.#disposed) return;
    if (event.kind === 'document') {
      if (this.#pendingDocumentEvents.length >= 4_096) this.#flushEvents();
      this.#pendingPresentationEvent = undefined;
      this.#pendingDocumentEvents.push(event);
    } else if (this.#pendingDocumentEvents.length > 0) {
      const lastIndex = this.#pendingDocumentEvents.length - 1;
      const last = this.#pendingDocumentEvents[lastIndex];
      if (last !== undefined) {
        this.#pendingDocumentEvents[lastIndex] = Object.freeze({ ...last, presentation: event.presentation });
      }
    } else {
      this.#pendingPresentationEvent = event;
    }
    if (this.#notificationScheduled) return;
    this.#notificationScheduled = true;
    this.#pendingRecipients = Object.freeze([...this.#listeners]);
    const generation = ++this.#notificationGeneration;
    queueMicrotask(() => {
      if (this.#disposed || generation !== this.#notificationGeneration) return;
      this.#flushEvents();
    });
  }

  #flushEvents(): void {
    if (this.#disposed) return;
    const events: readonly CodeEditorControllerEvent[] =
      this.#pendingDocumentEvents.length > 0
        ? Object.freeze(this.#pendingDocumentEvents.splice(0))
        : this.#pendingPresentationEvent === undefined
          ? Object.freeze([])
          : Object.freeze([this.#pendingPresentationEvent]);
    const recipients = this.#pendingRecipients;
    this.#pendingPresentationEvent = undefined;
    this.#pendingRecipients = Object.freeze([]);
    this.#notificationScheduled = false;
    this.#notificationGeneration += 1;
    for (const event of events) {
      for (const listener of recipients) {
        if (!this.#listeners.has(listener) || this.#disposed) continue;
        try {
          listener(event);
        } catch {
          this.degradation.fail('hostCallback');
        }
      }
    }
  }

  /** Releases controller-owned presentation, callback, and protocol resources. */
  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#notificationGeneration += 1;
    this.#pendingDocumentEvents.splice(0);
    this.#pendingPresentationEvent = undefined;
    this.#pendingRecipients = Object.freeze([]);
    this.#notificationScheduled = false;
    this.#listeners.clear();
    this.#lspStateSubscription?.dispose();
    this.#lspMutationBinding?.dispose();
    this.#manualCompletion = undefined;
    this.#presentation = projectCodeEditorControllerPresentation(undefined);
    this.#foldableRegions = Object.freeze([]);
    this.#foldableRegionLines = Object.freeze([]);
    this.#foldableByKey = new Map();
    this.#foldableByLine = new Map();
    this.#collapsedFoldKeys = new Set();
    this.#collapsedRegionLines = Object.freeze([]);
    this.#collapsedRoots = Object.freeze([]);
    this.#languageResult = undefined;
    this.document.releaseRetainedResources();
    this.degradation.dispose();
    this.observations.dispose();
    void this.#lsp?.close().catch(() => undefined);
  }

  #relocateSelectionForCollapse(regions: readonly FoldableRegion[]): void {
    const anchor = Number(this.document.selection.anchor);
    const head = Number(this.document.selection.head);
    for (const region of regions) {
      const hiddenFrom = Number(this.document.snapshot.line(region.from + 1).from);
      const hiddenTo = Number(this.document.snapshot.line(region.to).to);
      const selectionFrom = Math.min(anchor, head);
      const selectionTo = Math.max(anchor, head);
      if (selectionTo < hiddenFrom || selectionFrom > hiddenTo) continue;
      const header = Number(this.document.snapshot.line(region.from).from);
      this.document.setSelection({ anchor: header, head: header });
      return;
    }
  }

  #refreshCollapsedRegionLines(): void {
    const collapsed: { readonly from: number; readonly to: number }[] = [];
    for (const key of this.#collapsedFoldKeys) {
      const region = this.#foldableByKey.get(key);
      if (region !== undefined) collapsed.push(Object.freeze({ from: region.from, to: region.to }));
    }
    this.#collapsedRegionLines = Object.freeze(
      collapsed.sort((left, right) => left.from - right.from || right.to - left.to),
    );
    this.#collapsedRoots = buildCollapsedHierarchy(this.#collapsedRegionLines);
  }

  #touchedFoldKeys(edits: readonly DocumentEditInput[]): ReadonlySet<string> {
    const touched = new Set<string>();
    for (const region of this.#foldableRegions) {
      for (const edit of edits) {
        const from = Math.min(edit.range.from, edit.range.to);
        const to = Math.max(edit.range.from, edit.range.to);
        const insertionInside = from === to && from >= region.sourceFrom && from <= region.sourceTo;
        const replacementIntersects = from < region.sourceTo && to > region.sourceFrom;
        if (insertionInside || replacementIntersects) {
          touched.add(region.key);
          break;
        }
      }
    }
    return touched;
  }
}

function toProtocolPosition(document: CodeEditorDocumentModel): { readonly line: number; readonly character: number } {
  const position = offsetToPosition(document.snapshot, Number(document.selection.head));
  return { line: Number(position.line), character: Number(position.character) };
}

/**
 * Creates a controller shared by direct and window-hosted code editor views.
 *
 * @example
 * ```ts
 * const controller = createCodeEditorController({ document });
 * ```
 */
export function createCodeEditorController(options: CreateCodeEditorControllerOptions): CodeEditorController {
  return new CodeEditorController(options);
}
