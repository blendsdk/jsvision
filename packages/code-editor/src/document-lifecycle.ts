import type { CodeEditorDocumentModel } from './document/model.js';
import { utf8ByteLengthAtMost } from './document/limits.js';
import { copyIdentity, type DocumentIdentity } from './document/types.js';
import type { CodeEditorLspCoordinator } from './lsp/coordinator.js';

/** Stable outcomes reported for format-on-save preparation. */
export type CodeEditorSaveFormattingOutcome =
  'disabled' | 'applied' | 'invalid' | 'stale' | 'cancelled' | 'failure' | 'timeout';

/** Explicit host decision for one already-detected external document change. */
export type CodeEditorExternalChangeDecision = 'keep' | 'reload' | 'compare';

/** Untrusted external content and the host's explicit conflict decision. */
export interface CodeEditorExternalChangeInput {
  /** Exact external source supplied by the host. */
  readonly text: string;
  /** Explicit action selected by the host or user. */
  readonly decision: CodeEditorExternalChangeDecision;
}

/** Result of applying one external-change decision. */
export type CodeEditorExternalChangeResult = 'kept' | 'reloaded' | 'compare-requested' | 'rejected';

/** Typed persistence and conflict effects that remain under host authority. */
export type CodeEditorDocumentLifecycleHostEffect =
  | {
      /** Requests persistence of one exact source revision. */
      readonly kind: 'save';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly text: string;
      readonly formatting: CodeEditorSaveFormattingOutcome;
    }
  | {
      /** Requests permission to close the active document. */
      readonly kind: 'close';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly modified: boolean;
    }
  | {
      /** Requests a host-owned comparison without exposing local source text. */
      readonly kind: 'external-change';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly decision: 'compare';
      readonly text: string;
      readonly modified: boolean;
    };

/** Dependencies supplied by the document-scoped controller. */
export interface CodeEditorDocumentLifecycleOptions {
  /** Active in-memory document. */
  readonly document: CodeEditorDocumentModel;
  /** Optional language-service coordinator used only for format-on-save. */
  readonly lsp?: CodeEditorLspCoordinator;
  /** Configured maximum accepted external source bytes. */
  readonly maximumDocumentBytes: number;
  /** Host-owned authorization and persistence callback. */
  readonly host: (effect: CodeEditorDocumentLifecycleHostEffect) => Promise<boolean>;
  /** Installs validated external text and refreshes controller/protocol state. */
  readonly reload: (text: string) => Promise<boolean>;
  /** Reports an isolated host callback failure without leaking its details. */
  readonly hostFailed: () => void;
}

/**
 * Coordinates save, dirty-close, and external-change decisions without performing direct I/O.
 *
 * The host callback is the only persistence boundary. Save checkpoints are advanced only when
 * the accepted submission still identifies the current document, so edits made while a host save
 * is pending remain visibly modified.
 */
export class CodeEditorDocumentLifecycle {
  readonly #document: CodeEditorDocumentModel;
  readonly #lsp: CodeEditorLspCoordinator | undefined;
  readonly #maximumDocumentBytes: number;
  readonly #host: (effect: CodeEditorDocumentLifecycleHostEffect) => Promise<boolean>;
  readonly #reload: (text: string) => Promise<boolean>;
  readonly #hostFailed: () => void;

  public constructor(options: CodeEditorDocumentLifecycleOptions) {
    this.#document = options.document;
    this.#lsp = options.lsp;
    this.#maximumDocumentBytes = options.maximumDocumentBytes;
    this.#host = options.host;
    this.#reload = options.reload;
    this.#hostFailed = options.hostFailed;
  }

  /** Submits current text to the host after optional best-effort format-on-save preparation. */
  public async save(): Promise<boolean> {
    const prepared = await this.#prepareSave();
    const effect: CodeEditorDocumentLifecycleHostEffect = Object.freeze({
      kind: 'save',
      originUri: this.#document.uri ?? 'untitled:///document',
      originRevision: Number(prepared.identity.revision),
      sessionGeneration: 0,
      text: prepared.text,
      formatting: prepared.formatting,
    });
    const accepted = await this.#invokeHost(effect);
    if (accepted && sameIdentity(prepared.identity, this.#document.identity)) this.#document.markSaved();
    return accepted;
  }

  /** Requests host confirmation to close, including current dirty state. */
  public async requestClose(): Promise<boolean> {
    const identity = copyIdentity(this.#document.identity);
    const accepted = await this.#invokeHost(
      Object.freeze({
        kind: 'close',
        originUri: this.#document.uri ?? 'untitled:///document',
        originRevision: Number(identity.revision),
        sessionGeneration: 0,
        modified: this.#document.modified,
      }),
    );
    return accepted && sameIdentity(identity, this.#document.identity);
  }

  /** Applies one explicit external-change decision without reading or writing storage. */
  public async resolveExternalChange(input: CodeEditorExternalChangeInput): Promise<CodeEditorExternalChangeResult> {
    const normalized = normalizeExternalChange(input, this.#maximumDocumentBytes);
    if (normalized === undefined) return 'rejected';
    if (normalized.decision === 'keep') return 'kept';
    if (normalized.decision === 'reload') return (await this.#reload(normalized.text)) ? 'reloaded' : 'rejected';
    const accepted = await this.#invokeHost(
      Object.freeze({
        kind: 'external-change',
        originUri: this.#document.uri ?? 'untitled:///document',
        originRevision: Number(this.#document.identity.revision),
        sessionGeneration: 0,
        decision: 'compare',
        text: normalized.text,
        modified: this.#document.modified,
      }),
    );
    return accepted ? 'compare-requested' : 'rejected';
  }

  async #prepareSave(): Promise<{
    readonly text: string;
    readonly formatting: CodeEditorSaveFormattingOutcome;
    readonly identity: DocumentIdentity;
  }> {
    if (this.#lsp === undefined) {
      return {
        text: this.#document.text,
        formatting: 'disabled',
        identity: copyIdentity(this.#document.identity),
      };
    }
    try {
      const prepared = await this.#lsp.save();
      return {
        text: prepared.text,
        formatting: normalizeFormattingOutcome(prepared.formatting),
        identity: prepared.identity,
      };
    } catch {
      return {
        text: this.#document.text,
        formatting: 'failure',
        identity: copyIdentity(this.#document.identity),
      };
    }
  }

  async #invokeHost(effect: CodeEditorDocumentLifecycleHostEffect): Promise<boolean> {
    try {
      return (await this.#host(effect)) === true;
    } catch {
      this.#hostFailed();
      return false;
    }
  }
}

function normalizeExternalChange(
  input: CodeEditorExternalChangeInput,
  maximumDocumentBytes: number,
): CodeEditorExternalChangeInput | undefined {
  try {
    const text = ownData(input, 'text');
    const decision = ownData(input, 'decision');
    if (
      typeof text !== 'string' ||
      text.length > maximumDocumentBytes ||
      utf8ByteLengthAtMost(text, maximumDocumentBytes) > maximumDocumentBytes ||
      (decision !== 'keep' && decision !== 'reload' && decision !== 'compare')
    ) {
      return undefined;
    }
    return Object.freeze({ text, decision });
  } catch {
    return undefined;
  }
}

function normalizeFormattingOutcome(value: string): CodeEditorSaveFormattingOutcome {
  if (
    value === 'disabled' ||
    value === 'applied' ||
    value === 'invalid' ||
    value === 'stale' ||
    value === 'cancelled' ||
    value === 'failure' ||
    value === 'timeout'
  ) {
    return value;
  }
  return 'failure';
}

function sameIdentity(left: DocumentIdentity, right: DocumentIdentity): boolean {
  return left.lineage === right.lineage && left.revision === right.revision;
}

function ownData(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}
