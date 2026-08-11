/**
 * Specification tests for card press, threshold, capture-generation, and dragged-set semantics.
 *
 * These cases intentionally describe the Phase C pointer contract before the drag controller exists.
 * Geometry, targets, autoscroll, and release behavior are specified by later Phase 4 tasks.
 */
import { describe, expect, it, vi } from 'vitest';

import type { PointerCaptureLease, PointerCaptureLossReason, PointerCaptureLostHandler } from '@jsvision/ui';

import type { KanbanActionTarget, KanbanSelectionEntry, KanbanSelectionSnapshot } from '../src/index.js';
import { KanbanPointerRouter } from '../src/testing.js';

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
    beginCardDrag: vi.fn(() => true),
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
