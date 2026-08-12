/** Specification tests for bounded, fake-clock-friendly drag autoscroll. */
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanDragAutoscrollController,
  resolveKanbanDragAutoscrollStep,
} from '../src/interaction/drag-autoscroll.js';

/** Deterministic single-threaded scheduler used without host timers. */
class FakeAutoscrollClock {
  #nextId = 1;
  readonly #pending = new Map<number, { readonly callback: () => void; readonly delayMs: number }>();

  readonly scheduler = Object.freeze({
    schedule: (callback: () => void, delayMs: number): number => {
      const id = this.#nextId;
      this.#nextId += 1;
      this.#pending.set(id, Object.freeze({ callback, delayMs }));
      return id;
    },
    cancel: (handle: unknown): void => {
      if (typeof handle === 'number') this.#pending.delete(handle);
    },
  });

  /** Runs the oldest scheduled tick and returns its configured delay. */
  tick(): number | undefined {
    const next = this.#pending.entries().next();
    if (next.done) return undefined;
    const [id, task] = next.value;
    this.#pending.delete(id);
    task.callback();
    return task.delayMs;
  }

  /** Number of live timer handles retained by the controller. */
  pending(): number {
    return this.#pending.size;
  }
}

const VIEWPORT = Object.freeze({ x: 0, y: 1, width: 20, height: 10 });

describe('drag autoscroll zone contract', () => {
  it('uses two-cell outer-edge steps and one-cell inner-edge steps on all four axes', () => {
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 0, y: 6 }, viewport: VIEWPORT })).toEqual({ x: -2, y: 0 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 2, y: 6 }, viewport: VIEWPORT })).toEqual({ x: -1, y: 0 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 19, y: 6 }, viewport: VIEWPORT })).toEqual({ x: 2, y: 0 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 17, y: 6 }, viewport: VIEWPORT })).toEqual({ x: 1, y: 0 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 10, y: 1 }, viewport: VIEWPORT })).toEqual({ x: 0, y: -2 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 10, y: 3 }, viewport: VIEWPORT })).toEqual({ x: 0, y: -1 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 10, y: 10 }, viewport: VIEWPORT })).toEqual({ x: 0, y: 2 });
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 10, y: 8 }, viewport: VIEWPORT })).toEqual({ x: 0, y: 1 });
  });

  it('uses a short activation grace and a slower steady cadence without duplicate ticks', () => {
    expect(resolveKanbanDragAutoscrollStep({ point: { x: 19, y: 10 }, viewport: VIEWPORT })).toEqual({ x: 2, y: 2 });

    const clock = new FakeAutoscrollClock();
    const scroll = vi.fn(() => ({ x: 2, y: 2 }));
    const controller = createKanbanDragAutoscrollController({ scheduler: clock.scheduler, scroll, recompute: vi.fn() });
    controller.update({ point: { x: 19, y: 10 }, viewport: VIEWPORT, generation: 1 });

    expect(clock.pending()).toBe(1);
    expect(clock.tick()).toBe(250);
    expect(scroll).toHaveBeenCalledOnce();
    expect(scroll).toHaveBeenCalledWith({ x: 2, y: 2 }, 1);
    expect(clock.pending()).toBe(1);
    expect(clock.tick()).toBe(125);
    expect(scroll).toHaveBeenCalledTimes(2);
    controller.cancel();
    expect(clock.pending()).toBe(0);
  });

  it('clamps non-overlapping zones in a tiny viewport', () => {
    const tiny = Object.freeze({ x: 4, y: 7, width: 3, height: 3 });
    const points = [
      { x: 4, y: 7 },
      { x: 5, y: 8 },
      { x: 6, y: 9 },
    ];

    expect(points.map((point) => resolveKanbanDragAutoscrollStep({ point, viewport: tiny }))).toEqual([
      { x: -2, y: -2 },
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);
  });
});

describe('drag autoscroll timer and recomputation contract', () => {
  it('waits through 249 ms of edge dwell and then repeats at the 125 ms cadence', () => {
    vi.useFakeTimers();
    try {
      const scroll = vi.fn((step: Readonly<{ x: number; y: number }>) => step);
      const controller = createKanbanDragAutoscrollController({ scroll, recompute: vi.fn() });
      controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 5 });

      vi.advanceTimersByTime(249);
      expect(scroll).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(scroll).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(124);
      expect(scroll).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(1);
      expect(scroll).toHaveBeenCalledTimes(2);
      controller.cancel();
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves grace through same-direction reprojection and rearms after reversal', () => {
    const clock = new FakeAutoscrollClock();
    const scroll = vi.fn((step: Readonly<{ x: number; y: number }>) => step);
    const controller = createKanbanDragAutoscrollController({ scheduler: clock.scheduler, scroll, recompute: vi.fn() });

    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 6 });
    controller.update({ point: { x: 17, y: 6 }, viewport: VIEWPORT, generation: 6 });
    expect(clock.pending()).toBe(1);
    expect(clock.tick()).toBe(250);
    expect(scroll).toHaveBeenLastCalledWith({ x: 1, y: 0 }, 6);

    controller.update({ point: { x: 0, y: 6 }, viewport: VIEWPORT, generation: 6 });
    expect(clock.pending()).toBe(1);
    expect(clock.tick()).toBe(250);
    expect(scroll).toHaveBeenLastCalledWith({ x: -2, y: 0 }, 6);
    controller.cancel();
  });

  it('cancels both arming and steady timers on leave or generation replacement', () => {
    const clock = new FakeAutoscrollClock();
    const controller = createKanbanDragAutoscrollController({
      scheduler: clock.scheduler,
      scroll: (step) => step,
      recompute: vi.fn(),
    });

    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 10 });
    controller.update({ point: { x: 10, y: 6 }, viewport: VIEWPORT, generation: 10 });
    expect(clock.pending()).toBe(0);

    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 10 });
    expect(clock.tick()).toBe(250);
    expect(clock.pending()).toBe(1);
    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 11 });
    expect(clock.pending()).toBe(1);
    expect(clock.tick()).toBe(250);
    controller.cancel();
    expect(clock.pending()).toBe(0);
  });

  it('retains a clamped corner axis through reentrant reprojection while the other stays steady', () => {
    const clock = new FakeAutoscrollClock();
    const steps: Array<Readonly<{ x: number; y: number }>> = [];
    const controller = createKanbanDragAutoscrollController({
      scheduler: clock.scheduler,
      scroll: (step) => {
        steps.push(step);
        return steps.length === 1 ? { x: 0, y: 2 } : step;
      },
      recompute: (generation) => controller.update({ point: { x: 19, y: 10 }, viewport: VIEWPORT, generation }),
    });
    controller.update({ point: { x: 19, y: 10 }, viewport: VIEWPORT, generation: 12 });

    expect(clock.tick()).toBe(250);
    expect(clock.tick()).toBe(125);
    expect(steps).toEqual([
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    controller.cancel();
  });

  it('recomputes current post-scroll geometry after every successful bounded step', () => {
    const clock = new FakeAutoscrollClock();
    const calls: string[] = [];
    const controller = createKanbanDragAutoscrollController({
      scheduler: clock.scheduler,
      scroll: (step, generation) => {
        calls.push(`scroll:${step.x},${step.y}:${generation}`);
        return step;
      },
      recompute: (generation) => calls.push(`recompute:${generation}`),
    });
    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 7 });

    clock.tick();

    expect(calls).toEqual(['scroll:2,0:7', 'recompute:7']);
  });

  it('stops an axis after clamping and cancels synchronously on pointer leave', () => {
    const clock = new FakeAutoscrollClock();
    const scroll = vi.fn(() => ({ x: 0, y: 0 }));
    const recompute = vi.fn();
    const controller = createKanbanDragAutoscrollController({ scheduler: clock.scheduler, scroll, recompute });
    controller.update({ point: { x: 19, y: 6 }, viewport: VIEWPORT, generation: 9 });

    clock.tick();
    expect(scroll).toHaveBeenCalledOnce();
    expect(recompute).not.toHaveBeenCalled();
    expect(clock.pending()).toBe(0);

    controller.update({ point: { x: 10, y: 6 }, viewport: VIEWPORT, generation: 9 });
    expect(clock.pending()).toBe(0);
    controller.cancel();
    controller.cancel();
    expect(clock.pending()).toBe(0);
  });
});
