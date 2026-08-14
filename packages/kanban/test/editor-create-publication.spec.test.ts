/** Immutable contracts for correlating authority-backed card creation to its persisted identity. */
import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Dialog, Group, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  openKanbanCardCreateDialog,
} from '../src/index.js';
import type { KanbanCardEditorAdapter, KanbanEditorDialogContext } from '../src/index.js';

interface Card {
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Builds a create-only adapter with one editable title. */
function adapter(): KanbanCardEditorAdapter<Card, Card> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'create-publication-v1',
      sections: [{ sectionId: 'main', labelId: 'card.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: 'text',
          labelId: 'card.title',
          order: 0,
          read: (draft: Card) => draft.title,
          write: (_draft: Card, title: string) => ({ title }),
        },
      ],
    }),
    create: () => ({ title: 'New card' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: (result) => ({ kind: 'card-create', target: { columnId: 'todo' }, draft: result.snapshot }),
  };
}

/** Creates a live host and records whether a dialog was mounted. */
function host() {
  const root = new Group();
  const loop = createEventLoop({ width: 80, height: 24 }, { caps: CAPS });
  loop.mount(root);
  const added: View[] = [];
  return {
    added,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width: 80, height: 24 },
        addWindow(view: View): void {
          added.push(view);
          root.add(view);
        },
        removeWindow(view: View): void {
          root.remove(view);
        },
      },
    },
  };
}

const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('authority-backed Kanban card creation', () => {
  it('should fail closed before mounting when no persisted-publication resolver is supplied', async () => {
    const h = host();
    const request = vi.fn();

    await expect(
      openKanbanCardCreateDialog(h.value, {
        claimId: 'new-1',
        adapter: adapter(),
        coordinator: createKanbanEditorCoordinator(),
        completion: { kind: 'authority', authority: { request } },
      }),
    ).resolves.toEqual({ kind: 'failed' });
    expect(request).not.toHaveBeenCalled();
    expect(h.added).toHaveLength(0);
  });

  it('should close committed only after the application maps creation to a persisted card publication', async () => {
    const h = host();
    let context: KanbanEditorDialogContext<Card> | undefined;
    const resolvePublication = vi.fn(async () => ({
      cardKey: 'persisted-42',
      card: { title: 'New card' },
      revision: 'card-r1',
    }));
    const pending = openKanbanCardCreateDialog(h.value, {
      claimId: 'new-1',
      adapter: adapter(),
      coordinator: createKanbanEditorCoordinator(),
      completion: {
        kind: 'authority',
        authority: {
          request: () => ({
            kind: 'accepted',
            operationId: 'create-1',
            publication: {
              operationId: 'create-1',
              subjects: [
                {
                  kind: 'card',
                  cardKey: 'persisted-42',
                  baselineRevision: 'not-created',
                  expectedRevision: 'card-r1',
                },
              ],
            },
          }),
        },
      },
      publication: { resolve: resolvePublication },
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Create', width: 40, height: 10 });
      },
    });
    await mounted();
    if (context === undefined) throw new Error('Expected create replacement context.');

    expect(context.mode).toBe('create');
    expect(Object.keys(context.actions).sort()).toEqual(['cancel', 'submit']);

    if (context.mode !== 'create') throw new Error('Expected create-mode replacement actions.');
    await expect(context.actions.submit()).resolves.toEqual({ kind: 'committed', operationId: 'create-1' });
    await expect(pending).resolves.toEqual({ kind: 'committed', operationId: 'create-1' });
    expect(resolvePublication).toHaveBeenCalledWith(
      'create-1',
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });
});
