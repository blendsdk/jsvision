import type { CodeEditorDocumentModel } from '../document/model.js';

/** Lifecycle states exposed independently from local editing and parsing. */
export type LspServiceState = 'plain' | 'connecting' | 'ready' | 'degraded';

/** Supported server capabilities negotiated by the editor-side coordinator. */
export interface CodeEditorLspCapabilities {
  readonly completion?: boolean;
  readonly hover?: boolean;
  readonly signatureHelp?: boolean;
  readonly diagnostics?: boolean;
  readonly definition?: boolean;
  readonly documentSymbols?: boolean;
  readonly documentFormatting?: boolean;
  readonly rangeFormatting?: boolean;
  readonly textDocumentSync?: 'full' | 'incremental';
  readonly completionTriggers?: readonly string[];
  readonly signatureTriggers?: readonly string[];
}

/** One protocol request recorded by the in-process session fixture. */
export interface LspRecordedRequest {
  readonly id: number;
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** One protocol notification recorded by a session. */
export interface LspRecordedNotification {
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** A cancellable editor operation with a stable correlation identifier. */
export interface CodeEditorLspOperation {
  readonly requestId: number;
  readonly settled: Promise<{ readonly outcome: LspOperationOutcome }>;
  cancel(): void;
}

/** Stable terminal outcomes for one asynchronous language-service operation. */
export type LspOperationOutcome = 'completed' | 'cancelled' | 'timeout' | 'failed' | 'stale' | 'unavailable';

/** Typed effects that remain under host authority. */
export type CodeEditorHostEffect =
  | {
      readonly kind: 'navigate';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly targetUri: string;
      readonly range: ProtocolRange;
      readonly focus: boolean;
    }
  | {
      readonly kind: 'workspace-edit';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly edit: ValidatedWorkspaceEdit;
      readonly atomic: true;
    }
  | {
      readonly kind: 'command-authorization';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
      readonly command: string;
      readonly arguments: readonly unknown[];
    };

/** Zero-based UTF-16 protocol position. */
export interface ProtocolPosition {
  readonly line: number;
  readonly character: number;
}

/** Half-open protocol range. */
export interface ProtocolRange {
  readonly start: ProtocolPosition;
  readonly end: ProtocolPosition;
}

/** A bounded inert cross-document edit proposal for host authorization. */
export interface ValidatedWorkspaceEdit {
  readonly changes: Readonly<Record<string, readonly { readonly range: ProtocolRange; readonly newText: string }[]>>;
}

/** Bounded completion item presented by the coordinator. */
export interface PresentedCompletionItem {
  readonly label: string;
  readonly detail?: string;
  readonly insertText?: string;
  readonly textEdit?: unknown;
  readonly additionalTextEdits?: readonly unknown[];
  readonly insertTextFormat?: unknown;
}

/** Current assistance presentation, intentionally independent from terminal widgets. */
export interface CodeEditorLspPresentation {
  readonly hover?: {
    readonly text: string;
    readonly clipped: boolean;
    readonly resourcesActive: false;
  };
  readonly signature?: { readonly lines: readonly string[] };
  readonly completion?: {
    readonly items: readonly PresentedCompletionItem[];
    readonly selected: number;
    readonly filter: string;
    readonly lineage: string;
    readonly revision: number;
    readonly sessionGeneration: number;
    readonly coordinatorGeneration: number;
  };
  readonly diagnostics: {
    readonly items: readonly PresentedDiagnostic[];
    readonly totalCount: number;
    readonly truncated: boolean;
    readonly versioned: boolean;
  };
  readonly navigationChooser?: { readonly items: readonly PresentedNavigationTarget[] };
  readonly symbolChooser?: { readonly items: readonly { readonly label: string; readonly range: ProtocolRange }[] };
}

/** Sanitized diagnostic retained for terminal presentation. */
export interface PresentedDiagnostic {
  readonly range: ProtocolRange;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'information' | 'hint';
}

/** Validated navigation target retained for local or host-owned navigation. */
export interface PresentedNavigationTarget {
  readonly uri: string;
  readonly range: ProtocolRange;
}

/** Safe local feature availability while a service is absent or unhealthy. */
export interface LocalCapabilityState {
  readonly editing: true;
  readonly parsing: true;
  readonly search: true;
  readonly gutter: true;
  readonly status: true;
  readonly save: true;
  readonly close: true;
}

/** Coordinator construction options. */
export interface CreateCodeEditorLspCoordinatorOptions {
  readonly document: CodeEditorDocumentModel;
  readonly session?: import('./session.js').CodeEditorLspSession;
  readonly uri: string;
  readonly languageId: string;
  readonly limits?: {
    readonly completionItems?: number;
    readonly diagnostics?: number;
    readonly contentCharacters?: number;
    readonly edits?: number;
    readonly replacementCharacters?: number;
  };
  readonly formatOnSave?: boolean;
  readonly now?: () => number;
  readonly clock?: {
    readonly now: () => number;
    readonly schedule: (callback: () => void, delayMilliseconds: number) => { dispose(): void };
  };
  readonly interactiveTimeoutMs?: number;
  readonly host?: (effect: CodeEditorHostEffect) => Promise<boolean>;
}
