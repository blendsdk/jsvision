import { Text } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanEditorControlBinding,
  createKanbanEditorSession,
  createStandardKanbanEditorAdapter,
} from '../src/index.js';
import type { KanbanSemanticValue, StandardCard } from '../src/index.js';

const CARD: StandardCard = Object.freeze({
  key: 'card-1',
  columnId: 'todo',
  title: 'Visible collections',
  status: 'Todo',
  assignees: Object.freeze([{ id: 'ada', label: 'Ada Lovelace' }]),
  labels: Object.freeze([{ id: 'release', label: 'Release blocker' }]),
  checklists: Object.freeze([
    Object.freeze({
      checklistId: 'delivery',
      title: 'Delivery',
      items: Object.freeze([
        Object.freeze({ itemId: 'design', text: 'Design', completed: false }),
        Object.freeze({ itemId: 'verify', text: 'Verify', completed: false }),
      ]),
    }),
  ]),
});

/** Reads a semantic checklist array as ordinary JSON-safe test evidence. */
function checklistValue(value: KanbanSemanticValue | undefined): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Sends one focused-key envelope directly to the isolated custom control. */
function key(view: { onEvent(event: DispatchEvent): void }, value: string, ctrl = false): void {
  view.onEvent({
    event: { type: 'key', key: value, ctrl, alt: false, shift: false },
    handled: false,
  });
}

/** Creates one standard editor session over the deterministic card fixture. */
async function session() {
  const adapter = createStandardKanbanEditorAdapter({ fields: ['assignees', 'labels', 'checklists'] });
  const editor = await createKanbanEditorSession({
    mode: 'edit',
    cardKey: CARD.key,
    adapter,
    resolver: {
      resolve: async () => ({ kind: 'record', card: CARD, revision: 'r1' }),
      subscribe: () => () => undefined,
    },
    authority: { request: vi.fn() },
  });
  return { adapter, editor };
}

describe('standard Kanban collection controls', () => {
  it('should render assignee and label summaries from their live field contexts', async () => {
    const { adapter, editor } = await session();
    const assignees = adapter.schema.field('assignees');
    const labels = adapter.schema.field('labels');
    if (assignees === undefined || labels === undefined) throw new Error('Expected standard collection fields.');

    const assigneeBinding = createKanbanEditorControlBinding({
      field: assignees,
      session: editor,
      controls: adapter.schema.controls,
    });
    const labelBinding = createKanbanEditorControlBinding({
      field: labels,
      session: editor,
      controls: adapter.schema.controls,
    });

    expect(assigneeBinding.view).toBeInstanceOf(Text);
    expect(labelBinding.view).toBeInstanceOf(Text);
    expect(assigneeBinding.measure(40).preferredWidth).toBeGreaterThanOrEqual(12);
    expect(labelBinding.measure(40).preferredWidth).toBeGreaterThan(12);
    assigneeBinding.dispose();
    labelBinding.dispose();
    editor.dispose();
  });

  it('should toggle, reorder, edit, delete, and add checklist items without replacing surviving identities', async () => {
    const { adapter, editor } = await session();
    const field = adapter.schema.field('checklists');
    if (field === undefined) throw new Error('Expected the standard checklist field.');
    expect(adapter.schema.controls?.controls.map((control) => control.controlId)).toContain(field.controlId);
    const binding = createKanbanEditorControlBinding({ field, session: editor, controls: adapter.schema.controls });
    expect(binding.diagnostics()).toEqual([]);
    expect(binding.view).not.toBeInstanceOf(Text);
    key(binding.view, ' ');
    key(binding.view, 'down', true);
    key(binding.view, 'enter');
    key(binding.view, '!');
    key(binding.view, 'enter');

    expect(checklistValue(editor.fieldValue('checklists'))).toEqual([
      {
        checklistId: 'delivery',
        title: 'Delivery',
        items: [
          { itemId: 'verify', text: 'Verify', completed: false },
          { itemId: 'design', text: 'Design!', completed: true },
        ],
      },
    ]);

    key(binding.view, 'delete');
    key(binding.view, 'insert');
    const value = checklistValue(editor.fieldValue('checklists'));
    expect(value).toMatchObject([
      {
        checklistId: 'delivery',
        items: [
          { itemId: 'verify', text: 'Verify', completed: false },
          { text: 'New item', completed: false },
        ],
      },
    ]);
    expect(JSON.stringify(value)).not.toContain('"itemId":"design"');
    binding.dispose();
    editor.dispose();
  });
});
