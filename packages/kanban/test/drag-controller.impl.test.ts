/** Implementation coverage for drag generations, timers, prefetch, and callback containment. */
import { describe, expect, it, vi } from 'vitest';

import type { PointerCaptureLease } from '@jsvision/ui';

import { KanbanDisposedResourceError } from '../src/contract/error.js';
import { createPlacementToken } from '../src/contract/identity.js';
import type { KanbanCardMoveProposal } from '../src/contract/request.js';
import { createKanbanDragAutoscrollController } from '../src/interaction/drag-autoscroll.js';
import { createKanbanCardDragController } from '../src/interaction/drag-controller.js';
import { createKanbanDragPrefetchController } from '../src/interaction/drag-prefetch.js';
import type { KanbanCardDropTarget } from '../src/interaction/drag-types.js';
import type { KanbanEligibility } from '../src/operation/eligibility.js';

/** Creates one current capture with observable and optionally hostile cleanup. */
function capture(onRelease?: () => void): PointerCaptureLease {
  let active = true;
  return Object.freeze({
    generation: 1,
    active: () => active,
    release(): void {
      if (!active) return;
      active = false;
      onRelease?.();
    },
  });
}

/** One complete moved-card source snapshot. */
function movedCard() {
  return Object.freeze({
    cardKey: 1,
    source: Object.freeze({ columnId: 'ready' }),
    sourcePlacement: Object.freeze({ kind: 'start' as const, cursorRevision: 'ready-r1' }),
    sourceRevision: 'ready-r1',
    entityRevision: 'card-r1',
  });
}

/** One current allowed semantic target with bounded prefetch evidence. */
function target(start = 4): KanbanCardDropTarget {
  return Object.freeze({
    kind: 'unknown-edge',
    slotId: `ready:edge:${start}`,
    address: Object.freeze({ columnId: 'ready' }),
    position: Object.freeze({
      kind: 'window-edge',
      edge: 'after',
      neighborCardKey: 1,
      token: createPlacementToken('edge-token'),
      cursorRevision: 'cursor-r1',
    }),
    eligibility: Object.freeze({ kind: 'unavailable', code: 'placement-loading' }),
    rect: Object.freeze({ x: 0, y: 8, width: 20, height: 2 }),
    geometryGeneration: 3,
    prefetch: Object.freeze({
      address: Object.freeze({ columnId: 'ready' }),
      start,
      count: 8,
      revision: 'cursor-r1',
    }),
  });
}

/** Starts one controller with exact source and geometry evidence. */
function activeController(
  options: {
    readonly capture?: PointerCaptureLease;
    readonly commitProposal?: (proposal: KanbanCardMoveProposal, eligibility: KanbanEligibility) => boolean;
    readonly invalidate?: () => void;
  } = {},
) {
  const controller = createKanbanCardDragController({
    commitProposal: options.commitProposal ?? (() => true),
    invalidate: options.invalidate ?? (() => undefined),
  });
  expect(
    controller.begin({
      generation: 7,
      capture: options.capture ?? capture(),
      dragged: [movedCard()],
      originPoint: { x: 1, y: 2 },
      sceneRevision: 'scene-r1',
      geometryGeneration: 3,
    }),
  ).toBe(true);
  return controller;
}

describe('card drag generation and callback containment', () => {
  it('keeps released overlay and capture ownership until synchronous admission publishes pending state', () => {
    const state: { controller?: ReturnType<typeof createKanbanCardDragController> } = {};
    const lease = capture();
    const observed = vi.fn(() => {
      expect(state.controller?.snapshot().kind).toBe('proposed');
      expect(lease.active()).toBe(true);
      return true;
    });
    const controller = activeController({ capture: lease, commitProposal: observed });
    state.controller = controller;
    controller.propose({ generation: 7, target: { ...target(), eligibility: { kind: 'allowed' } } });

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(true);
    expect(observed).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toEqual({ kind: 'idle' });
    expect(lease.active()).toBe(false);
  });

  it('carries the captured view revision and pointer-origin identity independently of moved order', () => {
    const commitProposal = vi.fn((_proposal: KanbanCardMoveProposal, _eligibility: KanbanEligibility) => true);
    const controller = createKanbanCardDragController({ commitProposal, invalidate: () => undefined });
    expect(
      controller.begin({
        generation: 7,
        capture: capture(),
        dragged: [movedCard(), { ...movedCard(), cardKey: 2, entityRevision: 'card-r2' }],
        originCardKey: 2,
        originPoint: { x: 1, y: 2 },
        sceneRevision: 'scene-r1',
        geometryGeneration: 3,
        viewRevision: 'view-r4',
      }),
    ).toBe(true);
    expect(controller.snapshot()).toMatchObject({ overlay: { ghost: { cardKey: 2, count: 2 } } });
    controller.propose({ generation: 7, target: { ...target(), eligibility: { kind: 'allowed' } } });
    controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 });
    expect(commitProposal.mock.calls[0]?.[0]).toMatchObject({ viewRevision: 'view-r4' });
  });

  it('ignores stale proposal updates and adopts current post-scroll revisions', () => {
    const controller = activeController();

    expect(controller.propose({ generation: 6, target: target() })).toBe(false);
    expect(controller.snapshot().kind).toBe('dragging');
    expect(
      controller.propose({
        generation: 7,
        target: { ...target(), eligibility: { kind: 'allowed' } },
        sceneRevision: 'scene-r2',
        geometryGeneration: 4,
      }),
    ).toBe(true);
    expect(controller.release({ generation: 7, sceneRevision: 'scene-r2', geometryGeneration: 4 })).toBe(true);
  });

  it('invalidates ownership before reentrant capture cleanup and isolates repaint failure', () => {
    const release = vi.fn(() => controller.cancel('capture-lost'));
    const lease = capture(release);
    const controller = activeController({
      capture: lease,
      invalidate: () => {
        throw new Error('paint-failed');
      },
    });

    expect(controller.cancel('explicit')).toBe(true);
    expect(release).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toEqual({ kind: 'idle' });
    expect(controller.cancel('explicit')).toBe(false);
  });

  it('settles capture and state when coordinator admission throws', () => {
    const lease = capture();
    const controller = activeController({
      capture: lease,
      commitProposal: () => {
        throw new Error('admission-failed');
      },
    });
    controller.propose({ generation: 7, target: { ...target(), eligibility: { kind: 'allowed' } } });

    expect(controller.release({ generation: 7, sceneRevision: 'scene-r1', geometryGeneration: 3 })).toBe(false);
    expect(lease.active()).toBe(false);
    expect(controller.snapshot()).toEqual({ kind: 'idle' });
  });
});

/** Deterministic timer seam with explicit oldest-task stepping. */
class Clock {
  #next = 1;
  readonly tasks = new Map<number, () => void>();
  readonly scheduler = Object.freeze({
    schedule: (callback: () => void): number => {
      const id = this.#next;
      this.#next += 1;
      this.tasks.set(id, callback);
      return id;
    },
    cancel: (handle: unknown): void => {
      if (typeof handle === 'number') this.tasks.delete(handle);
    },
  });

  /** Runs one pending callback. */
  tick(): void {
    const next = this.tasks.entries().next();
    if (next.done) return;
    const [id, callback] = next.value;
    this.tasks.delete(id);
    callback();
  }
}

describe('drag autoscroll internal cleanup', () => {
  it('rejects a synchronously delivering scheduler without recursive scrolling', () => {
    const scroll = vi.fn((step: Readonly<{ x: number; y: number }>) => step);
    const controller = createKanbanDragAutoscrollController({
      scheduler: {
        schedule(callback): object {
          callback();
          return Object.freeze({});
        },
        cancel: () => undefined,
      },
      scroll,
      recompute: () => undefined,
    });

    expect(() =>
      controller.update({
        point: { x: 19, y: 5 },
        viewport: { x: 0, y: 0, width: 20, height: 10 },
        generation: 8,
      }),
    ).not.toThrow();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('stops one clamped axis while the other continues on the sole timer', () => {
    const clock = new Clock();
    const steps: Array<Readonly<{ x: number; y: number }>> = [];
    const controller = createKanbanDragAutoscrollController({
      scheduler: clock.scheduler,
      scroll: (step) => {
        steps.push(step);
        return steps.length === 1 ? { x: 0, y: 2 } : step;
      },
      recompute: () => undefined,
    });
    controller.update({
      point: { x: 19, y: 10 },
      viewport: { x: 0, y: 1, width: 20, height: 10 },
      generation: 2,
    });

    clock.tick();
    clock.tick();
    expect(steps).toEqual([
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(clock.tasks.size).toBe(1);
  });

  it('contains throwing scroll and scheduler callbacks without retaining a timer', () => {
    const clock = new Clock();
    const controller = createKanbanDragAutoscrollController({
      scheduler: clock.scheduler,
      scroll: () => {
        throw new Error('scroll-failed');
      },
      recompute: () => undefined,
    });
    controller.update({
      point: { x: 19, y: 5 },
      viewport: { x: 0, y: 0, width: 20, height: 10 },
      generation: 3,
    });

    expect(() => clock.tick()).not.toThrow();
    expect(clock.tasks.size).toBe(0);

    const unavailable = createKanbanDragAutoscrollController({
      scheduler: {
        schedule: () => {
          throw new Error('timer-failed');
        },
        cancel: () => undefined,
      },
      scroll: (step) => step,
      recompute: () => undefined,
    });
    expect(() =>
      unavailable.update({
        point: { x: 0, y: 5 },
        viewport: { x: 0, y: 0, width: 20, height: 10 },
        generation: 4,
      }),
    ).not.toThrow();
  });
});

describe('drag prefetch generation and abort ownership', () => {
  it('rejects Promise subclasses and own then accessors without invoking them', () => {
    const overriddenThen = vi.fn();
    class HostilePromise extends Promise<void> {}
    Object.defineProperty(HostilePromise.prototype, 'then', {
      get(): typeof Promise.prototype.then {
        overriddenThen();
        return Promise.prototype.then;
      },
    });
    const subclass = new HostilePromise(() => undefined);
    const subclassController = createKanbanDragPrefetchController({
      ensureRange: () => subclass,
      publishEvidence: () => undefined,
    });
    expect(subclassController.update(target(), 9)).toBe(false);
    expect(overriddenThen).not.toHaveBeenCalled();

    const native = new Promise<void>(() => undefined);
    Object.defineProperty(native, 'then', { get: overriddenThen });
    const accessorController = createKanbanDragPrefetchController({
      ensureRange: () => native,
      publishEvidence: () => undefined,
    });
    expect(accessorController.update(target(), 9)).toBe(false);
    expect(overriddenThen).not.toHaveBeenCalled();
  });

  it('deduplicates one hint and publishes only its current successful settlement', async () => {
    let resolve: (() => void) | undefined;
    const publishEvidence = vi.fn();
    const ensureRange = vi.fn(
      () =>
        new Promise<void>((complete) => {
          resolve = complete;
        }),
    );
    const controller = createKanbanDragPrefetchController({ ensureRange, publishEvidence });

    expect(controller.update(target(), 5)).toBe(true);
    expect(controller.update(target(), 5)).toBe(false);
    resolve?.();
    await Promise.resolve();
    expect(ensureRange).toHaveBeenCalledOnce();
    expect(publishEvidence).toHaveBeenCalledOnce();
  });

  it('aborts replaced work and ignores its late resolution', async () => {
    const resolvers: Array<() => void> = [];
    const signals: AbortSignal[] = [];
    const publishEvidence = vi.fn();
    const controller = createKanbanDragPrefetchController({
      ensureRange: (_hint, signal) => {
        signals.push(signal);
        return new Promise<void>((resolve) => resolvers.push(resolve));
      },
      publishEvidence,
    });

    controller.update(target(4), 6);
    controller.update(target(12), 6);
    expect(signals[0]?.aborted).toBe(true);
    resolvers[0]?.();
    await Promise.resolve();
    expect(publishEvidence).not.toHaveBeenCalled();
    resolvers[1]?.();
    await Promise.resolve();
    expect(publishEvidence).toHaveBeenCalledOnce();
  });

  it('contains failed work, aborts on dispose, and rejects later updates', async () => {
    let signal: AbortSignal | undefined;
    const publishEvidence = vi.fn();
    const controller = createKanbanDragPrefetchController({
      ensureRange: (_hint, currentSignal) => {
        signal = currentSignal;
        return Promise.reject(new Error('load-failed'));
      },
      publishEvidence,
    });

    expect(controller.update(target(), 7)).toBe(true);
    await Promise.resolve();
    expect(publishEvidence).not.toHaveBeenCalled();
    controller.update(target(12), 7);
    controller.dispose();
    expect(signal?.aborted).toBe(true);
    expect(() => controller.update(target(), 7)).toThrow(KanbanDisposedResourceError);
  });
});
