import { classicTheme } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidDescriptorError,
  createFallbackKanbanCardDescriptor,
  createKanbanTheme,
  renderKanbanCardSafely,
  validateKanbanCardDescriptor,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardRenderer,
  KanbanCardRow,
  KanbanCardSpan,
  KanbanObservation,
} from '../src/index.js';

const FALLBACK_LABELS = { invalidCardTitle: 'Invalid card', unknownStatus: 'Unknown status' } as const;

/** Creates a narrow bounded context for descriptor contract assertions. */
function context(cardKey: CardKey): KanbanCardRenderContext {
  return {
    cardKey,
    width: 20,
    rowBudget: 4,
    density: 'compact',
    focused: true,
    selected: false,
    readOnly: false,
    operation: 'idle',
    theme: createKanbanTheme(classicTheme),
    capabilities: {
      colorDepth: 'mono',
      widthMode: 'wcwidth',
      boxDrawing: true,
      ambiguousWide: false,
    },
    formatting: {
      locale: 'en',
      formatNumber: (value: number | bigint) => String(value),
      formatDate: () => undefined,
    },
  };
}

/** Creates one valid two-row descriptor whose fields can be replaced in a focused test. */
function descriptor(cardKey: CardKey): KanbanCardDescriptor {
  return {
    cardKey,
    width: 20,
    measuredHeight: 2,
    surfaceRole: 'card.focused',
    borderRole: 'card.focused',
    marker: {
      row: 0,
      column: 0,
      glyph: '>',
      role: 'card.focused',
      cues: ['focused'],
    },
    rows: [
      { section: 'title', spans: [{ column: 1, text: 'Safe title', role: 'content.title' }] },
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

describe('Kanban descriptor safety contract', () => {
  it('should accept one bounded semantic descriptor without changing it', () => {
    const value = descriptor('card-1');
    expect(() => validateKanbanCardDescriptor(value, context('card-1'))).not.toThrow();
    expect(value.rows).toHaveLength(2);
  });

  it.each([
    ['negative geometry', { measuredHeight: -1 }],
    ['non-finite geometry', { measuredHeight: Number.POSITIVE_INFINITY }],
    ['row budget overflow', { measuredHeight: 5 }],
    ['width mismatch', { width: 21 }],
  ])('should reject %s before projection', (_label, replacement) => {
    const value = { ...descriptor('invalid-geometry'), ...replacement };
    expect(() => validateKanbanCardDescriptor(value, context('invalid-geometry'))).toThrow(
      KanbanInvalidDescriptorError,
    );
  });

  it('should reject unsafe text, unknown theme roles, duplicate actions, and out-of-card regions', () => {
    const base = descriptor('invalid-content');
    const unsafe = {
      ...base,
      rows: [
        { section: 'title' as const, spans: [{ column: 1, text: '\u001b[31msecret', role: 'content.title' as const }] },
      ],
    };
    const unknownRole = structuredClone(base);
    Reflect.set(unknownRole.rows[0]?.spans[0] ?? {}, 'role', 'application.raw-color');
    const duplicateActions = {
      ...base,
      actions: [
        { actionId: 'example.open', label: 'Open', enabled: true },
        { actionId: 'example.open', label: 'Again', enabled: true },
      ],
    };
    const outside = {
      ...base,
      regions: [{ regionId: 'outside', kind: 'section' as const, x: 19, y: 0, width: 2, height: 1 }],
    };

    for (const value of [unsafe, unknownRole, duplicateActions, outside]) {
      expect(() => validateKanbanCardDescriptor(value, context('invalid-content'))).toThrow(
        KanbanInvalidDescriptorError,
      );
    }
  });

  it('should replace a throwing renderer locally with one bounded frozen fallback and redacted observation', () => {
    const observations: KanbanObservation[] = [];
    const failing: KanbanCardRenderer<{ readonly secret: string }> = {
      render: () => {
        throw new Error('DO-NOT-OBSERVE');
      },
    };
    const renderContext = context('broken-1');
    const fallback = renderKanbanCardSafely({ secret: 'CONFIDENTIAL' }, failing, renderContext, {
      labels: FALLBACK_LABELS,
      observe: (value: KanbanObservation) => observations.push(value),
    });

    expect(fallback.degradation.level).toBe('fallback');
    expect(fallback.measuredHeight).toBeLessThanOrEqual(renderContext.rowBudget);
    expect(fallback.width).toBe(renderContext.width);
    expect(Object.isFrozen(fallback)).toBe(true);
    expect(Object.isFrozen(fallback.rows)).toBe(true);
    expect(observations).toEqual([{ code: 'card-render-failed', scope: 'renderer', cardKey: 'broken-1' }]);
    expect(JSON.stringify({ fallback, observations })).not.toMatch(/DO-NOT-OBSERVE|CONFIDENTIAL/u);
  });

  it('should preserve a neighboring valid descriptor when another card fails', () => {
    const validRenderer: KanbanCardRenderer<undefined> = { render: () => descriptor('healthy-2') };
    const brokenRenderer: KanbanCardRenderer<undefined> = {
      render: () => {
        throw new Error('isolated');
      },
    };

    const broken = renderKanbanCardSafely(undefined, brokenRenderer, context('broken-1'), {
      labels: FALLBACK_LABELS,
    });
    const healthy = renderKanbanCardSafely(undefined, validRenderer, context('healthy-2'), {
      labels: FALLBACK_LABELS,
    });

    expect(broken.degradation.level).toBe('fallback');
    expect(healthy).toEqual(descriptor('healthy-2'));
    expect(healthy.degradation.level).toBe('none');
  });

  it('should construct the same bounded localized fallback through the pure fallback helper', () => {
    const value = createFallbackKanbanCardDescriptor(context(42), FALLBACK_LABELS);
    const text = value.rows
      .flatMap((row: KanbanCardRow) => row.spans)
      .map((span: KanbanCardSpan) => span.text)
      .join(' ');

    expect(value.cardKey).toBe(42);
    expect(value.degradation.level).toBe('fallback');
    expect(text).toContain(FALLBACK_LABELS.invalidCardTitle);
    expect(text).toContain(FALLBACK_LABELS.unknownStatus);
    expect(value.actions).toEqual([]);
    expect(value.regions).toEqual([]);
  });
});
