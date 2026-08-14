import { describe, expect, it, vi } from 'vitest';

import {
  applyKanbanSavedView,
  createKanbanSavedViewMigrationRegistry,
  createKanbanViewController,
  createKanbanViewRegistry,
  migrateKanbanSavedView,
  parseKanbanSavedView,
  reconcileKanbanSavedView,
} from '../src/index.js';
import type { KanbanSavedViewV1 } from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

/** Creates one valid v1 fixture with source-owned filter and comparator identities. */
function view(replacement: Partial<KanbanSavedViewV1['view']> = {}): KanbanSavedViewV1 {
  return {
    kind: 'jsvision-kanban-view',
    version: 1,
    view: {
      searchPolicy: 'transient',
      filters: [{ fieldId: 'owner', operatorId: 'app.equals', value: 'me' }],
      quickFilters: [],
      sort: [{ fieldId: 'priority', comparatorId: 'app.numeric', direction: 'ascending' }],
      columns: { items: [{ columnId: 'ready', visible: true, collapsed: false }] },
      swimlanes: { items: [] },
      presentation: {
        density: 'comfortable',
        cardFieldIds: [],
        summaryIds: [],
        checklist: 'hidden',
      },
      ...replacement,
    },
  };
}

/** Creates current semantic identities used by deterministic reconciliation. */
function context() {
  return {
    registry: createKanbanViewRegistry(),
    fields: [
      { fieldId: 'owner', operators: ['app.equals'], comparators: [] },
      { fieldId: 'priority', operators: [], comparators: ['app.numeric'] },
    ],
    columns: [
      { columnId: 'ready', visible: true, collapsed: false, minimumWidth: 18, maximumWidth: 32 },
      { columnId: 'review', visible: true, collapsed: false, minimumWidth: 18, maximumWidth: 32 },
    ],
    swimlanes: [],
  } as const;
}

describe('Kanban saved-view migration and reconciliation specification', () => {
  it('runs each sequential migration once without mutating its older input', () => {
    const v0 = Object.freeze({
      kind: 'jsvision-kanban-view',
      version: 0,
      view: Object.freeze({
        filters: Object.freeze([]),
        quickFilters: Object.freeze([]),
        sort: Object.freeze([]),
        columns: Object.freeze({ items: Object.freeze([]) }),
        swimlanes: Object.freeze({ items: Object.freeze([]) }),
        presentation: Object.freeze({ density: 'comfortable', cardFieldIds: Object.freeze([]), checklist: 'hidden' }),
      }),
    });
    const before = JSON.stringify(v0);
    const migrate = vi.fn(() => view());
    const registry = createKanbanSavedViewMigrationRegistry({
      migrations: [{ fromVersion: 0, toVersion: 1, migrate }],
    });

    const result = migrateKanbanSavedView(v0, { registry });

    expect(result).toMatchObject({ kind: 'migrated', fromVersion: 0, toVersion: 1, value: view() });
    expect(migrate).toHaveBeenCalledOnce();
    expect(JSON.stringify(v0)).toBe(before);
  });

  it('drops explicitly optional missing structures and appends new structures in current order', () => {
    const parsed = parseKanbanSavedView(
      view({
        sort: [],
        columns: {
          items: [
            { columnId: 'removed', visible: false, collapsed: false, onMissing: 'drop' },
            { columnId: 'ready', visible: true, collapsed: false },
          ],
        },
      }),
    );
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;

    const result = reconcileKanbanSavedView(parsed.value, context());

    expect(result.kind).toBe('reconciled');
    if (result.kind !== 'reconciled') return;
    expect(result.resolved.columns.items.map(({ columnId }) => columnId)).toEqual(['ready', 'review']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'missing-reference-dropped', category: 'column', id: 'removed' }),
    ]);
    expect(result.raw.view.columns.items[0]).toMatchObject({ columnId: 'removed', onMissing: 'drop' });
  });

  it('rejects a missing active comparator under its conservative default policy', () => {
    const parsed = parseKanbanSavedView(
      view({ sort: [{ fieldId: 'priority', comparatorId: 'app.removed', direction: 'ascending' }] }),
    );
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;

    expect(reconcileKanbanSavedView(parsed.value, context())).toEqual({
      kind: 'rejected',
      diagnostic: { code: 'missing-required-reference', category: 'comparator', id: 'app.removed' },
    });
  });

  it('applies typed registered filter and sort identities to a windowed source query', () => {
    const parsed = parseKanbanSavedView(view());
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const reconciled = reconcileKanbanSavedView(parsed.value, context());
    expect(reconciled.kind).toBe('reconciled');
    if (reconciled.kind !== 'reconciled') return;
    const controller = createKanbanViewController();
    expect(applyKanbanSavedView(controller, reconciled).kind).toBe('changed');
    const fixture = createWindowedKanbanFixture({
      logicalCardCount: 0,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
      initialRevision: 'source-v1',
      materialize: () => [],
      keyOf: () => 'unused',
    });
    const openQuery = vi.fn(fixture.source.openQuery.bind(fixture.source));

    const session = openQuery(controller.query());

    expect(openQuery).toHaveBeenCalledWith({
      filters: [{ fieldId: 'owner', operatorId: 'app.equals', value: 'me' }],
      sort: [{ fieldId: 'priority', comparatorId: 'app.numeric', direction: 'ascending' }],
      viewRevision: 1,
    });
    session.dispose();
    fixture.dispose();
    controller.dispose();
  });
});
