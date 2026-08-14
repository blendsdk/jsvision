import { Group } from '@jsvision/ui';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorControlRegistry,
  createStandardKanbanEditorAdapter,
  KanbanInvalidEditorSchemaError,
} from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanCardEditorField,
  KanbanEditorContext,
  StandardCard,
} from '../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

interface TicketDraft {
  readonly title: string;
  readonly description: string;
  readonly points: number;
  readonly blocked: boolean;
  readonly due: string;
  readonly state: string;
  readonly labels: readonly string[];
  readonly custom: string;
}

/** Creates a detached draft used to prove field adapters never depend on source mutation. */
function emptyDraft(): TicketDraft {
  return {
    title: '',
    description: '',
    points: 0,
    blocked: false,
    due: '',
    state: '',
    labels: [],
    custom: '',
  };
}

/** Creates one exact field descriptor for schema graph and bound mutations. */
function textField(fieldId: string, dependencies: readonly string[] = []): KanbanCardEditorField<TicketDraft, string> {
  return {
    fieldId,
    sectionId: 'main',
    kind: 'text',
    labelId: `app.fields.${fieldId}`,
    order: 0,
    dependencies,
    read: (draft) => draft.title,
    write: (draft, value) => ({ ...draft, title: value }),
  };
}

describe('Kanban editor schema specification', () => {
  // Every supported field kind must retain its own typed draft adapter and registered control metadata.
  it('retains every generic field kind with typed read/write adapters', () => {
    const pointsField = {
      fieldId: 'points',
      sectionId: 'main',
      kind: 'number' as const,
      labelId: 'app.fields.points',
      order: 2,
      read: (draft: TicketDraft) => draft.points,
      write: (draft: TicketDraft, value: number) => ({ ...draft, points: value }),
    };
    const fields = [
      textField('title'),
      {
        fieldId: 'description',
        sectionId: 'main',
        kind: 'multiline' as const,
        labelId: 'app.fields.description',
        order: 1,
        read: (draft: TicketDraft) => draft.description,
        write: (draft: TicketDraft, value: string) => ({ ...draft, description: value }),
      },
      pointsField,
      {
        fieldId: 'blocked',
        sectionId: 'main',
        kind: 'boolean' as const,
        labelId: 'app.fields.blocked',
        order: 3,
        read: (draft: TicketDraft) => draft.blocked,
        write: (draft: TicketDraft, value: boolean) => ({ ...draft, blocked: value }),
      },
      {
        fieldId: 'due',
        sectionId: 'main',
        kind: 'date' as const,
        labelId: 'app.fields.due',
        order: 4,
        read: (draft: TicketDraft) => draft.due,
        write: (draft: TicketDraft, value: string) => ({ ...draft, due: value }),
      },
      {
        fieldId: 'state',
        sectionId: 'main',
        kind: 'single-choice' as const,
        labelId: 'app.fields.state',
        order: 5,
        read: (draft: TicketDraft) => draft.state,
        write: (draft: TicketDraft, value: string) => ({ ...draft, state: value }),
        choices: [
          { choiceId: 'ready', labelId: 'app.states.ready', value: 'ready' },
          { choiceId: 'done', labelId: 'app.states.done', value: 'done' },
        ],
      },
      {
        fieldId: 'labels',
        sectionId: 'main',
        kind: 'multiple-choice' as const,
        labelId: 'app.fields.labels',
        order: 6,
        read: (draft: TicketDraft) => draft.labels,
        write: (draft: TicketDraft, value: readonly string[]) => ({ ...draft, labels: value }),
        choices: [{ choiceId: 'bug', labelId: 'app.labels.bug', value: 'bug' }],
      },
      {
        fieldId: 'custom',
        sectionId: 'main',
        kind: 'custom' as const,
        labelId: 'app.fields.custom',
        order: 7,
        controlId: 'app.controls.custom',
        read: (draft: TicketDraft) => draft.custom,
        write: (draft: TicketDraft, value: string) => ({ ...draft, custom: value }),
      },
    ];
    const controls = createKanbanEditorControlRegistry({
      controls: [
        {
          controlId: 'app.controls.custom',
          create: () => ({
            view: new Group(),
            measure: () => ({ minimumWidth: 8, preferredWidth: 16, rows: 1 }),
            dispose: vi.fn(),
          }),
        },
      ],
    });

    const schema = createKanbanCardEditorSchema({
      revision: 'ticket-schema-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
      fields,
      controls,
    });

    expect(schema.fields.map(({ kind }) => kind)).toEqual([
      'text',
      'multiline',
      'number',
      'boolean',
      'date',
      'single-choice',
      'multiple-choice',
      'custom',
    ]);
    expectTypeOf(pointsField.read).returns.toEqualTypeOf<number>();
    expect(pointsField.write(emptyDraft(), 8)).toMatchObject({ points: 8 });
  });

  // Invalid schema graphs and collections must reject before any partial editor state is exposed.
  it('rejects duplicate identities, missing sections, visibility cycles, and over-bound choices atomically', () => {
    const base = {
      revision: 'ticket-schema-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
    } as const;
    const invalidFields = [
      [textField('title'), textField('title')],
      [{ ...textField('title'), sectionId: 'missing' }],
      [textField('first', ['second']), textField('second', ['first'])],
      [
        {
          ...textField('state'),
          kind: 'single-choice' as const,
          choices: Array.from({ length: 5_000 }, (_, index) => ({
            choiceId: `choice-${index}`,
            labelId: `app.choices.choice-${index}`,
            value: String(index),
          })),
        },
      ],
    ];

    for (const fields of invalidFields) {
      expect(() => createKanbanCardEditorSchema({ ...base, fields })).toThrow(KanbanInvalidEditorSchemaError);
    }
  });

  // Serialized or application-provided identifiers may select only known field kinds and complete controls.
  it('rejects unknown kinds and custom controls without measured disposable ownership', () => {
    expect(() =>
      createKanbanCardEditorSchema({
        revision: 'ticket-schema-v1',
        sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
        fields: [{ ...textField('custom'), kind: 'custom', controlId: 'app.controls.missing' }],
      }),
    ).toThrow(KanbanInvalidEditorSchemaError);
    expect(() => {
      const hostileSchema = {
        revision: 'ticket-schema-v1',
        sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
        fields: [{ ...textField('title'), kind: 'unknown' }],
      };
      Reflect.apply(createKanbanCardEditorSchema, undefined, [hostileSchema]);
    }).toThrow(KanbanInvalidEditorSchemaError);
  });

  // Generic applications must retain their record and draft types without depending on Zod-owned contracts.
  it('keeps the generic adapter strongly typed without importing Zod contracts', () => {
    const schema = createKanbanCardEditorSchema({
      revision: 'ticket-schema-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
      fields: [textField('title')],
    });
    const adapter: KanbanCardEditorAdapter<Ticket, TicketDraft> = {
      schema,
      create: (card) => ({ ...emptyDraft(), title: card?.title ?? '' }),
      snapshot: (draft) => ({ title: draft.title }),
      proposal: ({ draft }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: draft }),
    };
    const context: KanbanEditorContext = {
      mode: 'edit',
      signal: new AbortController().signal,
    };

    expectTypeOf(adapter.create).parameter(0).toEqualTypeOf<Ticket | undefined>();
    expectTypeOf(adapter.create).parameter(1).toEqualTypeOf<KanbanEditorContext>();
    expect(adapter.snapshot(adapter.create({ id: 'ticket-1', title: 'Typed' }, context))).toEqual({ title: 'Typed' });
  });

  // Standard schemas must omit unconfigured rows and preserve application-owned checklist identities.
  it('renders only configured standard fields and preserves checklist group/item identities', () => {
    const adapter = createStandardKanbanEditorAdapter({ fields: ['title', 'status', 'checklists'] });
    const card: StandardCard = {
      key: 'ticket-1',
      columnId: 'ready',
      title: 'Ship editor',
      status: 'Ready',
      description: 'Omitted from configuration',
      checklists: [
        {
          checklistId: 'release',
          title: 'Release',
          items: [{ itemId: 'verify', text: 'Verify package', completed: false }],
        },
      ],
    };

    const context: KanbanEditorContext = {
      mode: 'edit',
      signal: new AbortController().signal,
    };
    const draft = adapter.create(card, context);
    const snapshot = adapter.snapshot(draft);

    expect(adapter.schema.fields.map(({ fieldId }) => fieldId)).toEqual(['title', 'status', 'checklists']);
    expect(snapshot).not.toHaveProperty('description');
    expect(snapshot).toMatchObject({
      checklists: [{ checklistId: 'release', items: [{ itemId: 'verify' }] }],
    });
  });
});
