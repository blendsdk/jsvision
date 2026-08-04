import { classicTheme } from '@jsvision/core';
import { stringWidth } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import {
  composeStandardKanbanCard,
  createKanbanTheme,
  resolveKanbanPresentation,
  snapshotKanbanCardPresentation,
  validateKanbanCardDescriptor,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardFormattingContext,
  KanbanCardPresentationAdapter,
  KanbanCardPresentationMaximum,
  KanbanCardPresentationSnapshot,
  KanbanCardRenderContext,
  KanbanCardVisualState,
  KanbanObservation,
} from '../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly estimate: number;
  readonly tasks: readonly { readonly itemId: string; readonly text: string; readonly completed: boolean }[];
}

const theme = createKanbanTheme(classicTheme);
const capabilities = { colorDepth: 'mono', widthMode: 'wcwidth', boxDrawing: true, ambiguousWide: false } as const;
const formatting: KanbanCardFormattingContext = {
  locale: 'en',
  formatNumber: (value) => String(value),
  formatDate: () => undefined,
};
const visualState: KanbanCardVisualState = {
  focused: true,
  selected: false,
  rangeAnchor: false,
  readOnly: false,
  invalid: false,
  operation: 'idle',
};

/** Returns a detail-rich card with enough optional content to exercise every degradation stage. */
function workItem(): WorkItem {
  return {
    id: 7,
    title: 'Investigate production latency',
    status: 'In progress',
    priority: 'High',
    estimate: 13,
    tasks: [
      { itemId: 'trace', text: 'Collect a representative trace', completed: true },
      { itemId: 'query', text: 'Identify the slow query', completed: false },
      { itemId: 'verify', text: 'Verify the optimized query in staging', completed: false },
    ],
  };
}

/** Creates one custom budget that makes all rich optional families eligible. */
function maximum(cardRows = 12): KanbanCardPresentationMaximum {
  const limits = validateKanbanLimitOptions({ class: 'standard' });
  return {
    budget: resolveKanbanPresentation(
      {
        revision: `rich-${cardRows}`,
        cardRows,
        cardGap: 1,
        metadataFields: 2,
        labelRows: 1,
        summarySections: 1,
        checklistMode: 'preview',
        checklistPreviewItems: 3,
      },
      limits,
    ),
    limits,
    availableFieldIds: ['priority', 'estimate'],
    availableSummaryIds: ['task-count'],
    availableChecklistIds: ['tasks'],
  };
}

/** Creates the ordinary rich adapter used by geometry property tests. */
function adapter(): KanbanCardPresentationAdapter<WorkItem> {
  return {
    keyOf: (card) => card.id,
    titleOf: (card) => card.title,
    statusOf: (card) => card.status,
    fields: [
      { fieldId: 'priority', label: 'Priority', priority: 1, kind: 'text', valueOf: (card) => card.priority },
      { fieldId: 'estimate', label: 'Estimate', priority: 2, kind: 'number', valueOf: (card) => card.estimate },
    ],
    summaries: [
      {
        summaryId: 'task-count',
        label: 'Tasks',
        priority: 3,
        valueOf: (card) => ({ count: card.tasks.length }),
      },
    ],
    checklistOf: (card) => [{ checklistId: 'tasks', title: 'Checklist', items: card.tasks }],
  };
}

/** Snapshots the ordinary fixture through the same public boundary used by applications. */
function snapshot(cardRows = 12): KanbanCardPresentationSnapshot {
  return snapshotKanbanCardPresentation(workItem(), adapter(), {
    maximum: maximum(cardRows),
    visualState,
    formatting,
  });
}

/** Builds the complete validator context matching one rich composition. */
function renderContext(
  value: KanbanCardPresentationSnapshot,
  width: number,
  rowBudget: number,
): KanbanCardRenderContext {
  return {
    cardKey: value.cardKey,
    ...(value.presentationRevision === undefined ? {} : { presentationRevision: value.presentationRevision }),
    width,
    rowBudget,
    density: 'comfortable',
    focused: true,
    selected: false,
    readOnly: false,
    operation: 'idle',
    theme,
    capabilities,
    formatting,
  };
}

describe('rich standard-card implementation', () => {
  it('keeps every width and row-budget projection valid, bounded, and deterministic', () => {
    const value = snapshot();
    for (let width = 18; width <= 32; width += 1) {
      for (let rowBudget = 2; rowBudget <= value.selection.budget.cardRows; rowBudget += 1) {
        const context = { width, rowBudget, theme, capabilities };
        const first = composeStandardKanbanCard(value, context);
        const second = composeStandardKanbanCard(value, context);

        expect(first).toEqual(second);
        expect(first.measuredHeight).toBeGreaterThanOrEqual(2);
        expect(first.measuredHeight).toBeLessThanOrEqual(rowBudget);
        expect(first.sections[0]?.kind).toBe('title');
        expect(first.sections[1]?.kind).toBe('status');
        expect(new Set(first.degradation.omittedSections).size).toBe(first.degradation.omittedSections.length);
        for (const row of first.rows) {
          const text = row.spans.map(({ text: spanText }) => spanText).join('');
          expect(stringWidth(text)).toBeLessThanOrEqual(width - 1);
        }
        expect(() => validateKanbanCardDescriptor(first, renderContext(value, width, rowBudget))).not.toThrow();
      }
    }
  });

  it('degrades monotonically as the available row budget decreases', () => {
    const value = snapshot();
    let previousOptionalRows = Number.POSITIVE_INFINITY;
    let previousHeight = Number.POSITIVE_INFINITY;

    for (let rowBudget = value.selection.budget.cardRows; rowBudget >= 2; rowBudget -= 1) {
      const descriptor = composeStandardKanbanCard(value, { width: 24, rowBudget, theme, capabilities });
      const optionalRows = descriptor.rows.filter((row) => row.section !== 'title' && row.section !== 'status').length;

      expect(descriptor.measuredHeight).toBeLessThanOrEqual(previousHeight);
      expect(optionalRows).toBeLessThanOrEqual(previousOptionalRows);
      expect(descriptor.rows.filter((row) => row.section === 'title')).toHaveLength(1);
      expect(descriptor.rows.filter((row) => row.section === 'status')).toHaveLength(1);
      previousHeight = descriptor.measuredHeight;
      previousOptionalRows = optionalRows;
    }
  });

  it('contains independent optional callback failures and preserves neighboring families', () => {
    const observations: KanbanObservation[] = [];
    const secret = 'tenant-secret-value';
    const failingAdapter: KanbanCardPresentationAdapter<WorkItem> = {
      keyOf: (card) => card.id,
      titleOf: (card) => card.title,
      statusOf: (card) => card.status,
      fields: [
        { fieldId: 'priority', label: 'Priority', priority: 1, kind: 'text', valueOf: (card) => card.priority },
        {
          fieldId: 'estimate',
          label: 'Estimate',
          priority: 2,
          kind: 'number',
          valueOf: () => {
            throw new Error(secret);
          },
        },
      ],
      summaries: [
        {
          summaryId: 'task-count',
          label: 'Tasks',
          priority: 3,
          valueOf: () => {
            throw new Error(secret);
          },
        },
      ],
      checklistOf: (card) => [{ checklistId: 'tasks', items: card.tasks }],
      styleOf: () => {
        throw new Error(secret);
      },
    };
    const value = snapshotKanbanCardPresentation(workItem(), failingAdapter, {
      maximum: maximum(),
      visualState,
      formatting,
      observe: (observation) => observations.push(observation),
    });

    expect(value.fields.map(({ fieldId }) => fieldId)).toEqual(['priority']);
    expect(value.summaries).toEqual([]);
    expect(value.checklists[0]?.items).toHaveLength(3);
    expect(value.style).toEqual({});
    expect(observations.map(({ code }) => code)).toEqual([
      'card-field-failed',
      'card-summary-failed',
      'card-style-failed',
    ]);
    expect(JSON.stringify(observations)).not.toContain(secret);
  });
});
