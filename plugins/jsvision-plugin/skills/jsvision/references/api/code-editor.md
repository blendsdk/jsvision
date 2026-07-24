<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/code-editor — terminal-native source editing

The document model, terminal editor surfaces, language adapters, LSP coordination, themes, safety limits, and observability.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## BracketPair

```ts
interface BracketPair {
  open: number;
  close: number;
}
```

## CodeEditor

Focusable terminal-native source editor backed by a document controller.

```ts
new CodeEditor(options: CodeEditorOptions)   // extends Group
// methods & signals:
controller: CodeEditorController
behavior
nonColorIndicators
chrome
journey: string[]
assistanceView: CodeEditorAssistanceView
scroll: { readonly x: Signal<number>; readonly y: Signal<number> }
focusState: 'idle' | 'focused' | 'released'
focus(): boolean
execute(command: CodeEditorCommand): void
insertText(text: string): boolean
openCompletion(items: readonly CodeEditorCompletionItem[]): void
openModal(modal: CodeEditorModalState): void
startSnippet(placeholders: readonly { readonly from: number; readonly to: number }[]): void
setSearchQuery(query: string): void
routeKey(key: CodeEditorKey): CodeEditorKeyRoute
setTheme(theme: CodeEditorTheme | ResolvedCodeEditorTheme): void
project(options: {
    readonly width: number;
    readonly height: number;
    readonly caps: CapabilityProfile;
  }): CodeEditorFrame
whenIdle(): Promise<void>
dispose(): void
retainedState: {
    readonly completionItems: number;
    readonly popupRows: number;
    readonly snippetPlaceholders: number;
    readonly pendingHostEffects: number;
  }
```

## CodeEditorCellStyle

One terminal-safe semantic cell style used by the code editor.

```ts
interface CodeEditorCellStyle {
  foreground: Color;
  background: Color;
  attrs?: AttrMask;
}
```

## CodeEditorController

Owns public editor state and funnels every source mutation through document transactions.

```ts
new CodeEditorController(options: CreateCodeEditorControllerOptions)
// methods & signals:
document: CodeEditorDocumentModel
folds: readonly { readonly from: number; readonly to: number }[]
limits: CodeEditorLimits
degradation: CodeEditorDegradationState
observations: CodeEditorObservabilityChannel
metrics: CodeEditorControllerMetrics
publicState: CodeEditorControllerPublicState
retainedState: {
    readonly historyBytes: number;
    readonly folds: number;
    readonly diagnostics: number;
    readonly completions: number;
    readonly symbols: number;
    readonly requests: number;
    readonly telemetryEvents: number;
  }
languageResult: LocalLanguageResult | undefined
setLanguageResult(result: LocalLanguageResult | undefined): void
diagnostics: readonly {
    readonly from: number;
    readonly to: number;
    readonly severity: 'error' | 'warning' | 'information' | 'hint';
  }[]
snippets: readonly { readonly from: number; readonly to: number; readonly active: boolean }[]
replaceSelection(text: string): boolean
hostAction(kind: 'navigate' | 'save' | 'close'): Promise<boolean>
requestAssistance(): void
requestFormatting(): void
toggleFold(): void
dispose(): void
```

## CodeEditorControllerHostEffect

Host-owned effects raised by keyboard commands that leave the editor boundary.

```ts
type CodeEditorControllerHostEffect = | CodeEditorHostEffect
  | {
      readonly kind: 'save' | 'close';
      readonly originUri: string;
      readonly originRevision: number;
      readonly sessionGeneration: number;
    }
```

## CodeEditorControllerMetrics

Observable counters proving presentation-only work remains semantically inert.

```ts
interface CodeEditorControllerMetrics {
  parserRuns: number;
  lspRequests: number;
  assistanceRequests: number;
}
```

## CodeEditorControllerPublicState

Machine-readable state for host-provided status and accessible presentation.

```ts
interface CodeEditorControllerPublicState {
  commandAvailability: Readonly<Record<string, boolean>>;
  language: string;
  serviceState: string;
  line: number;
  visualColumn: number;
  selectionSize: number;
  modified: boolean;
  readOnly: boolean;
  degradation: ReturnType<CodeEditorDegradationState['snapshot']>;
}
```

## CodeEditorDegradationNotice

One bounded, non-modal degradation notice suitable for accessible host presentation.

```ts
interface CodeEditorDegradationNotice {
  feature: CodeEditorDegradedFeature;
  reason: 'failure' | 'limit';
  nonModal: true;
  truncated: boolean;
  presented?: number;
  discarded?: number;
  message?: string;
}
```

## CodeEditorDegradationSnapshot

Machine-readable degradation state that never contains document or protocol content.

```ts
interface CodeEditorDegradationSnapshot {
  mode: 'ready' | 'degraded';
  affectedFeatures: readonly CodeEditorDegradedFeature[];
  notices: readonly CodeEditorDegradationNotice[];
  availableActions: readonly string[];
}
```

## CodeEditorDegradationState

Mutable owner for bounded degradation state.

```ts
interface CodeEditorDegradationState {
  suspend(feature: CodeEditorDegradedFeature, details: { readonly reason: 'limit'; readonly presented: number; readonly discarded: number }): void;
  fail(feature: CodeEditorDegradedFeature, error?: unknown): void;
  recover(feature: CodeEditorDegradedFeature): void;
  snapshot(): CodeEditorDegradationSnapshot;
  dispose(): void;
}
```

## CodeEditorDegradedFeature

Optional subsystems that may degrade independently from document editing.

```ts
type CodeEditorDegradedFeature = | 'documentModel'
  | 'parser'
  | 'languageAdapter'
  | 'languageService'
  | 'sharedSession'
  | 'popupRenderer'
  | 'diagnosticProducer'
  | 'hostCallback'
  | 'observabilityCallback'
  | 'diagnostics'
  | 'completion'
  | 'symbols'
```

## CodeEditorDocumentModel

Pure in-memory document model used by editor, language, and protocol layers.

```ts
new CodeEditorDocumentModel(options: CreateDocumentModelOptions)
// methods & signals:
text: string
snapshot: DocumentSnapshot
identity: DocumentIdentity
selection: DocumentSelection
undoDepth: number
retainedHistoryBytes: number
redoDepth: number
historyRetainedBytes: number
modified: boolean
readOnly: boolean
sizeMode: DocumentSizeMode
uri: string | undefined
languageId: CodeEditorLanguageId
lineEnding: DocumentLineEnding
tabSize: number
createTransaction(transaction: DocumentTransactionInput): DocumentTransaction
apply(transaction: DocumentTransaction): DocumentMutationResult
undo(): DocumentMutationResult
redo(): DocumentMutationResult
replaceDocument(options: CreateDocumentModelOptions): void
setReadOnly(readOnly: boolean): void
setSelection(selection: DocumentSelectionInput): void
markSaved(): void
releaseRetainedResources(): void
configureSafetyLimits(limits: DocumentLimits): void
search(query: string, options?: DocumentSearchOptions): readonly DocumentSearchMatch[]
```

## CodeEditorDocumentSizeClassification

Observable document-size classification used before optional feature activation.

```ts
interface CodeEditorDocumentSizeClassification {
  mode: 'full' | 'large' | 'reduced';
  confirmationRequired: boolean;
  language?: 'plain';
  preservedFeatures: readonly EssentialCodeEditorFeature[];
}
```

## CodeEditorFrame

Immutable viewport projection produced without a DOM or terminal serialization.

```ts
interface CodeEditorFrame {
  cells: readonly (readonly CodeEditorProjectedCell[])[];
  caret: { readonly visible: boolean; readonly x: number; readonly y: number };
  precedence: readonly string[];
  actions: readonly string[];
  cellSignature: string;
  cellAtDocumentOffset(offset: number): CodeEditorProjectedCell | undefined;
}
```

## CodeEditorHostEffect

Typed effects that remain under host authority.

```ts
type CodeEditorHostEffect = | {
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
    }
```

## CodeEditorKeyRoute

Result of deterministic keyboard routing.

```ts
interface CodeEditorKeyRoute {
  handled: boolean;
  owner: 'dismissal' | 'completion' | 'snippet' | 'editor' | 'text' | 'unhandled';
}
```

## CodeEditorLanguageId

Language identifiers supported by the built-in code-editor adapters.

```ts
type CodeEditorLanguageId = 'plain' | 'javascript' | 'typescript' | 'postgresql'
```

## CodeEditorLimits

Hard safety ceilings shared by editor subsystems.

```ts
interface CodeEditorLimits {
  documentBytes: number;
  documentLines: number;
  historyEntries: number;
  historyBytes: number;
  editsPerTransaction: number;
  replacementBytes: number;
  decorations: number;
  folds: number;
  diagnostics: number;
  completionItems: number;
  symbols: number;
  protocolMessageBytes: number;
  protocolNestingDepth: number;
  popupWidth: number;
  popupHeight: number;
  retainedTelemetryEvents: number;
}
```

## CodeEditorLimitsInput

Optional host limits.

```ts
type CodeEditorLimitsInput = Readonly<Partial<CodeEditorLimits>>
```

## CodeEditorLspCapabilities

Supported server capabilities negotiated by the editor-side coordinator.

```ts
interface CodeEditorLspCapabilities {
  completion?: boolean;
  hover?: boolean;
  signatureHelp?: boolean;
  diagnostics?: boolean;
  definition?: boolean;
  documentSymbols?: boolean;
  documentFormatting?: boolean;
  rangeFormatting?: boolean;
  textDocumentSync?: 'full' | 'incremental';
  completionTriggers?: readonly string[];
  signatureTriggers?: readonly string[];
}
```

## CodeEditorLspCoordinator

Coordinates one document with an optional transport-neutral LSP session.

```ts
new CodeEditorLspCoordinator(options: CreateCodeEditorLspCoordinatorOptions)
// methods & signals:
serviceState: LspServiceState
operationState: 'idle' | 'waiting' | 'pending'
closed
localCapabilities
presentation: CodeEditorLspPresentation
snippet: SnippetInteractionState | undefined
configureLimits(limits: CreateCodeEditorLspCoordinatorOptions['limits']): void
retainedState: {
    readonly pendingRequests: number;
    readonly diagnostics: number;
    readonly completions: number;
    readonly symbols: number;
    readonly snippetPlaceholders: number;
  }
document: CodeEditorDocumentModel
open(): Promise<void>
synchronize(): Promise<void>
resynchronize(): Promise<void>
setLanguage(languageId: string): Promise<void>
setUri(uri: string): Promise<void>
close(): Promise<void>
requestCompletion(position: ProtocolPosition): CodeEditorLspOperation
triggerCompletion(character: string, position: ProtocolPosition): CodeEditorLspOperation
requestHover(position: ProtocolPosition, viewport?: { readonly width: number; readonly height: number }): CodeEditorLspOperation
requestSignature(position: ProtocolPosition): CodeEditorLspOperation
triggerSignature(character: string, position: ProtocolPosition): CodeEditorLspOperation
requestDefinition(position: ProtocolPosition): CodeEditorLspOperation
requestDocumentSymbols(): CodeEditorLspOperation
formatDocument(): CodeEditorLspOperation
formatRange(range: import('./types.js').ProtocolRange): CodeEditorLspOperation
acceptCompletion(_options?: { readonly execute?: (value: unknown) => void }): void
handleKey(key: {
    readonly key: string;
    readonly text?: string;
    readonly shift?: boolean;
  }): 'completion' | 'snippet' | 'editor' | 'unhandled'
documentChanged(): void
caretChanged(): void
chooseDocumentSymbol(index: number): boolean
navigateBack(): boolean
chooseNavigationTarget(index: number): Promise<void>
proposeWorkspaceEdit(edit: unknown): Promise<boolean>
forwardCommand(command: unknown): Promise<boolean>
save(): Promise<{ readonly text: string; readonly formatting: string }>
tick(): void
commandAvailability: LspCommandAvailability
```

## CodeEditorLspOperation

A cancellable editor operation with a stable correlation identifier.

```ts
interface CodeEditorLspOperation {
  requestId: number;
  settled: Promise<{ readonly outcome: LspOperationOutcome }>;
  cancel(): void;
}
```

## CodeEditorLspPresentation

Current assistance presentation, intentionally independent from terminal widgets.

```ts
interface CodeEditorLspPresentation {
  hover?: {
    readonly text: string;
    readonly clipped: boolean;
    readonly resourcesActive: false;
  };
  signature?: { readonly lines: readonly string[] };
  completion?: {
    readonly items: readonly PresentedCompletionItem[];
    readonly selected: number;
    readonly filter: string;
    readonly lineage: string;
    readonly revision: number;
    readonly sessionGeneration: number;
    readonly coordinatorGeneration: number;
  };
  diagnostics: {
    readonly items: readonly PresentedDiagnostic[];
    readonly totalCount: number;
    readonly truncated: boolean;
    readonly versioned: boolean;
  };
  navigationChooser?: { readonly items: readonly PresentedNavigationTarget[] };
  symbolChooser?: { readonly items: readonly { readonly label: string; readonly range: ProtocolRange }[] };
}
```

## CodeEditorLspSession

Minimal editor-owned LSP session contract implemented by hosts and runtime adapters.

```ts
interface CodeEditorLspSession {
  contractVersion: 1;
  capabilities: Readonly<CodeEditorLspCapabilities>;
  state: CodeEditorLspSessionState;
  generation: number;
  reserveRequestId(): number;
  request(id: number, method: string, params: Readonly<Record<string, unknown>>, listener: ResponseListener): void;
  notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void>;
  cancel(id: number): void;
  subscribeDiagnostics(listener: DiagnosticListener): () => void;
  subscribeState(listener: StateListener): () => void;
  markReady(): void;
}
```

## CodeEditorLspSessionState

Transport-neutral session lifecycle state.

```ts
type CodeEditorLspSessionState = 'connecting' | 'ready' | 'degraded' | 'closed'
```

## CodeEditorObservabilityChannel

Bounded observability boundary owned by one editor.

```ts
interface CodeEditorObservabilityChannel {
  record(observation: CodeEditorObservation): void;
  snapshot(): CodeEditorObservabilitySnapshot;
  whenIdle(): Promise<void>;
  dispose(): void;
}
```

## CodeEditorObservabilityOptions

Options for an exception-safe asynchronous host observation callback.

```ts
interface CodeEditorObservabilityOptions {
  callback?: (event: CodeEditorObservationEvent) => void | Promise<void>;
  limits?: { readonly retainedEvents?: number };
  schedule?: (work: () => void) => void;   // A test seam; production delivery still owns queueing, bounds, and failure containment.
}
```

## CodeEditorObservabilitySnapshot

Immutable aggregate observability snapshot.

```ts
interface CodeEditorObservabilitySnapshot {
  counters: Readonly<{
    discardedStaleResults: number;
    truncations: number;
    degradedTransitions: number;
    callbackFailures: number;
    droppedEvents: number;
    pendingDeliveries: number;
  }>;
  retainedEvents: readonly CodeEditorObservationEvent[];
}
```

## CodeEditorObservation

Aggregate event accepted by the optional observability boundary.

```ts
interface CodeEditorObservation {
  kind: 'parse' | 'render' | 'lsp' | 'degradation' | 'truncation';
  durationMs?: number;
  discardedStaleResults?: number;
  truncations?: number;
  degradedTransitions?: number;
  untrustedContent?: unknown;   // Untrusted material is accepted only to make its deliberate exclusion explicit.
}
```

## CodeEditorObservationEvent

Content-free aggregate delivered through the host callback.

```ts
interface CodeEditorObservationEvent {
  kind: CodeEditorObservation['kind'];
  durationMs: number;
}
```

## CodeEditorOptions

Construction options for a terminal-native code editor view.

```ts
interface CodeEditorOptions {
  controller: CodeEditorController;
  keyBindings?: Readonly<Record<string, CodeEditorCommand>>;
}
```

## CodeEditorProjectedCell

A sanitized terminal cell plus semantic presentation metadata.

```ts
interface CodeEditorProjectedCell {
  text: string;
  width: 1;
  role: string;
  overlays: readonly string[];
  style?: CodeEditorCellStyle;
  documentOffset?: number;
}
```

## CodeEditorTheme

Versioned, complete semantic palette consumed by the editor projection.

```ts
interface CodeEditorTheme {
  contractVersion: 1;
  name: string;
  surfaces: Readonly<Record<'editor' | 'gutter' | 'activeLine' | 'selection' | 'status', CodeEditorCellStyle>>;
  syntax: Readonly<Record<SyntaxCategory, CodeEditorCellStyle>>;
  structure: Readonly<
    Record<'gutter' | 'lineNumber' | 'fold' | 'bracket' | 'search' | 'invisible', CodeEditorCellStyle>
  >;
  diagnostics: Readonly<Record<'error' | 'warning' | 'information' | 'hint', CodeEditorCellStyle>>;
  assistance: Readonly<Record<'popup' | 'selected' | 'snippet' | 'snippetActive', CodeEditorCellStyle>>;
}
```

## CodeEditorThemeResolutionReport

One rejected theme input or deterministic accessibility adjustment.

```ts
interface CodeEditorThemeResolutionReport {
  rejected: readonly string[];
  adjustments: readonly {
    readonly path: string;
    readonly reason: 'minimum-contrast' | 'capability-fallback';
  }[];
}
```

## CodeEditorThemeSource

Hybrid application-derived or independent theme selection.

```ts
type CodeEditorThemeSource = | { readonly kind: 'application'; readonly overrides?: unknown }
  | { readonly kind: 'independent'; readonly base: CodeEditorTheme; readonly overrides?: unknown }
```

## CodeEditorWindow

Movable editor window that adds standard scrollbar/status composition.

```ts
new CodeEditorWindow(options: CodeEditorWindowOptions)   // extends Window
// methods & signals:
editor: CodeEditor
horizontalScrollBar: ScrollBar
verticalScrollBar: ScrollBar
statusView: Text
chrome
status: { readonly language: string; readonly line: number; readonly column: number }
onResized(): void
```

## CodeEditorWindowOptions

Construction options for standard window composition around a code editor.

```ts
interface CodeEditorWindowOptions {
  controller: CodeEditorController;
  title?: string;
}
```

## CommentMetadata

```ts
interface CommentMetadata {
  line?: string;
  block?: readonly [string, string];
}
```

## CreateCodeEditorControllerOptions

Options for one document-scoped code-editor controller.

```ts
interface CreateCodeEditorControllerOptions {
  document: CodeEditorDocumentModel;
  host?: (effect: CodeEditorControllerHostEffect) => Promise<boolean>;
  lsp?: CodeEditorLspCoordinator;
  languageResult?: LocalLanguageResult;
  limits?: CodeEditorLimitsInput;
  observability?: CodeEditorObservabilityOptions;
}
```

## CreateCodeEditorLspCoordinatorOptions

Coordinator construction options.

```ts
interface CreateCodeEditorLspCoordinatorOptions {
  document: CodeEditorDocumentModel;
  session?: import('./session.js').CodeEditorLspSession;
  uri: string;
  languageId: string;
  limits?: {
    readonly completionItems?: number;
    readonly diagnostics?: number;
    readonly contentCharacters?: number;
    readonly edits?: number;
    readonly replacementCharacters?: number;
  };
  formatOnSave?: boolean;
  now?: () => number;
  clock?: {
    readonly now: () => number;
    readonly schedule: (callback: () => void, delayMilliseconds: number) => { dispose(): void };
  };
  interactiveTimeoutMs?: number;
  host?: (effect: CodeEditorHostEffect) => Promise<boolean>;
}
```

## CreateDocumentModelOptions

Initial state for one in-memory code-editor document.

```ts
interface CreateDocumentModelOptions {
  text: string;
  uri?: string;
  languageId?: CodeEditorLanguageId;
  readOnly?: boolean;
  tabSize?: number;
  limits?: DocumentLimits;
  confirmLargeDocument?: (details: LargeDocumentDetails) => boolean;
}
```

## DocumentCharacter

A validated zero-based UTF-16 character within a logical line.

```ts
type DocumentCharacter = number & { readonly [documentCharacterBrand]: true }
```

## DocumentEdit

Describes one replacement range in UTF-16 document offsets.

```ts
interface DocumentEdit {
  range: {
    readonly from: DocumentOffset;
    readonly to: DocumentOffset;
  };
  text: string;
}
```

## DocumentEditInput

Untrusted edit input accepted at the public normalization boundary.

```ts
interface DocumentEditInput {
  range: {
    readonly from: number;
    readonly to: number;
  };
  text: string;
}
```

## DocumentIdentity

Identifies one exact revision within a document lineage.

```ts
interface DocumentIdentity {
  lineage: string;
  revision: DocumentRevision;
}
```

## DocumentLine

A validated zero-based logical line number.

```ts
type DocumentLine = number & { readonly [documentLineBrand]: true }
```

## DocumentLineEnding

Describes the line separators observed in exact document text.

```ts
type DocumentLineEnding = 'none' | 'lf' | 'crlf' | 'cr' | 'mixed'
```

## DocumentMutationResult

Reports the result of a mutation request without throwing for untrusted edits.

```ts
type DocumentMutationResult = { readonly accepted: true } | { readonly accepted: false; readonly reason: DocumentRejectionReason }
```

## DocumentOffset

A validated UTF-16 offset into one document snapshot.

```ts
type DocumentOffset = number & { readonly [documentOffsetBrand]: true }
```

## DocumentPosition

Describes a zero-based UTF-16 line and character position.

```ts
interface DocumentPosition {
  line: DocumentLine;
  character: DocumentCharacter;
}
```

## DocumentPositionInput

Untrusted line and character input accepted at a conversion boundary.

```ts
interface DocumentPositionInput {
  line: number;
  character: number;
}
```

## DocumentRevision

A validated monotonic revision within one document lineage.

```ts
type DocumentRevision = number & { readonly [documentRevisionBrand]: true }
```

## DocumentSearchMatch

One literal search match expressed in UTF-16 document offsets.

```ts
interface DocumentSearchMatch {
  from: number;
  to: number;
}
```

## DocumentSearchOptions

Controls bounded literal document searches.

```ts
interface DocumentSearchOptions {
  caseSensitive?: boolean;
  maxResults?: number;
}
```

## DocumentSelection

Describes the active single selection using UTF-16 document offsets.

```ts
interface DocumentSelection {
  anchor: DocumentOffset;
  head: DocumentOffset;
}
```

## DocumentSelectionInput

Untrusted selection input accepted at the public normalization boundary.

```ts
interface DocumentSelectionInput {
  anchor: number;
  head: number;
}
```

## DocumentSizeMode

Controls the local feature tier selected from document size.

```ts
type DocumentSizeMode = 'full' | 'bounded' | 'reduced'
```

## DocumentSnapshot

Provides an immutable view of one exact document revision.

```ts
interface DocumentSnapshot {
  lineage: string;
  revision: DocumentRevision;
  length: number;
  lineCount: number;
  slice(from: number, to?: number): string;
  lineAt(offset: number): LogicalLine;
  line(line: number): LogicalLine;
}
```

## DocumentTransaction

A complete set of edits that must either all apply or all be rejected.

```ts
interface DocumentTransaction {
  kind: 'document-transaction';
}
```

## DocumentTransactionInput

Untrusted values used to request one normalized atomic transaction.

```ts
interface DocumentTransactionInput {
  base?: DocumentIdentity;
  edits: readonly DocumentEditInput[];
  selection?: DocumentSelectionInput;
  origin: EditOrigin;
}
```

## EditOrigin

Identifies the source of one logical editing operation.

```ts
type EditOrigin = 'typing' | 'completion' | 'snippet' | 'format' | 'external' | 'search'
```

## EssentialCodeEditorFeature

Features guaranteed to remain available in bounded and reduced document modes.

```ts
type EssentialCodeEditorFeature = 'edit' | 'search' | 'lineNumbers' | 'status' | 'save' | 'close'
```

## FoldRange

```ts
interface FoldRange {
  from: number;
  to: number;
}
```

## HARD_CODE_EDITOR_LIMITS

Immutable upper bounds enforced even when a host supplies larger values.

```ts
const HARD_CODE_EDITOR_LIMITS: CodeEditorLimits
```

## InProcessLspSession

Deterministic transport-neutral session used by hosts and tests.

```ts
new InProcessLspSession(options: CreateInProcessLspSessionOptions)
// methods & signals:
contractVersion
capabilities: Readonly<CodeEditorLspCapabilities>
requests: LspRecordedRequest[]
notifications: LspRecordedNotification[]
state: CodeEditorLspSessionState
generation
reserveRequestId(): number
request(id: number, method: string, params: Readonly<Record<string, unknown>>, listener: ResponseListener): void
notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void>
cancel(id: number): void
respond(id: number | undefined, result: unknown): void
fail(id: number | undefined, error: Error): void
timeout(id: number | undefined): void
publishDiagnostics(uri: string, version: number | undefined, diagnostics: unknown, metadata: { readonly generation: number } = { generation: this.generation }): void
reconnect(): void
updateCapabilities(capabilities: CodeEditorLspCapabilities): void
deliverEnvelope(_envelope: unknown): void
subscribeDiagnostics(listener: DiagnosticListener): () => void
subscribeState(listener: StateListener): () => void
markReady(): void
```

## LanguageAdapter

```ts
interface LanguageAdapter {
  contractVersion: 1;
  id: string;
  extensions: readonly string[];
  comments?: CommentMetadata;
  indentation?: { readonly preserveLeading: true };
  lsp?: { readonly languageId: string };
  syntax?: LanguageCapability<SyntaxSpan>;
  folds?: LanguageCapability<FoldRange>;
  brackets?: LanguageCapability<BracketPair>;
}
```

## LanguageCapability

```ts
type LanguageCapability<T> = (
  text: string,
  context: LanguageCapabilityContext,
) => Promise<LanguageCapabilityResult<T>>
```

## LanguageCapabilityContext

```ts
interface LanguageCapabilityContext {
  maxResults: number;
  previousState?: object;
  previousText?: string;
  signal?: AbortSignal;
  yieldControl(): Promise<void>;
}
```

## LanguageCapabilityResult

```ts
interface LanguageCapabilityResult<T> {
  items: readonly T[];
  state?: object;
}
```

## LanguageRegistry

Stores explicitly registered language adapters and resolves deterministic selections.

```ts
new LanguageRegistry(adapters: readonly LanguageAdapter[])
// methods & signals:
get(id: string): LanguageAdapter
resolve(selection: LanguageSelection): LanguageAdapter
```

## LanguageScheduler

Runs independently optional language capabilities and rejects stale generations.

```ts
new LanguageScheduler(options: LanguageSchedulerOptions = {})
// methods & signals:
analyze(adapterInput: unknown, text: string, identity: { readonly lineage: string; readonly revision: number }, previous?: LocalLanguageResult, options: LanguageAnalysisOptions = {}): Promise<LocalLanguageResult>
```

## LargeDocumentDetails

Bounded metadata supplied when a document needs reduced-mode confirmation.

```ts
interface LargeDocumentDetails {
  byteLength: number;
  lineCount: number;
}
```

## LocalLanguageResult

```ts
interface LocalLanguageResult {
  syntax: readonly SyntaxSpan[];
  folds: readonly FoldRange[];
  brackets: readonly BracketPair[];
  identity: DocumentIdentity;
  adapterId: string;
  generation: number;
  state: LanguageServiceState;
  failure?: string;
}
```

## LogicalLine

Describes a logical line without its line separator.

```ts
interface LogicalLine {
  number: DocumentLine;
  from: DocumentOffset;
  to: DocumentOffset;
  length: number;
  text: string;
}
```

## LspServiceState

Lifecycle states exposed independently from local editing and parsing.

```ts
type LspServiceState = 'plain' | 'connecting' | 'ready' | 'degraded'
```

## ProjectCodeEditorOptions

Inputs for one bounded editor projection.

```ts
interface ProjectCodeEditorOptions {
  controller: CodeEditorController;
  width: number;
  height: number;
  caps: CapabilityProfile;
  syntax?: readonly SyntaxSpan[];
  diagnostics?: readonly CodeEditorDecorationSpan[];
  search?: readonly CodeEditorDecorationSpan[];
  bracket?: CodeEditorDecorationSpan;
  snippet?: readonly CodeEditorDecorationSpan[];
  activeLine?: number;
  caret?: number;
  scrollX?: number;
  scrollY?: number;
  theme?: CodeEditorTheme;
  themeName?: string;
}
```

## ProtocolPosition

Zero-based UTF-16 protocol position.

```ts
interface ProtocolPosition {
  line: number;
  character: number;
}
```

## ProtocolRange

Half-open protocol range.

```ts
interface ProtocolRange {
  start: ProtocolPosition;
  end: ProtocolPosition;
}
```

## ResolvedCodeEditorTheme

Complete theme plus inspectable resolution evidence.

```ts
interface ResolvedCodeEditorTheme {
  contractVersion: 1;
  theme: CodeEditorTheme;
  report: CodeEditorThemeResolutionReport;
}
```

## SyntaxCategory

```ts
type SyntaxCategory = (typeof syntaxCategories)[number]
```

## SyntaxSpan

```ts
interface SyntaxSpan {
  from: number;
  to: number;
  category: SyntaxCategory;
}
```

## VisualColumn

A validated terminal cell column.

```ts
type VisualColumn = number & { readonly [visualColumnBrand]: true }
```

## classicCodeEditorTheme

Classic terminal editor preset.

```ts
const classicCodeEditorTheme: CodeEditorTheme
```

## classifyDocumentSize

Classifies a document without allocating its content or changing it.

```ts
classifyDocumentSize(size: {
  readonly bytes: number;
  readonly lines: number;
}): CodeEditorDocumentSizeClassification
```

## createCodeEditorController

Creates a controller shared by direct and window-hosted code editor views.

```ts
createCodeEditorController(options: CreateCodeEditorControllerOptions): CodeEditorController
```

## createCodeEditorLspCoordinator

Creates one document-scoped LSP coordinator.

```ts
createCodeEditorLspCoordinator(options: CreateCodeEditorLspCoordinatorOptions): CodeEditorLspCoordinator
```

## createDegradationState

Creates isolated, rate-limited degradation state.

```ts
createDegradationState(): CodeEditorDegradationState
```

## createDocumentModel

Creates one isolated in-memory document model.

```ts
createDocumentModel(options: CreateDocumentModelOptions): CodeEditorDocumentModel
```

## createInProcessLspSession

Creates a deterministic in-process LSP session.

```ts
createInProcessLspSession(options: CreateInProcessLspSessionOptions = {}): InProcessLspSession
```

## createLanguageScheduler

Creates an isolated local-language scheduler.

```ts
createLanguageScheduler(options?: LanguageSchedulerOptions): LanguageScheduler
```

## createObservabilityChannel

Creates a content-free observability channel with one bounded callback drain.

```ts
createObservabilityChannel(optionsInput: CodeEditorObservabilityOptions = {}): CodeEditorObservabilityChannel
```

## darkCodeEditorTheme

Dark independent editor preset.

```ts
const darkCodeEditorTheme: CodeEditorTheme
```

## documentCharacter

Creates a trusted UTF-16 character position.

```ts
documentCharacter(value: number): DocumentCharacter
```

## documentLine

Creates a trusted logical line number.

```ts
documentLine(value: number): DocumentLine
```

## documentOffset

Creates a trusted document offset after validating its numeric domain and optional bound.

```ts
documentOffset(value: number, maximum = Number.MAX_SAFE_INTEGER): DocumentOffset
```

## documentRevision

Creates a trusted document revision.

```ts
documentRevision(value: number): DocumentRevision
```

## documentSelection

Normalizes a public selection input into trusted document offsets.

```ts
documentSelection(value: DocumentSelectionInput, length: number): DocumentSelection
```

## indentLines

Indents or dedents selected zero-based logical lines.

```ts
indentLines(text: string, lines: readonly number[], options: { readonly unit: string; readonly direction: 'indent' | 'dedent' }): string
```

## inspectInvisibleCharacters

Locates terminal-sensitive invisible code points without changing source text.

```ts
inspectInvisibleCharacters(text: string): readonly InvisibleCharacterWarning[]
```

## lightCodeEditorTheme

Light independent editor preset.

```ts
const lightCodeEditorTheme: CodeEditorTheme
```

## offsetToPosition

Converts a UTF-16 document offset to a zero-based line and character.

```ts
offsetToPosition(snapshot: DocumentSnapshot, offset: number): DocumentPosition
```

## offsetToVisualColumn

Calculates the terminal cell column at a UTF-16 document offset.

```ts
offsetToVisualColumn(snapshot: DocumentSnapshot, offset: number, tabSize = DEFAULT_TAB_SIZE): VisualColumn
```

## plainLanguageId

Identifies plain text, which intentionally has no parser dependency.

```ts
const plainLanguageId: CodeEditorLanguageId
```

## positionToOffset

Converts a zero-based UTF-16 line and character to a document offset.

```ts
positionToOffset(snapshot: DocumentSnapshot, position: DocumentPositionInput): DocumentOffset
```

## projectCodeEditor

Projects an indexed document viewport into safe, clipped terminal cells.

```ts
projectCodeEditor(options: ProjectCodeEditorOptions): CodeEditorFrame
```

## querySyntaxViewport

Selects syntax intersecting a bounded viewport plus optional look-around.

```ts
querySyntaxViewport(spans: readonly SyntaxSpan[], from: number, to: number, lookAround = 256): readonly SyntaxSpan[]
```

## resolveCodeEditorLimits

Resolves all host limits into a frozen policy without permitting a safety ceiling increase.

```ts
resolveCodeEditorLimits(input: CodeEditorLimitsInput = {}): CodeEditorLimits
```

## resolveCodeEditorTheme

Resolves the hybrid editor theme without invoking accessors or retaining caller-owned data.

```ts
resolveCodeEditorTheme(source: CodeEditorThemeSource, context: ResolveCodeEditorThemeContext): ResolvedCodeEditorTheme
```

## searchDocument

Finds literal matches without mutating document or history state.

```ts
searchDocument(snapshot: DocumentSnapshot, query: string, options: DocumentSearchOptions = {}): readonly DocumentSearchMatch[]
```

## toggleLineComments

Adds or removes the active adapter's line-comment delimiter.

```ts
toggleLineComments(text: string, lines: readonly number[], comments?: CommentMetadata): string
```

## visualColumn

Creates a trusted visual cell column.

```ts
visualColumn(value: number): VisualColumn
```
