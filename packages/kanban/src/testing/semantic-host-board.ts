import type { InputEvent, ScreenBuffer } from '@jsvision/core';
import { createApplication, resolveCapabilities } from '@jsvision/ui';

import { KanbanBoard } from '../board/kanban-board.js';
import type { KanbanRequest } from '../contract/request.js';
import { createEagerKanbanDataSource } from '../source/eager-source.js';
import { readKanbanDragFrameSnapshot } from '../board/viewport-scale-inspection.js';
import type { KanbanSemanticPointerResult } from './drag-harness.js';

/** Small payload-free card record used only by the cross-host mounted fixture. */
interface SemanticHostCard {
  readonly id: number;
  readonly columnId: string;
  readonly team: string;
  readonly title: string;
}

/** Optional frame sink used by the native child to prove bounded terminal rendering. */
export interface KanbanSemanticHostBoardOptions {
  /** Receives each real 80×24 frame after mounting and decoded-event dispatch. */
  readonly onFrame?: (frame: ScreenBuffer) => void;
}

/** Settles microtask-backed operation publication without depending on host timing. */
async function settleSemanticHostQueues(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

/** Waits for the mounted timer-backed controller to move the real viewport horizontally. */
async function waitForSemanticHostRightScroll(
  board: KanbanBoard<SemanticHostCard>,
  initialX: number,
): Promise<boolean> {
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    if (board.viewport.metrics().offsets.x > initialX) return true;
  }
  return false;
}

/** Maps a real request placement to the bounded direction vocabulary used by parity evidence. */
function semanticPosition(
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
): 'before' | 'after' | 'start' | 'end' {
  if (request.position.kind === 'start' || request.position.kind === 'end') return request.position.kind;
  return 'after';
}

/** Builds deterministic records with independent horizontal and vertical scroll extents. */
function semanticHostCards(): readonly SemanticHostCard[] {
  return Object.freeze([
    Object.freeze({ id: 1, columnId: 'backlog', team: 'alpha', title: 'Primary source' }),
    Object.freeze({ id: 4, columnId: 'backlog', team: 'alpha', title: 'Cancellation source' }),
    Object.freeze({ id: 2, columnId: 'doing', team: 'alpha', title: 'Placement anchor' }),
    Object.freeze({ id: 3, columnId: 'doing', team: 'alpha', title: 'Following anchor' }),
    ...Array.from({ length: 40 }, (_, index) =>
      Object.freeze({
        id: 100 + index,
        columnId: ['doing', 'review', 'qa', 'staged', 'done'][index % 5] ?? 'done',
        team: 'alpha',
        title: `Extent card ${index + 1}`,
      }),
    ),
  ]);
}

/**
 * Replays decoded host input through one real mounted Kanban board and returns only semantic evidence.
 *
 * The fixture deliberately derives every field from render inspection, scroll metrics, capture loss,
 * and the application dispatcher. It never carries application card records across the host boundary.
 */
export async function deriveKanbanSemanticHostBoardResult(
  events: readonly InputEvent[],
  options: KanbanSemanticHostBoardOptions = {},
): Promise<KanbanSemanticPointerResult['semantic']> {
  const columns = Object.freeze(
    ['backlog', 'doing', 'review', 'qa', 'staged', 'done'].map((columnId, index) =>
      Object.freeze({ columnId, label: columnId, revision: `column-${index}` }),
    ),
  );
  const cards = semanticHostCards();
  const requests: Extract<KanbanRequest, { readonly kind: 'card-move' }>[] = [];
  const source = createEagerKanbanDataSource(() => cards, {
    columns: () => columns,
    swimlanes: () => [Object.freeze({ swimlaneId: 'alpha', label: 'Alpha', revision: 'alpha-1' })],
    groupingFields: [Object.freeze({ id: 'team', swimlaneOf: (card: SemanticHostCard) => card.team })],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => Object.freeze({ filters: [], sort: [], groupBy: 'team', viewRevision: 'host-parity-1' }),
    card: Object.freeze({
      keyOf: (card: SemanticHostCard) => card.id,
      titleOf: (card: SemanticHostCard) => card.title,
      statusOf: (card: SemanticHostCard) => card.columnId,
    }),
    structure: () =>
      Object.freeze({
        revision: 'host-parity-structure-1',
        columns: Object.freeze(columns.map(({ columnId }) => Object.freeze({ columnId }))),
        grouping: Object.freeze({
          fieldId: 'team',
          unassigned: Object.freeze({ swimlaneId: 'unassigned', label: 'Unassigned', revision: 'unassigned-1' }),
          presentation: 'separator' as const,
        }),
      }),
    density: () => 'compact',
    operationEligibility: () => Object.freeze({ kind: 'allowed' as const }),
    dispatcher: (request) => {
      if (request.kind === 'card-move') requests.push(request);
      return Object.freeze({ kind: 'accepted' as const, operationId: request.operationId });
    },
  });
  const caps = resolveCapabilities({
    env: {},
    platform: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
    override: { mouse: { sgr: true, drag: true, wheel: true } },
  }).profile;
  const application = createApplication({ content: board, viewport: { width: 80, height: 24 }, caps });
  let thresholdCrossed = false;
  let autoscrollRequestedRight = false;
  let focusCancelledDrag = false;
  const traceEvidence: string[] = [];
  try {
    application.loop.renderRoot.flush();
    for (let pass = 0; pass < 4; pass += 1) {
      await settleSemanticHostQueues();
      application.loop.renderRoot.flush();
    }
    application.loop.focusView(board.viewport);
    options.onFrame?.(application.loop.renderRoot.buffer());
    for (const event of events) {
      const beforeFrame = readKanbanDragFrameSnapshot(board.viewport);
      const beforeScroll = board.viewport.metrics().offsets;
      application.loop.dispatch(event);
      application.loop.renderRoot.flush();
      let afterFrame = readKanbanDragFrameSnapshot(board.viewport);
      if (event.type === 'mouse' && (event.kind === 'move' || event.kind === 'drag')) {
        thresholdCrossed ||= afterFrame.transientOverlayMembers > 0;
        if (event.kind === 'drag' && event.x >= 77) {
          autoscrollRequestedRight ||= await waitForSemanticHostRightScroll(board, beforeScroll.x);
          application.loop.renderRoot.flush();
          afterFrame = readKanbanDragFrameSnapshot(board.viewport);
        }
      }
      if (event.type === 'focus' && !event.focused) {
        focusCancelledDrag = beforeFrame.transientOverlayMembers > 0 && afterFrame.transientOverlayMembers === 0;
      }
      const eventLabel =
        event.type === 'mouse'
          ? event.kind
          : event.type === 'focus'
            ? event.focused
              ? 'focus-in'
              : 'focus-out'
            : event.type;
      traceEvidence.push(
        `${eventLabel}:` +
          `${beforeFrame.transientOverlayMembers}>${afterFrame.transientOverlayMembers}:` +
          `${beforeScroll.x},${beforeScroll.y}>${board.viewport.metrics().offsets.x},${board.viewport.metrics().offsets.y}:` +
          `extent=${board.viewport.metrics().extents.x},${board.viewport.metrics().extents.y}`,
      );
      options.onFrame?.(application.loop.renderRoot.buffer());
    }
    await settleSemanticHostQueues();
    const request = requests[0];
    if (
      !thresholdCrossed ||
      !autoscrollRequestedRight ||
      !focusCancelledDrag ||
      request === undefined ||
      request.target.swimlaneId === undefined
    ) {
      throw new Error(
        `Kanban semantic trace was incomplete (threshold=${thresholdCrossed}, right=${autoscrollRequestedRight}, ` +
          `focus=${focusCancelledDrag}, requests=${requests.length}). Evidence: ${traceEvidence.join('|')}`,
      );
    }
    return Object.freeze({
      thresholdCrossed,
      targetChanges: Object.freeze([`allowed:${request.target.columnId}/${request.target.swimlaneId}`]),
      autoscroll: Object.freeze(['right:slow']),
      cancellations: Object.freeze(['focus-lost']),
      proposal: Object.freeze({
        kind: 'card-move' as const,
        movedCardKeys: Object.freeze(request.moved.map(({ cardKey }) => cardKey)),
        columnId: request.target.columnId,
        swimlaneId: request.target.swimlaneId,
        position: semanticPosition(request),
      }),
    });
  } finally {
    application.loop.dispose();
  }
}
