import type { KeyEvent } from '@jsvision/core';

import type { CardKey, KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';

/** Stable origin inventory shared by keyboard, pointer, chrome, and programmatic callers. */
export type KanbanActionOrigin = 'keyboard' | 'menu' | 'context-menu' | 'status' | 'pointer' | 'programmatic';

/** Closed package categories used for help grouping and read-only policy. */
export type KanbanActionCategory =
  'navigation' | 'selection' | 'card' | 'structure' | 'view' | 'help' | 'history' | 'application';

/** Logical applicability declared by one action definition. */
export type KanbanActionTargetKind = 'board' | 'card' | 'cell' | 'column' | 'swimlane' | 'selection' | 'any';

/** Detached logical target captured once before capability and handler execution. */
export type KanbanActionInvocationTarget =
  | { readonly kind: 'board' }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly revision?: KanbanRevision }
  | {
      readonly kind: 'cell';
      readonly columnId: KanbanColumnId;
      readonly swimlaneId?: KanbanSwimlaneId;
    }
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId; readonly revision?: KanbanRevision }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId; readonly revision?: KanbanRevision };

/** Bounded record-free selection evidence supplied to capabilities and handlers. */
export interface KanbanActionSelectionSnapshot {
  /** Current selected-card count without card payloads. */
  readonly count: number;
}

/** Bounded source lifecycle evidence supplied to capabilities and handlers. */
export interface KanbanActionSourceSnapshot {
  /** Current source/query availability. */
  readonly state: 'ready' | 'loading' | 'error' | 'disposed';
  /** Optional equality-only source revision. */
  readonly revision?: KanbanRevision;
}

/** Bounded active-view evidence supplied to capabilities and handlers. */
export interface KanbanActionViewSnapshot {
  /** Optional equality-only active view revision. */
  readonly revision?: KanbanRevision;
}

/** One immutable action invocation shared by every origin. */
export interface KanbanActionInvocation {
  /** Stable package or namespaced application action identity. */
  readonly actionId: string;
  /** UI or programmatic route that initiated the action. */
  readonly origin: KanbanActionOrigin;
  /** Current logical target captured before capability evaluation. */
  readonly target: KanbanActionInvocationTarget;
  /** Record-free selection summary. */
  readonly selection: KanbanActionSelectionSnapshot;
  /** Current source state and optional revision. */
  readonly source: KanbanActionSourceSnapshot;
  /** Current view revision evidence. */
  readonly view: KanbanActionViewSnapshot;
}

/** Successful synchronous or asynchronous action completion. */
export interface KanbanActionHandledOutcome {
  /** Outcome discriminator. */
  readonly kind: 'handled';
}

/** Discoverable action denial with bounded payload-free feedback. */
export interface KanbanActionDisabledOutcome {
  /** Outcome discriminator. */
  readonly kind: 'disabled';
  /** Stable application/package reason code. */
  readonly code: string;
  /** Optional safe visible feedback label. */
  readonly label?: string;
}

/** Explicitly hidden action outcome used to remove an affordance. */
export interface KanbanActionHiddenOutcome {
  /** Outcome discriminator. */
  readonly kind: 'hidden';
}

/** Missing or disposed route outcome. */
export interface KanbanActionUnavailableOutcome {
  /** Outcome discriminator. */
  readonly kind: 'unavailable';
  /** Stable payload-free reason code. */
  readonly code: 'action-unavailable' | 'router-disposed' | 'action-depth-exceeded' | 'action-reentrant';
}

/** Terminal action outcome returned after eligibility and handler execution. */
export type KanbanActionTerminalOutcome =
  KanbanActionHandledOutcome | KanbanActionDisabledOutcome | KanbanActionHiddenOutcome | KanbanActionUnavailableOutcome;

/** Asynchronous action admission with a disposal-aware terminal completion. */
export interface KanbanActionPendingOutcome {
  /** Outcome discriminator. */
  readonly kind: 'pending';
  /** Stable action identity whose handler is pending. */
  readonly actionId: string;
  /** Terminal completion; router disposal converts late settlement to unavailable. */
  readonly completion: Promise<KanbanActionTerminalOutcome>;
}

/** Immediate or pending outcome returned by the action router. */
export type KanbanActionOutcome = KanbanActionTerminalOutcome | KanbanActionPendingOutcome;

/** Result accepted from one package or application action handler. */
export type KanbanActionHandlerResult = KanbanActionTerminalOutcome | Promise<KanbanActionTerminalOutcome>;

/** Handler invoked only after target validation and one allowed capability snapshot. */
export type KanbanActionHandler = (invocation: KanbanActionInvocation) => KanbanActionHandlerResult;

/** Complete stable action definition stored by the bounded registry. */
export interface KanbanActionDefinition {
  /** Stable package ID or namespaced application extension ID. */
  readonly id: string;
  /** Help/menu grouping category. */
  readonly category: KanbanActionCategory;
  /** Translation message ID for the concise label. */
  readonly labelMessageId: string;
  /** Translation message ID for complete help. */
  readonly helpMessageId: string;
  /** Logical target kind required by the handler. */
  readonly target: KanbanActionTargetKind;
  /** Stable capability key passed to application policy. */
  readonly capability: string;
  /** Semantic default chords; an empty array marks an explicitly unbound action. */
  readonly bindings: readonly string[];
  /** Whether read-only policy classifies the package action as mutating. */
  readonly mutation?: boolean;
  /** Action behavior invoked through the shared router only. */
  readonly handler: KanbanActionHandler;
}

/** Capability result returned synchronously before one action handler. */
export type KanbanActionCapability =
  | { readonly state: 'allowed' }
  | { readonly state: 'disabled'; readonly reasonCode: string; readonly label?: string }
  | { readonly state: 'hidden' };

/** Record-free context passed to a pure capability provider. */
export interface KanbanActionCapabilityContext extends KanbanActionInvocation {
  /** Detached immutable action metadata. */
  readonly definition: KanbanActionDefinition;
}

/** Pure synchronous UI-eligibility provider; application authorization remains separate. */
export type KanbanCapabilityProvider = (context: KanbanActionCapabilityContext) => KanbanActionCapability;

/** Visible/enabled state used to construct pointer, menu, status, and palette affordances. */
export interface KanbanActionAffordance {
  /** Whether the affordance participates in hit testing/presentation. */
  readonly visible: boolean;
  /** Whether an invocation may reach the action handler. */
  readonly enabled: boolean;
}

/** Public registry surface consumed by keymaps, help, and routers. */
export interface KanbanActionRegistry {
  /** Returns the complete immutable package-plus-application inventory. */
  readonly actions: () => readonly KanbanActionDefinition[];
  /** Finds one exact action identity without prefix or case folding. */
  readonly action: (actionId: string) => KanbanActionDefinition | undefined;
}

/** Public action router shared by every invocation origin. */
export interface KanbanActionRouter {
  /** Evaluates capability once and invokes one exact action. */
  readonly invoke: (invocation: KanbanActionInvocation) => KanbanActionOutcome;
  /** Resolves affordance visibility/enablement through the same capability path. */
  readonly affordance: (invocation: KanbanActionInvocation) => KanbanActionAffordance;
  /** Makes retained routes unavailable and invalidates late handler settlement. */
  readonly dispose: () => void;
  /** Reports whether router resources have been released. */
  readonly disposed: () => boolean;
}

/** Core key event accepted by the semantic Kanban keymap. */
export type KanbanActionKeyEvent = KeyEvent;
