import type { View } from '@jsvision/ui';

import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import type { KanbanCardCreateProposal, KanbanCardUpdateProposal } from '../contract/request.js';
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
  readonly create: () => KanbanEditorControlInstance;
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

/** Generic bridge between an application record, editor draft, and board proposal. */
export interface KanbanCardEditorAdapter<TCard, TDraft> {
  /** Validated schema describing fields and controls. */
  readonly schema: KanbanCardEditorSchema<TCard, TDraft>;
  /** Creates a detached typed draft for create, view, or edit mode. */
  create(card: TCard | undefined, context: KanbanEditorContext): TDraft;
  /** Creates a bounded semantic snapshot without mutating the draft. */
  snapshot(draft: TDraft): KanbanSemanticValue;
  /** Builds one lifecycle-free create or update proposal for the shared authority. */
  proposal(result: KanbanEditorResult<TDraft>): KanbanCardCreateProposal | KanbanCardUpdateProposal;
}

/** Application-owned record identity used by an edit/view session. */
export interface KanbanEditorCardIdentity {
  /** Identity discriminator reserved for later provisional create sessions. */
  readonly kind: 'card';
  /** Stable application-owned card key. */
  readonly cardKey: CardKey;
}
