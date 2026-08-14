import type { KanbanDefinitionOfDoneSnapshot } from '../workflow/definition-of-done.js';
import type { KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type {
  KanbanColumnPosition,
  KanbanExpectedEntityRevision,
  KanbanFieldRejection,
  KanbanRequestProposal,
  KanbanRequestResult,
  KanbanSwimlanePosition,
} from '../contract/request.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanStructureStyle, KanbanWipPolicy } from '../source/types.js';
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';

/** A terminal-safe visible name and its locale-independent duplicate key. */
export interface KanbanNormalizedConfigurationName {
  /** Sanitized, trimmed, NFKC-normalized text shown to a user. */
  readonly label: string;
  /** Fixed-locale lowercase key used only for duplicate detection. */
  readonly collisionKey: string;
}

/** Immutable structural evidence for one configurable workflow column. */
export interface KanbanConfigurationColumnSnapshot {
  /** Stable application-owned column identity. */
  readonly columnId: KanbanColumnId;
  /** Sanitized visible column name. */
  readonly label: string;
  /** Optional visible text that distinguishes an approved duplicate name. */
  readonly disambiguator?: string;
  /** Equality-only column revision captured from application authority. */
  readonly revision: KanbanRevision;
  /** Optional sanitized completion policy presented by configuration UI. */
  readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot;
  /** Optional application-authoritative workflow count policy. */
  readonly wip?: KanbanWipPolicy;
  /** Optional allowlisted semantic surface style. */
  readonly style?: KanbanStructureStyle;
  /** Optional detached application-owned structural metadata. */
  readonly data?: KanbanSemanticValue;
}

/** Whether a swimlane is application-owned structure or a derived grouping projection. */
export type KanbanConfigurationSwimlaneMode = 'explicit' | 'derived';

/** Immutable structural evidence for one configurable or derived swimlane. */
export interface KanbanConfigurationSwimlaneSnapshot {
  /** Stable application-owned or derived swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Sanitized visible swimlane name. */
  readonly label: string;
  /** Optional visible text that distinguishes an approved duplicate name. */
  readonly disambiguator?: string;
  /** Equality-only swimlane revision captured from application authority. */
  readonly revision: KanbanRevision;
  /** Structural mutability classification; omitted input defaults to `explicit`. */
  readonly mode: KanbanConfigurationSwimlaneMode;
  /** Optional allowlisted semantic surface style. */
  readonly style?: KanbanStructureStyle;
  /** Optional detached application-owned structural metadata. */
  readonly data?: KanbanSemanticValue;
}

/** Detached application-authoritative board structure consumed by configuration builders and dialogs. */
export interface KanbanConfigurationSnapshot {
  /** Equality-only revision for the complete structural publication. */
  readonly revision: KanbanRevision;
  /** Ordered workflow columns. */
  readonly columns: readonly KanbanConfigurationColumnSnapshot[];
  /** Ordered explicit or derived swimlanes. */
  readonly swimlanes: readonly KanbanConfigurationSwimlaneSnapshot[];
}

/** Authoritative occupancy evidence required before structural deletion. */
export type KanbanConfigurationOccupancy =
  { readonly quality: 'unknown' } | { readonly quality: 'exact'; readonly count: number };

/** Explicit application opt-in that makes one duplicate visible name unambiguous. */
export interface KanbanDuplicateConfigurationName {
  /** Non-empty terminal-safe text displayed beside the duplicate name. */
  readonly disambiguator: string;
}

/** One column workflow selected by a configuration invoker. */
export type KanbanColumnConfigurationOperation =
  | { readonly kind: 'add'; readonly columnId: KanbanColumnId; readonly position: KanbanColumnPosition }
  | { readonly kind: 'update'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'reorder'; readonly columnId: KanbanColumnId }
  | {
      readonly kind: 'delete';
      readonly columnId: KanbanColumnId;
      readonly occupancy: KanbanConfigurationOccupancy;
      readonly policy?: unknown;
    };

/** One explicit-swimlane workflow selected by a configuration invoker. */
export type KanbanSwimlaneConfigurationOperation =
  | { readonly kind: 'add'; readonly swimlaneId: KanbanSwimlaneId; readonly position: KanbanSwimlanePosition }
  | { readonly kind: 'update'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'reorder'; readonly swimlaneId: KanbanSwimlaneId }
  | {
      readonly kind: 'delete';
      readonly swimlaneId: KanbanSwimlaneId;
      readonly occupancy: KanbanConfigurationOccupancy;
      readonly policy?: unknown;
    };

/** Application-owned authoritative source used by one configuration session. */
export interface KanbanConfigurationSource {
  /** Resolves the latest detached structure. */
  readonly resolve: (context?: { readonly signal: AbortSignal }) => Promise<KanbanConfigurationSnapshot>;
  /** Observes later authoritative structural publications. */
  readonly subscribe: (listener: (snapshot: KanbanConfigurationSnapshot) => void) => () => void;
}

/** Immutable authority evidence captured with one configuration proposal. */
export interface KanbanConfigurationAuthorityContext {
  /** Board-wide structural revision observed while the proposal was built. */
  readonly boardRevision: KanbanRevision;
  /** Relevant entity and stable-neighbor revisions from the same snapshot. */
  readonly entities: readonly KanbanExpectedEntityRevision[];
  /** Aborts when the session is disposed or this request is superseded. */
  readonly signal: AbortSignal;
}

/** Application-owned proposal authority used by dispatched configuration sessions. */
export interface KanbanConfigurationAuthority {
  /** Admits one lifecycle-free proposal and returns an operation-correlated result. */
  readonly request: (
    proposal: KanbanRequestProposal,
    context?: KanbanConfigurationAuthorityContext,
  ) => KanbanRequestResult | Promise<KanbanRequestResult>;
}

/** Coherent immutable state rendered by a configuration dialog. */
export interface KanbanConfigurationSessionSnapshot {
  /** Current source lifecycle. */
  readonly record: 'loading' | 'ready' | 'stale' | 'unavailable';
  /** Sanitized isolated name draft. */
  readonly label: string;
  /** Optional visible duplicate-name disambiguator. */
  readonly disambiguator?: string;
  /** Optional isolated definition-of-done draft for columns. */
  readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot;
  /** Optional isolated workflow count-policy draft for columns. */
  readonly wip?: KanbanWipPolicy;
  /** Optional isolated semantic-style draft. */
  readonly style?: KanbanStructureStyle;
  /** Optional detached application-owned metadata draft. */
  readonly data?: KanbanSemanticValue;
  /** Whether the isolated draft differs from its authoritative baseline. */
  readonly dirty: boolean;
  /** Current request lifecycle. */
  readonly submission: 'idle' | 'dispatching' | 'awaiting-publication' | 'rejected' | 'committed';
  /** Optional payload-free application rejection code. */
  readonly code?: string;
  /** Optional bounded field-specific application rejection diagnostics. */
  readonly diagnostics?: readonly KanbanFieldRejection[];
  /** Operation awaiting or confirmed by authoritative publication. */
  readonly operationId?: string;
  /** Current structural-deletion eligibility for delete workflows. */
  readonly deletion?:
    | { readonly kind: 'ready' }
    | {
        readonly kind: 'disabled';
        readonly code: 'occupancy-unknown' | 'non-empty-policy-required' | 'derived-group-read-only';
      };
  /** Deterministic board focus target produced by a committed structural deletion. */
  readonly focusTarget?: KanbanConfigurationFocusTarget;
}

/** Result of applying one configuration-session draft. */
export type KanbanConfigurationSessionApplyResult =
  | { readonly kind: 'proposal'; readonly proposal: KanbanRequestProposal }
  | { readonly kind: 'awaiting-publication'; readonly operationId: string }
  | { readonly kind: 'committed'; readonly operationId: string }
  | { readonly kind: 'rejected'; readonly code: string }
  | { readonly kind: 'stale' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'disposed' }
  | { readonly kind: 'failed' };

/** Disposable isolated draft actor shared by standard and replacement configuration dialogs. */
export interface KanbanConfigurationSession {
  /** Returns the detached immutable operation owned by this session. */
  readonly operation: () => KanbanColumnConfigurationOperation | KanbanSwimlaneConfigurationOperation;
  /** Returns one coherent immutable lifecycle snapshot. */
  readonly snapshot: () => KanbanConfigurationSessionSnapshot;
  /** Replaces the isolated visible-name draft after terminal-safe normalization. */
  readonly setLabel: (value: unknown) => boolean;
  /** Replaces an optional visible duplicate-name disambiguator. */
  readonly setDisambiguator: (value: unknown) => boolean;
  /** Replaces optional definition-of-done text for a configurable column. */
  readonly setDefinitionOfDone: (summary: unknown, details?: unknown) => boolean;
  /** Replaces or clears the isolated workflow count policy for a column. */
  readonly setWip: (value: unknown) => boolean;
  /** Replaces or clears the isolated allowlisted semantic style. */
  readonly setStyle: (value: unknown) => boolean;
  /** Replaces optional bounded application metadata. */
  readonly setData: (value: unknown) => boolean;
  /** Replaces the semantic position used by a reorder operation. */
  readonly setPosition: (value: KanbanColumnPosition | KanbanSwimlanePosition) => boolean;
  /** Returns bounded stable-neighbor destinations for a reorder operation. */
  readonly reorderDestinations: () => readonly KanbanConfigurationReorderDestination[];
  /** Returns valid reassignment destinations for a delete operation. */
  readonly deletionDestinations: () => readonly KanbanConfigurationDeletionDestination[];
  /** Selects one complete atomic reassignment policy by stable destination identity. */
  readonly setDeletionDestination: (destinationId: unknown) => boolean;
  /** Builds a proposal and optionally submits it through application authority. */
  readonly apply: () => Promise<KanbanConfigurationSessionApplyResult>;
  /** Discards a stale draft and resolves the latest authoritative structure. */
  readonly reload: () => Promise<boolean>;
  /** Subscribes to coherent state changes. */
  readonly subscribe: (listener: (snapshot: KanbanConfigurationSessionSnapshot) => void) => () => void;
  /** Releases source subscriptions and invalidates late async work. */
  readonly dispose: () => void;
  /** Reports whether owned resources have been released. */
  readonly disposed: () => boolean;
}

/** One human-readable stable destination offered by package-owned reorder UI. */
export interface KanbanConfigurationReorderDestination {
  /** Application-owned neighbor-label suffix; empty for package-localized start/end destinations. */
  readonly label: string;
  /** Stable semantic position submitted to the pure proposal builder. */
  readonly position: KanbanColumnPosition | KanbanSwimlanePosition;
}

/** One safe atomic reassignment destination offered by package-owned delete UI. */
export interface KanbanConfigurationDeletionDestination {
  /** Stable column or swimlane destination identity. */
  readonly destinationId: string;
  /** Short terminal-safe destination label. */
  readonly label: string;
}

/** Minimal application host required by package-owned configuration dialogs. */
export interface KanbanConfigurationDialogHost {
  /** Translation service inherited from the application. */
  readonly i18n: I18n;
  /** Modal execution and focus operations. */
  readonly loop: Pick<EventLoop, 'execView' | 'focusView'>;
  /** Desktop mount operations and current terminal extent. */
  readonly desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}

/** Result-only configuration completion that never invokes application authority. */
export interface KanbanConfigurationResultOnlyCompletion {
  /** Completion discriminator. */
  readonly kind: 'result-only';
}

/** Configuration completion routed through application request authority. */
export interface KanbanConfigurationAuthorityCompletion {
  /** Completion discriminator. */
  readonly kind: 'authority';
  /** Application request admission seam. */
  readonly authority: KanbanConfigurationAuthority;
}

/** Completion policies supported by package-owned configuration dialogs. */
export type KanbanConfigurationDialogCompletion =
  KanbanConfigurationResultOnlyCompletion | KanbanConfigurationAuthorityCompletion;

/** Application confirmation seam used for destructive or stale draft decisions. */
export type KanbanConfigurationConfirm = (request: {
  readonly kind: 'reload-stale' | 'discard-draft' | 'delete-structure';
  /** Aborts when the owning configuration dialog ends or is disposed. */
  readonly signal: AbortSignal;
}) => boolean | Promise<boolean>;

/** Terminal result returned by one package-owned configuration dialog. */
export type KanbanConfigurationDialogResult =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'proposal'; readonly proposal: KanbanRequestProposal }
  | { readonly kind: 'committed'; readonly operationId: string }
  | { readonly kind: 'disposed' }
  | { readonly kind: 'failed' };
import type { I18n } from '@jsvision/i18n';
import type { Desktop, EventLoop } from '@jsvision/ui';
