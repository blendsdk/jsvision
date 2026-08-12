/**
 * Specification oracle for immediate mounted drag feedback and lifecycle recovery.
 *
 * Every pointer sample is inspected immediately after `dispatch()` returns. No explicit render flush,
 * promise, timer, source settlement, or later input may be required to make its visual result observable.
 */
import type { ScreenBuffer } from '@jsvision/core';
import { createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '../src/index.js';
import type { KanbanQuery, KanbanRequest } from '../src/index.js';
import {
  createKanbanStabilizationFixture,
  inspectKanbanDragFrame,
  type KanbanStabilizationCard,
} from '../src/testing.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'drag-stabilization-r1' });
const CARD = createStandardKanbanCardAdapter();
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Converts one immutable terminal frame to stable plain-text evidence. */
function frameText(buffer: ScreenBuffer): string {
  return buffer
    .rows()
    .map((row) => row.map(({ char }) => char).join(''))
    .join('\n');
}

/** Moves one card in the fixture's application-owned publication after an accepted request. */
function locallyMovedCards(
  cards: readonly KanbanStabilizationCard[],
  request: KanbanRequest,
): readonly KanbanStabilizationCard[] {
  if (request.kind !== 'card-move') return cards;
  const moved = new Set(request.moved.map(({ cardKey }) => cardKey));
  const retained = cards.filter(({ key }) => !moved.has(key));
  const replacements = cards
    .filter(({ key }) => moved.has(key))
    .map((card) => Object.freeze({ ...card, columnId: request.target.columnId, presentationRevision: 2 }));
  return Object.freeze([...retained, ...replacements]);
}

/** Complete mounted mixed-height board with synchronous accepted local publication. */
function mountedDragFixture(): {
  readonly application: Application;
  readonly board: KanbanBoard<KanbanStabilizationCard>;
  readonly cards: ReturnType<typeof signal<readonly KanbanStabilizationCard[]>>;
  readonly frames: readonly string[];
  readonly dispatches: ReturnType<typeof vi.fn>;
} {
  const fixture = createKanbanStabilizationFixture();
  const cards = signal<readonly KanbanStabilizationCard[]>(fixture.cards);
  const source = createEagerKanbanDataSource(cards, {
    columns: () => fixture.columns,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const dispatches = vi.fn((request: KanbanRequest) => {
    cards.set(locallyMovedCards(cards(), request));
    return { kind: 'accepted' as const, operationId: request.operationId };
  });
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    presentation: () => 'compact',
    dispatcher: dispatches,
    operationEligibility: () => ({ kind: 'allowed' }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 80, height: 24 }, caps: CAPS });
  applications.push(application);
  const mutableFrames: string[] = [];
  application.loop.onFrame = (buffer) => mutableFrames.push(frameText(buffer));
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board, cards, frames: mutableFrames, dispatches });
}

/** Finds one visible whole-card target or fails with a useful fixture message. */
function cardTarget(board: KanbanBoard<KanbanStabilizationCard>, cardKey: string) {
  const target = board
    .inspection()
    .actionTargets.find((candidate) => candidate.kind === 'card' && candidate.cardKey === cardKey);
  if (target === undefined) throw new Error(`Expected visible target for ${cardKey}.`);
  return target;
}

/** Converts a viewport-local point to the exact normalized event-loop coordinate. */
function eventPoint(
  application: Application,
  board: KanbanBoard<KanbanStabilizationCard>,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const origin = application.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected mounted viewport origin.');
  return Object.freeze({ x: origin.x + x, y: origin.y + y });
}

/** Reads one planned additive testing-only overlay field without widening production inspection. */
function overlayField(board: KanbanBoard<KanbanStabilizationCard>, field: 'ghost' | 'gap'): unknown {
  return Reflect.get(inspectKanbanDragFrame(board.viewport), field);
}

/** Starts a captured drag and returns the exact normalized grab offset. */
function beginDrag(
  application: Application,
  board: KanbanBoard<KanbanStabilizationCard>,
  cardKey: string,
): { readonly x: number; readonly y: number } {
  const source = cardTarget(board, cardKey);
  const down = eventPoint(application, board, source.x + 3, source.y + 1);
  const threshold = eventPoint(application, board, source.x + 5, source.y + 1);
  const origin = application.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected mounted viewport origin.');
  application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  application.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, ...threshold });
  return Object.freeze({ x: down.x - origin.x - source.x, y: down.y - origin.y - source.y });
}

describe('mounted dispatch-return drag feedback', () => {
  // Each captured sample must emit and expose one pointer-relative title ghost plus one gap-only target.
  it('should publish matching frame and overlay evidence before every pointer dispatch returns', () => {
    const { application, board, frames } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    const source = cardTarget(board, fixture.named.short);
    const sibling = cardTarget(board, fixture.named.tall);

    const siblingPoint = eventPoint(application, board, sibling.x + 1, sibling.y + 1);
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ctrl: true, ...siblingPoint });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ctrl: true, ...siblingPoint });
    const grabOffset = beginDrag(application, board, fixture.named.short);
    const origin = application.loop.renderRoot.originOf(board.viewport);
    if (origin === null) throw new Error('Expected mounted viewport origin.');

    const samples = [
      eventPoint(application, board, source.x + 9, source.y + 2),
      eventPoint(application, board, 1, source.y + 3),
      eventPoint(application, board, board.viewport.bounds.width - 1, source.y + 3),
      eventPoint(application, board, source.x + 7, 1),
      eventPoint(application, board, source.x + 7, board.viewport.bounds.height - 1),
    ];
    for (const sample of samples) {
      const framesBefore = frames.length;
      application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...sample });
      expect(frames.length).toBeGreaterThan(framesBefore);
      expect(frames.at(-1)).toContain('Small sour');
      expect(overlayField(board, 'ghost')).toMatchObject({
        count: 2,
        contentRows: 1,
        rawOrigin: {
          x: sample.x - origin.x - grabOffset.x,
          y: sample.y - origin.y - grabOffset.y,
        },
        visibleRect: {
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: 3,
        },
      });
      expect(overlayField(board, 'gap')).toMatchObject({ rect: { height: 1 } });
    }
  });

  // Wheel scrolling keeps capture alive; release publishes one local move and leaves the card draggable.
  it('should preserve drag through scrolling, reconcile one accepted release, and allow a second drag', () => {
    const { application, board, cards, dispatches } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    beginDrag(application, board, fixture.named.short);
    const target = cardTarget(board, fixture.named.tall);
    const destination = eventPoint(application, board, target.x + 1, target.y + target.height);

    application.loop.dispatch({
      type: 'wheel',
      dir: 'down',
      x: destination.x,
      y: destination.y,
      shift: false,
      alt: false,
      ctrl: false,
    });
    expect(overlayField(board, 'ghost')).toBeDefined();
    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...destination });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...destination });

    expect(dispatches).toHaveBeenCalledTimes(1);
    expect(cards().find(({ key }) => key === fixture.named.short)?.columnId).toBe('ready');
    expect(board.inspection().pendingOperations).toHaveLength(0);
    beginDrag(application, board, fixture.named.short);
    expect(overlayField(board, 'ghost')).toBeDefined();
  });

  // Resize terminates stale capture synchronously, while the next gesture starts from fresh geometry.
  it('should cancel on resize and immediately permit a fresh drag', () => {
    const { application, board, dispatches } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    beginDrag(application, board, fixture.named.short);
    expect(overlayField(board, 'ghost')).toBeDefined();

    application.loop.resize({ width: 54, height: 16 });
    expect(overlayField(board, 'ghost')).toBeUndefined();
    expect(dispatches).not.toHaveBeenCalled();

    application.loop.resize({ width: 80, height: 24 });
    beginDrag(application, board, fixture.named.short);
    expect(overlayField(board, 'ghost')).toBeDefined();
  });
});
