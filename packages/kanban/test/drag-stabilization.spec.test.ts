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
  createKanbanFrameHostFixture,
  inspectKanbanDragFrame,
  inspectKanbanViewportScale,
  observeKanbanViewportOperations,
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
  vi.useRealTimers();
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
  const targetIndexes = retained.flatMap((card, index) => (card.columnId === request.target.columnId ? [index] : []));
  const position = request.position;
  const insertionIndex =
    position.kind === 'start'
      ? (targetIndexes[0] ?? retained.length)
      : position.kind === 'end'
        ? (targetIndexes.at(-1) ?? retained.length - 1) + 1
        : position.kind === 'between'
          ? (() => {
              const afterIndex = retained.findIndex(({ key }) => key === position.afterCardKey);
              if (afterIndex >= 0) return afterIndex;
              const beforeIndex = retained.findIndex(({ key }) => key === position.beforeCardKey);
              return beforeIndex >= 0 ? beforeIndex + 1 : retained.length;
            })()
          : retained.length;
  return Object.freeze([...retained.slice(0, insertionIndex), ...replacements, ...retained.slice(insertionIndex)]);
}

/** Complete mounted mixed-height board with synchronous accepted local publication. */
function mountedDragFixture(): {
  readonly application: Application;
  readonly board: KanbanBoard<KanbanStabilizationCard>;
  readonly cards: ReturnType<typeof signal<readonly KanbanStabilizationCard[]>>;
  readonly frames: readonly string[];
  readonly buffers: readonly ScreenBuffer[];
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
  const mutableBuffers: ScreenBuffer[] = [];
  application.loop.onFrame = (buffer) => {
    mutableFrames.push(frameText(buffer));
    mutableBuffers.push(buffer.clone());
  };
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board, cards, frames: mutableFrames, buffers: mutableBuffers, dispatches });
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

/** Detached compact-ghost evidence required by the mounted specification. */
interface CompactGhostEvidence {
  readonly count: number;
  readonly contentRows: number;
  readonly rawOrigin: Readonly<{ x: number; y: number }>;
  readonly visibleRect: Readonly<{ x: number; y: number; width: number; height: number }>;
}

/** Validates detached compact-ghost evidence without casting private implementation objects. */
function compactGhost(board: KanbanBoard<KanbanStabilizationCard>): CompactGhostEvidence {
  const value = overlayField(board, 'ghost');
  if (typeof value !== 'object' || value === null) throw new Error('Expected detached compact ghost evidence.');
  const count = Reflect.get(value, 'count');
  const contentRows = Reflect.get(value, 'contentRows');
  const rawOrigin = Reflect.get(value, 'rawOrigin');
  const visibleRect = Reflect.get(value, 'visibleRect');
  if (
    typeof count !== 'number' ||
    typeof contentRows !== 'number' ||
    typeof rawOrigin !== 'object' ||
    rawOrigin === null ||
    typeof visibleRect !== 'object' ||
    visibleRect === null
  ) {
    throw new Error('Expected complete detached compact ghost geometry.');
  }
  const x = Reflect.get(rawOrigin, 'x');
  const y = Reflect.get(rawOrigin, 'y');
  const visibleX = Reflect.get(visibleRect, 'x');
  const visibleY = Reflect.get(visibleRect, 'y');
  const width = Reflect.get(visibleRect, 'width');
  const height = Reflect.get(visibleRect, 'height');
  if ([x, y, visibleX, visibleY, width, height].some((member) => typeof member !== 'number')) {
    throw new Error('Expected finite detached compact ghost coordinates.');
  }
  return Object.freeze({
    count,
    contentRows,
    rawOrigin: Object.freeze({ x, y }),
    visibleRect: Object.freeze({ x: visibleX, y: visibleY, width, height }),
  });
}

/** Clips the complete three-row ghost to exact viewport-local bounds. */
function clippedGhostRect(
  origin: Readonly<{ x: number; y: number }>,
  width: number,
  bounds: Readonly<{ width: number; height: number }>,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  const x = Math.max(0, origin.x);
  const y = Math.max(0, origin.y);
  const right = Math.min(bounds.width, origin.x + width);
  const bottom = Math.min(bounds.height, origin.y + 3);
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Extracts the serialized cells covered by one detached visible rectangle. */
function frameRect(frame: string, rect: Readonly<{ x: number; y: number; width: number; height: number }>): string {
  return frame
    .split('\n')
    .slice(rect.y, rect.y + rect.height)
    .map((row) => row.slice(rect.x, rect.x + rect.width))
    .join('\n');
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
    const grabOffset = beginDrag(application, board, fixture.named.short);
    const origin = application.loop.renderRoot.originOf(board.viewport);
    if (origin === null) throw new Error('Expected mounted viewport origin.');

    const samples = [
      { point: eventPoint(application, board, source.x + 9, source.y + 2), expectsGap: true },
      { point: eventPoint(application, board, 1, source.y + 3), expectsGap: true },
      {
        point: eventPoint(application, board, board.viewport.bounds.width - 1, source.y + 3),
        expectsGap: true,
      },
      { point: eventPoint(application, board, source.x + 7, 1), expectsGap: false },
      {
        point: eventPoint(application, board, source.x + 7, board.viewport.bounds.height - 1),
        expectsGap: true,
      },
    ];
    for (const sample of samples) {
      const framesBefore = frames.length;
      application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...sample.point });
      expect(frames.length).toBeGreaterThan(framesBefore);
      const rawOrigin = {
        x: sample.point.x - origin.x - grabOffset.x,
        y: sample.point.y - origin.y - grabOffset.y,
      };
      const ghost = compactGhost(board);
      expect(ghost).toEqual({
        count: 1,
        contentRows: 1,
        rawOrigin,
        visibleRect: clippedGhostRect(rawOrigin, source.width, board.viewport.bounds),
      });
      const emitted = frames.at(-1);
      if (emitted === undefined) throw new Error('Expected an emitted drag frame.');
      const visibleContentWidth = Math.max(0, ghost.visibleRect.width - 2);
      const expectedTitle = 'Small source-range control'.slice(0, visibleContentWidth);
      expect(frameRect(emitted, ghost.visibleRect)).toContain(expectedTitle);
      if (sample.expectsGap) expect(overlayField(board, 'gap')).toMatchObject({ rect: { height: 1 } });
      else expect(overlayField(board, 'gap')).toBeUndefined();
    }
  });

  it('should render one bounded selected-count cue for an atomic multi-card drag', () => {
    const { application, board, frames } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    const sibling = cardTarget(board, fixture.named.tall);
    const siblingPoint = eventPoint(application, board, sibling.x + 1, sibling.y + 1);
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ctrl: true, ...siblingPoint });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ctrl: true, ...siblingPoint });
    const source = cardTarget(board, fixture.named.short);
    const sourcePoint = eventPoint(application, board, source.x + 1, source.y + 1);
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ctrl: true, ...sourcePoint });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ctrl: true, ...sourcePoint });
    beginDrag(application, board, fixture.named.short);
    const sample = eventPoint(application, board, source.x + 8, source.y + 2);

    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...sample });

    const ghost = compactGhost(board);
    expect(ghost).toMatchObject({ count: 2, contentRows: 1 });
    const emitted = frames.at(-1);
    if (emitted === undefined) throw new Error('Expected an emitted multi-card drag frame.');
    const cue = frameRect(emitted, ghost.visibleRect);
    expect(cue.match(/2 cards/g)).toHaveLength(1);
    expect(cue).not.toContain('Small source-range control');
  });

  it('should bound leaf composition and real terminal output to changed visible cells', () => {
    const { application, board, buffers } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    const source = cardTarget(board, fixture.named.short);
    beginDrag(application, board, fixture.named.short);
    const before = buffers.at(-1);
    if (before === undefined) throw new Error('Expected a pre-move terminal buffer.');

    const sample = eventPoint(application, board, source.x + 10, source.y + 2);
    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...sample });
    const after = buffers.at(-1);
    if (after === undefined || after === before) throw new Error('Expected a post-move terminal buffer.');
    const host = createKanbanFrameHostFixture(CAPS);
    const diff = host.capture('pointer-frame-1', before, after);
    const scale = inspectKanbanViewportScale(board.viewport);

    expect(scale.projectedCards).toBe(board.inspection().visibleCards.length);
    expect(scale.projectedCards).toBeLessThan(84);
    expect(diff.operationId).toBe('pointer-frame-1');
    expect(diff.renderRoot.changedCells).toBeGreaterThan(0);
    expect(diff.renderRoot.changedCells).toBeLessThan(before.width * before.height);
    expect(diff.renderRoot.changedRuns).toBeGreaterThan(0);
    expect(diff.renderRoot.changedRuns).toBeLessThanOrEqual(diff.renderRoot.changedCells);
    expect(diff.renderRoot.utf8Bytes).toBeGreaterThan(0);
    expect(diff.host).toEqual(diff.renderRoot);
    host.dispose();
  });

  it('should keep 84-card click, wheel, and captured target work proportional to visible residents', () => {
    const { application, board } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    const scale = inspectKanbanViewportScale(board.viewport);
    const visible = scale.projectedCards;
    const residentBudget = scale.retainedDescriptors;
    const source = cardTarget(board, fixture.named.short);
    const point = eventPoint(application, board, source.x + 2, source.y + 1);

    const click = observeKanbanViewportOperations(board.viewport, 'click-84');
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...point });
    const clickWork = click.snapshot();
    click.dispose();

    beginDrag(application, board, fixture.named.short);
    const pointer = observeKanbanViewportOperations(board.viewport, 'pointer-84');
    const destination = eventPoint(application, board, source.x + 8, source.y + 3);
    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...destination });
    const pointerWork = pointer.snapshot();
    pointer.dispose();
    application.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });

    const wheel = observeKanbanViewportOperations(board.viewport, 'wheel-84');
    application.loop.dispatch({ type: 'wheel', dir: 'down', shift: false, alt: false, ctrl: false, ...point });
    const wheelWork = wheel.snapshot();
    wheel.dispose();

    expect([clickWork.operationId, wheelWork.operationId, pointerWork.operationId]).toEqual([
      'click-84',
      'wheel-84',
      'pointer-84',
    ]);
    for (const observed of [clickWork.work, wheelWork.work, pointerWork.work]) {
      expect(observed.residentDescriptors).toBeLessThanOrEqual(residentBudget * 4);
      expect(observed.residentGroupingVisits).toBe(observed.residentDescriptors);
      expect(observed.heightMeasurements).toBeLessThanOrEqual(residentBudget * 4);
      expect(observed.hitRegions).toBeLessThanOrEqual(residentBudget * 8);
      expect(observed.drawnCards).toBeLessThanOrEqual(visible * 4);
      expect(observed.drawnCardRows).toBeLessThan(80 * 24 * 4);
      expect(observed.semanticDamageCells).toBeLessThanOrEqual(80 * 24 * 4);
    }
    expect(pointerWork.work.dragTargetRecomputations).toBeGreaterThan(0);
    expect(pointerWork.work.dragTargetRecomputations).toBeLessThanOrEqual(2);
    expect(pointerWork.work.dropRegions).toBeGreaterThan(0);
    expect(pointerWork.work.dropRegions).toBeLessThanOrEqual(residentBudget * 4);
  });

  it('should publish mounted autoscroll geometry before an injected timer tick returns', () => {
    vi.useFakeTimers();
    const { application, board, frames } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    const source = cardTarget(board, fixture.named.short);
    beginDrag(application, board, fixture.named.short);
    const edge = eventPoint(application, board, board.viewport.bounds.width - 1, source.y + 2);
    application.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...edge });
    const beforeFrames = frames.length;
    const beforeOffset = board.viewport.metrics().offsets.x;

    vi.advanceTimersByTime(250);

    expect(board.viewport.metrics().offsets.x).toBeGreaterThan(beforeOffset);
    expect(frames.length).toBeGreaterThan(beforeFrames);
    expect(inspectKanbanDragFrame(board.viewport)).toMatchObject({
      ghost: { contentRows: 1 },
      gap: { rect: { height: 1 } },
    });
  });

  // Wheel scrolling keeps capture alive; release publishes one local move and leaves the card draggable.
  it('should preserve drag through scrolling, reconcile one accepted release, and allow a second drag', () => {
    const { application, board, cards, dispatches } = mountedDragFixture();
    const fixture = createKanbanStabilizationFixture();
    beginDrag(application, board, fixture.named.short);
    const target = cardTarget(board, fixture.named.tall);
    const wheelPoint = eventPoint(application, board, target.x + 1, target.y + target.height);

    application.loop.dispatch({
      type: 'wheel',
      dir: 'down',
      x: wheelPoint.x,
      y: wheelPoint.y,
      shift: false,
      alt: false,
      ctrl: false,
    });
    expect(overlayField(board, 'ghost')).toBeDefined();
    const currentTarget = cardTarget(board, fixture.named.tall);
    const destination = eventPoint(application, board, currentTarget.x + 1, currentTarget.y + currentTarget.height);
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
