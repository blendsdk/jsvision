import { describe, expect, it } from 'vitest';

import { KANBAN_LIMITS, createKanbanSwimlanePresentationResolver } from '../src/index.js';
import type { KanbanCustomSwimlanePresentation, ResolveKanbanSwimlanePresentationInput } from '../src/index.js';

/** Builds one valid custom descriptor that exposes the callback's current width. */
function customPresentation(calls: number[]): KanbanCustomSwimlanePresentation {
  return {
    kind: 'custom',
    revision: 'custom-v1',
    render: (context) => {
      calls.push(context.availableWidth);
      return {
        rows: 1,
        railWidth: 0,
        text: [String(context.availableWidth)],
        roles: ['swimlane.header'],
        regions: [],
        actions: [],
      };
    },
  };
}

/** Builds one complete resolver input with focused geometry overrides. */
function input(
  presentation: KanbanCustomSwimlanePresentation,
  replacement: Partial<ResolveKanbanSwimlanePresentationInput> = {},
): ResolveKanbanSwimlanePresentationInput {
  return {
    presentation,
    swimlane: { swimlaneId: 'alpha', label: 'Alpha', revision: 1 },
    availableWidth: 80,
    columns: [{ columnId: 'ready', minimumWidth: 18 }],
    ...replacement,
  };
}

describe('custom swimlane presentation cache', () => {
  it('reuses only a semantically and geometrically identical normalized input', () => {
    const calls: number[] = [];
    const presentation = customPresentation(calls);
    const resolver = createKanbanSwimlanePresentationResolver();
    const first = resolver.resolve(input(presentation));
    const repeated = resolver.resolve(input(presentation));

    expect(repeated).toBe(first);
    expect(calls).toEqual([80]);
  });

  it('recomputes custom output after width and visible-column constraints change', () => {
    const calls: number[] = [];
    const presentation = customPresentation(calls);
    const resolver = createKanbanSwimlanePresentationResolver();
    const wide = resolver.resolve(input(presentation));
    const narrow = resolver.resolve(input(presentation, { availableWidth: 40 }));
    const twoColumns = resolver.resolve(
      input(presentation, {
        columns: [
          { columnId: 'ready', minimumWidth: 18 },
          { columnId: 'doing', minimumWidth: 18 },
        ],
      }),
    );

    expect(calls).toEqual([80, 40, 80]);
    expect(wide.columns).toEqual([{ columnId: 'ready', availableWidth: 80 }]);
    expect(narrow.columns).toEqual([{ columnId: 'ready', availableWidth: 40 }]);
    expect(twoColumns.columns).toEqual([
      { columnId: 'ready', availableWidth: 40 },
      { columnId: 'doing', availableWidth: 40 },
    ]);
    expect((narrow.chrome.kind === 'custom' && narrow.chrome.descriptor.text) || []).toEqual(['40']);
  });

  it('evicts the oldest custom result at the central retained-descriptor safe ceiling', () => {
    const calls: number[] = [];
    const presentation = customPresentation(calls);
    const resolver = createKanbanSwimlanePresentationResolver();
    resolver.resolve(input(presentation, { swimlane: { swimlaneId: 'alpha', label: 'Alpha', revision: 0 } }));

    for (let revision = 1; revision <= KANBAN_LIMITS.retainedDescriptors.safe; revision += 1) {
      resolver.resolve(input(presentation, { swimlane: { swimlaneId: 'alpha', label: 'Alpha', revision } }));
    }
    resolver.resolve(input(presentation, { swimlane: { swimlaneId: 'alpha', label: 'Alpha', revision: 0 } }));

    expect(calls).toHaveLength(KANBAN_LIMITS.retainedDescriptors.safe + 2);
  });
});
