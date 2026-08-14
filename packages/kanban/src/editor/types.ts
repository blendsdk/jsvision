import type { View } from '@jsvision/ui';

import type { CardKey, KanbanFieldId, KanbanOperationId } from '../contract/identity.js';
import type {
  KanbanCardCreateProposal,
  KanbanCardUpdateProposal,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../contract/request.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';

/** Stable identity used to group and order editor fields. */
export type KanbanEditorSectionId = string;

/** Closed field-kind set supported by the generic editor protocol. */
export type KanbanCardEditorFieldKind =
  'text' | 'multiline' | 'number' | 'boolean' | 'date' | 'single-choice' | 'multiple-choice' | 'custom';

/** Editor mode shared by generic sessions and later package dialogs. */
export type KanbanEditorMode = 'create' | 'view' | 'edit';

/** Safe field or form failure published without rejected application values. */
export interface KanbanEditorDiagnostic {
  /** Stable machine-readable reason code. */
  readonly code: string;
  /** Optional localized message identity resolved by the mounted application. */
  readonly messageId?: string;
  /** Optional already-sanitized application label. */
  readonly label?: string;
}

/** Bounded context supplied to application editor callbacks. */
export interface KanbanEditorContext {
  /** Current create, view, or edit behavior. */
  readonly mode: KanbanEditorMode;
  /** Live signal aborted when the callback generation is no longer authoritative. */
  readonly signal: AbortSignal;
}

/** Complete typed input supplied to parsers, formatters, predicates, and validators. */
export interface KanbanEditorFieldCallbackInput<TCard, TDraft, TValue> {
  /** Current typed field value. */
  readonly value: TValue;
  /** Current session-owned draft; callbacks must return changes rather than mutating it. */
  readonly draft: TDraft;
  /** Detached authoritative card when an edit/view session has one. */
  readonly card?: TCard;
  /** Current bounded mode and cancellation context. */
  readonly context: KanbanEditorContext;
  /** Convenience alias for the live callback-generation signal. */
  readonly signal: AbortSignal;
}

/** Callback helper whose parameter remains usable after heterogeneous fields are type-erased. */
type KanbanEditorCallback<TArgs extends readonly unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];

/** One static single-choice or multiple-choice option. */
export interface KanbanCardEditorChoice<TValue extends KanbanSemanticValue = KanbanSemanticValue> {
  /** Stable identity used for selection and reconciliation. */
  readonly choiceId: string;
  /** Localized label identity displayed by standard controls. */
  readonly labelId: string;
  /** Detached semantic value written into the draft when selected. */
  readonly value: TValue;
}

/** Typed field descriptor consumed by generic and standard editor sessions. */
export interface KanbanCardEditorField<TDraft, TValue = KanbanSemanticValue, TCard = unknown> {
  /** Stable field identity used by state, errors, and focus. */
  readonly fieldId: KanbanFieldId;
  /** Stable section containing this field. */
  readonly sectionId: KanbanEditorSectionId;
  /** Generic control/value behavior. */
  readonly kind: KanbanCardEditorFieldKind;
  /** Localized field label identity. */
  readonly labelId: string;
  /** Optional localized help identity. */
  readonly helpId?: string;
  /** Stable order within the section. */
  readonly order: number;
  /** Other field identities consulted by visibility or read-only predicates. */
  readonly dependencies?: readonly KanbanFieldId[];
  /** Reads the typed value from a session-owned draft. */
  readonly read: KanbanEditorCallback<readonly [draft: TDraft], TValue>;
  /** Returns a draft containing the supplied typed value. */
  readonly write: KanbanEditorCallback<readonly [draft: TDraft, value: TValue], TDraft>;
  /** Optional safe parser for raw control input. */
  readonly parse?: KanbanEditorCallback<
    readonly [value: unknown, input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    TValue
  >;
  /** Optional application formatter whose result is sanitized before display. */
  readonly format?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    string
  >;
  /** Ordered synchronous validators. */
  readonly validate?: readonly KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    KanbanEditorDiagnostic | undefined
  >[];
  /** Ordered asynchronous validators, each receiving a generation-owned signal. */
  readonly validateAsync?: readonly KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    Promise<KanbanEditorDiagnostic | undefined>
  >[];
  /** Optional visibility predicate evaluated through failure isolation. */
  readonly visible?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    boolean
  >;
  /** Optional read-only predicate evaluated through failure isolation. */
  readonly readOnly?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, TValue>],
    boolean
  >;
  /** Bounded static choices required by choice kinds. */
  readonly choices?: readonly KanbanCardEditorChoice[];
  /** Registered custom-control identity required only by custom fields. */
  readonly controlId?: string;
}

/**
 * Heterogeneous field definition accepted while a schema infers its draft type.
 *
 * `never` appears only in callback input positions so fields retain their concrete value types while
 * entering one mixed collection. The validated schema exposes `unknown` at the later lookup boundary.
 */
export interface KanbanCardEditorFieldDefinition<TDraft, TCard = unknown> {
  /** Stable field identity used by state, errors, and focus. */
  readonly fieldId: KanbanFieldId;
  /** Stable section containing this field. */
  readonly sectionId: KanbanEditorSectionId;
  /** Generic control/value behavior. */
  readonly kind: KanbanCardEditorFieldKind;
  /** Localized field label identity. */
  readonly labelId: string;
  /** Optional localized help identity. */
  readonly helpId?: string;
  /** Stable order within the section. */
  readonly order: number;
  /** Other fields consulted by conditional behavior. */
  readonly dependencies?: readonly KanbanFieldId[];
  /** Reads one concrete value into the heterogeneous boundary. */
  readonly read: KanbanEditorCallback<readonly [draft: TDraft], unknown>;
  /** Writes a concrete field value accepted by its own descriptor. */
  readonly write: KanbanEditorCallback<readonly [draft: TDraft, value: never], TDraft>;
  /** Optional parser retained without erasing its concrete return type. */
  readonly parse?: KanbanEditorCallback<
    readonly [value: unknown, input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    unknown
  >;
  /** Optional safe display formatter. */
  readonly format?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    string
  >;
  /** Ordered synchronous validators. */
  readonly validate?: readonly KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    KanbanEditorDiagnostic | undefined
  >[];
  /** Ordered asynchronous validators. */
  readonly validateAsync?: readonly KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    Promise<KanbanEditorDiagnostic | undefined>
  >[];
  /** Optional visibility predicate. */
  readonly visible?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    boolean
  >;
  /** Optional read-only predicate. */
  readonly readOnly?: KanbanEditorCallback<
    readonly [input: KanbanEditorFieldCallbackInput<TCard, TDraft, never>],
    boolean
  >;
  /** Bounded static choices required by choice kinds. */
  readonly choices?: readonly KanbanCardEditorChoice[];
  /** Registered custom-control identity required only by custom fields. */
  readonly controlId?: string;
}

/** Presentation metadata for one ordered editor section. */
export interface KanbanCardEditorSection {
  /** Stable section identity referenced by fields. */
  readonly sectionId: KanbanEditorSectionId;
  /** Localized section label identity. */
  readonly labelId: string;
  /** Stable schema order. */
  readonly order: number;
  /** Optional normal, tab, or collapsible presentation preference. */
  readonly presentation?: 'section' | 'tab' | 'collapsible';
  /** Whether a collapsible section starts closed. */
  readonly initialCollapsed?: boolean;
  /** Marks secondary dense content subject to the one-initially-open policy. */
  readonly secondaryDense?: boolean;
}

/** Measured custom control instance owned and disposed by one mounted field. */
export interface KanbanEditorControlInstance {
  /** Mounted JSVision view. */
  readonly view: View;
  /** Returns bounded responsive geometry for the current terminal width. */
  readonly measure: (availableWidth: number) => KanbanEditorControlMeasurement;
  /** Releases timers, subscriptions, and other field-owned resources idempotently. */
  readonly dispose: () => void;
}

/** Bounded field/session seam supplied to one application custom-control factory. */
export interface KanbanEditorControlContext {
  /** Stable field identity owned by this control instance. */
  readonly fieldId: KanbanFieldId;
  /** Current create, view, or edit behavior. */
  readonly mode: KanbanEditorMode;
  /** Returns the latest immutable semantic field value when it can be represented safely. */
  readonly value: () => KanbanSemanticValue | undefined;
  /** Returns the latest immutable display, visibility, read-only, and diagnostic state. */
  readonly state: () => KanbanEditorFieldState;
  /** Attempts a mutation through the same parser, validation, and generation boundary as standard controls. */
  readonly setValue: (value: unknown) => KanbanEditorSetValueResult;
  /** Records this field as the current focus identity when it is visible. */
  readonly focus: () => boolean;
  /** Live signal aborted when the mounted control is no longer authoritative. */
  readonly signal: AbortSignal;
}

/** Bounded layout evidence returned by a custom editor control. */
export interface KanbanEditorControlMeasurement {
  /** Smallest usable control width in terminal cells. */
  readonly minimumWidth: number;
  /** Preferred control width in terminal cells. */
  readonly preferredWidth: number;
  /** Required control height in terminal rows. */
  readonly rows: number;
}

/** Application factory registered under one inert custom-control identity. */
export interface KanbanEditorControlRegistration {
  /** Stable namespaced application control identity. */
  readonly controlId: string;
  /** Creates one measured disposable control instance. */
  readonly create: (context?: KanbanEditorControlContext) => KanbanEditorControlInstance;
}

/** Immutable custom-control registry consumed by schema validation and later dialogs. */
export interface KanbanEditorControlRegistry {
  /** Ordered detached registrations. */
  readonly controls: readonly KanbanEditorControlRegistration[];
  /** Looks up a registration without invoking its factory. */
  control(controlId: string): KanbanEditorControlRegistration | undefined;
}

/** Validated immutable generic editor schema. */
export interface KanbanCardEditorSchema<TCard, TDraft> {
  /** Equality-only application schema revision. */
  readonly revision: KanbanRevision;
  /** Ordered immutable sections. */
  readonly sections: readonly KanbanCardEditorSection[];
  /** Ordered immutable fields with value types erased only at the heterogeneous boundary. */
  readonly fields: readonly KanbanCardEditorField<TDraft, unknown, TCard>[];
  /** Optional immutable custom-control registry. */
  readonly controls?: KanbanEditorControlRegistry;
  /** Finds a field by its stable identity. */
  field(fieldId: KanbanFieldId): KanbanCardEditorField<TDraft, unknown, TCard> | undefined;
  /** Finds a section by its stable identity. */
  section(sectionId: KanbanEditorSectionId): KanbanCardEditorSection | undefined;
}

/** Detached validated draft evidence passed to an application adapter. */
export interface KanbanEditorResult<TDraft> {
  /** Current typed session draft. */
  readonly draft: TDraft;
  /** Bounded semantic full-draft snapshot. */
  readonly snapshot: KanbanSemanticValue;
  /** Exact schema-ordered changed field identities. */
  readonly changedFieldIds: readonly KanbanFieldId[];
  /** Base card revision captured when editing began. */
  readonly baseRevision?: KanbanRevision;
}

/** Lifecycle-free proposal shape whose application draft is validated by the session boundary. */
export type KanbanCardEditorProposal =
  | (Omit<KanbanCardCreateProposal, 'draft'> & { readonly draft: unknown })
  | (Omit<KanbanCardUpdateProposal, 'patch'> & { readonly patch: unknown });

/** Generic bridge between an application record, editor draft, and board proposal. */
export interface KanbanCardEditorAdapter<TCard, TDraft> {
  /** Validated schema describing fields and controls. */
  readonly schema: KanbanCardEditorSchema<TCard, TDraft>;
  /** Creates a detached typed draft for create, view, or edit mode. */
  create(card: TCard | undefined, context: KanbanEditorContext): TDraft;
  /** Creates a bounded semantic snapshot without mutating the draft. */
  snapshot(draft: TDraft): KanbanSemanticValue;
  /** Builds one lifecycle-free create or update proposal for the shared authority. */
  proposal(result: KanbanEditorResult<TDraft>): KanbanCardEditorProposal;
}

/** Application-owned record identity used by an edit/view session. */
export interface KanbanEditorCardIdentity {
  /** Identity discriminator reserved for later provisional create sessions. */
  readonly kind: 'card';
  /** Stable application-owned card key. */
  readonly cardKey: CardKey;
}

/** Authoritative record returned by an application-owned editor resolver. */
export interface KanbanEditorResolvedRecord<TCard> {
  /** Successful resolution discriminator. */
  readonly kind: 'record';
  /** Detached application record used only to construct the editor draft. */
  readonly card: TCard;
  /** Equality-only revision that becomes the session baseline. */
  readonly revision: KanbanRevision;
}

/** Typed resolver absence that does not disclose application record data. */
export interface KanbanEditorUnavailableRecord {
  /** Absence discriminator. */
  readonly kind: 'unavailable';
  /** Safe machine-readable reason such as `not-loaded` or `not-found`. */
  readonly code: string;
}

/** Authoritative notice that the application record no longer exists. */
export interface KanbanEditorDeletedRecord {
  /** Deletion discriminator. */
  readonly kind: 'deleted';
}

/** Internal typed discriminator shared by payload-free editor outcomes. */
interface KanbanEditorKindOutcome<TKind extends string> {
  /** Stable outcome discriminator. */
  readonly kind: TKind;
}

/** Internal operation-correlated outcome shared by submit and publication states. */
interface KanbanEditorOperationOutcome<TKind extends string> extends KanbanEditorKindOutcome<TKind> {
  /** Board-authority operation identity. */
  readonly operationId: KanbanOperationId;
}

/** Internal safe-code outcome shared by resolver and reload states. */
interface KanbanEditorCodeOutcome<TKind extends string> extends KanbanEditorKindOutcome<TKind> {
  /** Safe machine-readable reason. */
  readonly code: string;
}

/** Validation outcome that identifies the first schema-ordered invalid field. */
interface KanbanEditorInvalidSubmitOutcome extends KanbanEditorKindOutcome<'invalid'> {
  /** First invalid schema field that should receive focus. */
  readonly fieldId: KanbanFieldId;
}

/** Rejected submission retained for correction and resubmission. */
interface KanbanEditorRejectedSubmitOutcome extends KanbanEditorOperationOutcome<'rejected'> {
  /** Safe machine-readable application rejection reason. */
  readonly code: string;
}

/** Rejected submission state with optional safe application feedback. */
interface KanbanEditorRejectedSubmissionState extends KanbanEditorRejectedSubmitOutcome {
  /** Optional sanitized application-facing explanation. */
  readonly label?: string;
}

/** Complete result of resolving one application-owned card record. */
export type KanbanEditorResolveResult<TCard> = KanbanEditorResolvedRecord<TCard> | KanbanEditorUnavailableRecord;

/** One authoritative record or deletion publication observed by an editor session. */
export type KanbanEditorRecordPublication<TCard> = KanbanEditorResolvedRecord<TCard> | KanbanEditorDeletedRecord;

/** Cancellation context supplied to one application record-resolution generation. */
export interface KanbanEditorResolveContext {
  /** Live package-owned signal aborted when the resolution is no longer authoritative. */
  readonly signal: AbortSignal;
}

/** Application-owned record and revision source required by edit and view sessions. */
export interface KanbanEditorRecordResolver<TCard> {
  /** Resolves the latest detached record while honoring package-owned cancellation. */
  resolve(cardKey: CardKey, context: KanbanEditorResolveContext): Promise<KanbanEditorResolveResult<TCard>>;
  /** Subscribes before resolution so no intervening authoritative publication is lost. */
  subscribe(cardKey: CardKey, listener: (publication: KanbanEditorRecordPublication<TCard>) => void): () => void;
}

/** Application-owned request seam used by a session without assuming persistence authority. */
export interface KanbanEditorAuthority {
  /** Admits one exact lifecycle-free proposal and returns an operation-correlated result. */
  request(proposal: KanbanRequestProposal): KanbanRequestResult | Promise<KanbanRequestResult>;
  /** Optionally requests cancellation of an accepted operation still awaiting publication. */
  cancel?(operationId: KanbanOperationId): boolean;
}

/** Authoritative record condition visible to editor renderers. */
export type KanbanEditorRecordState =
  | KanbanEditorKindOutcome<'ready'>
  | KanbanEditorKindOutcome<'stale'>
  | KanbanEditorKindOutcome<'deleted'>
  | KanbanEditorCodeOutcome<'unavailable'>;

/** Submission lifecycle visible as one coherent immutable state. */
export type KanbanEditorSubmissionState =
  | KanbanEditorKindOutcome<'idle'>
  | KanbanEditorKindOutcome<'validating'>
  | KanbanEditorKindOutcome<'dispatching'>
  | KanbanEditorOperationOutcome<'awaiting-publication'>
  | KanbanEditorRejectedSubmissionState
  | KanbanEditorOperationOutcome<'committed'>;

/** Immutable field presentation and validation state. */
export interface KanbanEditorFieldState {
  /** Stable schema field identity. */
  readonly fieldId: KanbanFieldId;
  /** Safe formatted value intended for a standard control. */
  readonly displayValue: string;
  /** Whether the user has attempted to change or submit this field. */
  readonly touched: boolean;
  /** Whether the field participates in the current layout. */
  readonly visible: boolean;
  /** Whether mutation is currently forbidden. */
  readonly readOnly: boolean;
  /** Bounded payload-free validation failures in callback order. */
  readonly diagnostics: readonly KanbanEditorDiagnostic[];
}

/** Coherent immutable editor state consumed by dialogs and inspectors. */
export interface KanbanEditorSessionSnapshot {
  /** Current create, view, or edit behavior. */
  readonly mode: KanbanEditorMode;
  /** Stable record identity when the session edits or views an existing card. */
  readonly cardKey?: CardKey;
  /** Detached bounded semantic draft safe for presentation and result handling. */
  readonly draft: KanbanSemanticValue;
  /** Base revision captured from the latest explicit resolution or reload. */
  readonly baseRevision?: KanbanRevision;
  /** Whether any schema field differs from its baseline value. */
  readonly dirty: boolean;
  /** Schema-ordered identities whose values differ from the baseline. */
  readonly changedFieldIds: readonly KanbanFieldId[];
  /** Field that should receive focus after validation or reflow. */
  readonly focusedFieldId?: KanbanFieldId;
  /** Current authoritative-record condition. */
  readonly record: KanbanEditorRecordState;
  /** Current request/publication lifecycle. */
  readonly submission: KanbanEditorSubmissionState;
}

/** Completion handle returned by an accepted field mutation. */
export interface KanbanEditorValueAccepted {
  /** Accepted mutation discriminator. */
  readonly kind: 'accepted';
  /** Settles after the current async validation generation becomes inert or authoritative. */
  readonly settled: Promise<void>;
}

/** Non-accepted mutation outcome whose already-settled handle keeps calling code uniform. */
interface KanbanEditorValueOutcome<TKind extends string> extends KanbanEditorKindOutcome<TKind> {
  /** Already-settled completion because no async validation was started. */
  readonly settled: Promise<void>;
}

/** Synchronous result of attempting to change one editor field. */
export type KanbanEditorSetValueResult =
  | KanbanEditorValueAccepted
  | KanbanEditorValueOutcome<'read-only'>
  | KanbanEditorValueOutcome<'unknown-field'>
  | KanbanEditorValueOutcome<'invalid-value'>
  | KanbanEditorValueOutcome<'sealed'>
  | KanbanEditorValueOutcome<'disposed'>;

/** Result returned by a complete validation and submission attempt. */
export type KanbanEditorSubmitResult =
  | KanbanEditorInvalidSubmitOutcome
  | KanbanEditorOperationOutcome<'awaiting-publication'>
  | KanbanEditorRejectedSubmitOutcome
  | KanbanEditorOperationOutcome<'cancelled'>
  | KanbanEditorOperationOutcome<'superseded'>
  | KanbanEditorOperationOutcome<'committed'>
  | KanbanEditorKindOutcome<'read-only'>
  | KanbanEditorKindOutcome<'stale'>
  | KanbanEditorKindOutcome<'deleted'>
  | KanbanEditorKindOutcome<'unavailable'>
  | KanbanEditorKindOutcome<'sealed'>
  | KanbanEditorKindOutcome<'disposed'>
  | KanbanEditorKindOutcome<'failed'>;

/** Explicit policy accepted by a stale-session reload. */
export type KanbanEditorReloadPolicy = 'discard-draft';

/** Result of resolving and rebasing a stale editor draft. */
export type KanbanEditorReloadResult =
  | KanbanEditorKindOutcome<'reloaded'>
  | KanbanEditorKindOutcome<'deleted'>
  | KanbanEditorCodeOutcome<'unavailable'>
  | KanbanEditorKindOutcome<'sealed'>
  | KanbanEditorKindOutcome<'disposed'>
  | KanbanEditorKindOutcome<'failed'>;

/** Options for opening one isolated editor session. */
export interface KanbanEditorSessionOptions<TCard, TDraft> {
  /** Create, view, or edit behavior. */
  readonly mode: KanbanEditorMode;
  /** Existing application-owned card identity. */
  readonly cardKey: CardKey;
  /** Typed generic record/draft adapter. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Application-owned authoritative record source. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  /** Application-owned request admission seam. */
  readonly authority: KanbanEditorAuthority;
  /** Optional caller cancellation used only while the initial record resolution is pending. */
  readonly signal?: AbortSignal;
}

/** Disposable actor-style session shared by standard, custom, and inspector presentations. */
export interface KanbanEditorSession {
  /** Returns one coherent immutable session snapshot. */
  snapshot(): KanbanEditorSessionSnapshot;
  /** Returns immutable state for one schema field or a safe absent placeholder. */
  fieldState(fieldId: KanbanFieldId): KanbanEditorFieldState;
  /** Returns one immutable semantic field value, or `undefined` when absent or unsafe. */
  fieldValue(fieldId: KanbanFieldId): KanbanSemanticValue | undefined;
  /** Updates the stable field focus identity when that field exists and is visible. */
  focusField(fieldId: KanbanFieldId): boolean;
  /** Attempts one typed field mutation without coercing hostile values. */
  setValue(fieldId: KanbanFieldId, value: unknown): KanbanEditorSetValueResult;
  /** Validates and submits one full detached draft through application authority. */
  submit(): Promise<KanbanEditorSubmitResult>;
  /** Explicitly discards a stale draft and reloads the latest authoritative record. */
  reload(policy: KanbanEditorReloadPolicy): Promise<KanbanEditorReloadResult>;
  /** Subscribes to coherent state changes and returns an idempotent unsubscriber. */
  subscribe(listener: (snapshot: KanbanEditorSessionSnapshot) => void): () => void;
  /** Releases resolver, validation, and request ownership idempotently. */
  dispose(): void;
  /** Reports whether the session has released all owned resources. */
  disposed(): boolean;
}

/** Presentation family claiming one card identity through the editor coordinator. */
export type KanbanEditorKind = 'standard' | 'custom';

/** Options for opening one identity-exclusive editor session. */
export interface KanbanEditorCoordinatorOpenOptions<TCard, TDraft> extends KanbanEditorSessionOptions<TCard, TDraft> {
  /** Standard package presentation or complete application replacement. */
  readonly editorKind: KanbanEditorKind;
}

/** Successful identity-exclusive editor acquisition. */
export interface KanbanEditorOpened {
  /** Acquisition discriminator. */
  readonly kind: 'opened';
  /** Claimed presentation family. */
  readonly editorKind: KanbanEditorKind;
  /** Session whose disposal releases this exact coordinator claim. */
  readonly session: KanbanEditorSession;
}

/** Existing claim returned instead of creating a second draft for the same card. */
export interface KanbanEditorAlreadyOpen {
  /** Existing-claim discriminator. */
  readonly kind: 'already-open';
  /** Presentation family that owns the existing claim. */
  readonly editorKind: KanbanEditorKind;
  /** Existing shared session suitable for focus or inspector reuse. */
  readonly session: KanbanEditorSession;
}

/** Complete result of attempting an identity-exclusive editor acquisition. */
export type KanbanEditorOpenResult = KanbanEditorOpened | KanbanEditorAlreadyOpen | KanbanEditorKindOutcome<'disposed'>;

/** Owns identity claims across package and application editor presentations. */
export interface KanbanEditorCoordinator {
  /** Opens or returns the one session already claimed for the supplied card identity. */
  open<TCard, TDraft>(options: KanbanEditorCoordinatorOpenOptions<TCard, TDraft>): Promise<KanbanEditorOpenResult>;
  /** Disposes all resolved sessions and prevents later acquisition. */
  dispose(): void;
  /** Reports whether the coordinator has released its claim registry. */
  disposed(): boolean;
}
