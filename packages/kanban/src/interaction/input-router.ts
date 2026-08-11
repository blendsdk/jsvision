import type { KanbanInteractionOrigin } from './intent.js';
import type { KanbanMoveDirection } from './operation-facade.js';
import type { KanbanInteractionSnapshot, KanbanInteractionTransition, KanbanNavigationDirection } from './types.js';

/** Normalized terminal key evidence accepted by the Phase B keyboard router. */
export interface KanbanKeyInput {
  /** Printable character or lowercase named key from the terminal decoder. */
  readonly key: string;
  /** Whether the currently deliverable Ctrl modifier is present. */
  readonly ctrl: boolean;
  /** Whether the Alt modifier is present. */
  readonly alt: boolean;
  /** Whether the Shift modifier is present. */
  readonly shift: boolean;
}

/** Synchronous seams used to route one key without awaiting controller settlement. */
export interface KanbanKeyInputSink {
  /** Reads the current detached focus and selection evidence. */
  readonly snapshot: () => KanbanInteractionSnapshot;
  /** Queues one recognized transition and reports immediate acceptance. */
  readonly accept: (transition: KanbanInteractionTransition) => boolean;
  /** Queues focused-card activation through the semantic intent boundary. */
  readonly activate: (origin: KanbanInteractionOrigin) => boolean;
  /** Starts one semantic focused-card move without synthesizing pointer visuals. */
  readonly moveFocused?: (direction: KanbanMoveDirection) => boolean;
  /** Cancels the active drag or latest cancellable operation before selection Escape. */
  readonly cancelTransient?: () => boolean;
}

/** Resolves only the fixed Phase B navigation names emitted by the terminal decoder. */
function navigationDirection(key: string): KanbanNavigationDirection | undefined {
  switch (key) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
    case 'home':
    case 'end':
      return key;
    case 'pageup':
      return 'page-up';
    case 'pagedown':
      return 'page-down';
    default:
      return undefined;
  }
}

/** Routes one unmodified or Shift-modified navigation key. */
function routeNavigation(input: KanbanKeyInput, sink: KanbanKeyInputSink): boolean | undefined {
  const direction = navigationDirection(input.key);
  if (direction === undefined) return undefined;
  const snapshot = sink.snapshot();
  if (input.shift && snapshot.focused.kind === 'card' && snapshot.rangeAnchor === undefined) {
    if (!sink.accept({ kind: 'selection', operation: 'replace' })) return false;
  }
  return sink.accept({
    kind: 'navigate',
    direction,
    ...(input.shift ? { extendSelection: true } : {}),
  });
}

/**
 * Routes the fixed Phase B keyboard subset and reports synchronous event-loop acceptance.
 *
 * Meta/Command is deliberately absent because the current terminal event transport does not preserve
 * it. Alt-modified and unknown gestures remain available to the containing application.
 */
export function routeKanbanKeyInput(input: KanbanKeyInput, sink: KanbanKeyInputSink): boolean {
  if (input.alt) return false;
  if (input.ctrl) {
    if (input.shift && (input.key === 'left' || input.key === 'right')) {
      return sink.moveFocused?.(input.key) ?? false;
    }
    if (input.shift || input.key !== 'a') return false;
    return sink.accept({ kind: 'selection', operation: 'select-loaded-visible-matching' });
  }

  const navigation = routeNavigation(input, sink);
  if (navigation !== undefined) return navigation;
  if (input.shift) return false;

  if (input.key === 'space') {
    if (sink.snapshot().focused.kind !== 'card') return false;
    return sink.accept({ kind: 'selection', operation: 'toggle' });
  }
  if (input.key === 'enter') {
    if (sink.snapshot().focused.kind !== 'card') return false;
    return sink.activate('keyboard');
  }
  if (input.key === 'escape' && sink.cancelTransient?.() === true) return true;
  if (input.key === 'escape') return sink.accept({ kind: 'escape' });
  return false;
}
