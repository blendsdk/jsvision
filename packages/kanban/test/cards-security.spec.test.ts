import { classicTheme } from '@jsvision/core';
import { stringWidth } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  composeStandardKanbanCard,
  createKanbanTheme,
  resolveKanbanPresentation,
  snapshotKanbanCardPresentation,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardFormattingContext,
  KanbanCardPresentationAdapter,
  KanbanCardPresentationMaximum,
  KanbanCardRow,
  KanbanCardSpan,
  KanbanCardVisualState,
  KanbanObservation,
} from '../src/index.js';

interface SecretCard {
  readonly id: number;
  readonly title: string;
  readonly status: string;
  readonly secret: string;
  readonly date: object;
}

const hostile = '\u001b[31mprivate\u0007\u009b2J\u202econtrol';
const theme = createKanbanTheme(classicTheme);
const capabilities = { colorDepth: 'mono', widthMode: 'wcwidth', boxDrawing: false, ambiguousWide: false } as const;
const state: KanbanCardVisualState = {
  focused: true,
  selected: false,
  rangeAnchor: false,
  readOnly: false,
  invalid: false,
  operation: 'idle',
};

function maximum(): KanbanCardPresentationMaximum {
  const limits = validateKanbanLimitOptions({ class: 'standard' });
  return {
    budget: resolveKanbanPresentation(
      {
        revision: 'security-preview',
        cardRows: 10,
        cardGap: 1,
        metadataFields: 3,
        labelRows: 2,
        summarySections: 2,
        checklistMode: 'preview',
        checklistPreviewItems: 2,
      },
      limits,
    ),
    limits,
    availableFieldIds: ['unsafe', 'date', 'failed'],
    availableSummaryIds: ['unsafe-summary', 'failed-summary'],
    availableChecklistIds: ['unsafe-list'],
  };
}

function card(): SecretCard {
  return {
    id: 7,
    title: `Title ${hostile}`,
    status: `Status ${hostile}`,
    secret: 'CUSTOMER-SECRET',
    date: { opaque: true },
  };
}

function formatting(
  dateFormatter: (value: unknown) => string | undefined = () => 'safe date',
): KanbanCardFormattingContext {
  return {
    locale: 'en',
    formatNumber: (value) => String(value),
    formatDate: dateFormatter,
  };
}

function text(rows: readonly KanbanCardRow[]): string {
  return rows
    .flatMap((row) => row.spans)
    .map((span: KanbanCardSpan) => span.text)
    .join(' ');
}

describe('rich Kanban card hostile-input boundary', () => {
  it('uses distinct ASCII-safe primary cues in deterministic visual-state precedence', () => {
    const adapter: KanbanCardPresentationAdapter<SecretCard> = {
      keyOf: (value) => value.id,
      titleOf: (value) => value.title,
      statusOf: (value) => value.status,
    };
    const variants: readonly KanbanCardVisualState[] = [
      { ...state, invalid: true, operation: 'pending' },
      { ...state, operation: 'pending' },
      { ...state, selected: true },
      state,
      { ...state, focused: false, selected: true, rangeAnchor: true },
      { ...state, focused: false, readOnly: true },
      { ...state, focused: false },
    ];
    const signatures = variants.map((visualState) => {
      const value = snapshotKanbanCardPresentation(card(), adapter, {
        maximum: maximum(),
        visualState,
        formatting: formatting(),
      });
      const marker = composeStandardKanbanCard(value, { width: 20, rowBudget: 4, theme, capabilities }).marker;
      return `${marker.role}:${marker.glyph}`;
    });
    expect(new Set(signatures).size).toBe(variants.length);
  });

  it('sanitizes unsafe text in mandatory, field, label, summary, checklist, and observation output', () => {
    const observations: KanbanObservation[] = [];
    const adapter: KanbanCardPresentationAdapter<SecretCard> = {
      keyOf: (value) => value.id,
      titleOf: (value) => value.title,
      statusOf: (value) => value.status,
      fields: [
        { fieldId: 'unsafe', label: `Field ${hostile}`, priority: 1, kind: 'text', valueOf: () => `Value ${hostile}` },
        { fieldId: 'date', label: 'Date', priority: 2, kind: 'date', valueOf: (value) => value.date },
        { fieldId: 'failed', label: 'Failed', priority: 3, kind: 'labels', valueOf: () => [`Label ${hostile}`] },
      ],
      summaries: [
        {
          summaryId: 'unsafe-summary',
          label: `Summary ${hostile}`,
          priority: 1,
          valueOf: () => ({ text: `Count ${hostile}`, count: 4 }),
        },
      ],
      checklistOf: () => [
        {
          checklistId: 'unsafe-list',
          title: `Checklist ${hostile}`,
          items: [{ itemId: 'safe-item', text: `Item ${hostile}`, completed: false }],
        },
      ],
    };
    const value = snapshotKanbanCardPresentation(card(), adapter, {
      maximum: maximum(),
      visualState: state,
      formatting: formatting(),
      observe: (observation) => observations.push(observation),
    });
    const descriptor = composeStandardKanbanCard(value, { width: 20, rowBudget: 10, theme, capabilities });
    const output = [
      value.title,
      value.status,
      ...value.fields.flatMap((field) => [field.label, ...field.values]),
      ...value.summaries.flatMap((summary) => [summary.label, summary.text ?? '']),
      ...value.checklists.flatMap((group) => [group.title ?? '', ...group.items.map((item) => item.text)]),
      text(descriptor.rows),
      ...observations.flatMap((observation) => [observation.code, observation.scope, observation.message ?? '']),
    ].join(' ');

    expect(output).toContain('private');
    expect(output).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u);
    expect(output).not.toContain('CUSTOMER-SECRET');
    for (const row of descriptor.rows) expect(stringWidth(text([row]))).toBeLessThanOrEqual(20);
  });

  it('rejects duplicate identities before invoking affected values and keeps diagnostics payload-free', () => {
    const valueGetter = vi.fn(() => 'must not run');
    const observations: KanbanObservation[] = [];
    const adapter: KanbanCardPresentationAdapter<SecretCard> = {
      keyOf: (value) => value.id,
      titleOf: (value) => value.title,
      statusOf: (value) => value.status,
      fields: [
        { fieldId: 'unsafe', label: 'First', priority: 1, kind: 'text', valueOf: valueGetter },
        { fieldId: 'unsafe', label: 'Duplicate', priority: 2, kind: 'text', valueOf: valueGetter },
      ],
      checklistOf: () => [
        {
          checklistId: 'unsafe-list',
          items: [
            { itemId: 'duplicate', text: 'first', completed: false },
            { itemId: 'duplicate', text: 'second', completed: true },
          ],
        },
      ],
    };
    const snapshot = snapshotKanbanCardPresentation(card(), adapter, {
      maximum: maximum(),
      visualState: state,
      formatting: formatting(),
      observe: (observation) => observations.push(observation),
    });

    expect(valueGetter).not.toHaveBeenCalled();
    expect(snapshot.fields).toEqual([]);
    expect(snapshot.checklists).toEqual([]);
    expect(observations.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(observations)).not.toMatch(/must not run|CUSTOMER-SECRET/u);
  });

  it('isolates throwing getters, formatters, styles, and observers to their optional families', () => {
    const observations: KanbanObservation[] = [];
    const observe = vi.fn((observation: KanbanObservation) => {
      observations.push(observation);
      if (observations.length === 1) throw new Error('OBSERVER-SECRET');
    });
    const adapter: KanbanCardPresentationAdapter<SecretCard> = {
      keyOf: (value) => value.id,
      titleOf: (value) => value.title,
      statusOf: (value) => value.status,
      fields: [
        { fieldId: 'unsafe', label: 'Healthy', priority: 1, kind: 'text', valueOf: () => 'retained' },
        {
          fieldId: 'failed',
          label: 'Getter',
          priority: 2,
          kind: 'text',
          valueOf: (value) => {
            throw new Error(`GETTER ${value.secret}`);
          },
        },
        {
          fieldId: 'date',
          label: 'Formatter',
          priority: 3,
          kind: 'date',
          valueOf: (value) => value.date,
          format: (_value, context) => {
            throw new Error(`FORMAT ${context.locale} CUSTOMER-SECRET`);
          },
        },
      ],
      summaries: [
        {
          summaryId: 'failed-summary',
          label: 'Summary',
          priority: 1,
          valueOf: (value) => {
            throw new Error(`SUMMARY ${value.secret}`);
          },
        },
      ],
      styleOf: (value) => {
        throw new Error(`STYLE ${value.secret}`);
      },
    };
    const snapshot = snapshotKanbanCardPresentation(card(), adapter, {
      maximum: maximum(),
      visualState: state,
      formatting: formatting(),
      observe,
    });

    expect(snapshot.fields.map(({ fieldId }) => fieldId)).toEqual(['unsafe']);
    expect(snapshot.summaries).toEqual([]);
    expect(snapshot.style).toEqual({});
    expect(Object.isFrozen(snapshot.style)).toBe(true);
    expect(observe).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(observations)).not.toMatch(/CUSTOMER-SECRET|GETTER|FORMAT|SUMMARY|STYLE|OBSERVER/u);
  });

  it('passes an opaque date value unchanged exactly once without mutating card data', () => {
    const source = card();
    const before = JSON.stringify(source);
    const formatDate = vi.fn((value: unknown) => (value === source.date ? 'same object' : 'converted'));
    const adapter: KanbanCardPresentationAdapter<SecretCard> = {
      keyOf: (value) => value.id,
      titleOf: (value) => value.title,
      statusOf: (value) => value.status,
      fields: [{ fieldId: 'date', label: 'Date', priority: 1, kind: 'date', valueOf: (value) => value.date }],
    };
    const snapshot = snapshotKanbanCardPresentation(source, adapter, {
      maximum: maximum(),
      visualState: state,
      formatting: formatting(formatDate),
    });

    expect(formatDate).toHaveBeenCalledOnce();
    expect(formatDate).toHaveBeenCalledWith(source.date);
    expect(snapshot.fields[0]?.values).toEqual(['same object']);
    expect(JSON.stringify(source)).toBe(before);
  });
});
