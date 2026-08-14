import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import {
  KANBAN_LIMITS,
  KanbanInvalidEditorSchemaError,
  createKanbanCardEditorSchema,
  createKanbanEditorControlRegistry,
  createStandardKanbanEditorAdapter,
} from '../src/index.js';
import type { KanbanCardEditorSchema, StandardKanbanEditorDraft, StandardKanbanEditorForm } from '../src/index.js';

interface MixedDraft {
  readonly title: string;
  readonly ready: boolean;
}

describe('Kanban editor schema implementation boundaries', () => {
  it('should preserve concrete callbacks in a heterogeneous typed field collection', () => {
    const schema = createKanbanCardEditorSchema({
      revision: 'mixed-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: 'text',
          labelId: 'app.fields.title',
          order: 0,
          read: (draft: MixedDraft) => draft.title,
          write: (draft: MixedDraft, title: string) => ({ ...draft, title }),
        },
        {
          fieldId: 'ready',
          sectionId: 'main',
          kind: 'boolean',
          labelId: 'app.fields.ready',
          order: 1,
          read: (draft: MixedDraft) => draft.ready,
          write: (draft: MixedDraft, ready: boolean) => ({ ...draft, ready }),
        },
      ],
    });

    expectTypeOf(schema).toMatchTypeOf<KanbanCardEditorSchema<unknown, MixedDraft>>();
    expect(schema.fields.map(({ fieldId }) => fieldId)).toEqual(['title', 'ready']);
  });

  it('should detach and order schema containers without invoking field callbacks', () => {
    const read = vi.fn((draft: MixedDraft) => draft.title);
    const sections = [
      { sectionId: 'later', labelId: 'app.sections.later', order: 2 },
      { sectionId: 'main', labelId: 'app.sections.main', order: 1 },
    ];
    const fields = [
      {
        fieldId: 'later',
        sectionId: 'later',
        kind: 'text' as const,
        labelId: 'app.fields.later',
        order: 0,
        read,
        write: (draft: MixedDraft, title: string) => ({ ...draft, title }),
      },
      {
        fieldId: 'title',
        sectionId: 'main',
        kind: 'text' as const,
        labelId: 'app.fields.title',
        order: 0,
        read,
        write: (draft: MixedDraft, title: string) => ({ ...draft, title }),
      },
    ];

    const schema = createKanbanCardEditorSchema({ revision: 'detached-v1', sections, fields });
    sections.length = 0;
    fields.length = 0;

    expect(schema.sections.map(({ sectionId }) => sectionId)).toEqual(['main', 'later']);
    expect(schema.fields.map(({ fieldId }) => fieldId)).toEqual(['title', 'later']);
    expect(Object.isFrozen(schema.sections)).toBe(true);
    expect(Object.isFrozen(schema.fields)).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it('should accept the exact registry capacity and reject one additional registration', () => {
    const factory = vi.fn(() => {
      throw new Error('factory-must-remain-lazy');
    });
    const registrations = Array.from({ length: KANBAN_LIMITS.cardFields.safe }, (_, index) => ({
      controlId: `app.controls.control-${index}`,
      create: factory,
    }));

    const registry = createKanbanEditorControlRegistry({ controls: registrations });

    expect(registry.controls).toHaveLength(KANBAN_LIMITS.cardFields.safe);
    expect(registry.control(registrations.at(-1)!.controlId)).toBe(registry.controls.at(-1));
    expect(factory).not.toHaveBeenCalled();
    expect(() =>
      createKanbanEditorControlRegistry({
        controls: [...registrations, { controlId: 'app.controls.overflow', create: factory }],
      }),
    ).toThrow(KanbanInvalidEditorSchemaError);
  });

  it('should normalize throwing control factories without exposing their error payload', () => {
    const registry = createKanbanEditorControlRegistry({
      controls: [
        {
          controlId: 'app.controls.throwing',
          create: () => {
            throw new Error('private-control-token');
          },
        },
      ],
    });

    let failure: unknown;
    try {
      registry.control('app.controls.throwing')?.create();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(KanbanInvalidEditorSchemaError);
    expect(JSON.stringify(failure)).not.toContain('private-control-token');
  });

  it('should detach standard nested card collections and expose a Zod-free form surface', () => {
    const source = {
      key: 'ticket-1',
      columnId: 'ready',
      title: 'Ship editor',
      status: 'Ready',
      labels: [{ id: 'release', label: 'Release' }],
      checklists: [
        {
          checklistId: 'release',
          title: 'Release',
          items: [{ itemId: 'verify', text: 'Verify package', completed: false }],
        },
      ],
    };
    const adapter = createStandardKanbanEditorAdapter({
      fields: ['title', 'labels', 'checklists'],
      schema: z.object({
        title: z.string().min(1),
        labels: z.array(z.unknown()),
        checklists: z.array(z.unknown()),
      }),
    });

    const draft = adapter.create(source, { mode: 'edit', signal: new AbortController().signal });
    source.labels[0]!.label = 'Mutated';
    source.checklists[0]!.items[0]!.text = 'Mutated';
    const form = adapter.createForm(draft);

    expectTypeOf(draft).toEqualTypeOf<StandardKanbanEditorDraft>();
    expectTypeOf(form).toEqualTypeOf<StandardKanbanEditorForm>();
    expect(draft.labels).toEqual([{ id: 'release', label: 'Release' }]);
    expect(draft.checklists).toEqual([
      {
        checklistId: 'release',
        title: 'Release',
        items: [{ itemId: 'verify', text: 'Verify package', completed: false }],
      },
    ]);
    expect(form.rawValues()).toMatchObject({ title: 'Ship editor' });
    form.dispose();
  });
});
