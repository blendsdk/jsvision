import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  KanbanBoard,
  KanbanInvalidViewRegistryError,
  createEagerKanbanDataSource,
  createKanbanViewController,
  createKanbanViewRegistry,
} from '../../src/index.js';
import type { KanbanCardAdapter, KanbanObservation } from '../../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: 'ready';
  readonly title: string;
}

const CARD: KanbanCardAdapter<WorkItem> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const COLUMN = Object.freeze({ columnId: 'ready', label: 'Ready', revision: 'ready-r1' });
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
  vi.useRealTimers();
});

/** Mounts one board using a controller-owned query and returns rendered evidence. */
function mount(
  source: ReturnType<typeof createEagerKanbanDataSource<WorkItem>>,
  controller: ReturnType<typeof createKanbanViewController>,
  observe?: (observation: KanbanObservation) => void,
) {
  const board = new KanbanBoard({
    source,
    query: controller.query,
    card: CARD,
    view: { controller },
    ...(observe === undefined ? {} : { observe }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
  application.loop.renderRoot.flush();
  applications.push(application);
  return { application, board };
}

describe('Kanban view input security specification', () => {
  it('rejects an unsafe registry identity without invoking its evaluator or accessor', () => {
    expect(createKanbanViewRegistry).toBeTypeOf('function');
    expect(KanbanInvalidViewRegistryError).toBeTypeOf('function');
    const evaluator = vi.fn((value: unknown) => String(value));
    const hostile = {
      id: 'app.hostile',
      filter: { fieldId: 'owner', operatorId: 'app.equals', value: 'me' },
      get labelId(): string {
        throw new Error('classified-registry-accessor');
      },
    };

    expect(() =>
      createKanbanViewRegistry({
        quickFilters: [
          {
            id: '../unsafe',
            labelId: 'kanban.filter.unsafe',
            filter: { fieldId: 'owner', operatorId: 'app.equals', value: 'me' },
            parameterCodec: { snapshot: evaluator },
          },
          hostile,
        ],
      }),
    ).toThrowError(KanbanInvalidViewRegistryError);
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('aborts a throwing candidate query before any public state or session becomes visible', () => {
    vi.useFakeTimers();
    const card: WorkItem = { id: 1, columnId: 'ready', title: 'Safe resident card' };
    const source = createEagerKanbanDataSource(() => [card], {
      columns: () => [COLUMN],
      keyOf: (item) => item.id,
      columnOf: (item) => item.columnId,
      search: (_item, term) => {
        if (term.length > 0) throw new Error(`classified-evaluator:${term}`);
        return true;
      },
    });
    const controller = createKanbanViewController({ debounceMs: 150 });
    const publications = vi.fn();
    controller.subscribe(publications);
    const observations: KanbanObservation[] = [];
    const { application, board } = mount(source, controller, (observation) => observations.push(observation));
    const beforeState = controller.state();
    const beforeQuery = controller.query();
    const beforeCards = board.inspection().visibleCards.map(({ cardKey }) => cardKey);

    controller.apply({ kind: 'set-search', search: 'classified-secret' });
    vi.advanceTimersByTime(150);
    application.loop.renderRoot.flush();

    expect(controller.state()).toBe(beforeState);
    expect(controller.query()).toBe(beforeQuery);
    expect(publications).not.toHaveBeenCalled();
    expect(board.inspection().visibleCards.map(({ cardKey }) => cardKey)).toEqual(beforeCards);
    expect(JSON.stringify(observations)).not.toContain('classified');
    expect(observations).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'query-open-failed' })]));
    controller.dispose();
  });

  it('contains source-evaluator reentrancy throughout candidate preparation', () => {
    vi.useFakeTimers();
    const card: WorkItem = { id: 1, columnId: 'ready', title: 'Safe resident card' };
    const owner: { controller?: ReturnType<typeof createKanbanViewController> } = {};
    let nested: ReturnType<ReturnType<typeof createKanbanViewController>['apply']> | undefined;
    const source = createEagerKanbanDataSource(() => [card], {
      columns: () => [COLUMN],
      keyOf: (item) => item.id,
      columnOf: (item) => item.columnId,
      search: (_item, term) => {
        if (term.length > 0) nested = owner.controller?.apply({ kind: 'set-density', density: 'compact' });
        return true;
      },
    });
    const controller = createKanbanViewController({ debounceMs: 150 });
    owner.controller = controller;
    mount(source, controller);

    controller.apply({ kind: 'set-search', search: 'release' });
    vi.advanceTimersByTime(150);

    expect(nested).toEqual({ kind: 'unavailable', code: 'view-transition-active' });
    expect(controller.state().search).toBe('release');
    expect(controller.state().presentation.density).toBe('comfortable');
    controller.dispose();
  });

  it('rejects an unknown comparator candidate without changing the committed revision', () => {
    const source = createEagerKanbanDataSource<WorkItem>(() => [], {
      columns: () => [COLUMN],
      keyOf: (item) => item.id,
      columnOf: (item) => item.columnId,
      sortFields: [{ fieldId: 'title', compare: () => 0 }],
    });
    const controller = createKanbanViewController();
    const { board } = mount(source, controller);
    const before = controller.state();

    const result = controller.apply({
      kind: 'set-sort',
      sort: [{ fieldId: 'title', comparatorId: 'app.missing', direction: 'ascending' }],
    });

    expect(result.kind).toBe('rejected');
    expect(result.code).toBe('unknown-comparator');
    expect(controller.state()).toBe(before);
    expect(board.inspection().visibleCards).toEqual([]);
    controller.dispose();
  });
});
