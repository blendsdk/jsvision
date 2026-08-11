/** Specification tests for card-drag release, cancellation, and atomic selected-block proposals. */
import { describe, expect, it, vi } from 'vitest';

import type { PointerCaptureLease } from '@jsvision/ui';

import { createKanbanCardDragController } from '../src/interaction/drag-controller.js';

/** Active capture lease whose release is visible to the specification. */
function captureLease(generation: number) {
  let active = true;
  const lease: PointerCaptureLease = Object.freeze({
    generation,
    active: () => active,
    release(): void {
      active = false;
    },
  });
  return Object.freeze({ lease, active: () => active });
}

/** Ordered source evidence for one or more cards moved atomically. */
function draggedCards(...cardKeys: readonly number[]) {
  return Object.freeze(
    cardKeys.map((cardKey) =>
      Object.freeze({
        cardKey,
        source: Object.freeze({ columnId: 'ready' }),
        sourcePlacement: Object.freeze({ kind: 'start' as const, cursorRevision: 'ready-r1' }),
        sourceRevision: 'ready-r1',
        entityRevision: `card-${cardKey}-r1`,
      }),
    ),
  );
}

/** One allowed current semantic destination. */
function allowedTarget() {
  return Object.freeze({
    kind: 'resting-gutter' as const,
    slotId: 'doing:between:8:9',
    address: Object.freeze({ columnId: 'doing' }),
    position: Object.freeze({
      kind: 'between' as const,
      beforeCardKey: 8,
      afterCardKey: 9,
      cursorRevision: 'doing-r3',
    }),
    eligibility: Object.freeze({ kind: 'allowed' as const }),
    geometryGeneration: 3,
  });
}

/** Begin one current drag and install the default allowed target. */
function activeController(cardKeys: readonly number[] = [1]) {
  const commitProposal = vi.fn(() => true);
  const invalidate = vi.fn();
  const capture = captureLease(41);
  const controller = createKanbanCardDragController({ commitProposal, invalidate });
  expect(
    controller.begin({
      generation: 7,
      capture: capture.lease,
      dragged: draggedCards(...cardKeys),
      originPoint: { x: 2, y: 4 },
      sceneRevision: 'scene-r1',
      geometryGeneration: 3,
    }),
  ).toBe(true);
  controller.propose({ generation: 7, target: allowedTarget() });
  return Object.freeze({ controller, commitProposal, invalidate, capture });
}

describe('card drag release contract', () => {
  it('hands one ordered selected-block move proposal to the coordinator and releases capture', () => {
    const { controller, commitProposal, capture } = activeController([3, 1, 2]);

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(true);

    expect(commitProposal).toHaveBeenCalledOnce();
    expect(commitProposal).toHaveBeenCalledWith(
      {
        kind: 'card-move',
        moved: draggedCards(3, 1, 2),
        target: { columnId: 'doing' },
        position: {
          kind: 'between',
          beforeCardKey: 8,
          afterCardKey: 9,
          cursorRevision: 'doing-r3',
        },
      },
      { kind: 'allowed' },
    );
    expect(capture.active()).toBe(false);
    expect(controller.snapshot()).toEqual({ kind: 'idle' });

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(false);
    expect(commitProposal).toHaveBeenCalledOnce();
  });

  it.each(['blocked', 'unavailable', 'outside'] as const)('dispatches nothing when release is %s', (outcome) => {
    const { controller, commitProposal, capture } = activeController();
    if (outcome === 'outside') controller.propose({ generation: 7, target: undefined });
    else {
      controller.propose({
        generation: 7,
        target: {
          ...allowedTarget(),
          eligibility:
            outcome === 'blocked'
              ? { kind: 'blocked', code: 'transition-blocked' }
              : { kind: 'unavailable', code: 'placement-loading' },
        },
      });
    }

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(false);
    expect(commitProposal).not.toHaveBeenCalled();
    expect(capture.active()).toBe(false);
    expect(controller.snapshot()).toEqual({ kind: 'idle' });
  });

  it('hands a warning target to the coordinator for request-time confirmation', () => {
    const { controller, commitProposal } = activeController();
    controller.propose({
      generation: 7,
      target: {
        ...allowedTarget(),
        eligibility: { kind: 'warning', code: 'wip-warning' },
      },
    });

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(true);
    expect(commitProposal).toHaveBeenCalledOnce();
    expect(commitProposal.mock.calls[0]?.[1]).toEqual({ kind: 'warning', code: 'wip-warning' });
  });

  it('rejects stale scene, geometry, and gesture generations without reinterpreting coordinates', () => {
    const staleCases = [
      { generation: 6, sceneRevision: 'scene-r1', geometryGeneration: 3 },
      { generation: 7, sceneRevision: 'scene-r2', geometryGeneration: 3 },
      { generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 4 },
    ];

    for (const stale of staleCases) {
      const { controller, commitProposal } = activeController();
      expect(controller.release(stale)).toBe(false);
      expect(commitProposal).not.toHaveBeenCalled();
    }
  });
});

describe('card drag cancellation contract', () => {
  it.each(['explicit', 'escape', 'resize', 'source-change', 'capture-lost', 'dispose'] as const)(
    'cleans up %s cancellation idempotently without dispatch',
    (reason) => {
      const { controller, commitProposal, capture, invalidate } = activeController();

      expect(controller.cancel(reason)).toBe(true);
      expect(controller.cancel(reason)).toBe(false);
      expect(commitProposal).not.toHaveBeenCalled();
      expect(capture.active()).toBe(false);
      expect(controller.snapshot()).toEqual({ kind: 'idle' });
      expect(invalidate).toHaveBeenCalledOnce();
    },
  );

  it('treats decoded focus loss as capture loss and suppresses a queued pointer-up', () => {
    const { controller, commitProposal } = activeController();

    expect(controller.focusChanged(false, 7)).toBe(true);
    expect(controller.snapshot()).toEqual({ kind: 'idle' });
    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(false);
    expect(commitProposal).not.toHaveBeenCalled();
  });

  it('does not cancel for unrelated publication evidence but cancels a relevant revision change', () => {
    const unrelated = activeController([1, 2]);
    expect(
      unrelated.controller.reconcile({
        generation: 7,
        sceneRevision: 'scene-r1',
        changedCardKeys: [99],
      }),
    ).toBe(false);
    expect(unrelated.controller.snapshot().kind).toBe('proposed');

    expect(
      unrelated.controller.reconcile({
        generation: 7,
        sceneRevision: 'scene-r2',
        changedCardKeys: [2],
      }),
    ).toBe(true);
    expect(unrelated.controller.snapshot()).toEqual({ kind: 'idle' });
    expect(unrelated.commitProposal).not.toHaveBeenCalled();
  });
});
