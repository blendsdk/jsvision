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

  it('migrates bounded persisted JSON text through the same detached input boundary', () => {
    const v0 = { kind: 'jsvision-kanban-view', version: 0, view: {} };
    const migrate = vi.fn(() => view());
    const registry = createKanbanSavedViewMigrationRegistry({
      migrations: [{ fromVersion: 0, toVersion: 1, migrate }],
    });

    const result = migrateKanbanSavedView(JSON.stringify(v0), { registry });

    expect(result).toMatchObject({ kind: 'migrated', fromVersion: 0, toVersion: 1 });
    expect(migrate).toHaveBeenCalledWith(v0);
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

  it('rejects quick filters whose current applicability or parameter codec cannot produce a query', () => {
    const parsed = parseKanbanSavedView(view({ quickFilters: [{ id: 'app.mine', value: 'me' }] }));
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const registrations = [
      {
        id: 'app.mine',
        labelId: 'app.filters.mine',
        filter: { fieldId: 'owner', operatorId: 'app.equals' },
        applicable: () => false,
        parameterCodec: { snapshot: () => 'me' },
      },
      {
        id: 'app.mine',
        labelId: 'app.filters.mine',
        filter: { fieldId: 'owner', operatorId: 'app.equals' },
        parameterCodec: {
          snapshot: () => {
            throw new Error('classified-codec-failure');
          },
        },
      },
    ] as const;

    for (const registration of registrations) {
      const registry = createKanbanViewRegistry({ quickFilters: [registration] });
      expect(reconcileKanbanSavedView(parsed.value, { ...context(), registry })).toEqual({
        kind: 'rejected',
        diagnostic: { code: 'missing-required-reference', category: 'quick-filter', id: 'app.mine' },
      });
    }
  });

  it('validates transforming quick-filter codecs without storing their transformed output', () => {
    const snapshot = vi.fn((value: unknown) => ({ normalized: String(value) }));
    const registry = createKanbanViewRegistry({
      quickFilters: [
        {
          id: 'app.mine',
          labelId: 'app.filters.mine',
          filter: { fieldId: 'owner', operatorId: 'app.equals' },
          parameterCodec: { snapshot },
        },
      ],
    });
    const parsed = parseKanbanSavedView(view({ quickFilters: [{ id: 'app.mine', value: 'me' }] }));
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;

    const result = reconcileKanbanSavedView(parsed.value, { ...context(), registry });

    expect(result.kind).toBe('reconciled');
    if (result.kind !== 'reconciled') return;
    expect(result.resolved.quickFilters).toEqual([{ id: 'app.mine', value: 'me' }]);
    expect(snapshot).toHaveBeenCalledOnce();
  });

  it('truncates optional-drop diagnostics without rejecting an otherwise valid view', () => {
    const columns = Array.from({ length: 64 }, (_, index) => ({
      columnId: `missing-column-${index}`,
      visible: true,
      collapsed: false,
      onMissing: 'drop' as const,
    }));
    const swimlanes = Array.from({ length: 128 }, (_, index) => ({
      swimlaneId: `missing-swimlane-${index}`,
      visible: true,
      collapsed: false,
      onMissing: 'drop' as const,
    }));
    const cardFieldIds = Array.from({ length: 64 }, (_, index) => `missing-field-${index}`);
    const summaryIds = Array.from({ length: 16 }, (_, index) => `missing-summary-${index}`);
    const parsed = parseKanbanSavedView(
      view({
        filters: [],
        sort: [],
        columns: { items: columns },
        swimlanes: { items: swimlanes },
        presentation: {
          density: 'comfortable',
          cardFieldIds,
          summaryIds,
          checklist: 'hidden',
        },
      }),
    );
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;

    const result = reconcileKanbanSavedView(parsed.value, {
      registry: createKanbanViewRegistry(),
      columns: [],
      swimlanes: [],
      cardFieldIds: [],
      summaryIds: [],
    });

    expect(result.kind).toBe('reconciled');
    if (result.kind !== 'reconciled') return;
    expect(result.diagnostics).toHaveLength(256);
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
