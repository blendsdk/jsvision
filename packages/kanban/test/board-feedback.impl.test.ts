import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type { KanbanCardPresentationAdapter, KanbanQuery } from '../src/index.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly owner: string;
  readonly tasks: readonly { readonly itemId: string; readonly text: string; readonly completed: boolean }[];
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardPresentationAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
  fields: [{ fieldId: 'owner', label: 'Owner', priority: 1, kind: 'text', valueOf: (card) => card.owner }],
  checklistOf: (card) => [{ checklistId: 'tasks', title: 'Tasks', items: card.tasks }],
};

/** Mounts one board and flushes its first complete controller-backed projection. */
function mount(board: KanbanBoard<Card>, width = 80, height = 12) {
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Creates one eager board with a complete focused-detail fixture. */
function board(limits?: ConstructorParameters<typeof KanbanBoard<Card>>[0]['limits']): KanbanBoard<Card> {
  const cards = Object.freeze([
    {
      id: 1,
      columnId: 'ready',
      title: 'Focused card',
      owner: 'Owner\u001b[31m',
      tasks: Object.freeze([{ itemId: 'one', text: 'First\nitem', completed: false }]),
    },
  ]);
  const source = createEagerKanbanDataSource(() => cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  return new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    structure: () => ({
      revision: 1,
      columns: [
        {
          columnId: 'ready',
          definitionOfDone: { summary: 'Reviewed', details: 'Reviewed by owner' },
        },
      ],
    }),
    ...(limits === undefined ? {} : { limits }),
  });
}

describe('board interaction projection implementation', () => {
  it('projects controller cues and complete bounded focused details without retaining unsafe text', async () => {
    const value = board();
    const render = mount(value);
    const initial = value.inspection();

    expect(initial.interaction.focused).toMatchObject({ kind: 'card', cardKey: 1 });
    expect(initial.focusedDetail).toMatchObject({
      title: 'Focused card',
      status: 'Ready',
      definitionOfDone: 'Reviewed by owner',
      fields: [{ fieldId: 'owner', label: 'Owner' }],
      checklists: [{ checklistId: 'tasks', items: [{ itemId: 'one', text: 'First item', completed: false }] }],
    });
    expect(JSON.stringify(initial.focusedDetail)).not.toContain('\u001b');
    expect(initial.visibleCards[0]?.marker.cues).toContain('focused');
    expect(Object.isFrozen(initial.focusedDetail)).toBe(true);

    await value.interaction().transition({ kind: 'selection', operation: 'toggle' });
    render.flush();
    const selected = value.inspection();
    expect(selected.interaction).toMatchObject({ selectedCardKeys: [1], selectedCount: 1, selectionScope: 'loaded' });
    expect(selected.visibleCards[0]?.marker.cues).toEqual(expect.arrayContaining(['focused', 'selected']));
    expect(selected.focusedDetail.selection).toEqual({ loadedCount: 1, scope: 'loaded' });
    render.unmount();
  });

  it('uses one conditional row for feedback without reserving permanent board chrome', async () => {
    const value = board({ values: { selectedKeys: 0 } });
    const render = mount(value);
    expect(value.inspection().viewportRect.height).toBe(12);

    await value.interaction().transition({ kind: 'selection', operation: 'toggle' });
    render.flush();
    const feedback = value.inspection();
    expect(feedback.interaction.feedback).toMatchObject({ code: 'selection-limit-exceeded' });
    expect(feedback.viewportRect.height).toBe(11);
    expect(feedback.navigator.visible).toBe(false);
    render.unmount();
  });
});
