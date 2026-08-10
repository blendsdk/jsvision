import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { DispatchEvent, View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
  KanbanBoard,
  KanbanViewport,
  createEagerKanbanDataSource,
  createEnglishKanbanI18n,
} from '../src/index.js';
import type { KanbanCardAdapter, KanbanInteractionController, KanbanQuery } from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Creates one small eager source for mount-boundary tests. */
function eagerSource() {
  return createEagerKanbanDataSource(() => [{ id: 1, columnId: 'ready', title: 'Card' }], {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
}

/** Mounts one responsive view and flushes its first complete projection. */
function mount(view: View) {
  view.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(view);
  const render = createRenderRoot({ width: 40, height: 12 }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Delivers one local key and returns the framework handled envelope. */
function key(viewport: KanbanViewport<Card>, value: string): DispatchEvent {
  const event: DispatchEvent = {
    event: { type: 'key', key: value, ctrl: false, alt: false, shift: false },
    handled: false,
  };
  viewport.onEvent(event);
  return event;
}

/** Builds a complete controller with overridable subscription and disposal seams. */
function controller(
  options: {
    readonly subscribe?: (invalidate: () => void) => () => void;
    readonly dispose?: () => void;
  } = {},
): KanbanInteractionController {
  return {
    snapshot: () => KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
    transition: () => ({ kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT }),
    subscribe: options.subscribe ?? (() => () => undefined),
    dispose: options.dispose ?? (() => undefined),
  };
}

describe('Phase B mounted lifecycle implementation', () => {
  it('keeps a standalone mirror read-only when supplied with a board facade', () => {
    const owner = new KanbanBoard({
      source: eagerSource(),
      query: () => QUERY,
      card: CARD,
    });
    const viewport = new KanbanViewport({
      source: eagerSource(),
      query: () => QUERY,
      card: CARD,
      interaction: owner.interaction(),
    });

    expect(key(viewport, 'down').handled).toBe(false);
    const render = mount(viewport);
    const before = owner.interaction().snapshot();
    expect(key(viewport, 'down').handled).toBe(false);
    expect(owner.interaction().snapshot()).toEqual(before);

    render.unmount();
    expect(key(viewport, 'down').handled).toBe(false);
  });

  it('rolls back a failed controller subscription and leaves no reusable mount resources', () => {
    const dispose = vi.fn();
    const board = new KanbanBoard({
      source: eagerSource(),
      query: () => QUERY,
      card: CARD,
      interactionFactory: () =>
        controller({
          subscribe: () => {
            throw new Error('subscription-secret');
          },
          dispose,
        }),
    });
    const render = mount(board);

    expect(board.interaction().snapshot()).toEqual(KANBAN_NEUTRAL_INTERACTION_SNAPSHOT);
    expect(key(board.viewport, 'down').handled).toBe(false);
    expect(dispose).toHaveBeenCalledOnce();
    render.unmount();
    expect(() => render.mount(board)).toThrow();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('aborts pending source work and releases every cursor and session exactly once', () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 1_000,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const board = new KanbanBoard({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mount(board);
    expect(fixture.controller.pendingRanges().length).toBeGreaterThan(0);

    board.dispose();
    board.dispose();
    const metrics = fixture.metrics();
    expect(metrics.abortedRequests).toBeGreaterThan(0);
    expect(metrics.disposedSessions).toBe(1);
    expect(metrics.disposedCursors).toBe(metrics.createdCursors);
    expect(fixture.controller.pendingRanges()).toEqual([]);
    expect(key(board.viewport, 'down').handled).toBe(false);

    render.unmount();
    fixture.dispose();
  });

  it('reacts to presentation, structure, and locale replacements without remounting the source', () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 20,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const density = signal<'comfortable' | 'compact'>('comfortable');
    const structure = signal({ revision: 1, columns: [] });
    const i18n = signal(createEnglishKanbanI18n());
    const board = new KanbanBoard({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      density,
      structure,
      i18n,
    });
    const render = mount(board);
    const before = fixture.metrics();

    density.set('compact');
    structure.set({ revision: 2, columns: [] });
    i18n.set(createEnglishKanbanI18n());
    render.flush();
    render.flush();
    const after = fixture.metrics();

    expect(before.openedSessions).toBe(1);
    expect(after.openedSessions).toBe(1);
    expect(after.createdCursors).toBe(before.createdCursors);
    expect(board.inspection().layoutReflows).toBeGreaterThan(0);

    render.unmount();
    fixture.dispose();
  });
});
