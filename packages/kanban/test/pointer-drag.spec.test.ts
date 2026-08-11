/**
 * Specification tests for card press, threshold, capture-generation, and dragged-set semantics.
 *
 * These cases intentionally describe the Phase C pointer contract before the drag controller exists.
 * Geometry, targets, autoscroll, and release behavior are specified by later Phase 4 tasks.
 */
import { describe, expect, it, vi } from 'vitest';

import type { PointerCaptureLease, PointerCaptureLossReason, PointerCaptureLostHandler } from '@jsvision/ui';

import type { KanbanActionTarget, KanbanSelectionEntry, KanbanSelectionSnapshot } from '../src/index.js';
import { createKanbanCollapsedHoverController } from '../src/index.js';
import { KanbanPointerRouter } from '../src/testing.js';
import type { KanbanPointerDragStart } from '../src/testing.js';
import { projectKanbanCardDropMap } from '../src/interaction/drop-map.js';
import { selectKanbanDropTargetWithHysteresis } from '../src/interaction/drop-hysteresis.js';
import { createKanbanDragPrefetchController } from '../src/interaction/drag-prefetch.js';

/** One selected card with complete semantic and revision evidence. */
function selectionEntry(cardKey: number, logicalColumn = 'ready'): KanbanSelectionEntry {
  return Object.freeze({
    cardKey,
    address: Object.freeze({ columnId: logicalColumn }),
    entityRevision: `card-${cardKey}-r1`,
  });
}

/** Build one deterministic selection in the source order supplied by the application. */
function selection(...entries: readonly KanbanSelectionEntry[]): KanbanSelectionSnapshot {
  return Object.freeze({
    entries: Object.freeze([...entries]),
    sessionRevision: 'source-r1',
    queryGeneration: 1,
  });
}

/** Create one whole-card hit target without retaining a card record. */
function cardTarget(cardKey: number): KanbanActionTarget {
  const address = Object.freeze({ columnId: 'ready' });
  return Object.freeze({
    kind: 'card',
    scope: Object.freeze({ kind: 'card', cardKey, address }),
    x: 2,
    y: cardKey * 3,
    width: 20,
    height: 2,
    zIndex: 400,
    cardKey,
    address,
    logicalIndex: cardKey - 1,
  });
}

/** Creates one structural header target with explicit reorder authority evidence. */
function structureTarget(
  kind: 'workflow-header' | 'swimlane-header',
  identity: string,
  reorder: 'allowed' | 'blocked-derived' = 'allowed',
) {
  const columnId = kind === 'workflow-header' ? identity : 'ready';
  return Object.freeze({
    kind,
    scope:
      kind === 'workflow-header'
        ? Object.freeze({ kind: 'column' as const, columnId })
        : Object.freeze({ kind: 'swimlane' as const, swimlaneId: identity }),
    x: kind === 'workflow-header' ? 1 : 0,
    y: kind === 'workflow-header' ? 0 : 2,
    width: 18,
    height: 1,
    zIndex: 300,
    ...(kind === 'workflow-header' ? { columnId } : { swimlaneId: identity }),
    reorder,
  });
}

/** Controllable generation-bound capture returned by a normalized pointer report. */
function captureHarness(generation: number) {
  let active = true;
  let onLost: PointerCaptureLostHandler | undefined;
  const lease: PointerCaptureLease = Object.freeze({
    generation,
    active: () => active,
    release(): void {
      active = false;
    },
  });
  return Object.freeze({
    acquire(handler: PointerCaptureLostHandler): PointerCaptureLease {
      onLost = handler;
      return lease;
    },
    lose(reason: PointerCaptureLossReason): void {
      if (!active) return;
      active = false;
      onLost?.(reason);
    },
    lease,
  });
}

/** Complete click and drag seams with deterministic card revision evidence. */
function gestureSink(selected: KanbanSelectionSnapshot) {
  return {
    snapshotSelection: () => selected,
    beginPrimary: () => true,
    completeCard: vi.fn(() => true),
    completeCardAction: () => true,
    completeScopedAction: () => true,
    completeRetry: () => true,
    openContext: () => true,
    snapshotCard: (target: KanbanActionTarget) =>
      target.cardKey === undefined ? undefined : selectionEntry(Number(target.cardKey)),
    beginCardDrag: vi.fn((_start: KanbanPointerDragStart) => true),
    cancelCardDrag: vi.fn(),
  };
}

describe('card drag press and threshold contract', () => {
  it('preserves ordinary click completion while movement stays below the configured threshold', () => {
    const sink = gestureSink(selection(selectionEntry(1)));
    const capture = captureHarness(11);
    const router = new KanbanPointerRouter(sink, { dragThreshold: 2 });
    const target = cardTarget(1);

    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 5, y: 5 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: capture.acquire,
    });
    router.route({
      kind: 'move',
      button: 0,
      ctrl: false,
      point: { x: 6, y: 5 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: capture.acquire,
    });

    expect(sink.beginCardDrag).not.toHaveBeenCalled();
    expect(
      router.route({
        kind: 'up',
        button: 0,
        ctrl: false,
        point: { x: 6, y: 5 },
        target,
        sceneRevision: 'scene-r1',
      }),
    ).toBe(true);
    expect(sink.completeCard).toHaveBeenCalledOnce();
  });

  it('starts exactly one captured drag on the first cell transition at the default threshold', () => {
    const sink = gestureSink(selection(selectionEntry(1)));
    const capture = captureHarness(12);
    const router = new KanbanPointerRouter(sink);
    const target = cardTarget(1);

    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 5, y: 5 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: capture.acquire,
    });
    expect(
      router.route({
        kind: 'move',
        button: 0,
        ctrl: false,
        point: { x: 6, y: 5 },
        target,
        sceneRevision: 'scene-r1',
        acquireCapture: capture.acquire,
      }),
    ).toBe(true);

    expect(sink.beginCardDrag).toHaveBeenCalledOnce();
    expect(sink.beginCardDrag).toHaveBeenCalledWith(
      expect.objectContaining({
        originPoint: { x: 5, y: 5 },
        point: { x: 6, y: 5 },
        capture: capture.lease,
      }),
    );
    expect(router.pending()).toBeUndefined();
    expect(
      router.route({
        kind: 'up',
        button: 0,
        ctrl: false,
        point: { x: 6, y: 5 },
        target,
        sceneRevision: 'scene-r1',
      }),
    ).toBe(false);
    expect(sink.completeCard).not.toHaveBeenCalled();
  });

  it('starts immediately at threshold zero and fails closed without capture or card evidence', () => {
    const capture = captureHarness(13);
    const target = cardTarget(1);
    const enabled = gestureSink(selection(selectionEntry(1)));
    const immediate = new KanbanPointerRouter(enabled, { dragThreshold: 0 });

    expect(
      immediate.route({
        kind: 'down',
        button: 0,
        ctrl: false,
        point: { x: 5, y: 5 },
        target,
        sceneRevision: 'scene-r1',
        acquireCapture: capture.acquire,
      }),
    ).toBe(true);
    expect(enabled.beginCardDrag).toHaveBeenCalledOnce();

    const unavailable = gestureSink(selection());
    unavailable.snapshotCard = () => undefined;
    const missingEvidence = new KanbanPointerRouter(unavailable);
    missingEvidence.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 5, y: 5 },
      target,
      sceneRevision: 'scene-r1',
    });
    expect(
      missingEvidence.route({
        kind: 'move',
        button: 0,
        ctrl: false,
        point: { x: 6, y: 5 },
        target,
        sceneRevision: 'scene-r1',
      }),
    ).toBe(false);
    expect(unavailable.beginCardDrag).not.toHaveBeenCalled();
  });
});

describe('card drag generation and dragged-set contract', () => {
  it('cancels malformed/out-of-bounds reports and refreshes the release point before handoff', () => {
    const selected = selection(selectionEntry(1));
    const target = cardTarget(1);
    const capture = captureHarness(31);
    let dispatchable = true;
    const releaseCardDrag = vi.fn(() => dispatchable);
    const sink = {
      ...gestureSink(selected),
      updateCardDrag: vi.fn(
        (_generation: number, _point: Readonly<{ x: number; y: number }>, current?: KanbanActionTarget) => {
          dispatchable = current !== undefined;
          return true;
        },
      ),
      releaseCardDrag,
    };
    const router = new KanbanPointerRouter(sink);
    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 1, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: capture.acquire,
    });
    router.route({
      kind: 'move',
      button: 0,
      ctrl: false,
      point: { x: 2, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: capture.acquire,
    });

    expect(
      router.route({
        kind: 'up',
        button: 0,
        ctrl: false,
        point: { x: 5, y: 5 },
        sceneRevision: 'scene-r1',
      }),
    ).toBe(false);
    expect(sink.updateCardDrag).toHaveBeenLastCalledWith(expect.any(Number), { x: 5, y: 5 }, undefined);
    expect(releaseCardDrag).toHaveBeenCalledOnce();

    const malformedCapture = captureHarness(32);
    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 1, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: malformedCapture.acquire,
    });
    router.route({
      kind: 'move',
      button: 0,
      ctrl: false,
      point: { x: 2, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: malformedCapture.acquire,
    });
    expect(
      router.route({
        kind: 'up',
        button: 2,
        ctrl: false,
        point: { x: 2, y: 1 },
        target,
        sceneRevision: 'scene-r1',
      }),
    ).toBe(false);
    expect(releaseCardDrag).toHaveBeenCalledOnce();
  });

  it('invalidates capture loss before ignoring queued reports from the cancelled generation', () => {
    const sink = gestureSink(selection(selectionEntry(1)));
    const firstCapture = captureHarness(21);
    const router = new KanbanPointerRouter(sink);
    const target = cardTarget(1);

    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 1, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: firstCapture.acquire,
    });
    router.route({
      kind: 'move',
      button: 0,
      ctrl: false,
      point: { x: 2, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: firstCapture.acquire,
    });
    const firstGeneration = sink.beginCardDrag.mock.calls[0]?.[0].generation;

    firstCapture.lose('modal');
    expect(sink.cancelCardDrag).toHaveBeenCalledWith(firstGeneration, 'modal');
    expect(
      router.route({
        kind: 'up',
        button: 0,
        ctrl: false,
        point: { x: 2, y: 1 },
        target,
        sceneRevision: 'scene-r1',
        gestureGeneration: firstGeneration,
      }),
    ).toBe(false);

    const secondCapture = captureHarness(22);
    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 1, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: secondCapture.acquire,
    });
    router.route({
      kind: 'move',
      button: 0,
      ctrl: false,
      point: { x: 2, y: 1 },
      target,
      sceneRevision: 'scene-r1',
      acquireCapture: secondCapture.acquire,
    });
    const secondGeneration = sink.beginCardDrag.mock.calls[1]?.[0].generation;
    expect(secondGeneration).not.toBe(firstGeneration);
  });

  it('moves an unselected card alone and a selected card with the ordered concrete selection', () => {
    const selected = selection(selectionEntry(3), selectionEntry(1), selectionEntry(2));
    const sink = gestureSink(selected);
    const router = new KanbanPointerRouter(sink);

    const start = (cardKey: number, captureGeneration: number): void => {
      const target = cardTarget(cardKey);
      const capture = captureHarness(captureGeneration);
      router.route({
        kind: 'down',
        button: 0,
        ctrl: false,
        point: { x: 1, y: 1 },
        target,
        sceneRevision: 'scene-r1',
        acquireCapture: capture.acquire,
      });
      router.route({
        kind: 'move',
        button: 0,
        ctrl: false,
        point: { x: 2, y: 1 },
        target,
        sceneRevision: 'scene-r1',
        acquireCapture: capture.acquire,
      });
      capture.lease.release();
    };

    start(8, 31);
    expect(sink.beginCardDrag.mock.calls[0]?.[0].dragged).toEqual([selectionEntry(8)]);

    start(1, 32);
    expect(sink.beginCardDrag.mock.calls[1]?.[0].dragged).toEqual(selected.entries);
  });
});

describe('structural header drag contract', () => {
  it.each([
    ['workflow-header', 'doing', 'column-reorder'],
    ['swimlane-header', 'team-b', 'swimlane-reorder'],
  ] as const)(
    'uses the same captured threshold, bounded structural cues, two-axis autoscroll, and one release for %s',
    (kind, identity, requestKind) => {
      // Eligible column and explicit-swimlane headers use one gesture contract and one atomic release handoff.
      const target = structureTarget(kind, identity);
      const capture = captureHarness(kind === 'workflow-header' ? 71 : 72);
      const request = vi.fn((_proposal: unknown) => true);
      const autoscroll = vi.fn((_step: Readonly<{ x: number; y: number }>) => ({ x: 2, y: 2 }));
      const beginStructureDrag = vi.fn(() => true);
      const updateStructureDrag = vi.fn((_generation: number, point: Readonly<{ x: number; y: number }>) => {
        autoscroll({ x: point.x >= 19 ? 2 : 0, y: point.y >= 9 ? 2 : 0 });
        return true;
      });
      const releaseStructureDrag = vi.fn((_generation: number) =>
        request({
          kind: requestKind,
          ...(kind === 'workflow-header' ? { columnId: identity } : { swimlaneId: identity }),
          position: { kind: 'end' },
        }),
      );
      const sink = {
        ...gestureSink(selection()),
        beginStructureDrag,
        updateStructureDrag,
        releaseStructureDrag,
        cancelStructureDrag: vi.fn(),
      };
      const router = new KanbanPointerRouter(sink);

      router.route({
        kind: 'down',
        button: 0,
        ctrl: false,
        point: { x: 2, y: 1 },
        target,
        sceneRevision: 'structure-scene-r1',
        acquireCapture: capture.acquire,
      });
      expect(
        router.route({
          kind: 'move',
          button: 0,
          ctrl: false,
          point: { x: 3, y: 1 },
          target,
          sceneRevision: 'structure-scene-r1',
          acquireCapture: capture.acquire,
        }),
      ).toBe(true);
      expect(beginStructureDrag).toHaveBeenCalledOnce();
      expect(beginStructureDrag).toHaveBeenCalledWith(
        expect.objectContaining({
          structure:
            kind === 'workflow-header'
              ? { kind: 'column', columnId: identity }
              : { kind: 'swimlane', swimlaneId: identity },
          capture: capture.lease,
          cues: {
            ghost: 'bounded-header',
            placeholder: 'source-slot',
            marker: 'sibling-insertion',
          },
        }),
      );

      router.route({
        kind: 'drag',
        button: 0,
        ctrl: false,
        point: { x: 19, y: 9 },
        target,
        sceneRevision: 'structure-scene-r1',
      });
      expect(autoscroll).toHaveBeenLastCalledWith({ x: 2, y: 2 });
      expect(
        router.route({
          kind: 'up',
          button: 0,
          ctrl: false,
          point: { x: 19, y: 9 },
          target,
          sceneRevision: 'structure-scene-r1',
        }),
      ).toBe(true);
      expect(releaseStructureDrag).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledWith(expect.objectContaining({ kind: requestKind, position: { kind: 'end' } }));
    },
  );

  it('blocks a derived swimlane before capture and never treats any header as a card slot', () => {
    // Derived groups without explicit reorder capability are inert mutation targets.
    const derived = structureTarget('swimlane-header', 'derived-team', 'blocked-derived');
    const capture = captureHarness(73);
    const beginStructureDrag = vi.fn(() => true);
    const sink = { ...gestureSink(selection()), beginStructureDrag, releaseStructureDrag: vi.fn() };
    const router = new KanbanPointerRouter(sink);

    router.route({
      kind: 'down',
      button: 0,
      ctrl: false,
      point: { x: 2, y: 2 },
      target: derived,
      sceneRevision: 'derived-scene-r1',
      acquireCapture: capture.acquire,
    });
    expect(
      router.route({
        kind: 'move',
        button: 0,
        ctrl: false,
        point: { x: 3, y: 2 },
        target: derived,
        sceneRevision: 'derived-scene-r1',
        acquireCapture: capture.acquire,
      }),
    ).toBe(false);

    expect(beginStructureDrag).not.toHaveBeenCalled();
    expect(sink.beginCardDrag).not.toHaveBeenCalled();
    expect(capture.lease.active()).toBe(true);
    expect(sink.releaseStructureDrag).not.toHaveBeenCalled();
  });
});

/** Two-card cell geometry with explicit revision-bound placement evidence. */
function populatedDropCell() {
  return Object.freeze({
    address: Object.freeze({ columnId: 'ready' }),
    content: Object.freeze({ x: 0, y: 2, width: 20, height: 14 }),
    header: Object.freeze({ x: 0, y: 0, width: 20, height: 1 }),
    postHeader: Object.freeze({
      rect: Object.freeze({ x: 0, y: 1, width: 20, height: 1 }),
      position: Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r1' }),
    }),
    leading: Object.freeze({
      rect: Object.freeze({ x: 0, y: 2, width: 20, height: 2 }),
      position: Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r1' }),
    }),
    trailing: Object.freeze({
      rect: Object.freeze({ x: 0, y: 14, width: 20, height: 2 }),
      position: Object.freeze({ kind: 'end' as const, cursorRevision: 'cursor-r1' }),
    }),
    cards: Object.freeze([
      Object.freeze({
        cardKey: 1,
        rect: Object.freeze({ x: 1, y: 3, width: 18, height: 4 }),
        before: Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r1' }),
        after: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
      }),
      Object.freeze({
        cardKey: 2,
        rect: Object.freeze({ x: 1, y: 7, width: 18, height: 4 }),
        before: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
        after: Object.freeze({ kind: 'end' as const, cursorRevision: 'cursor-r1' }),
      }),
    ]),
    gutters: Object.freeze([
      Object.freeze({
        rect: Object.freeze({ x: 0, y: 7, width: 20, height: 1 }),
        position: Object.freeze({
          kind: 'between' as const,
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        }),
      }),
    ]),
    complete: Object.freeze({ leading: true, trailing: true, empty: false }),
  });
}

describe('semantic card drop-map target contract', () => {
  it('prefers a full-width resting gutter over an overlapping card half', () => {
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [populatedDropCell()],
    });

    expect(map.targetAt({ x: 5, y: 7 })).toMatchObject({
      kind: 'resting-gutter',
      address: { columnId: 'ready' },
      position: { kind: 'between', beforeCardKey: 1, afterCardKey: 2 },
    });
  });

  it('uses card upper and lower halves only outside a resting gutter', () => {
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [populatedDropCell()],
    });

    expect(map.targetAt({ x: 5, y: 3 })).toMatchObject({
      kind: 'card-before',
      cardKey: 1,
      position: { kind: 'start' },
    });
    expect(map.targetAt({ x: 5, y: 5 })).toMatchObject({
      kind: 'card-after',
      cardKey: 1,
      position: { kind: 'between', beforeCardKey: 1, afterCardKey: 2 },
    });
  });

  it('resolves bounded leading and trailing zones only from complete source evidence', () => {
    const complete = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [populatedDropCell()],
    });
    const incomplete = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [
        {
          ...populatedDropCell(),
          complete: { leading: false, trailing: false, empty: false },
        },
      ],
    });

    expect(complete.targetAt({ x: 19, y: 2 })).toMatchObject({
      kind: 'cell-leading',
      position: { kind: 'start' },
    });
    expect(complete.targetAt({ x: 19, y: 15 })).toMatchObject({
      kind: 'cell-trailing',
      position: { kind: 'end' },
    });
    expect(incomplete.targetAt({ x: 19, y: 2 })).toBeUndefined();
    expect(incomplete.targetAt({ x: 19, y: 15 })).toBeUndefined();
  });

  it('keeps the swimlane header inert and exposes a separate first post-header gap', () => {
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [populatedDropCell()],
    });

    expect(map.targetAt({ x: 10, y: 0 })).toBeUndefined();
    expect(map.targetAt({ x: 10, y: 1 })).toMatchObject({
      kind: 'post-header',
      position: { kind: 'start' },
    });
  });

  it('uses the large card-content region as the target for a known empty cell', () => {
    const populated = populatedDropCell();
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [
        {
          ...populated,
          cards: [],
          gutters: [],
          complete: { leading: true, trailing: true, empty: true },
        },
      ],
    });

    expect(map.targetAt({ x: 10, y: 9 })).toMatchObject({
      kind: 'empty-cell',
      address: { columnId: 'ready' },
      position: { kind: 'start' },
    });
  });

  it('creates exactly one one-row compact gap only for the active semantic proposal', () => {
    const map = projectKanbanCardDropMap({
      density: 'compact',
      cells: [populatedDropCell()],
      activeGap: {
        address: { columnId: 'ready' },
        rect: { x: 0, y: 7, width: 20, height: 1 },
        position: {
          kind: 'between',
          beforeCardKey: 1,
          afterCardKey: 2,
          cursorRevision: 'cursor-r1',
        },
      },
    });

    expect(map.targets.filter(({ kind }) => kind === 'active-gap')).toHaveLength(1);
    expect(map.targetAt({ x: 10, y: 7 })).toMatchObject({ kind: 'active-gap' });
    expect(map.targets.some(({ kind }) => kind === 'resting-gutter')).toBe(false);
  });
});

describe('drag target stability and bounded discovery contract', () => {
  it('retains the current semantic slot inside its one-cell band but switches semantic owners immediately', () => {
    const current = Object.freeze({
      kind: 'card-after' as const,
      slotId: 'ready:after:1',
      address: Object.freeze({ columnId: 'ready' }),
      rect: Object.freeze({ x: 0, y: 5, width: 20, height: 2 }),
      position: Object.freeze({
        kind: 'between' as const,
        beforeCardKey: 1,
        afterCardKey: 2,
        cursorRevision: 'cursor-r1',
      }),
      geometryGeneration: 4,
    });
    const adjacent = Object.freeze({
      ...current,
      kind: 'card-before' as const,
      slotId: 'ready:before:2',
      rect: Object.freeze({ x: 0, y: 7, width: 20, height: 2 }),
    });
    const otherCell = Object.freeze({
      ...adjacent,
      slotId: 'doing:before:9',
      address: Object.freeze({ columnId: 'doing' }),
    });

    expect(
      selectKanbanDropTargetWithHysteresis({
        current,
        candidate: adjacent,
        point: { x: 10, y: 7 },
        geometryGeneration: 4,
      }),
    ).toBe(current);
    expect(
      selectKanbanDropTargetWithHysteresis({
        current,
        candidate: otherCell,
        point: { x: 10, y: 7 },
        geometryGeneration: 4,
      }),
    ).toBe(otherCell);
  });

  it('never retains a target whose geometry generation became stale', () => {
    const current = Object.freeze({
      kind: 'cell-leading' as const,
      slotId: 'ready:start',
      address: Object.freeze({ columnId: 'ready' }),
      rect: Object.freeze({ x: 0, y: 2, width: 20, height: 2 }),
      position: Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r1' }),
      geometryGeneration: 3,
    });
    const candidate = Object.freeze({
      ...current,
      position: Object.freeze({ kind: 'start' as const, cursorRevision: 'cursor-r2' }),
      geometryGeneration: 4,
    });

    expect(
      selectKanbanDropTargetWithHysteresis({
        current,
        candidate,
        point: { x: 10, y: 2 },
        geometryGeneration: 4,
      }),
    ).toBe(candidate);
  });

  it('keeps an unknown window edge unavailable and cancels stale prefetch work on leave', async () => {
    let resolvePrefetch: (() => void) | undefined;
    let capturedSignal: AbortSignal | undefined;
    const ensureRange = vi.fn((_hint: unknown, signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<void>((resolve) => {
        resolvePrefetch = resolve;
      });
    });
    const publishEvidence = vi.fn();
    const prefetch = createKanbanDragPrefetchController({ ensureRange, publishEvidence });
    const populated = populatedDropCell();
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      cells: [
        {
          ...populated,
          complete: { leading: true, trailing: false, empty: false },
          unknownTrailing: {
            rect: { x: 0, y: 14, width: 20, height: 2 },
            position: {
              kind: 'window-edge',
              edge: 'after',
              neighborCardKey: 2,
              token: 'edge-token-r1',
              cursorRevision: 'cursor-r1',
            },
            prefetch: { address: { columnId: 'ready' }, start: 2, count: 16, revision: 'cursor-r1' },
          },
        },
      ],
    });
    const target = map.targetAt({ x: 10, y: 15 });

    expect(target).toMatchObject({
      kind: 'unknown-edge',
      eligibility: { kind: 'unavailable', code: 'placement-loading' },
    });
    expect(prefetch.update(target, 7)).toBe(true);
    expect(prefetch.update(target, 7)).toBe(false);
    expect(ensureRange).toHaveBeenCalledOnce();

    prefetch.update(undefined, 7);
    expect(capturedSignal?.aborted).toBe(true);
    resolvePrefetch?.();
    await Promise.resolve();
    expect(publishEvidence).not.toHaveBeenCalled();
  });

  it('temporarily expands only a visible collapsed swimlane and restores it on leave', () => {
    vi.useFakeTimers();
    try {
      const hover = createKanbanCollapsedHoverController();
      expect(hover.begin({ swimlaneId: 'team-a', visible: false, collapsed: true })).toBe(false);
      expect(hover.snapshot()).toEqual({ kind: 'idle' });

      expect(hover.begin({ swimlaneId: 'team-a', visible: true, collapsed: true })).toBe(true);
      vi.advanceTimersByTime(499);
      expect(hover.snapshot()).toEqual({ kind: 'waiting', swimlaneId: 'team-a' });
      vi.advanceTimersByTime(1);
      expect(hover.snapshot()).toEqual({ kind: 'expanded', swimlaneId: 'team-a', temporary: true });

      hover.leave('team-a');
      expect(hover.snapshot()).toEqual({ kind: 'idle' });
    } finally {
      vi.useRealTimers();
    }
  });
});
