import type { CardKey, KanbanExtensionId } from '../contract/identity.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanSelectionSnapshot } from './types.js';

/** Input channel that initiated one semantic application interaction. */
export type KanbanInteractionOrigin = 'keyboard' | 'pointer' | 'programmatic';

/** Package-owned scoped actions with stable semantics across hosts. */
export type KanbanBuiltInActionId = 'collapse' | 'clear-filters' | 'configure' | 'add-card';

/** Complete action identity accepted by the application-owned scoped-action boundary. */
export type KanbanScopedActionId = KanbanBuiltInActionId | KanbanExtensionId;

/** Shared immutable evidence captured for every application interaction intent. */
export interface KanbanInteractionIntentBase {
  /** Input channel that initiated the interaction. */
  readonly origin: KanbanInteractionOrigin;
  /** Eligible ordered selection captured after the required interaction transition settles. */
  readonly selection: KanbanSelectionSnapshot;
}

/** Requests that the application open or otherwise activate one card. */
export interface KanbanOpenCardIntent extends KanbanInteractionIntentBase {
  /** Stable intent discriminator. */
  readonly kind: 'open-card';
  /** Application-owned card identity without the application record payload. */
  readonly cardKey: CardKey;
  /** Semantic cell containing the card when the intent was captured. */
  readonly address: KanbanCellAddress;
  /** Optional descriptor action that requested the activation. */
  readonly actionId?: KanbanExtensionId;
}

/** Requests an application-owned context surface for one closed semantic scope. */
export interface KanbanOpenContextIntent extends KanbanInteractionIntentBase {
  /** Stable intent discriminator. */
  readonly kind: 'open-context';
  /** Semantic owner targeted after focus and eligible selection have settled. */
  readonly scope: KanbanActionScope;
}

/** Requests one application-owned action without mutating board data or policy locally. */
export interface KanbanScopedActionIntent extends KanbanInteractionIntentBase {
  /** Stable intent discriminator. */
  readonly kind: 'scoped-action';
  /** Package-owned or validated application-namespaced semantic action. */
  readonly actionId: KanbanScopedActionId;
  /** Closed semantic owner of the action. */
  readonly scope: KanbanActionScope;
}

/** Complete non-mutation interaction boundary delivered to an application handler. */
export type KanbanInteractionIntent = KanbanOpenCardIntent | KanbanOpenContextIntent | KanbanScopedActionIntent;

/** Optional synchronous application handler for immutable semantic interaction intents. */
export type KanbanInteractionHandler = (intent: KanbanInteractionIntent) => void;
