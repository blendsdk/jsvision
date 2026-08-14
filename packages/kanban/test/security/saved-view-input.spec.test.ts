import { describe, expect, it, vi } from 'vitest';

import {
  applyKanbanSavedView,
  createKanbanViewController,
  createKanbanViewRegistry,
  parseKanbanSavedView,
  reconcileKanbanSavedView,
} from '../../src/index.js';
import type { KanbanSavedViewV1 } from '../../src/index.js';

/** Creates one minimal complete valid envelope for one hostile-field mutation at a time. */
function validView(): KanbanSavedViewV1 {
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

/** Asserts the fixed payload-free invalid-view result without echoing hostile input. */
function expectInvalid(value: unknown): void {
  expect(parseKanbanSavedView(value)).toEqual({
    kind: 'rejected',
    diagnostic: { code: 'invalid-view' },
  });
}

describe('Kanban saved-view input security specification', () => {
  it('rejects malformed text, unknown top-level fields, and invalid cell widths', () => {
    expectInvalid('{"kind":');
    expectInvalid({ ...validView(), unknown: true });
    expectInvalid({
      ...validView(),
      view: {
        ...validView().view,
        columns: { items: [{ columnId: 'ready', visible: true, collapsed: false, width: 0 }] },
      },
    });
    expectInvalid({
      ...validView(),
      view: {
        ...validView().view,
        columns: { items: [{ columnId: 'ready', visible: true, collapsed: false, width: 513 }] },
      },
    });
  });

  it('rejects excessive encoded size, depth, array length, and object key count before retention', () => {
    expectInvalid(JSON.stringify({ ...validView(), name: 'x'.repeat(70_000) }));

    let nested: unknown = null;
    for (let depth = 0; depth < 40; depth += 1) nested = { child: nested };
    expectInvalid({ ...validView(), extensions: { 'app.deep': nested } });

    expectInvalid({ ...validView(), extensions: { 'app.wide': Array.from({ length: 5_000 }, () => null) } });
    expectInvalid({
      ...validView(),
      extensions: {
        'app.keys': Object.fromEntries(Array.from({ length: 2_000 }, (_, index) => [`key-${index}`, index])),
      },
    });
  });

  it('rejects accessors, executable values, unsafe members, and non-plain objects without invocation', () => {
    const getter = vi.fn(() => {
      throw new Error('classified-accessor-value');
    });
    const accessor = Object.defineProperty(validView(), 'name', { enumerable: true, get: getter });
    expectInvalid(accessor);
    expect(getter).not.toHaveBeenCalled();

    expectInvalid({ ...validView(), extensions: { 'app.function': () => true } });
    expectInvalid({ ...validView(), extensions: { 'app.regex': /release/gu } });
    expectInvalid({ ...validView(), extensions: { 'app.path': new URL('file:///tmp/secret') } });
    expectInvalid(JSON.parse('{"kind":"jsvision-kanban-view","version":1,"view":{},"__proto__":{}}'));
  });

  it('returns a bounded unsupported-version diagnostic without changing live view state', () => {
    const controller = createKanbanViewController();
    const before = controller.state();

    const result = parseKanbanSavedView({ ...validView(), version: 99 });

    expect(result).toEqual({
      kind: 'unsupported-version',
      version: 99,
      supported: { minimum: 1, maximum: 1 },
    });
    expect(controller.state()).toBe(before);
    controller.dispose();
  });

  it('never includes rejected names, extension values, or raw errors in diagnostics', () => {
    const secret = 'classified-filter-value';
    const result = parseKanbanSavedView({
      ...validView(),
      name: secret,
      extensions: { 'app.secret': { value: secret, invalid: BigInt(1) } },
    });

    expect(result.kind).toBe('rejected');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('BigInt');
  });

  it('validates complete reconciliation provenance before mutating controller state', () => {
    const controller = createKanbanViewController();
    const input = validView();
    const parsed = parseKanbanSavedView({
      ...input,
      view: {
        ...input.view,
        presentation: { ...input.view.presentation, density: 'spacious' },
      },
    });
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const reconciled = reconcileKanbanSavedView(parsed.value, {
      registry: createKanbanViewRegistry(),
      columns: [],
      swimlanes: [],
    });
    expect(reconciled.kind).toBe('reconciled');
    if (reconciled.kind !== 'reconciled') return;
    const before = controller.state();
    const hostile = Object.defineProperty({ ...reconciled }, 'provenance', {
      enumerable: true,
      get: () => {
        throw new Error('classified-provenance');
      },
    });

    expect(applyKanbanSavedView(controller, hostile)).toEqual({ kind: 'rejected', code: 'invalid-saved-view' });
    expect(controller.state()).toBe(before);
    controller.dispose();
  });

  it('enforces one cumulative registered-identity budget across nested field metadata', () => {
    const parsed = parseKanbanSavedView(validView());
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const operators = Array.from({ length: 1_024 }, (_, index) => `app.operator-${index}`);

    expect(
      reconcileKanbanSavedView(parsed.value, {
        registry: createKanbanViewRegistry(),
        fields: [
          { fieldId: 'first', operators, comparators: [] },
          { fieldId: 'second', operators: [], comparators: [] },
        ],
        columns: [],
        swimlanes: [],
      }),
    ).toEqual({ kind: 'rejected', diagnostic: { code: 'invalid-view' } });
  });
});
