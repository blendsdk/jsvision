import { describe, expect, it } from 'vitest';

import {
  KANBAN_TIMING_DEFAULTS,
  KanbanDisposedResourceError,
  createKanbanCollapsedHoverController,
} from '../src/index.js';
import type { KanbanCollapsedHoverScheduler } from '../src/index.js';

interface ScheduledTask {
  readonly handle: number;
  readonly dueAt: number;
  readonly callback: () => void;
  cancelled: boolean;
}

/** Deterministic scheduler that can also replay cancelled callbacks to test generation guards. */
class FakeHoverClock implements KanbanCollapsedHoverScheduler {
  #now = 0;
  #nextHandle = 0;
  readonly tasks: ScheduledTask[] = [];
  cancelShouldThrow = false;

  /** Records one task against the current virtual time. */
  schedule(callback: () => void, delayMs: number): number {
    const task: ScheduledTask = {
      handle: ++this.#nextHandle,
      dueAt: this.#now + delayMs,
      callback,
      cancelled: false,
    };
    this.tasks.push(task);
    return task.handle;
  }

  /** Marks a known task cancelled and optionally simulates a hostile host hook. */
  cancel(handle: unknown): void {
    const task = this.tasks.find((candidate) => candidate.handle === handle);
    if (task !== undefined) task.cancelled = true;
    if (this.cancelShouldThrow) throw new Error('timer-cancel-secret');
  }

  /** Advances virtual time and runs due non-cancelled callbacks in scheduling order. */
  advance(milliseconds: number): void {
    this.#now += milliseconds;
    for (const task of this.tasks) {
      if (!task.cancelled && task.dueAt <= this.#now) {
        task.cancelled = true;
        task.callback();
      }
    }
  }

  /** Replays one callback even if cancellation claimed success. */
  replay(handle: number): void {
    const task = this.tasks.find((candidate) => candidate.handle === handle);
    if (task === undefined) throw new Error(`Unknown fake timer handle: ${handle}`);
    task.callback();
  }
}

/** Creates one ordinary visible collapsed target. */
function target(swimlaneId: string) {
  return { swimlaneId, visible: true, collapsed: true } as const;
}

describe('collapsed swimlane hover timing', () => {
  it('expands only after the complete central 500 ms delay', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });

    expect(hover.begin(target('alpha'))).toBe(true);
    expect(clock.tasks[0]?.dueAt).toBe(KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs);
    clock.advance(KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs - 1);
    expect(hover.snapshot()).toEqual({ kind: 'waiting', swimlaneId: 'alpha' });
    clock.advance(1);
    expect(hover.snapshot()).toEqual({ kind: 'expanded', swimlaneId: 'alpha', temporary: true });
  });

  it('replaces the active lease and ignores a replayed stale generation', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    hover.begin(target('alpha'));
    const staleHandle = clock.tasks[0]!.handle;

    hover.begin(target('beta'));
    clock.replay(staleHandle);

    expect(clock.tasks[0]?.cancelled).toBe(true);
    expect(hover.snapshot()).toEqual({ kind: 'waiting', swimlaneId: 'beta' });
    clock.advance(KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs);
    expect(hover.snapshot()).toEqual({ kind: 'expanded', swimlaneId: 'beta', temporary: true });
  });

  it('keeps the lease when leaving another swimlane and restores it when leaving the owner', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    hover.begin(target('alpha'));
    clock.advance(KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs);

    hover.leave('beta');
    expect(hover.snapshot().kind).toBe('expanded');
    hover.leave('alpha');
    expect(hover.snapshot()).toEqual({ kind: 'idle' });
  });

  it.each([
    { swimlaneId: 'hidden', visible: false, collapsed: true },
    { swimlaneId: 'expanded', visible: true, collapsed: false },
    { swimlaneId: '\u001b[31m', visible: true, collapsed: true },
  ])('rejects a non-eligible target %# and cancels the previous lease', (ineligible) => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    hover.begin(target('alpha'));

    expect(hover.begin(ineligible)).toBe(false);
    expect(hover.snapshot()).toEqual({ kind: 'idle' });
    expect(clock.tasks[0]?.cancelled).toBe(true);
  });

  it('keeps cancelled callbacks inert even when the scheduler cancellation hook throws', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    hover.begin(target('alpha'));
    const handle = clock.tasks[0]!.handle;
    clock.cancelShouldThrow = true;

    expect(() => hover.cancel()).not.toThrow();
    clock.replay(handle);

    expect(hover.snapshot()).toEqual({ kind: 'idle' });
  });

  it('cancels pending work and rejects state-changing operations after disposal', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    hover.begin(target('alpha'));
    const handle = clock.tasks[0]!.handle;

    hover.dispose();
    hover.dispose();
    clock.replay(handle);

    expect(hover.snapshot()).toEqual({ kind: 'disposed' });
    expect(clock.tasks[0]?.cancelled).toBe(true);
    expect(() => hover.begin(target('beta'))).toThrow(KanbanDisposedResourceError);
    expect(() => hover.leave('alpha')).toThrow(KanbanDisposedResourceError);
    expect(() => hover.cancel()).toThrow(KanbanDisposedResourceError);
  });

  it('returns frozen observable snapshots for every lease state', () => {
    const clock = new FakeHoverClock();
    const hover = createKanbanCollapsedHoverController({ scheduler: clock });
    const states = [hover.snapshot()];
    hover.begin(target('alpha'));
    states.push(hover.snapshot());
    clock.advance(KANBAN_TIMING_DEFAULTS.collapsedSwimlaneHoverMs);
    states.push(hover.snapshot());
    hover.cancel();
    states.push(hover.snapshot());
    hover.dispose();
    states.push(hover.snapshot());

    expect(states.every(Object.isFrozen)).toBe(true);
  });
});
