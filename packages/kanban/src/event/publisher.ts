import type { KanbanActionInvocation, KanbanActionTerminalOutcome } from '../command/types.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanInteractionSnapshot } from '../interaction/types.js';
import type { KanbanSourceState } from '../source/states.js';
import type { KanbanEventHub, KanbanFocusEventTarget } from './types.js';

/** Converts interaction focus into the smaller public event target. */
function eventFocus(snapshot: KanbanInteractionSnapshot): KanbanFocusEventTarget {
  const focus = snapshot.focused;
  if (focus.kind === 'board-state') return Object.freeze({ kind: 'board' });
  if (focus.kind === 'column-header') return Object.freeze({ kind: 'column', columnId: focus.columnId });
  if (focus.kind === 'swimlane-header') return Object.freeze({ kind: 'swimlane', swimlaneId: focus.swimlaneId });
  return Object.freeze({ kind: 'card', cardKey: focus.cardKey });
}

/** Compares two public focus targets while preserving numeric/string card identity. */
function sameFocus(left: KanbanFocusEventTarget | undefined, right: KanbanFocusEventTarget): boolean {
  if (left?.kind !== right.kind) return false;
  if (left.kind === 'board' && right.kind === 'board') return true;
  if (left.kind === 'card' && right.kind === 'card') {
    return typeof left.cardKey === typeof right.cardKey && left.cardKey === right.cardKey;
  }
  if (left.kind === 'column' && right.kind === 'column') return left.columnId === right.columnId;
  if (left.kind === 'swimlane' && right.kind === 'swimlane') return left.swimlaneId === right.swimlaneId;
  return (
    left.kind === 'cell' &&
    right.kind === 'cell' &&
    left.columnId === right.columnId &&
    left.swimlaneId === right.swimlaneId
  );
}

/** Creates a type-preserving selection fingerprint without exposing records. */
function selectionKey(keys: readonly CardKey[]): string {
  return JSON.stringify(keys.map((key) => [typeof key, key]));
}

/** Publishes one action intent using the invocation already detached by the router. */
export function publishKanbanActionIntent(events: KanbanEventHub, invocation: KanbanActionInvocation): void {
  events.publish({ kind: 'action', actionId: invocation.actionId, origin: invocation.origin, state: 'intent' });
}

/** Publishes one terminal action outcome without handler payloads. */
export function publishKanbanActionOutcome(
  events: KanbanEventHub,
  invocation: KanbanActionInvocation,
  outcome: KanbanActionTerminalOutcome | { readonly kind: 'pending' },
): void {
  if (outcome.kind === 'handled' || outcome.kind === 'hidden' || outcome.kind === 'pending') {
    events.publish({
      kind: 'action',
      actionId: invocation.actionId,
      origin: invocation.origin,
      state: outcome.kind,
    });
    return;
  }
  events.publish({
    kind: 'action',
    actionId: invocation.actionId,
    origin: invocation.origin,
    state: outcome.kind,
    code: outcome.code,
  });
}

/** Board adapters that publish state only after the corresponding public snapshot is readable. */
export class KanbanStateEventPublisher {
  readonly #events: KanbanEventHub;
  #focus: KanbanFocusEventTarget | undefined;
  #selection = '';
  #viewRevision: KanbanRevision | undefined;
  #source = '';

  /** Creates one lightweight state-difference publisher. */
  constructor(events: KanbanEventHub) {
    this.#events = events;
  }

  /** Publishes changed focus and selection from one already-public interaction snapshot. */
  interaction(snapshot: KanbanInteractionSnapshot): void {
    const focus = eventFocus(snapshot);
    if (!sameFocus(this.#focus, focus)) {
      this.#focus = focus;
      this.#events.publish({ kind: 'focus', target: focus });
    }
    const selection = selectionKey(snapshot.selectedCardKeys);
    if (selection !== this.#selection) {
      this.#selection = selection;
      this.#events.publish({ kind: 'selection', count: snapshot.selectedCardKeys.length });
    }
  }

  /** Publishes one changed committed view revision. */
  view(revision: KanbanRevision): void {
    if (revision === this.#viewRevision) return;
    this.#viewRevision = revision;
    this.#events.publish({ kind: 'view', revision });
  }

  /** Publishes one changed source/query lifecycle projection without source payloads. */
  source(state: KanbanSourceState | undefined, revision: KanbanRevision, queryRevision: KanbanRevision): void {
    const kind = state?.kind ?? 'loading';
    const fingerprint = JSON.stringify([kind, typeof revision, revision, typeof queryRevision, queryRevision]);
    if (fingerprint === this.#source) return;
    this.#source = fingerprint;
    this.#events.publish({ kind: 'source', state: kind, revision, queryRevision });
  }
}
