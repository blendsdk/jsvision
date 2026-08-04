import { classicTheme } from '@jsvision/core';
import { signal, stringWidth } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import {
  composeStandardKanbanCard,
  createKanbanTheme,
  resolveKanbanPresentation,
  renderStandardKanbanCard,
  snapshotKanbanCardPresentation,
  validateKanbanCardDescriptor,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardFormattingContext,
  KanbanCardDescriptor,
  KanbanCardPresentationAdapter,
  KanbanCardPresentationMaximum,
  KanbanCardPresentationSnapshot,
  KanbanCardRenderContext,
  KanbanCardVisualState,
  KanbanObservation,
  KanbanThemeRole,
  CardKey,
} from '../src/index.js';
import { createKanbanDescriptorCacheTestHarness } from '../src/testing.js';
import type { KanbanDescriptorCacheKey } from '../src/testing.js';

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
function maximum(
  cardRows = 12,
  checklistMode: 'hidden' | 'progress' | 'preview' = 'preview',
  limits = validateKanbanLimitOptions({ class: 'standard' }),
): KanbanCardPresentationMaximum {
  return {
    budget: resolveKanbanPresentation(
      {
        revision: `rich-${cardRows}`,
        cardRows,
        cardGap: 1,
        metadataFields: Math.min(2, limits.cardFields),
        labelRows: 1,
        summarySections: Math.min(1, limits.summarySections),
        checklistMode,
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

/** Creates a semantic descriptor-cache key for one rich fixture. */
function cacheKey(cardKey: CardKey): KanbanDescriptorCacheKey {
  return {
    generation: 1,
    address: { columnId: 'ready' },
    cursorRevision: 'cursor-v1',
    cardKey,
    rendererRevision: 'rich-v1',
    presentationPolicyRevision: 'rich-12',
    presentationSelectionFingerprint: 'priority,estimate,tasks',
    width: 24,
    rowBudget: 12,
    density: 'comfortable',
    themeRevision: 'theme-v1',
    capabilityRevision: 'capabilities-v1',
    interactionRevision: 'ordinary-v1',
  };
}

describe('rich standard-card implementation', () => {
  it('keeps the convenience renderer compatible while composing rich adapter fields and style once', () => {
    let checklistReads = 0;
    const richAdapter: KanbanCardPresentationAdapter<WorkItem> = {
      ...adapter(),
      checklistOf: (card) => {
        checklistReads += 1;
        return [{ checklistId: 'tasks', items: card.tasks }];
      },
      styleOf: () => ({ surfaceRole: 'wip.warning', borderRole: 'wip.error', glyphFamily: 'ascii' }),
    };
    const descriptor = renderStandardKanbanCard(workItem(), richAdapter, renderContext(snapshot(), 24, 12));

    expect(descriptor.sections.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['title', 'status', 'metadata', 'summary']),
    );
    expect(descriptor.surfaceRole).toBe('wip.warning');
    expect(descriptor.borderRole).toBe('wip.error');
    expect(checklistReads).toBe(1);
    expect(descriptor.sections.some(({ kind }) => kind.startsWith('checklist'))).toBe(false);
  });

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

  it('falls back from malformed selection output and enforces lowered label cardinality locally', () => {
    const observations: KanbanObservation[] = [];
    const limits = validateKanbanLimitOptions({ class: 'standard', values: { cardFields: 1 } });
    const constrainedMaximum: KanbanCardPresentationMaximum = {
      ...maximum(12, 'hidden', limits),
      availableFieldIds: ['labels'],
      availableSummaryIds: [],
      availableChecklistIds: [],
    };
    const malformedSelectionAdapter: KanbanCardPresentationAdapter<WorkItem> = {
      keyOf: (card) => card.id,
      titleOf: (card) => card.title,
      statusOf: (card) => card.status,
      fields: [
        {
          fieldId: 'labels',
          label: 'Labels',
          priority: 1,
          kind: 'labels',
          valueOf: () => ['first', 'second'],
        },
      ],
      selectionOf: () => ({ fieldIds: ['labels'], unexpected: true }),
    };
    const value = snapshotKanbanCardPresentation(workItem(), malformedSelectionAdapter, {
      maximum: constrainedMaximum,
      visualState,
      formatting,
      observe: (observation) => observations.push(observation),
    });

    expect(value.title).toBe(workItem().title);
    expect(value.fields).toEqual([]);
    expect(observations.map(({ code }) => code)).toEqual(['card-selection-failed', 'card-field-failed']);
    expect(JSON.stringify(observations)).not.toContain('unexpected');
  });

  it('wraps labels within their row budget and reports progress without preview omission evidence', () => {
    const labelsAdapter: KanbanCardPresentationAdapter<WorkItem> = {
      keyOf: (card) => card.id,
      titleOf: (card) => card.title,
      statusOf: (card) => card.status,
      fields: [
        {
          fieldId: 'labels',
          label: 'Labels',
          priority: 1,
          kind: 'labels',
          valueOf: () => ['customer-impacting', 'database', 'latency'],
        },
      ],
      checklistOf: (card) => [{ checklistId: 'tasks', items: card.tasks }],
    };
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    const labelMaximum: KanbanCardPresentationMaximum = {
      ...maximum(12, 'preview', limits),
      budget: resolveKanbanPresentation(
        {
          revision: 'label-wrap',
          cardRows: 12,
          cardGap: 1,
          metadataFields: 1,
          labelRows: 2,
          summarySections: 0,
          checklistMode: 'preview',
          checklistPreviewItems: 1,
        },
        limits,
      ),
      availableFieldIds: ['labels'],
      availableSummaryIds: [],
    };
    const labels = snapshotKanbanCardPresentation(workItem(), labelsAdapter, {
      maximum: labelMaximum,
      visualState,
      formatting,
    });
    const wrapped = composeStandardKanbanCard(labels, { width: 18, rowBudget: 12, theme, capabilities });
    expect(wrapped.rows.filter(({ section }) => section === 'labels')).toHaveLength(2);
    expect(wrapped.rows.filter(({ section }) => section === 'labels')[1]?.spans[0]?.text).toContain('…');

    const progress = snapshotKanbanCardPresentation(workItem(), adapter(), {
      maximum: maximum(12, 'progress'),
      visualState,
      formatting,
    });
    const progressDescriptor = composeStandardKanbanCard(progress, {
      width: 24,
      rowBudget: 12,
      theme,
      capabilities,
    });
    const progressText = progressDescriptor.rows
      .filter(({ section }) => section === 'checklist-progress')
      .flatMap(({ spans }) => spans)
      .map(({ text }) => text)
      .join('');
    expect(progressText).toBe('1/3');
  });

  it('contains hostile field descriptors without invoking accessors or leaking observer failures', () => {
    const secret = 'field-schema-secret';
    let accessorCalls = 0;
    const hostileAdapter: KanbanCardPresentationAdapter<WorkItem> = {
      keyOf: (card) => card.id,
      titleOf: (card) => card.title,
      statusOf: (card) => card.status,
      fields: [
        {
          fieldId: 'priority',
          label: 'Priority',
          priority: 1,
          kind: 'text',
          valueOf: (card) => card.priority,
          get role(): KanbanThemeRole {
            accessorCalls += 1;
            throw new Error(secret);
          },
        },
      ],
      checklistOf: (card) => [{ checklistId: 'tasks', items: card.tasks }],
    };
    const value = snapshotKanbanCardPresentation(workItem(), hostileAdapter, {
      maximum: maximum(),
      visualState,
      formatting,
      observe: () => {
        throw new Error(secret);
      },
    });

    expect(accessorCalls).toBe(0);
    expect(value.fields).toEqual([]);
    expect(value.checklists[0]?.items).toHaveLength(3);
  });

  it('rejects hostile descriptor text and geometry with a payload-free package error', () => {
    const value = snapshot();
    const context = renderContext(value, 24, 12);
    const valid = composeStandardKanbanCard(value, { width: 24, rowBudget: 12, theme, capabilities });
    const secret = 'descriptor-secret';
    const hostileText: KanbanCardDescriptor = {
      ...valid,
      rows: [
        {
          ...valid.rows[0]!,
          spans: [{ ...valid.rows[0]!.spans[0]!, text: `${secret}\u001b[31m` }],
        },
        ...valid.rows.slice(1),
      ],
    };
    const hostileGeometry: KanbanCardDescriptor = {
      ...valid,
      regions: valid.regions.map((region, index) => (index === 0 ? { ...region, width: valid.width + 1 } : region)),
    };

    for (const descriptor of [hostileText, hostileGeometry]) {
      let thrown: unknown;
      try {
        validateKanbanCardDescriptor(descriptor, context);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeDefined();
      expect(String(thrown)).not.toContain(secret);
    }
  });

  it('applies semantic role and non-color cue precedence for every interaction branch', () => {
    const cases = [
      [{ invalid: true }, 'operation.rejected', ['rejected']],
      [{ operation: 'rejected' as const }, 'operation.rejected', ['rejected']],
      [{ operation: 'pending' as const }, 'operation.pending', ['pending']],
      [{ operation: 'grabbed' as const }, 'card.grabbed', ['grabbed']],
      [{ focused: true, selected: true }, 'card.focused-selected', ['focused', 'selected']],
      [{ focused: true }, 'card.focused', ['focused']],
      [{ selected: true }, 'card.selected', ['selected']],
      [{ rangeAnchor: true }, 'card.selected', ['selected']],
      [{ readOnly: true }, 'card.read-only', ['read-only']],
      [{}, 'card.normal', []],
    ] as const;

    for (const [replacement, expectedRole, expectedCues] of cases) {
      const state: KanbanCardVisualState = {
        focused: false,
        selected: false,
        rangeAnchor: false,
        readOnly: false,
        invalid: false,
        operation: 'idle',
        ...replacement,
      };
      const value = snapshotKanbanCardPresentation(workItem(), adapter(), {
        maximum: maximum(),
        visualState: state,
        formatting,
      });
      const descriptor = composeStandardKanbanCard(value, { width: 24, rowBudget: 12, theme, capabilities });

      expect(descriptor.surfaceRole).toBe(expectedRole);
      expect(descriptor.borderRole).toBe(expectedRole);
      expect(descriptor.marker.cues).toEqual(expectedCues);
      expect(stringWidth(descriptor.marker.glyph)).toBe(1);
      const feedbackRows = descriptor.rows.filter(({ section }) => section === 'feedback');
      expect(feedbackRows).toHaveLength(
        state.invalid || state.operation === 'rejected' || state.operation === 'pending' ? 1 : 0,
      );
    }
  });

  it('compacts active feedback into the mandatory status row at the two-row minimum', () => {
    const states: readonly KanbanCardVisualState[] = [
      { ...visualState, operation: 'pending' },
      { ...visualState, operation: 'rejected' },
      { ...visualState, invalid: true },
    ];
    for (const state of states) {
      const value = snapshotKanbanCardPresentation(workItem(), adapter(), {
        maximum: maximum(),
        visualState: state,
        formatting,
      });
      const descriptor = composeStandardKanbanCard(value, {
        width: 24,
        rowBudget: 2,
        theme,
        capabilities,
        feedbackLabels: { pending: '\u001b', invalid: '\u001b', rejected: '\u001b' },
      });
      const statusText = descriptor.rows[1]?.spans.map(({ text }) => text).join('') ?? '';

      expect(descriptor.measuredHeight).toBe(2);
      expect(descriptor.sections.map(({ kind }) => kind)).toEqual(['title', 'status']);
      expect(statusText).toMatch(/Pending|Rejected|Invalid/u);
      expect(statusText).not.toContain('\u001b');
      expect(descriptor.marker.cues).toContain(state.operation === 'pending' ? 'pending' : 'rejected');
    }
  });

  it('reactively rebuilds only the affected retained descriptor and contains rejected rebuilds', () => {
    const title = signal<string | null>('First title');
    const neighborTitle = signal('Neighbor title');
    const harness = createKanbanDescriptorCacheTestHarness({ maximumEntries: 2 });
    const firstKey = cacheKey(7);
    const neighborKey = cacheKey(8);
    const create = (cardKey: number, source: () => string | null) => () => {
      const currentTitle = source();
      if (currentTitle === null) throw new Error('rebuild-secret');
      const value = snapshotKanbanCardPresentation({ ...workItem(), id: cardKey, title: currentTitle }, adapter(), {
        maximum: maximum(),
        visualState,
        formatting,
      });
      return composeStandardKanbanCard(value, { width: 24, rowBudget: 12, theme, capabilities });
    };
    const first = harness.getOrCreate(firstKey, create(7, title));
    const neighbor = harness.getOrCreate(neighborKey, create(8, neighborTitle));

    title.set('Updated title');
    const updated = harness.getOrCreate(firstKey, create(7, title));
    expect(updated).not.toBe(first);
    expect(harness.getOrCreate(neighborKey, create(8, neighborTitle))).toBe(neighbor);
    expect(harness.snapshot()).toMatchObject({ rebuilt: 1, invalidations: 1, activeComputations: 2 });

    title.set(null);
    expect(harness.getOrCreate(firstKey, create(7, title))).toBe(updated);
    expect(harness.snapshot()).toMatchObject({ rebuilt: 1, invalidations: 1, activeComputations: 2 });

    title.set('Recovered title');
    expect(harness.getOrCreate(firstKey, create(7, title))).not.toBe(updated);
    expect(harness.snapshot()).toMatchObject({ rebuilt: 2, invalidations: 2, activeComputations: 2 });

    harness.retain([neighborKey]);
    const afterRetention = harness.snapshot();
    title.set('Disposed title');
    expect(harness.snapshot()).toEqual(afterRetention);
    harness.dispose();
  });
});
