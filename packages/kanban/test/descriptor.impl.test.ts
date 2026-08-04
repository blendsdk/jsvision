import { classicTheme } from '@jsvision/core';
import { stringWidth } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  KanbanInvalidDescriptorError,
  createKanbanTheme,
  createStandardKanbanCardAdapter,
  renderKanbanCardSafely,
  renderStandardKanbanCard,
  validateKanbanCardDescriptor,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardRenderer,
  StandardCard,
} from '../src/index.js';

const LABELS = { invalidCardTitle: 'Invalid card', unknownStatus: 'Unknown status' } as const;

/** Creates one deterministic compact render context. */
function context(cardKey: CardKey, width = 20): KanbanCardRenderContext {
  return {
    cardKey,
    width,
    rowBudget: 4,
    density: 'compact',
    focused: true,
    selected: false,
    readOnly: false,
    operation: 'idle',
    theme: createKanbanTheme(classicTheme),
    capabilities: { colorDepth: 'mono', widthMode: 'wcwidth', boxDrawing: true, ambiguousWide: false },
    formatting: { locale: 'en', formatNumber: String, formatDate: () => undefined },
  };
}

/** Creates a valid descriptor that focused validation cases can copy. */
function descriptor(cardKey: CardKey): KanbanCardDescriptor {
  return {
    cardKey,
    width: 20,
    measuredHeight: 2,
    surfaceRole: 'card.normal',
    borderRole: 'card.normal',
    marker: { row: 0, column: 0, glyph: '>', role: 'card.focused', cues: ['focused'] },
    rows: [
      { section: 'title', spans: [{ column: 1, text: 'Title', role: 'content.title' }] },
      { section: 'status', spans: [{ column: 1, text: 'Ready', role: 'content.status' }] },
    ],
    sections: [
      { id: 'title', kind: 'title', startRow: 0, rowCount: 1, priority: 0 },
      { id: 'status', kind: 'status', startRow: 1, rowCount: 1, priority: 1 },
    ],
    actions: [],
    regions: [],
    degradation: { level: 'none', omittedSections: [] },
  };
}

describe('card descriptor implementation boundaries', () => {
  it('clips hostile wide-glyph content by cells across every supported narrow width', () => {
    const card: StandardCard = {
      key: 'wide',
      columnId: 'ready',
      title: '\u001b界🙂界🙂界🙂 title\ncontinued',
      status: '状態界🙂界🙂界🙂',
    };
    const adapter = createStandardKanbanCardAdapter();

    for (let width = 18; width <= 32; width += 1) {
      const rendered = renderStandardKanbanCard(card, adapter, context(card.key, width));
      for (const row of rendered.rows) {
        const text = row.spans.map((span) => span.text).join('');
        expect(stringWidth(text)).toBeLessThanOrEqual(width - 1);
        expect(text).not.toMatch(/[\u0000-\u001f\u007f-\u009f\uFFFD]/u);
      }
      expect(() => validateKanbanCardDescriptor(rendered, context(card.key, width))).not.toThrow();
    }
  });

  it('rejects oversized fields, invalid action identities, and overlapping hit regions', () => {
    const base = descriptor('bounded');
    const oversized = {
      ...base,
      rows: [
        {
          section: 'title' as const,
          spans: [
            { column: 1, text: 'x'.repeat(KANBAN_LIMITS.semanticStringBytes.safe + 1), role: 'content.title' as const },
          ],
        },
        base.rows[1]!,
      ],
    };
    const invalidAction = {
      ...base,
      actions: [{ actionId: 'not-namespaced', label: 'Open', enabled: true }],
    };
    const nonStringAction = {
      ...base,
      actions: [{ actionId: 'example.open', label: 'Open', enabled: true }],
    };
    Reflect.set(nonStringAction.actions[0]!, 'actionId', ['example.open']);
    const invalidEnabled = {
      ...base,
      actions: [{ actionId: 'example.open', label: 'Open', enabled: true }],
    };
    Reflect.set(invalidEnabled.actions[0]!, 'enabled', 'yes');
    const duplicateOmission = {
      ...base,
      degradation: { level: 'reduced' as const, omittedSections: ['summary' as const, 'summary' as const] },
    };
    const bidiText = {
      ...base,
      rows: [
        { section: 'title' as const, spans: [{ column: 1, text: 'safe\u202eunsafe', role: 'content.title' as const }] },
        base.rows[1]!,
      ],
    };
    const zeroCellText = {
      ...base,
      rows: [
        { section: 'title' as const, spans: [{ column: 1, text: '\u0301\u200d', role: 'content.title' as const }] },
        base.rows[1]!,
      ],
    };
    const overlap = {
      ...base,
      regions: [
        { regionId: 'one', kind: 'section' as const, x: 1, y: 0, width: 4, height: 1 },
        { regionId: 'two', kind: 'section' as const, x: 3, y: 0, width: 4, height: 1 },
      ],
    };

    for (const value of [
      oversized,
      invalidAction,
      nonStringAction,
      invalidEnabled,
      duplicateOmission,
      bidiText,
      zeroCellText,
      overlap,
    ]) {
      expect(() => validateKanbanCardDescriptor(value, context('bounded'))).toThrow(KanbanInvalidDescriptorError);
    }
  });

  it('falls back when mandatory text contains no visible terminal cells', () => {
    const card: StandardCard = { key: 'zero-cell', columnId: 'ready', title: '\u0301\u200d', status: '\u0301' };
    const adapter = createStandardKanbanCardAdapter();
    const rendered = renderKanbanCardSafely(
      card,
      { render: (value, renderContext) => renderStandardKanbanCard(value, adapter, renderContext) },
      context(card.key),
      { labels: LABELS },
    );

    expect(rendered.degradation.level).toBe('fallback');
  });

  it('contains throwing adapters and observation sinks behind a deterministic fallback', () => {
    const keyOf = vi.fn(() => 'adapter-failure');
    const titleOf = vi.fn(() => {
      throw new Error('private-title');
    });
    const statusOf = vi.fn(() => 'Ready');
    const adapter = { keyOf, titleOf, statusOf };
    const renderer: KanbanCardRenderer<object> = {
      render: (card, renderContext) => renderStandardKanbanCard(card, adapter, renderContext),
    };
    const observe = vi.fn(() => {
      throw new Error('observer-failure');
    });

    const first = renderKanbanCardSafely({}, renderer, context('adapter-failure'), { labels: LABELS, observe });
    const second = renderKanbanCardSafely({}, renderer, context('adapter-failure'), { labels: LABELS });

    expect(first).toEqual(second);
    expect(first.degradation.level).toBe('fallback');
    expect(keyOf).toHaveBeenCalled();
    expect(titleOf).toHaveBeenCalled();
    expect(statusOf).not.toHaveBeenCalled();
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('detaches a valid custom descriptor before caller mutation', () => {
    const callerOwned = descriptor('detached');
    const safe = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('detached'), {
      labels: LABELS,
    });
    const firstSpan = callerOwned.rows[0]?.spans[0];
    if (firstSpan !== undefined) Reflect.set(firstSpan, 'text', 'mutated');

    expect(safe.rows[0]?.spans[0]?.text).toBe('Title');
    expect(Object.isFrozen(safe.rows[0]?.spans[0])).toBe(true);
    expect(Object.isFrozen(safe.degradation.omittedSections)).toBe(true);
  });

  it('reads stateful descriptor collections once before validating the frozen snapshot', () => {
    const callerOwned = descriptor('stateful');
    const safeRows = callerOwned.rows;
    const hostileRows = [
      { section: 'title' as const, spans: [{ column: 1, text: '\u202eunsafe', role: 'content.title' as const }] },
      safeRows[1]!,
    ];
    const rows = vi.fn(() => (rows.mock.calls.length === 1 ? safeRows : hostileRows));
    Object.defineProperty(callerOwned, 'rows', { enumerable: true, get: rows });

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('stateful'), {
      labels: LABELS,
    });

    expect(rows).toHaveBeenCalledTimes(1);
    expect(rendered.degradation.level).toBe('none');
    expect(rendered.rows).toEqual(safeRows);
  });

  it('reads nested cue and omission collections once before validating the snapshot', () => {
    const callerOwned = descriptor('nested-stateful');
    const cues = vi.fn(() => (cues.mock.calls.length === 1 ? ['focused'] : Array(1_000).fill('rejected')));
    const omissions = vi.fn(() => (omissions.mock.calls.length === 1 ? [] : Array(1_000).fill('summary')));
    Object.defineProperty(callerOwned.marker, 'cues', { enumerable: true, get: cues });
    Object.defineProperty(callerOwned.degradation, 'omittedSections', { enumerable: true, get: omissions });

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('nested-stateful'), {
      labels: LABELS,
    });

    expect(cues).toHaveBeenCalledTimes(1);
    expect(omissions).toHaveBeenCalledTimes(1);
    expect(rendered.degradation.level).toBe('none');
  });

  it('rejects oversized renderer collections before invoking their copy method', () => {
    const callerOwned = descriptor('oversized-copy');
    const oversized = Array(KANBAN_LIMITS.cardFields.safe + 1);
    const map = vi.fn(() => {
      throw new Error('must not copy');
    });
    Object.defineProperty(oversized, 'map', { value: map });
    Reflect.set(callerOwned, 'actions', oversized);

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('oversized-copy'), {
      labels: LABELS,
    });

    expect(map).not.toHaveBeenCalled();
    expect(rendered.degradation.level).toBe('fallback');
  });

  it('copies short renderer arrays without invoking caller-overridden map methods', () => {
    const callerOwned = descriptor('custom-map');
    const map = vi.fn(() => Array(10_000).fill({ actionId: 'example.injected', label: 'Injected', enabled: true }));
    Object.defineProperty(callerOwned.actions, 'map', { value: map });

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('custom-map'), {
      labels: LABELS,
    });

    expect(map).not.toHaveBeenCalled();
    expect(rendered.actions).toEqual([]);
    expect(rendered.degradation.level).toBe('none');
  });

  it('copies only the initially validated length when an element getter expands its source array', () => {
    const callerOwned = descriptor('expanding-array');
    const action = { actionId: 'example.open', label: 'Open', enabled: true };
    const actions = [action];
    Object.defineProperty(action, 'actionId', {
      enumerable: true,
      get: () => {
        actions.push(
          ...Array.from({ length: KANBAN_LIMITS.cardFields.safe + 1 }, (_, index) => ({
            actionId: `example.injected-${index}`,
            label: 'Injected',
            enabled: true,
          })),
        );
        return 'example.open';
      },
    });
    Reflect.set(callerOwned, 'actions', actions);

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('expanding-array'), {
      labels: LABELS,
    });

    expect(actions.length).toBeGreaterThan(KANBAN_LIMITS.cardFields.safe);
    expect(rendered.actions).toEqual([{ actionId: 'example.open', label: 'Open', enabled: true }]);
    expect(rendered.degradation.level).toBe('none');
  });

  it('bounds fallback work and never invokes localized label accessors', () => {
    const getter = vi.fn(() => 'private');
    const labels = { invalidCardTitle: 'placeholder', unknownStatus: 'x'.repeat(1_000_000) };
    Object.defineProperty(labels, 'invalidCardTitle', { enumerable: true, get: getter });

    const rendered = renderKanbanCardSafely(
      undefined,
      {
        render: () => {
          throw new Error('failed');
        },
      },
      context('labels'),
      {
        labels,
      },
    );

    expect(getter).not.toHaveBeenCalled();
    expect(rendered.rows[0]?.spans[0]?.text).toContain('Invalid');
    expect(stringWidth(rendered.rows[1]?.spans[0]?.text ?? '')).toBeLessThanOrEqual(19);
  });

  it('replaces zero-cell fallback labels with a visible package-owned marker', () => {
    const rendered = renderKanbanCardSafely(
      undefined,
      {
        render: () => {
          throw new Error('failed');
        },
      },
      context('zero-label'),
      {
        labels: { invalidCardTitle: '\u0301\u200d', unknownStatus: '\u0301' },
      },
    );

    expect(rendered.degradation.level).toBe('fallback');
    expect(rendered.rows.every((row) => stringWidth(row.spans[0]?.text ?? '') > 0)).toBe(true);
  });

  it('rejects non-primitive descriptor text without retaining caller-owned nested values', () => {
    const callerOwned = descriptor('non-string');
    const mutableText = ['Title'];
    Reflect.set(callerOwned.rows[0]?.spans[0] ?? {}, 'text', mutableText);

    const rendered = renderKanbanCardSafely(undefined, { render: () => callerOwned }, context('non-string'), {
      labels: LABELS,
    });
    mutableText[0] = 'mutated';

    expect(rendered.degradation.level).toBe('fallback');
    expect(JSON.stringify(rendered)).not.toContain('mutated');
  });
});
