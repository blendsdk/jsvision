import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanInvalidViewRegistryError } from '../src/contract/error.js';
import { createKanbanExtensionId } from '../src/contract/identity.js';
import { KANBAN_LIMITS } from '../src/contract/limits.js';
import { attachKanbanViewProjectionParticipant, createKanbanViewController } from '../src/view/controller.js';
import { createKanbanViewRegistry } from '../src/view/registry.js';
import { createKanbanViewScheduler } from '../src/view/scheduler.js';
import { createUnboundKanbanViewSummary } from '../src/view/summary.js';
import type { KanbanViewTransitionResult } from '../src/view/types.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('Kanban view-state implementation boundaries', () => {
  it('should accept inclusive debounce boundaries and reject values outside them', () => {
    expect(() => createKanbanViewScheduler(0)).not.toThrow();
    expect(() => createKanbanViewScheduler(60_000)).not.toThrow();
    expect(() => createKanbanViewScheduler(-1)).toThrow(RangeError);
    expect(() => createKanbanViewScheduler(60_001)).toThrow(RangeError);
    expect(() => createKanbanViewScheduler(1.5)).toThrow(RangeError);
  });

  it('should retain one timer when scheduling many replacement generations', () => {
    vi.useFakeTimers();
    const scheduler = createKanbanViewScheduler(150);
    const callbacks = Array.from({ length: 100 }, () => vi.fn());

    for (const callback of callbacks) scheduler.schedule(callback);

    expect(vi.getTimerCount()).toBe(1);
    expect(scheduler.pending()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(callbacks.slice(0, -1).every((callback) => callback.mock.calls.length === 0)).toBe(true);
    expect(callbacks.at(-1)).toHaveBeenCalledOnce();
    expect(scheduler.pending()).toBe(false);
    scheduler.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should release pending timer ownership when canceled or disposed', () => {
    vi.useFakeTimers();
    const scheduler = createKanbanViewScheduler(150);
    const callback = vi.fn();

    scheduler.schedule(callback);
    scheduler.cancel();
    scheduler.cancel();
    vi.advanceTimersByTime(150);

    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    scheduler.dispose();
    scheduler.dispose();
    expect(() => scheduler.schedule(callback)).toThrow(RangeError);
  });

  it('should accept the exact quick-filter capacity and reject one additional registration', () => {
    const registrations = Array.from({ length: KANBAN_LIMITS.cardFields.safe }, (_, index) => ({
      id: createKanbanExtensionId(`app.filter-${index}`),
      labelId: `app.filters.filter-${index}`,
      predicate: () => true,
    }));

    const registry = createKanbanViewRegistry({ quickFilters: registrations });

    expect(registry.quickFilters).toHaveLength(KANBAN_LIMITS.cardFields.safe);
    expect(registry.quickFilter(registrations.at(-1)!.id)).toBe(registry.quickFilters.at(-1));
    expect(() =>
      createKanbanViewRegistry({
        quickFilters: [
          ...registrations,
          {
            id: createKanbanExtensionId('app.filter-overflow'),
            labelId: 'app.filters.overflow',
            predicate: () => true,
          },
        ],
      }),
    ).toThrow(KanbanInvalidViewRegistryError);
  });

  it('should detach registry structure without invoking registered behavior', () => {
    const predicate = vi.fn(() => true);
    const applicable = vi.fn(() => true);
    const registration = {
      id: createKanbanExtensionId('app.mine'),
      labelId: 'app.filters.mine',
      predicate,
      applicable,
    };
    const input = [registration];

    const registry = createKanbanViewRegistry({ quickFilters: input });
    input.length = 0;

    expect(registry.quickFilters).toHaveLength(1);
    expect(Object.isFrozen(registry.quickFilters)).toBe(true);
    expect(Object.isFrozen(registry.quickFilters[0])).toBe(true);
    expect(predicate).not.toHaveBeenCalled();
    expect(applicable).not.toHaveBeenCalled();
  });

  it('should isolate duplicate subscribers and release them without retained delivery', () => {
    const controller = createKanbanViewController();
    const subscriber = vi.fn();
    const unsubscribeFirst = controller.subscribe(subscriber);
    const unsubscribeSecond = controller.subscribe(subscriber);

    controller.apply({ kind: 'set-density', density: 'compact' });
    expect(subscriber).toHaveBeenCalledOnce();

    unsubscribeFirst();
    unsubscribeSecond();
    controller.apply({ kind: 'set-density', density: 'spacious' });
    expect(subscriber).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it('should reject nested transitions while one participant commit is active', () => {
    const controller = createKanbanViewController();
    const order: string[] = [];
    let nested: KanbanViewTransitionResult | undefined;
    const detach = attachKanbanViewProjectionParticipant(controller, {
      prepare: () => ({
        commit: () => {
          order.push('commit');
          nested = controller.apply({ kind: 'set-density', density: 'spacious' });
        },
        verify: () => true,
        rollback: () => order.push('rollback'),
        abort: () => order.push('abort'),
        retire: () => order.push('retire'),
      }),
      summary: createUnboundKanbanViewSummary,
    });
    controller.subscribe(() => order.push('subscriber'));

    const result = controller.apply({ kind: 'set-density', density: 'compact' });

    expect(result.kind).toBe('changed');
    expect(nested).toEqual({ kind: 'unavailable', code: 'view-transition-active' });
    expect(order).toEqual(['commit', 'retire', 'subscriber']);
    expect(controller.state().presentation.density).toBe('compact');
    detach();
    controller.dispose();
  });

  it('should enforce one exclusive participant lease and release only its exact owner', () => {
    const controller = createKanbanViewController();
    const participant = {
      prepare: () => ({
        commit: () => undefined,
        verify: () => true,
        rollback: () => undefined,
        abort: () => undefined,
        retire: () => undefined,
      }),
      summary: createUnboundKanbanViewSummary,
    };
    const detach = attachKanbanViewProjectionParticipant(controller, participant);

    expect(() => attachKanbanViewProjectionParticipant(controller, participant)).toThrow(TypeError);
    detach();
    detach();
    const nextDetach = attachKanbanViewProjectionParticipant(controller, participant);
    nextDetach();
    controller.dispose();
  });
});
