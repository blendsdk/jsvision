import { describe, expect, it, vi } from 'vitest';

import { KANBAN_SAVED_VIEW_LIMITS } from '../src/view/saved-view-limits.js';
import { createKanbanSavedViewMigrationRegistry, migrateKanbanSavedView } from '../src/view/saved-view-migration.js';
import type { KanbanSavedViewV1 } from '../src/view/saved-view-types.js';

/** Creates one valid current envelope returned by legacy adapters. */
function currentView(): KanbanSavedViewV1 {
  return {
    kind: 'jsvision-kanban-view',
    version: 1,
    view: {
      searchPolicy: 'transient',
      filters: [],
      quickFilters: [],
      sort: [],
      columns: { items: [] },
      swimlanes: { items: [] },
      presentation: {
        density: 'comfortable',
        cardFieldIds: [],
        summaryIds: [],
        checklist: 'hidden',
      },
    },
  };
}

/** Creates one detached legacy version accepted by an application migration. */
function legacyView() {
  return { kind: 'jsvision-kanban-view', version: 0, view: { legacy: true } } as const;
}

describe('Kanban saved-view migration implementation boundaries', () => {
  it('should reject duplicate, skipping, and excessive adapter registries before callback execution', () => {
    const migrate = vi.fn(currentView);

    expect(() =>
      createKanbanSavedViewMigrationRegistry({
        migrations: [
          { fromVersion: 0, toVersion: 1, migrate },
          { fromVersion: 0, toVersion: 1, migrate },
        ],
      }),
    ).toThrow();
    expect(() =>
      createKanbanSavedViewMigrationRegistry({
        migrations: [{ fromVersion: 0, toVersion: 2, migrate }],
      }),
    ).toThrow();
    expect(() =>
      createKanbanSavedViewMigrationRegistry({
        migrations: Array.from({ length: KANBAN_SAVED_VIEW_LIMITS.migrations + 1 }, (_, version) => ({
          fromVersion: version,
          toVersion: version + 1,
          migrate,
        })),
      }),
    ).toThrow();
    expect(migrate).not.toHaveBeenCalled();
  });

  it('should provide one frozen detached generation and leave caller input unchanged', () => {
    const input = legacyView();
    const before = JSON.stringify(input);
    const migrate = vi.fn((value: unknown) => {
      expect(Object.isFrozen(value)).toBe(true);
      return currentView();
    });
    const registry = createKanbanSavedViewMigrationRegistry({
      migrations: [{ fromVersion: 0, toVersion: 1, migrate }],
    });

    expect(migrateKanbanSavedView(input, { registry }).kind).toBe('migrated');
    expect(migrate).toHaveBeenCalledOnce();
    expect(JSON.stringify(input)).toBe(before);
  });

  it('should redact thrown errors and reject wrong-version, accessor, proxy, and cyclic output', () => {
    const getter = vi.fn(() => currentView().view);
    const accessor = Object.defineProperty({ kind: 'jsvision-kanban-view', version: 1 }, 'view', {
      enumerable: true,
      get: getter,
    });
    const cyclic: { kind: string; version: number; self?: unknown } = {
      kind: 'jsvision-kanban-view',
      version: 1,
    };
    cyclic.self = cyclic;
    const proxy = new Proxy(currentView(), {
      ownKeys: () => {
        throw new Error('classified-proxy-error');
      },
    });
    const outputs = [
      () => {
        throw new Error('classified-migration-error');
      },
      () => ({ ...currentView(), version: 0 }),
      () => accessor,
      () => proxy,
      () => cyclic,
    ];

    for (const migrate of outputs) {
      const registry = createKanbanSavedViewMigrationRegistry({
        migrations: [{ fromVersion: 0, toVersion: 1, migrate }],
      });
      const result = migrateKanbanSavedView(legacyView(), { registry });

      expect(result).toEqual({ kind: 'rejected', diagnostic: { code: 'migration-failed' } });
      expect(JSON.stringify(result)).not.toContain('classified');
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it('should validate a current envelope without requiring or invoking a migration adapter', () => {
    const migrate = vi.fn(currentView);
    const registry = createKanbanSavedViewMigrationRegistry({
      migrations: [{ fromVersion: 0, toVersion: 1, migrate }],
    });

    expect(migrateKanbanSavedView(currentView(), { registry })).toMatchObject({
      kind: 'migrated',
      fromVersion: 1,
      toVersion: 1,
      value: currentView(),
    });
    expect(migrate).not.toHaveBeenCalled();
  });
});
