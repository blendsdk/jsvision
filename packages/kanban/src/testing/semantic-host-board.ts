import type { InputEvent, ScreenBuffer } from '@jsvision/core';
import { createApplication, resolveCapabilities, signal } from '@jsvision/ui';

import { KanbanBoard } from '../board/kanban-board.js';
import { renderStandardKanbanCard } from '../card/standard-renderer.js';
import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanCardRenderContext } from '../card/descriptor.js';
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

/** Stable adapter shared by the semantic host source and its variable-height renderer. */
const SEMANTIC_HOST_CARD_ADAPTER: KanbanCardAdapter<SemanticHostCard> = Object.freeze({
  keyOf: (card: SemanticHostCard) => card.id,
  titleOf: (card: SemanticHostCard) => card.title,
  statusOf: (card: SemanticHostCard) => card.columnId,
});

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
    Object.freeze({
      id: 2,
      columnId: 'doing',
      team: 'alpha',
      title: 'Placement anchor with deliberately wrapped cross-host variable-height content',
    }),
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

/** Applies one accepted move to the application-owned fixture in the exact requested target order. */
function publishSemanticHostMove(
  current: readonly SemanticHostCard[],
  request: Extract<KanbanRequest, { readonly kind: 'card-move' }>,
): readonly SemanticHostCard[] {
  const movedKeys = new Set(request.moved.map(({ cardKey }) => cardKey));
  const retained = current.filter(({ id }) => !movedKeys.has(id));
  const moved = current
    .filter(({ id }) => movedKeys.has(id))
    .map((card) =>
      Object.freeze({
        ...card,
        columnId: request.target.columnId,
        team: request.target.swimlaneId ?? card.team,
      }),
    );
  const targetIndexes = retained.flatMap((card, index) =>
    card.columnId === request.target.columnId &&
    (request.target.swimlaneId === undefined || card.team === request.target.swimlaneId)
      ? [index]
      : [],
  );
  const position = request.position;
  const insertionIndex =
    position.kind === 'start'
      ? (targetIndexes[0] ?? retained.length)
      : position.kind === 'end'
        ? (targetIndexes.at(-1) ?? retained.length - 1) + 1
        : position.kind === 'between'
          ? (() => {
              const afterIndex = retained.findIndex(({ id }) => id === position.afterCardKey);
              if (afterIndex >= 0) return afterIndex;
              const beforeIndex = retained.findIndex(({ id }) => id === position.beforeCardKey);
              return beforeIndex >= 0 ? beforeIndex + 1 : retained.length;
            })()
          : retained.length;
  return Object.freeze([...retained.slice(0, insertionIndex), ...moved, ...retained.slice(insertionIndex)]);
}

/** Converts a mounted terminal frame to stable text before the next dispatch mutates the buffer. */
function semanticFrameText(frame: ScreenBuffer): string {
  return frame
    .rows()
    .map((row) => row.map(({ char }) => char).join(''))
    .join('\n');
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
  const cards = signal(semanticHostCards());
  const requests: Extract<KanbanRequest, { readonly kind: 'card-move' }>[] = [];
  const source = createEagerKanbanDataSource(cards, {
    columns: () => columns,
    swimlanes: () => [Object.freeze({ swimlaneId: 'alpha', label: 'Alpha', revision: 'alpha-1' })],
    groupingFields: [Object.freeze({ id: 'team', swimlaneOf: (card: SemanticHostCard) => card.team })],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => Object.freeze({ filters: [], sort: [], groupBy: 'team', viewRevision: 'host-parity-1' }),
    card: SEMANTIC_HOST_CARD_ADAPTER,
    presentation: () =>
      Object.freeze({
        revision: 'host-parity-presentation-1',
        cardRows: 6,
        cardGap: 1,
        metadataFields: 0,
        labelRows: 0,
        summarySections: 0,
        checklistMode: 'hidden' as const,
        checklistPreviewItems: 0,
      }),
    renderer: () =>
      Object.freeze({
        render: (card: SemanticHostCard, context: KanbanCardRenderContext) => {
          const descriptor = renderStandardKanbanCard(card, SEMANTIC_HOST_CARD_ADAPTER, context);
          return card.id === 2
            ? Object.freeze({
                ...descriptor,
                measuredHeight: Math.min(context.rowBudget, 4),
                rows: Object.freeze([
                  ...descriptor.rows,
                  Object.freeze({
                    section: 'custom' as const,
                    spans: Object.freeze([
                      Object.freeze({ column: 1, text: 'mixed', role: 'content.metadata' as const }),
                    ]),
                  }),
                  Object.freeze({
                    section: 'custom' as const,
                    spans: Object.freeze([
                      Object.freeze({ column: 1, text: 'host', role: 'content.metadata' as const }),
                    ]),
                  }),
                ]),
                sections: Object.freeze([
                  ...descriptor.sections,
                  Object.freeze({ id: 'host-detail', kind: 'custom' as const, startRow: 2, rowCount: 2, priority: 2 }),
                ]),
              })
            : descriptor;
        },
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
      if (request.kind === 'card-move') {
        requests.push(request);
        cards.set(publishSemanticHostMove(cards(), request));
      }
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
  let clickObserved = false;
  let wheelObserved = false;
  let pointerMoves = 0;
  let ghostFollowsPointer = true;
  let priorPointer:
    | {
        readonly point: { readonly x: number; readonly y: number };
        readonly origin: { readonly x: number; readonly y: number };
      }
    | undefined;
  const gapSlots = new Set<string>();
  let dropObserved = false;
  let postDropRedrawObserved = false;
  let downWithoutDrag = false;
  const traceEvidence: string[] = [];
  try {
    application.loop.renderRoot.flush();
    for (let pass = 0; pass < 4; pass += 1) {
      await settleSemanticHostQueues();
      application.loop.renderRoot.flush();
    }
    application.loop.focusView(board.viewport);
    const visibleHeights = board.inspection().visibleCards.map(({ descriptor }) => descriptor.measuredHeight);
    const mixedHeightObserved = new Set(visibleHeights).size > 1;
    options.onFrame?.(application.loop.renderRoot.buffer());
    for (const event of events) {
      const beforeFrame = readKanbanDragFrameSnapshot(board.viewport);
      const beforeText = semanticFrameText(application.loop.renderRoot.buffer());
      const beforeScroll = board.viewport.metrics().offsets;
      const requestsBefore = requests.length;
      application.loop.dispatch(event);
      application.loop.renderRoot.flush();
      let afterFrame = readKanbanDragFrameSnapshot(board.viewport);
      const afterText = semanticFrameText(application.loop.renderRoot.buffer());
      if (event.type === 'wheel') {
        wheelObserved ||= beforeScroll.y !== board.viewport.metrics().offsets.y;
      }
      if (event.type === 'mouse' && (event.kind === 'move' || event.kind === 'drag')) {
        pointerMoves += 1;
        downWithoutDrag = false;
        thresholdCrossed ||= afterFrame.transientOverlayMembers > 0;
        if (afterFrame.gap !== undefined) gapSlots.add(afterFrame.gap.slotId);
        if (afterFrame.ghost !== undefined) {
          if (priorPointer !== undefined) {
            ghostFollowsPointer &&=
              afterFrame.ghost.rawOrigin.x - priorPointer.origin.x === event.x - priorPointer.point.x &&
              afterFrame.ghost.rawOrigin.y - priorPointer.origin.y === event.y - priorPointer.point.y;
          }
          priorPointer = Object.freeze({
            point: Object.freeze({ x: event.x, y: event.y }),
            origin: afterFrame.ghost.rawOrigin,
          });
        }
        if (event.kind === 'drag' && event.x >= 77) {
          autoscrollRequestedRight ||= await waitForSemanticHostRightScroll(board, beforeScroll.x);
          application.loop.renderRoot.flush();
          afterFrame = readKanbanDragFrameSnapshot(board.viewport);
        }
      }
      if (event.type === 'mouse' && event.kind === 'down') {
        downWithoutDrag = true;
        priorPointer = undefined;
      }
      if (event.type === 'mouse' && event.kind === 'up') {
        clickObserved ||=
          downWithoutDrag &&
          board.interaction().snapshot().focused.kind === 'card' &&
          board.interaction().snapshot().selectedCardKeys.length === 1;
        downWithoutDrag = false;
        if (requests.length > requestsBefore) {
          dropObserved = true;
          const movedKey = requests.at(-1)?.moved[0]?.cardKey;
          postDropRedrawObserved ||=
            beforeText !== afterText &&
            movedKey !== undefined &&
            board
              .inspection()
              .visibleCards.some(
                ({ cardKey, columnId }) =>
                  typeof cardKey === typeof movedKey &&
                  cardKey === movedKey &&
                  columnId === requests.at(-1)?.target.columnId,
              );
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
      !mixedHeightObserved ||
      !clickObserved ||
      !wheelObserved ||
      pointerMoves < 4 ||
      !ghostFollowsPointer ||
      gapSlots.size < 2 ||
      !dropObserved ||
      !postDropRedrawObserved ||
      !autoscrollRequestedRight ||
      !focusCancelledDrag ||
      request === undefined ||
      request.target.swimlaneId === undefined
    ) {
      throw new Error(
        `Kanban semantic trace was incomplete (threshold=${thresholdCrossed}, right=${autoscrollRequestedRight}, ` +
          `focus=${focusCancelledDrag}, click=${clickObserved}, wheel=${wheelObserved}, moves=${pointerMoves}, ` +
          `ghost=${ghostFollowsPointer}, gaps=${gapSlots.size}, drop=${dropObserved}, redraw=${postDropRedrawObserved}, ` +
          `requests=${requests.length}, heights=${visibleHeights.join(',')}). ` +
          `Evidence: ${traceEvidence.join('|')}`,
      );
    }
    return Object.freeze({
      thresholdCrossed,
      observedSteps: Object.freeze([
        'mixed-height' as const,
        'click' as const,
        'wheel' as const,
        'grab' as const,
        'pointer-moves' as const,
        'gap-transition' as const,
        'drop' as const,
        'post-drop-redraw' as const,
      ]),
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
