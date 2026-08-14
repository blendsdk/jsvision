import type { KanbanFieldId } from '../contract/identity.js';
import type { KanbanEditorDiagnostic, KanbanEditorRecordPublication, KanbanEditorSetValueResult } from './types.js';

/** Empty immutable diagnostics collection shared by pristine fields. */
export const NO_KANBAN_EDITOR_DIAGNOSTICS: readonly KanbanEditorDiagnostic[] = Object.freeze([]);

const SETTLED_EDITOR_VALUE = Promise.resolve();

/** Returns a uniform completion handle when a value change did not start validation work. */
export function settledKanbanEditorValueOutcome<
  TKind extends Exclude<KanbanEditorSetValueResult, { readonly kind: 'accepted' }>['kind'],
>(kind: TKind): { readonly kind: TKind; readonly settled: Promise<void> } {
  return Object.freeze({ kind, settled: SETTLED_EDITOR_VALUE });
}

/** Mutable state owned by one schema field and never exposed directly. */
export interface MutableKanbanEditorFieldState {
  /** Stable schema identity retained across validation generations. */
  readonly fieldId: KanbanFieldId;
  /** Whether mutation or submission has exposed validation feedback. */
  touched: boolean;
  /** Current failure-contained visibility predicate result. */
  visible: boolean;
  /** Current mode and predicate-derived mutation policy. */
  readOnly: boolean;
  /** Sanitized control-facing representation. */
  displayValue: string;
  /** Immutable safe parser, write, validation, and authority failures for the current generation. */
  validationDiagnostics: readonly KanbanEditorDiagnostic[];
  /** Immutable safe read, predicate, and formatter failures for the current presentation. */
  presentationDiagnostics: readonly KanbanEditorDiagnostic[];
  /** Monotonic counter that makes late async validation inert. */
  generation: number;
  /** Controller aborted whenever a newer field generation starts. */
  controller: AbortController | undefined;
}

/** Validated record publication buffered while initial resolution is pending. */
export type BufferedKanbanEditorRecordPublication<TCard> = KanbanEditorRecordPublication<TCard>;
