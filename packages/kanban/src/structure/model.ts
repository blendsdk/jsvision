import { KanbanInvalidPresentationError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanColumnMeta } from '../source/validation.js';
import type {
  KanbanColumnMeta,
  KanbanDefinitionOfDone,
  KanbanStructureCapability,
  KanbanStructureStyle,
  KanbanWipPolicy,
} from '../source/types.js';
import { snapshotKanbanStructurePolicy } from './policy.js';
import type { KanbanColumnPolicy, KanbanColumnWidthPreference, KanbanStructurePolicy } from './policy.js';

/** Semantic scope owned by one normalized structure state. */
export type KanbanStructureScope =
  | { readonly kind: 'board' }
  | { readonly kind: 'column'; readonly columnId: string }
  | { readonly kind: 'swimlane'; readonly swimlaneId: string }
  | { readonly kind: 'cell'; readonly address: { readonly columnId: string; readonly swimlaneId?: string } };

/** Source lifecycle facts accepted by the pure structural-state resolver. */
export type KanbanStructureSourceState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'refreshing' }
  | { readonly kind: 'partial' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'error'; readonly code: string; readonly retry: 'available' | 'unavailable' };

/** Facts used to distinguish empty, filtered, loading, partial, collapsed, hidden, and error states. */
export interface KanbanStructureStateInput {
  /** Semantic owner of the state surface. */
  readonly scope: KanbanStructureScope;
  /** Authoritative source lifecycle fact. */
  readonly source: KanbanStructureSourceState;
  /** Whether an active filter explains an empty result. */
  readonly filtered: boolean;
  /** Whether visible chrome suppresses ordinary card regions. */
  readonly collapsed?: boolean;
  /** Whether the semantic entity is detached from the visible scene. */
  readonly hidden?: boolean;
}

/** Closed semantic state codes used by renderer and interaction layers. */
export type KanbanStructureStateCode =
  | 'no-columns'
  | 'true-empty'
  | 'filtered-empty'
  | 'loading'
  | 'refreshing'
  | 'partial'
  | 'ready'
  | 'collapsed'
  | 'hidden'
  | 'error';

/** Bounded semantic action exposed by one structural state surface. */
export interface KanbanStructureStateAction {
  /** Package-owned action route; application publication remains authoritative. */
  readonly kind: 'clear-filters' | 'retry';
}

/** Detached immutable state presentation for one structural scope. */
export interface KanbanStructureState {
  /** Distinct semantic state code. */
  readonly code: KanbanStructureStateCode;
  /** Semantic owner retained without renderer geometry. */
  readonly scope: KanbanStructureScope;
  /** Available package-owned semantic actions. */
  readonly actions: readonly KanbanStructureStateAction[];
  /** Non-color text cue that keeps the state distinguishable. */
  readonly nonColorCue?: string;
}

/** Stable semantic reference retained across display-label changes. */
export interface KanbanColumnSemanticReference {
  /** Structural discriminator. */
  readonly kind: 'column';
  /** Stable source-owned column identity. */
  readonly columnId: string;
}

/** One source column after validated policy projection. */
export interface ResolvedKanbanColumn {
  /** Stable source-owned column identity. */
  readonly columnId: string;
  /** Sanitized source-owned display label. */
  readonly label: string;
  /** Equality-only source metadata revision. */
  readonly revision: KanbanRevision;
  /** Stable reference used by focus, selection, and saved view semantics. */
  readonly semanticReference: KanbanColumnSemanticReference;
  /** Whether this entity participates in the visible scene. */
  readonly visibility: 'visible' | 'hidden';
  /** Whether card regions are available below retained chrome. */
  readonly collapse: 'expanded' | 'collapsed';
  /** Whether ordinary card scene nodes may be projected. */
  readonly cardRegion: 'active' | 'suppressed';
  /** Optional complete responsive width preference. */
  readonly width?: KanbanColumnWidthPreference;
  /** Optional pure WIP evaluation policy. */
  readonly wip?: KanbanWipPolicy;
  /** Optional compact/full definition-of-done evidence. */
  readonly definitionOfDone?: KanbanDefinitionOfDone;
  /** Package-understood presentation capabilities. */
  readonly capabilities: readonly KanbanStructureCapability[];
  /** Optional allowlisted semantic style. */
  readonly style?: KanbanStructureStyle;
}

/** Complete source-authoritative structure input with view-owned projection policy. */
export interface ResolveKanbanStructureInput<TCard> {
  /** Equality-only revision for the resulting structure snapshot. */
  readonly revision: KanbanRevision;
  /** Source-ordered workflow columns. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Validated view-owned structure policy. */
  readonly policy: KanbanStructurePolicy<TCard>;
}

/** Immutable normalized workflow structure with hidden/collapsed evidence kept separately. */
export interface ResolvedKanbanStructure {
  /** Equality-only snapshot revision. */
  readonly revision: KanbanRevision;
  /** Source-ordered columns participating in the visible scene. */
  readonly columns: readonly ResolvedKanbanColumn[];
  /** Complete normalized column evidence, including hidden and collapsed entities. */
  readonly detached: { readonly columns: readonly ResolvedKanbanColumn[] };
  /** Board-level structure state. */
  readonly state: KanbanStructureState;
}

/** Frozen empty action list shared by inert structural states. */
const NO_ACTIONS: readonly KanbanStructureStateAction[] = Object.freeze([]);

/** Converts invalid model input into one payload-free structural configuration error. */
function invalidStructure(): never {
  throw new KanbanInvalidPresentationError();
}

/** Creates a detached frozen scope without retaining caller-owned nested address data. */
function snapshotScope(scope: KanbanStructureScope): KanbanStructureScope {
  if (scope.kind === 'board') return Object.freeze({ kind: 'board' });
  if (scope.kind === 'column') return Object.freeze({ kind: 'column', columnId: scope.columnId });
  if (scope.kind === 'swimlane') return Object.freeze({ kind: 'swimlane', swimlaneId: scope.swimlaneId });
  return Object.freeze({
    kind: 'cell',
    address: Object.freeze({
      columnId: scope.address.columnId,
      ...(scope.address.swimlaneId === undefined ? {} : { swimlaneId: scope.address.swimlaneId }),
    }),
  });
}

/** Creates one frozen state with a stable non-color label. */
function state(
  code: KanbanStructureStateCode,
  scope: KanbanStructureScope,
  actions: readonly KanbanStructureStateAction[] = NO_ACTIONS,
): KanbanStructureState {
  return Object.freeze({ code, scope: snapshotScope(scope), actions, nonColorCue: code });
}

/**
 * Resolves authoritative lifecycle facts into one distinct, renderer-independent structural state.
 *
 * @example
 * ```ts
 * resolveKanbanStructureState({
 *   scope: { kind: 'board' },
 *   source: { kind: 'loading' },
 *   filtered: false,
 * });
 * ```
 */
export function resolveKanbanStructureState(input: KanbanStructureStateInput): KanbanStructureState {
  if (input.hidden === true) return state('hidden', input.scope);
  if (input.collapsed === true) return state('collapsed', input.scope);
  if (input.source.kind === 'error') {
    const actions = input.source.retry === 'available' ? Object.freeze([{ kind: 'retry' as const }]) : NO_ACTIONS;
    return state('error', input.scope, actions);
  }
  if (input.source.kind === 'empty') {
    return input.filtered
      ? state('filtered-empty', input.scope, Object.freeze([{ kind: 'clear-filters' as const }]))
      : state('true-empty', input.scope);
  }
  return state(input.source.kind, input.scope);
}

/** Projects one validated policy record over source-owned identity and label metadata. */
function resolveColumn(meta: KanbanColumnMeta, policy: KanbanColumnPolicy | undefined): ResolvedKanbanColumn {
  const visibility = policy?.visible === false ? 'hidden' : 'visible';
  const collapse = policy?.collapsed === true ? 'collapsed' : 'expanded';
  return Object.freeze({
    columnId: meta.columnId,
    label: meta.label,
    revision: meta.revision,
    semanticReference: Object.freeze({ kind: 'column', columnId: meta.columnId }),
    visibility,
    collapse,
    cardRegion: visibility === 'hidden' || collapse === 'collapsed' ? 'suppressed' : 'active',
    ...(policy?.width === undefined ? {} : { width: policy.width }),
    ...(policy?.wip === undefined ? {} : { wip: policy.wip }),
    ...(policy?.definitionOfDone === undefined ? {} : { definitionOfDone: policy.definitionOfDone }),
    capabilities: policy?.capabilities ?? Object.freeze([]),
    ...(policy?.style === undefined ? {} : { style: policy.style }),
  });
}

/**
 * Reconciles source-ordered column metadata with view-owned policy by stable semantic identity.
 *
 * Display-label changes never affect placement references, and policy projection never mutates or
 * reorders the application collection.
 *
 * @example
 * ```ts
 * const structure = resolveKanbanStructure({
 *   revision: 'structure-v1',
 *   columns: [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
 *   policy: { revision: 'policy-v1', columns: [] },
 * });
 * ```
 */
export function resolveKanbanStructure<TCard>(input: ResolveKanbanStructureInput<TCard>): ResolvedKanbanStructure {
  if (!Array.isArray(input.columns) || input.columns.length > KANBAN_LIMITS.columns.safe) return invalidStructure();
  try {
    const revision = snapshotKanbanRevision(input.revision);
    const policy = snapshotKanbanStructurePolicy<TCard>(input.policy);
    const columns = Object.freeze(input.columns.map(snapshotKanbanColumnMeta));
    if (new Set(columns.map((column) => column.columnId)).size !== columns.length) return invalidStructure();
    const policies = new Map(policy.columns.map((entry) => [entry.columnId, entry]));
    const detachedColumns = Object.freeze(
      columns.map((column) => resolveColumn(column, policies.get(column.columnId))),
    );
    const visibleColumns = Object.freeze(detachedColumns.filter((column) => column.visibility === 'visible'));
    const boardScope = Object.freeze({ kind: 'board' as const });
    const boardState: KanbanStructureState =
      columns.length === 0
        ? Object.freeze({ code: 'no-columns', scope: boardScope, actions: NO_ACTIONS })
        : state('ready', boardScope);
    return Object.freeze({
      revision,
      columns: visibleColumns,
      detached: Object.freeze({ columns: detachedColumns }),
      state: boardState,
    });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidStructure();
  }
}
