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
    const collapsed: { readonly from: number; readonly to: number }[] = [];
    for (const key of this.#collapsedFoldKeys) {
      const region = this.#foldableByKey.get(key);
      if (region !== undefined) collapsed.push(Object.freeze({ from: region.from, to: region.to }));
    }
    return Object.freeze(collapsed.sort((left, right) => left.from - right.from || right.to - left.to));
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
      } else {
        const regions = validateFoldableRegions(this.document, result.folds, this.limits.folds, result.adapterId);
        const survivingKeys = new Set(
          regions.filter((region) => this.#collapsedFoldKeys.has(region.key)).map((region) => region.key),
        );
        this.#foldableRegions = regions;
        this.#foldableRegionLines = Object.freeze(regions.map(({ from, to }) => Object.freeze({ from, to })));
        this.#foldableByKey = new Map(regions.map((region) => [region.key, region]));
        this.#foldableByLine = new Map(regions.map((region) => [region.from, region]));
        this.#collapsedFoldKeys = survivingKeys;
        this.#languageResult = Object.freeze({
          ...result,
          folds: Object.freeze(
            regions.map((region) => Object.freeze({ from: region.sourceFrom, to: region.sourceTo })),
          ),
        });
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
  }

  /** Expands every collapsed structural region. */
  public unfoldAll(): void {
    if (this.#disposed) return;
    this.#collapsedFoldKeys = new Set();
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
  }

  /** Expands a collapsed structural region by its logical header line. */
  public unfoldLine(line: number): void {
    const region = this.#foldableByLine.get(line);
    if (region === undefined || !this.#collapsedFoldKeys.has(region.key)) return;
    const next = new Set(this.#collapsedFoldKeys);
    next.delete(region.key);
    this.#collapsedFoldKeys = next;
  }

  /** Toggles a structural region by its logical header line. */
  public toggleFoldLine(line: number): void {
    const region = this.#foldableByLine.get(line);
    if (region === undefined) return;
    if (this.#collapsedFoldKeys.has(region.key)) this.unfoldLine(line);
    else this.foldLine(line);
  }

  /** Releases controller-owned presentation, callback, and protocol resources. */
  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#foldableRegions = Object.freeze([]);
    this.#foldableRegionLines = Object.freeze([]);
    this.#foldableByKey = new Map();
    this.#foldableByLine = new Map();
    this.#collapsedFoldKeys = new Set();
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
}

interface FoldableRegion {
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly from: number;
  readonly to: number;
  readonly key: string;
}

function validateFoldableRegions(
  document: CodeEditorDocumentModel,
  ranges: LocalLanguageResult['folds'],
  limit: number,
  adapterId: string,
): readonly FoldableRegion[] {
  const snapshot = document.snapshot;
  const candidates: Omit<FoldableRegion, 'key'>[] = [];
  const seen = new Set<string>();
  const inspectionLimit = Math.min(ranges.length, Math.max(limit, Math.min(limit * 4, 200_000)));
  for (let index = 0; index < inspectionLimit; index += 1) {
    const range = ranges[index];
    if (range === undefined) continue;
    if (candidates.length >= limit) break;
    if (
      !Number.isSafeInteger(range.from) ||
      !Number.isSafeInteger(range.to) ||
      range.from < 0 ||
      range.to <= range.from ||
      range.to > snapshot.length
    )
      continue;
    const from = Number(offsetToPosition(snapshot, range.from).line);
    const to = Number(offsetToPosition(snapshot, Math.max(range.from, range.to - 1)).line);
    if (to <= from) continue;
    const identity = `${range.from}:${range.to}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    candidates.push({ sourceFrom: range.from, sourceTo: range.to, from, to });
  }
  candidates.sort((left, right) => left.from - right.from || right.to - left.to);
  const nested: Omit<FoldableRegion, 'key'>[] = [];
  const parents: Omit<FoldableRegion, 'key'>[] = [];
  for (const candidate of candidates) {
    while (parents.length > 0 && candidate.from > (parents.at(-1)?.to ?? -1)) parents.pop();
    const parent = parents.at(-1);
    if (parent !== undefined && candidate.to > parent.to) continue;
    nested.push(candidate);
    parents.push(candidate);
  }
  const keyed: FoldableRegion[] = [];
  const path: FoldableRegion[] = [];
  for (const region of nested) {
    while (path.length > 0 && region.from > (path.at(-1)?.to ?? -1)) path.pop();
    const header = snapshot.line(region.from).text.trim();
    const key = `${adapterId}\u0000${[...path.map((parent) => snapshot.line(parent.from).text.trim()), header].join(
      '\u0000',
    )}`;
    const candidate = Object.freeze({ ...region, key });
    keyed.push(candidate);
    path.push(candidate);
  }
  const keyCounts = new Map<string, number>();
  for (const region of keyed) keyCounts.set(region.key, (keyCounts.get(region.key) ?? 0) + 1);
  return Object.freeze(keyed.filter((region) => keyCounts.get(region.key) === 1));
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
