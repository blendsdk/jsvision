import { describe, expect, it } from 'vitest';

import {
  applyKanbanSavedView,
  captureKanbanSavedView,
  createKanbanViewController,
  createKanbanViewRegistry,
  parseKanbanSavedView,
  reconcileKanbanSavedView,
  serializeKanbanSavedView,
} from '../src/index.js';
import type { KanbanSavedViewV1 } from '../src/index.js';

/** Creates one complete deterministic v1 fixture that can be reordered without changing semantics. */
function savedView(replacement: Partial<KanbanSavedViewV1> = {}): KanbanSavedViewV1 {
  return {
    kind: 'jsvision-kanban-view',
    version: 1,
    name: 'Daily work',
    view: {
      searchPolicy: 'transient',
      filters: [],
      quickFilters: [],
      sort: [],
      columns: { items: [{ columnId: 'ready', visible: true, collapsed: false, width: 40 }] },
      swimlanes: { items: [] },
      presentation: {
        density: 'comfortable',
        cardFieldIds: ['priority'],
        summaryIds: ['children'],
        checklist: 'preview',
      },
    },
    ...replacement,
  };
}

describe('Kanban saved-view specification', () => {
  it('captures only durable semantic view facets and persists search only under durable policy', () => {
    const transient = createKanbanViewController();
    transient.apply({ kind: 'set-search', search: 'release' });
    transient.apply({
      kind: 'set-columns',
      columns: { items: [{ columnId: 'ready', visible: true, collapsed: false, width: 24 }] },
    });

    const transientCapture = captureKanbanSavedView(transient, { name: 'My view' });
    const transientText = serializeKanbanSavedView(transientCapture);

    expect(transientCapture).toMatchObject({ kind: 'jsvision-kanban-view', version: 1, name: 'My view' });
    expect(transientCapture.view).not.toHaveProperty('search');
    for (const excluded of [
      'focus',
      'selection',
      'scroll',
      'placementToken',
      'pendingOperation',
      'editorDraft',
      'cache',
    ]) {
      expect(transientText).not.toContain(excluded);
    }
    expect(transientText).not.toContain('function');

    const durable = createKanbanViewController({ initial: { searchPolicy: 'durable', search: 'release' } });
    expect(captureKanbanSavedView(durable).view).toMatchObject({ searchPolicy: 'durable', search: 'release' });
    transient.dispose();
    durable.dispose();
  });

  it('serializes semantically equal extension objects in Unicode code-point key order', () => {
    const astral = '\u{10000}';
    const loneSurrogate = '\ud800';
    const privateUse = '\ue000';
    const left = savedView({
      extensions: {
        'app.layout': { [astral]: 4, [privateUse]: 3, [loneSurrogate]: 2, alpha: 1 },
      },
    });
    const right = savedView({
      extensions: {
        'app.layout': { alpha: 1, [loneSurrogate]: 2, [privateUse]: 3, [astral]: 4 },
      },
    });

    const leftText = serializeKanbanSavedView(left);
    const rightText = serializeKanbanSavedView(right);
    const extension = JSON.parse(leftText).extensions['app.layout'] as Record<string, number>;

    expect(leftText).toBe(rightText);
    expect(Object.keys(extension)).toEqual(['alpha', loneSurrogate, privateUse, astral]);
  });

  it('keeps current-version parse and canonical serialization idempotent', () => {
    const first = parseKanbanSavedView(JSON.stringify(savedView()));
    expect(first.kind).toBe('parsed');
    if (first.kind !== 'parsed') return;

    const canonical = serializeKanbanSavedView(first.value);
    const second = parseKanbanSavedView(canonical);

    expect(second).toEqual(first);
    expect(second.kind === 'parsed' ? serializeKanbanSavedView(second.value) : '').toBe(canonical);
  });

  it('preserves bounded unknown namespaced extensions without interpreting them', () => {
    const extension = { nested: { enabled: true, thresholds: [1, 2, 3] }, text: 'opaque' };
    const parsed = parseKanbanSavedView(
      serializeKanbanSavedView(savedView({ extensions: { 'example.custom-view': extension } })),
    );

    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    expect(parsed.value.extensions?.['example.custom-view']).toEqual(extension);
    expect(Object.isFrozen(parsed.value.extensions?.['example.custom-view'])).toBe(true);
  });

  it('retains raw width provenance through ordinary edits until explicit resave', () => {
    const controller = createKanbanViewController();
    const parsed = parseKanbanSavedView(savedView());
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const reconciled = reconcileKanbanSavedView(parsed.value, {
      registry: createKanbanViewRegistry(),
      columns: [
        {
          columnId: 'ready',
          visible: true,
          collapsed: false,
          minimumWidth: 18,
          maximumWidth: 32,
        },
      ],
      swimlanes: [],
    });
    expect(reconciled.kind).toBe('reconciled');
    if (reconciled.kind !== 'reconciled') return;
    expect(reconciled.raw.view.columns.items[0]?.width).toBe(40);
    expect(reconciled.resolved.columns.items[0]?.width).toBe(32);
    expect(applyKanbanSavedView(controller, reconciled).kind).toBe('changed');

    controller.apply({ kind: 'set-density', density: 'spacious' });
    controller.apply({
      kind: 'set-columns',
      columns: { items: [{ columnId: 'ready', visible: true, collapsed: false, width: 28 }] },
    });

    expect(captureKanbanSavedView(controller).view.columns.items[0]?.width).toBe(40);
    expect(captureKanbanSavedView(controller, { mode: 'resave' }).view.columns.items[0]?.width).toBe(28);
    controller.dispose();
  });
});
