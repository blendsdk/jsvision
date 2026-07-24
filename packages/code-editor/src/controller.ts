import type { CodeEditorHostEffect } from './lsp/types.js';
import type { CodeEditorDocumentModel } from './document/model.js';
import type { CodeEditorLspCoordinator } from './lsp/coordinator.js';
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
  public folds: readonly { readonly from: number; readonly to: number }[] = Object.freeze([]);
  public readonly limits: CodeEditorLimits;
  public readonly degradation: CodeEditorDegradationState;
  public readonly observations: CodeEditorObservabilityChannel;
  readonly #host: (effect: CodeEditorControllerHostEffect) => Promise<boolean>;
  readonly #lsp: CodeEditorLspCoordinator | undefined;
  #languageResult: LocalLanguageResult | undefined;
  #parserRuns = 0;
  #lspRequests = 0;
  #assistanceRequests = 0;
  #disposed = false;

  public constructor(options: CreateCodeEditorControllerOptions) {
    this.document = options.document;
    this.#host = options.host ?? (async () => false);
    this.#lsp = options.lsp;
    this.#languageResult = options.languageResult;
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
  }

  /** Returns a current immutable observability snapshot. */
  public get metrics(): CodeEditorControllerMetrics {
    return Object.freeze({
      parserRuns: this.#parserRuns,
      lspRequests: this.#lspRequests,
      assistanceRequests: this.#assistanceRequests,
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
    return this.#languageResult;
  }

  /** Replaces local presentation data only when it matches the active document identity. */
  public setLanguageResult(result: LocalLanguageResult | undefined): void {
    if (this.#disposed) return;
    if (
      result === undefined ||
      (result.identity.lineage === this.document.identity.lineage &&
        Number(result.identity.revision) === Number(this.document.identity.revision))
    ) {
      this.#languageResult = result;
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
    const accepted = this.document.apply(
      this.document.createTransaction({
        edits: [{ range: { from, to }, text }],
        selection: { anchor: from + text.length, head: from + text.length },
        origin: 'typing',
      }),
    ).accepted;
    if (!accepted) this.degradation.fail('documentModel');
    return accepted;
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

  /** Requests whole-document formatting through the optional LSP coordinator. */
  public requestFormatting(): void {
    if (this.#disposed) return;
    if (this.#lsp !== undefined) {
      this.#lspRequests += 1;
      this.#lsp.formatDocument();
    }
  }

  /** Toggles one local fold marker at the active line. */
  public toggleFold(): void {
    if (this.#disposed) return;
    const position = offsetToPosition(this.document.snapshot, Number(this.document.selection.head));
    if (this.folds.some((fold) => fold.from === Number(position.line))) {
      this.folds = Object.freeze(this.folds.filter((fold) => fold.from !== Number(position.line)));
    } else {
      this.folds = Object.freeze(
        [...this.folds, Object.freeze({ from: Number(position.line), to: Number(position.line) })].slice(
          -this.limits.folds,
        ),
      );
    }
  }

  /** Releases controller-owned presentation, callback, and protocol resources. */
  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.folds = Object.freeze([]);
    this.#languageResult = undefined;
    this.document.releaseRetainedResources();
    this.degradation.dispose();
    this.observations.dispose();
    void this.#lsp?.close().catch(() => undefined);
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
