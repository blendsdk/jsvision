/** Implementation coverage for structural sibling resolution and capture cleanup. */
import type { PointerCaptureLease } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanStructuralDragController } from '../src/interaction/structural-drag.js';
import type { KanbanStructuralDragScene } from '../src/interaction/structural-drag.js';
import type { KanbanPointerStructureDragStart } from '../src/interaction/pointer-router.js';

/** Creates one controllable active capture lease. */
function capture(): PointerCaptureLease {
  let active = true;
  return Object.freeze({
    generation: 1,
    active: () => active,
    release: () => {
      active = false;
    },
  });
}

/** Creates complete column and explicit-swimlane sibling geometry. */
function scene(explicitSwimlanes = true): KanbanStructuralDragScene {
  return Object.freeze({
    sceneRevision: 'scene-r1',
    geometryGeneration: 1,
    viewport: Object.freeze({ x: 0, y: 3, width: 60, height: 15 }),
    columnOrder: Object.freeze(['ready', 'doing', 'done']),
    columns: Object.freeze([
      Object.freeze({ id: 'ready', x: 0, y: 1, width: 20, height: 1 }),
      Object.freeze({ id: 'doing', x: 20, y: 1, width: 20, height: 1 }),
      Object.freeze({ id: 'done', x: 40, y: 1, width: 20, height: 1 }),
    ]),
    ...(explicitSwimlanes ? { swimlaneOrder: Object.freeze(['alpha', 'beta']) } : {}),
    swimlanes: Object.freeze([
      Object.freeze({ id: 'alpha', x: 0, y: 4, width: 60, height: 1 }),
      Object.freeze({ id: 'beta', x: 0, y: 10, width: 60, height: 1 }),
    ]),
  });
}

/** Creates one complete threshold-crossing structural handoff. */
function start(
  lease: PointerCaptureLease,
  structure: KanbanPointerStructureDragStart['structure'],
): KanbanPointerStructureDragStart {
  const target =
    structure.kind === 'column'
      ? Object.freeze({
          kind: 'workflow-header' as const,
          scope: Object.freeze({ kind: 'column' as const, columnId: structure.columnId }),
          columnId: structure.columnId,
          reorder: 'allowed' as const,
          x: 20,
          y: 1,
          width: 20,
          height: 1,
          zIndex: 300,
        })
      : Object.freeze({
          kind: 'swimlane-header' as const,
          scope: Object.freeze({ kind: 'swimlane' as const, swimlaneId: structure.swimlaneId }),
          swimlaneId: structure.swimlaneId,
          reorder: 'allowed' as const,
          x: 0,
          y: 4,
          width: 60,
          height: 1,
          zIndex: 300,
        });
  return Object.freeze({
    target,
    sceneRevision: 'scene-r1',
    priorSelection: Object.freeze({ entries: Object.freeze([]), sessionRevision: 1, queryGeneration: 1 }),
    ctrl: false,
    shift: false,
    alt: false,
    clickCount: 1,
    generation: 1,
    originPoint: Object.freeze({ x: target.x + 1, y: target.y }),
    point: Object.freeze({ x: target.x + 2, y: target.y }),
    capture: lease,
    structure,
    cues: Object.freeze({
      ghost: 'bounded-header',
      placeholder: 'source-slot',
      marker: 'sibling-insertion',
    }),
  });
}

describe('structural drag controller', () => {
  it('resolves a column sibling slot and dispatches exactly once on release', () => {
    const lease = capture();
    const commit = vi.fn(() => true);
    const controller = new KanbanStructuralDragController({
      readScene: () => scene(),
      commitProposal: commit,
      scroll: () => Object.freeze({ x: 0, y: 0 }),
      invalidate: () => undefined,
    });

    expect(controller.begin(start(lease, { kind: 'column', columnId: 'doing' }))).toBe(true);
    expect(controller.update(1, { x: 59, y: 1 })).toBe(true);
    expect(controller.snapshot()).toMatchObject({
      kind: 'dragging',
      overlay: { structure: { kind: 'column', columnId: 'doing' }, markerRect: { x: 59, width: 1 } },
    });
    expect(controller.release(1)).toBe(true);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith({
      kind: 'column-reorder',
      columnId: 'doing',
      position: { kind: 'end' },
    });
    expect(lease.active()).toBe(false);
    expect(controller.release(1)).toBe(false);
  });

  it('rejects derived swimlanes and cancels explicit swimlanes without dispatch', () => {
    const derived = new KanbanStructuralDragController({
      readScene: () => scene(false),
      commitProposal: () => true,
      scroll: () => Object.freeze({ x: 0, y: 0 }),
      invalidate: () => undefined,
    });
    expect(derived.begin(start(capture(), { kind: 'swimlane', swimlaneId: 'alpha' }))).toBe(false);

    const lease = capture();
    const commit = vi.fn(() => true);
    const explicit = new KanbanStructuralDragController({
      readScene: () => scene(),
      commitProposal: commit,
      scroll: () => Object.freeze({ x: 0, y: 0 }),
      invalidate: () => undefined,
    });
    expect(explicit.begin(start(lease, { kind: 'swimlane', swimlaneId: 'alpha' }))).toBe(true);
    expect(explicit.cancel(1, 'escape')).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    expect(lease.active()).toBe(false);
  });
});
