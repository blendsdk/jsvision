import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  KanbanBoard,
  createEagerKanbanDataSource,
  createKanbanViewController,
  createKanbanViewRegistry,
} from '../src/index.js';
import type { CardKey, KanbanCardPresentationAdapter, KanbanRequest } from '../src/index.js';

interface WorkItem {
  readonly id: CardKey;
  readonly columnId: 'ready';
  readonly title: string;
  readonly owner: string;
  readonly urgent: boolean;
  readonly priority: number;
  readonly tasks: readonly { readonly itemId: string; readonly text: string; readonly completed: boolean }[];
}

const COLUMN = Object.freeze({ columnId: 'ready', label: 'Ready', revision: 'ready-r1' });
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const applications: Application[] = [];

const CARD: KanbanCardPresentationAdapter<WorkItem> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
  fields: [
    { fieldId: 'owner', label: 'Owner', priority: 2, kind: 'text', valueOf: (card) => card.owner },
    { fieldId: 'priority', label: 'Priority', priority: 1, kind: 'number', valueOf: (card) => card.priority },
  ],
  summaries: [
    {
      summaryId: 'children',
      label: 'Children',
      priority: 1,
      valueOf: (card) => ({ count: card.tasks.length }),
    },
  ],
  checklistOf: (card) => [{ checklistId: 'tasks', title: 'Tasks', items: card.tasks }],
};

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
  vi.useRealTimers();
});

/** Creates one deterministic card fixture with three checklist rows. */
function item(replacement: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 1,
    columnId: 'ready',
    title: 'Release candidate',
    owner: 'me',
    urgent: true,
    priority: 1,
    tasks: [
      { itemId: 'one', text: 'First task', completed: true },
      { itemId: 'two', text: 'Second task', completed: false },
      { itemId: 'three', text: 'Third task', completed: false },
    ],
    ...replacement,
  };
}

/** Mounts one full board and tracks its application lifecycle. */
function mount(
  cards: readonly WorkItem[],
  controller: ReturnType<typeof createKanbanViewController>,
  options: Partial<ConstructorParameters<typeof KanbanBoard<WorkItem>>[0]> = {},
) {
  const source = createEagerKanbanDataSource(() => cards, {
    columns: () => [COLUMN],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
    search: (card, term) => card.title.toLocaleLowerCase('en-US').includes(term),
    filterFields: [
      {
        fieldId: 'owner',
        operators: [{ operatorId: 'app.equals', matches: (card, value) => card.owner === value }],
      },
      {
        fieldId: 'urgent',
        operators: [{ operatorId: 'app.equals', matches: (card, value) => card.urgent === value }],
      },
    ],
    sortFields: [
      {
        fieldId: 'priority',
        compare: (left, right) => (left.priority === right.priority ? 0 : left.priority < right.priority ? -1 : 1),
      },
    ],
  });
  const board = new KanbanBoard({ source, query: controller.query, card: CARD, view: { controller }, ...options });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 56, height: 22 }, caps: CAPS });
  application.loop.renderRoot.flush();
  applications.push(application);
  return { application, board };
}

/** Flattens all visible descriptor text for semantic presentation assertions. */
function descriptorText(board: KanbanBoard<WorkItem>): string {
  return (
    board
      .inspection()
      .visibleCards[0]?.descriptor.rows.flatMap((row) => row.spans.map((span) => span.text))
      .join(' ') ?? ''
  );
}

describe('Kanban Phase D view projection specification', () => {
  it('should apply two registered quick filters jointly in one committed query', () => {
    const registry = createKanbanViewRegistry({
      quickFilters: [
        {
          id: 'app.mine',
          labelId: 'app.filters.mine',
          filter: { fieldId: 'owner', operatorId: 'app.equals', value: 'me' },
        },
        {
          id: 'app.urgent',
          labelId: 'app.filters.urgent',
          filter: { fieldId: 'urgent', operatorId: 'app.equals', value: true },
        },
      ],
    });
    const controller = createKanbanViewController({ registry });
    const { application, board } = mount(
      [item(), item({ id: 2, owner: 'other' }), item({ id: 3, urgent: false })],
      controller,
    );

    const result = controller.apply({
      kind: 'set-quick-filters',
      quickFilters: [{ id: 'app.mine' }, { id: 'app.urgent' }],
    });
    application.loop.renderRoot.flush();

    expect(result.kind).toBe('changed');
    expect(controller.query().filters).toEqual([
      { fieldId: 'owner', operatorId: 'app.equals', value: 'me' },
      { fieldId: 'urgent', operatorId: 'app.equals', value: true },
    ]);
    expect(board.inspection().visibleCards.map(({ cardKey }) => cardKey)).toEqual([1]);
    controller.dispose();
  });

  it('should project controller fields summaries and checklist mode while preserving record presentation', () => {
    const controller = createKanbanViewController();
    const cardPresentation = vi.fn(() => ({
      selection: { fieldIds: ['owner'], summaryIds: [], checklistIds: ['tasks'] },
      visualState: {
        focused: false,
        selected: false,
        rangeAnchor: false,
        readOnly: true,
        invalid: false,
        operation: 'idle' as const,
      },
    }));
    const { application, board } = mount([item()], controller, {
      presentation: () => ({
        revision: 'legacy-presentation',
        cardRows: 18,
        cardGap: 1,
        metadataFields: 2,
        labelRows: 1,
        summarySections: 1,
        checklistMode: 'hidden',
        checklistPreviewItems: 0,
      }),
      cardPresentation,
    });

    controller.apply({
      kind: 'set-presentation',
      presentation: {
        density: 'spacious',
        cardFieldIds: ['priority'],
        summaryIds: ['children'],
        checklist: 'preview',
      },
    });
    application.loop.renderRoot.flush();
    const text = descriptorText(board);

    expect(cardPresentation).toHaveBeenCalled();
    expect(text).toContain('Priority');
    expect(text).not.toContain('Owner');
    expect(text).toContain('Children');
    expect(text).toContain('First task');
    expect(text).toContain('Second task');
    expect(text).not.toContain('Third task');
    expect(board.inspection().visibleCards[0]?.descriptor.marker.cues).toContain('read-only');
    controller.dispose();
  });

  it('should block a sorted within-cell programmatic move before application dispatch', async () => {
    const requests: KanbanRequest[] = [];
    const controller = createKanbanViewController();
    const { board } = mount([item(), item({ id: 2, priority: 2 })], controller, {
      dispatcher: (request) => {
        requests.push(request);
        return { kind: 'accepted', operationId: request.operationId };
      },
    });
    controller.apply({ kind: 'set-sort', sort: [{ fieldId: 'priority', direction: 'ascending' }] });

    const result = await board.interaction().moveCard?.({
      cardKey: 1,
      target: { columnId: 'ready' },
      direction: 'end',
    });

    expect(result).toMatchObject({ kind: 'cancelled', code: 'sorted-manual-order' });
    expect(requests).toEqual([]);
    controller.dispose();
  });

  it('should reject a move when application eligibility changes the committed ordering view', async () => {
    const requests: KanbanRequest[] = [];
    const controller = createKanbanViewController();
    const { board } = mount([item(), item({ id: 2, priority: 2 })], controller, {
      dispatcher: (request) => {
        requests.push(request);
        return { kind: 'accepted', operationId: request.operationId };
      },
      operationEligibility: () => {
        controller.apply({ kind: 'set-sort', sort: [{ fieldId: 'priority', direction: 'ascending' }] });
        return { kind: 'allowed' };
      },
    });

    const result = await board.interaction().moveCard?.({
      cardKey: 1,
      target: { columnId: 'ready' },
      direction: 'end',
    });

    expect(result).toMatchObject({ kind: 'cancelled', code: 'view-transition-stale' });
    expect(requests).toEqual([]);
    controller.dispose();
  });

  it('should expose new query count evidence inside the committed subscriber delivery', () => {
    vi.useFakeTimers();
    const controller = createKanbanViewController({ debounceMs: 150 });
    const { application } = mount([item(), item({ id: 2, title: 'Unrelated card' })], controller);
    const summaries: ReturnType<typeof controller.summary>[] = [];
    controller.subscribe(() => summaries.push(controller.summary()));

    controller.apply({ kind: 'set-search', search: 'release' });
    vi.advanceTimersByTime(150);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      total: { quality: 'exact', value: 2 },
      matching: { quality: 'exact', value: 1 },
      authoritativeResident: true,
    });
    application.loop.renderRoot.flush();
    controller.dispose();
  });
});
