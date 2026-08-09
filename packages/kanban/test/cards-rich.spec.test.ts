import { classicTheme } from '@jsvision/core';
import { Group, createRenderRoot, resolveCapabilities, signal, stringWidth } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  composeStandardKanbanCard,
  createEagerKanbanDataSource,
  createKanbanTheme,
  KanbanBoard,
  KanbanViewport,
  resolveKanbanPresentation,
  renderStandardKanbanCard,
  snapshotKanbanCardPresentation,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCardDescriptor,
  KanbanCardFormattingContext,
  KanbanCardPresentationAdapter,
  KanbanCardPresentationMaximum,
  KanbanCardPresentationSnapshot,
  KanbanCardRenderContext,
  KanbanCardSectionKind,
  KanbanCardVisualState,
  KanbanPresentationInput,
} from '../src/index.js';
import { createKanbanDescriptorCacheTestHarness } from '../src/testing.js';
import type { KanbanDescriptorCacheKey } from '../src/testing.js';

interface Ticket {
  readonly ticketNumber: CardKey;
  readonly columnId: string;
  readonly caption: string;
  readonly stateLabel: string;
  readonly revision: string;
  readonly priority: string;
  readonly labels: string[];
  readonly due: object;
  readonly points: number;
  readonly childLabels: readonly string[];
  readonly tasks: readonly { readonly itemId: string; readonly text: string; readonly completed: boolean }[];
}

const theme = createKanbanTheme(classicTheme);
const capabilities = { colorDepth: 'mono', widthMode: 'wcwidth', boxDrawing: true, ambiguousWide: false } as const;
const formatting: KanbanCardFormattingContext = {
  locale: 'en',
  formatNumber: (value) => String(value),
  formatDate: () => undefined,
};

function visualState(replacement: Partial<KanbanCardVisualState> = {}): KanbanCardVisualState {
  return {
    focused: true,
    selected: false,
    rangeAnchor: false,
    readOnly: false,
    invalid: false,
    operation: 'idle',
    ...replacement,
  };
}

function maximum(input: KanbanPresentationInput = 'comfortable'): KanbanCardPresentationMaximum {
  const limits = validateKanbanLimitOptions({ class: 'standard' });
  return {
    budget: resolveKanbanPresentation(input, limits),
    limits,
    availableFieldIds: ['priority', 'labels', 'due', 'points'],
    availableSummaryIds: ['children'],
    availableChecklistIds: ['tasks', 'quality'],
  };
}

function ticket(replacement: Partial<Ticket> = {}): Ticket {
  return {
    ticketNumber: 417,
    columnId: 'ready',
    caption: 'Production alert',
    stateLabel: 'Triage',
    revision: 'ticket-417-v1',
    priority: 'High',
    labels: ['backend', 'customer'],
    due: { instant: '2027-01-02T03:04:05Z' },
    points: 8,
    childLabels: Array.from({ length: 100 }, (_, index) => `child-${index}`),
    tasks: [
      { itemId: 'one', text: 'First task', completed: true },
      { itemId: 'two', text: 'Second task', completed: false },
      { itemId: 'three', text: 'Long final task ending beyond the edge 界', completed: false },
    ],
    ...replacement,
  };
}

function adapter(
  dateFormat: (value: unknown, context: KanbanCardFormattingContext) => string | undefined = vi.fn(() => 'Jan 2'),
): KanbanCardPresentationAdapter<Ticket> {
  return {
    keyOf: (card) => card.ticketNumber,
    titleOf: (card) => card.caption,
    statusOf: (card) => card.stateLabel,
    presentationRevisionOf: (card) => card.revision,
    fields: [
      { fieldId: 'priority', label: 'Priority', priority: 1, kind: 'text', valueOf: (card) => card.priority },
      { fieldId: 'labels', label: 'Labels', priority: 3, kind: 'labels', valueOf: (card) => card.labels },
      { fieldId: 'due', label: 'Due', priority: 2, kind: 'date', valueOf: (card) => card.due, format: dateFormat },
      { fieldId: 'points', label: 'Points', priority: 4, kind: 'number', valueOf: (card) => card.points },
    ],
    summaries: [
      {
        summaryId: 'children',
        label: 'Children',
        priority: 5,
        valueOf: (card) => ({ count: card.childLabels.length }),
      },
    ],
    checklistOf: (card) => [{ checklistId: 'tasks', title: 'Tasks', items: card.tasks }],
    selectionOf: () => ({ fieldIds: ['due', 'priority', 'labels', 'points'] }),
    styleOf: (_card, state) => ({
      revision: state.focused ? 'style-focused' : 'style-ordinary',
      surfaceRole: state.selected ? 'card.focused-selected' : 'card.focused',
      titleRole: 'content.title',
      textRole: 'content.metadata',
      glyphFamily: 'ascii',
    }),
  };
}

function snapshot(card: Ticket, input: KanbanPresentationInput = 'spacious'): KanbanCardPresentationSnapshot {
  const configured = maximum(input);
  return snapshotKanbanCardPresentation(card, adapter(), {
    maximum: configured,
    visualState: visualState(),
    formatting,
  });
}

function descriptorText(descriptor: KanbanCardDescriptor, section?: KanbanCardSectionKind): string {
  return descriptor.rows
    .filter((row) => section === undefined || row.section === section)
    .flatMap((row) => row.spans)
    .map((span) => span.text)
    .join(' ');
}

function hasChecklist(descriptor: KanbanCardDescriptor): boolean {
  return descriptor.sections.some(({ kind }) => kind === 'checklist-progress' || kind === 'checklist-preview');
}
function compose(value: KanbanCardPresentationSnapshot, width = 24, rowBudget = 12): KanbanCardDescriptor {
  return composeStandardKanbanCard(value, { width, rowBudget, theme, capabilities });
}

function custom(checklistMode: 'hidden' | 'progress' | 'preview', cardRows = 12): KanbanPresentationInput {
  return {
    revision: `custom-${checklistMode}-${cardRows}`,
    cardRows,
    cardGap: 1,
    metadataFields: 4,
    labelRows: 2,
    summarySections: 1,
    checklistMode,
    checklistPreviewItems: 2,
  };
}

function cacheKey(cardKey: CardKey, styleRevision: string): KanbanDescriptorCacheKey {
  return {
    generation: 1,
    address: { columnId: 'ready' },
    cursorRevision: 'cursor-v1',
    cardKey,
    rendererRevision: 'renderer-v1',
    presentationRevision: `card-${String(cardKey)}-v1`,
    presentationPolicyRevision: 'policy-v1',
    presentationSelectionFingerprint: 'fields:priority',
    styleRevision,
    width: 24,
    rowBudget: 8,
    density: 'comfortable',
    themeRevision: 'theme-v1',
    capabilityRevision: 'capability-v1',
    interactionRevision: 'interaction-v1',
  };
}

function cachedDescriptor(cardKey: CardKey, label: string): KanbanCardDescriptor {
  const value = compose(snapshot(ticket({ ticketNumber: cardKey, caption: label })), 24, 8);
  return value;
}

/** Delivers one key through the mounted viewport and exposes synchronous handled propagation. */
function dispatchCardKey(board: KanbanBoard<Ticket>, key: string): DispatchEvent {
  const event: DispatchEvent = {
    event: { type: 'key', key, ctrl: false, alt: false, shift: false },
    handled: false,
  };
  board.viewport.onEvent(event);
  return event;
}

/** Delivers one pointer phase at a published semantic target. */
function dispatchCardPointer(
  board: KanbanBoard<Ticket>,
  target: { readonly x: number; readonly y: number },
  kind: 'down' | 'up',
  clickCount?: number,
): DispatchEvent {
  const event: DispatchEvent = {
    event: { type: 'mouse', kind, button: 0, x: target.x, y: target.y },
    handled: false,
    local: { x: target.x, y: target.y },
    ...(clickCount === undefined ? {} : { clickCount }),
  };
  board.viewport.onEvent(event);
  return event;
}

/** Waits for the facade's serialized transition and intent delivery queue. */
async function settleCardInteraction(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('rich Kanban card presentation', () => {
  it('snapshots generic fields, labels, dates, summaries, checklists, selection, and style once', () => {
    const due = { instant: 'opaque-date-value' };
    const card = ticket({ due });
    const dateFormat = vi.fn((value: unknown) => (value === due ? 'unchanged date' : 'wrong date'));
    const value = snapshotKanbanCardPresentation(card, adapter(dateFormat), {
      maximum: maximum('spacious'),
      visualState: visualState(),
      formatting,
    });

    expect(value.cardKey).toBe(card.ticketNumber);
    expect(value.presentationRevision).toBe(card.revision);
    expect(value.fields.map(({ fieldId }) => fieldId)).toEqual(['due', 'priority', 'labels', 'points']);
    expect(value.fields.map(({ values }) => values)).toEqual([
      ['unchanged date'],
      ['High'],
      ['backend', 'customer'],
      ['8'],
    ]);
    expect(dateFormat).toHaveBeenCalledOnce();
    expect(dateFormat).toHaveBeenCalledWith(due, formatting);
    expect(value.summaries).toEqual([{ summaryId: 'children', label: 'Children', priority: 5, count: 100 }]);
    expect(value.checklists[0]?.items.map(({ itemId }) => itemId)).toEqual(['one', 'two', 'three']);
    expect(value.style).toMatchObject({ revision: 'style-focused', glyphFamily: 'ascii' });
    expect([value, value.fields, value.checklists[0]?.items].every(Object.isFrozen)).toBe(true);
  });

  it.each(['compact', 'comfortable', 'spacious'] as const)(
    'keeps mandatory semantics bounded and deterministic at widths 18 through 32 for %s',
    (preset) => {
      const value = snapshot(ticket(), preset);
      for (let width = 18; width <= 32; width += 1) {
        const first = compose(value, width, value.selection.budget.cardRows);
        const second = compose(value, width, value.selection.budget.cardRows);
        expect(first).toEqual(second);
        expect(first.width).toBe(width);
        expect(first.measuredHeight).toBeLessThanOrEqual(value.selection.budget.cardRows);
        expect(descriptorText(first, 'title').trim()).not.toBe('');
        expect(descriptorText(first, 'status').trim()).not.toBe('');
        expect(first.marker.cues).toContain('focused');
        for (const row of first.rows)
          expect(stringWidth(descriptorText({ ...first, rows: [row] }))).toBeLessThanOrEqual(width);
      }
    },
  );

  it('renders hidden, progress, preview, empty, and publication-order checklist semantics without mutation', () => {
    const card = ticket();
    const before = JSON.stringify(card);
    const hidden = compose(snapshot(card, 'comfortable'));
    const progress = compose(snapshot(card, custom('progress')));
    const preview = compose(snapshot(card, custom('preview')));
    const empty = compose(snapshot(ticket({ tasks: [] }), custom('preview')));
    const republished = snapshot(
      ticket({ tasks: [card.tasks[2]!, { ...card.tasks[0]!, text: 'Edited first' }] }),
      custom('preview'),
    );

    expect(hasChecklist(hidden)).toBe(false);
    expect(descriptorText(progress, 'checklist-progress')).toMatch(/1.*3/u);
    expect(descriptorText(preview, 'checklist-preview')).toContain('First task');
    expect(descriptorText(preview, 'checklist-preview')).toContain('Second task');
    expect(descriptorText(preview, 'checklist-preview')).not.toContain('Long final task');
    expect(descriptorText(preview, 'checklist-preview')).toContain('+1');
    expect(hasChecklist(empty)).toBe(false);
    expect(republished.checklists[0]?.items.map(({ itemId }) => itemId)).toEqual(['three', 'one']);
    expect(republished.checklists[0]?.items[1]?.text).toBe('Edited first');
    expect(JSON.stringify(card)).toBe(before);
    const tasks = [{ itemId: 'wide', text: 'Very long item ending 界', completed: false }];
    const wide = compose(snapshot(ticket({ tasks }), custom('preview')), 18);
    expect(wide.rows.every((row) => stringWidth(descriptorText({ ...wide, rows: [row] })) <= 18)).toBe(true);
    expect(descriptorText(wide)).not.toContain('\ufffd');
  });

  it('degrades preview before progress and optional families while preserving mandatory rows and unique omissions', () => {
    const value = snapshot(ticket(), custom('preview'));
    const reduced = compose(value, 20, 4);
    const minimum = compose(value, 18, 2);

    expect(descriptorText(reduced, 'checklist-preview')).not.toContain('Second task');
    expect(minimum.sections.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['title', 'status']));
    expect(hasChecklist(minimum)).toBe(false);
    expect(new Set(minimum.degradation.omittedSections).size).toBe(minimum.degradation.omittedSections.length);
    expect(minimum.measuredHeight).toBeLessThanOrEqual(2);
  });

  it('invalidates and rebuilds only the selected retained descriptor and disposes computations with retention', () => {
    const invalidated: Readonly<KanbanDescriptorCacheKey>[] = [];
    const harness = createKanbanDescriptorCacheTestHarness({
      maximumEntries: 2,
      onDescriptorInvalidated: (key) => invalidated.push(key),
    });
    const firstKey = cacheKey(1, 'style-v1');
    const neighborKey = cacheKey('1', 'style-v1');
    const first = harness.getOrCreate(firstKey, () => cachedDescriptor(1, 'First'));
    const neighbor = harness.getOrCreate(neighborKey, () => cachedDescriptor('1', 'Neighbor'));

    expect(harness.invalidate({ cardKey: 1, styleRevision: 'style-v1' })).toBe(1);
    const rebuilt = harness.getOrCreate(firstKey, () => cachedDescriptor(1, 'First rebuilt'));
    expect(rebuilt).not.toBe(first);
    expect(harness.getOrCreate(neighborKey, () => cachedDescriptor('1', 'Changed neighbor'))).toBe(neighbor);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0]).toEqual(firstKey);
    expect(Object.isFrozen(invalidated[0])).toBe(true);
    expect(harness.snapshot()).toMatchObject({ retained: 2, rebuilt: 1, invalidations: 1, activeComputations: 2 });

    harness.retain([neighborKey]);
    expect(harness.snapshot()).toMatchObject({ retained: 1, activeComputations: 1 });
    const beforeEviction = harness.snapshot().disposed;
    harness.getOrCreate(cacheKey(2, 'style-v1'), () => cachedDescriptor(2, 'Second'));
    harness.getOrCreate(cacheKey(3, 'style-v1'), () => cachedDescriptor(3, 'Third'));
    expect(harness.snapshot()).toMatchObject({ retained: 2, activeComputations: 2, disposed: beforeEviction + 1 });
    harness.dispose();
    expect(harness.snapshot()).toMatchObject({ retained: 0, activeComputations: 0, disposed: beforeEviction + 3 });
  });

  it('mounts rich variable-height descriptors without one view per logical card', () => {
    const due = { instant: 'mounted-opaque-date' };
    const dateFormat = vi.fn((value: unknown) => (value === due ? 'Unchanged date' : 'Wrong date'));
    const mountedAdapter = adapter(dateFormat);
    const cards = signal<readonly Ticket[]>([
      ticket({
        ticketNumber: 1,
        caption: 'Preview card',
        due,
        tasks: [
          { itemId: 'one', text: 'First task', completed: true },
          { itemId: 'two', text: 'Long task ending beyond the mounted edge 界', completed: false },
          { itemId: 'three', text: 'Third task', completed: false },
        ],
      }),
      ticket({ ticketNumber: 2, caption: 'Compact neighbor', tasks: [] }),
    ]);
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
      keyOf: (card: Ticket) => card.ticketNumber,
      columnOf: (card: Ticket) => card.columnId,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => ({ filters: [], sort: [] }),
      card: mountedAdapter,
      presentation: () => custom('preview', 12),
      formatting: () => formatting,
      cardPresentation: (card: Ticket) => ({
        selection: card.ticketNumber === 1 ? { checklistIds: ['tasks'] } : { checklistIds: [] },
        visualState: visualState({ focused: card.ticketNumber === 1 }),
      }),
    });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 18 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot(
      { width: 40, height: 18 },
      { caps: resolveCapabilities({ env: {}, platform: 'linux' }).profile },
    );
    render.mount(host);
    render.flush();
    const inspection = viewport.inspection();
    const first = inspection.visibleCards.find(({ cardKey }) => cardKey === 1);
    const neighbor = inspection.visibleCards.find(({ cardKey }) => cardKey === 2);
    const firstText =
      first?.descriptor.rows
        .flatMap(({ spans }: { readonly spans: readonly { readonly text: string }[] }) =>
          spans.map(({ text }: { readonly text: string }) => text),
        )
        .join(' ') ?? '';

    expect(first?.descriptor.sections.map(({ kind }: { readonly kind: string }) => kind)).toEqual(
      expect.arrayContaining(['title', 'status', 'checklist-preview']),
    );
    expect(first?.descriptor.measuredHeight).toBeGreaterThan(neighbor?.descriptor.measuredHeight ?? 0);
    expect(first?.descriptor.marker.cues).toContain('focused');
    expect(firstText).toContain('First task');
    expect(firstText).toContain('+1');
    expect(firstText).not.toContain('child-0');
    expect(firstText).not.toContain('\ufffd');
    expect(
      neighbor?.descriptor.sections.some(({ kind }: { readonly kind: string }) => kind.startsWith('checklist')),
    ).toBe(false);
    expect(dateFormat).toHaveBeenCalledWith(due, formatting);
    expect(inspection.mountedCardViews).toBe(0);
    expect(inspection.visibleCards.every(({ descriptor }) => Object.isFrozen(descriptor))).toBe(true);

    const firstDescriptor = first?.descriptor;
    const neighborDescriptor = neighbor?.descriptor;
    cards.set([
      ticket({
        ...cards()[0],
        revision: 'ticket-1-v2',
        stateLabel: 'In progress',
        tasks: [cards()[0]!.tasks[2]!, cards()[0]!.tasks[0]!],
      }),
      cards()[1]!,
    ]);
    render.flush();
    const republished = viewport.inspection();
    const changed = republished.visibleCards.find(({ cardKey }) => cardKey === 1);
    const unchangedNeighbor = republished.visibleCards.find(({ cardKey }) => cardKey === 2);
    expect(changed?.descriptor).not.toBe(firstDescriptor);
    expect(unchangedNeighbor?.descriptor).toBe(neighborDescriptor);
    const changedText = changed?.descriptor.rows
      .flatMap(({ spans }: { readonly spans: readonly { readonly text: string }[] }) =>
        spans.map(({ text }: { readonly text: string }) => text),
      )
      .join(' ');
    expect(changedText).toContain('In progress');
    expect(changedText).toContain('Third task');

    render.unmount();
  });

  it('contains invalid mounted custom output and throwing rich callbacks to the affected card', () => {
    const observations: unknown[] = [];
    const cards: readonly Ticket[] = [
      ticket({ ticketNumber: 1, caption: 'Affected card' }),
      ticket({ ticketNumber: 2, caption: 'Usable neighbor' }),
    ];
    const baseAdapter = adapter();
    const hostileAdapter: KanbanCardPresentationAdapter<Ticket> = {
      ...baseAdapter,
      fields: [
        {
          fieldId: 'priority',
          label: 'Priority',
          priority: 1,
          kind: 'text',
          valueOf: (card) => {
            if (card.ticketNumber === 1) throw new Error('field-secret\u001b[31m');
            return card.priority;
          },
        },
      ],
      styleOf: (card, state) => {
        if (card.ticketNumber === 1) throw new Error('style-secret');
        return baseAdapter.styleOf!(card, state);
      },
    };
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
      keyOf: (card: Ticket) => card.ticketNumber,
      columnOf: (card: Ticket) => card.columnId,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => ({ filters: [], sort: [] }),
      card: hostileAdapter,
      presentation: () => custom('preview', 12),
      formatting: () => formatting,
      rendererRevision: () => 'mounted-custom-v1',
      renderer: () => ({
        render: (card: Ticket, context: KanbanCardRenderContext) => {
          const valid = renderStandardKanbanCard(card, hostileAdapter, context);
          return card.ticketNumber === 1 ? { ...valid, measuredHeight: context.rowBudget + 1 } : valid;
        },
      }),
      observe: (observation) => observations.push(observation),
    });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 18 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot(
      { width: 40, height: 18 },
      { caps: resolveCapabilities({ env: {}, platform: 'linux' }).profile },
    );
    render.mount(host);
    render.flush();
    const inspection = viewport.inspection();
    const affected = inspection.visibleCards.find(({ cardKey }) => cardKey === 1);
    const neighbor = inspection.visibleCards.find(({ cardKey }) => cardKey === 2);

    expect(affected?.descriptor.degradation.level).toBe('fallback');
    expect(neighbor?.descriptor.degradation.level).not.toBe('fallback');
    expect(JSON.stringify(inspection)).not.toMatch(/field-secret|style-secret|\u001b/u);
    expect(JSON.stringify(observations)).not.toMatch(/field-secret|style-secret|\u001b/u);
    expect(inspection.visibleCards).toHaveLength(2);

    render.unmount();
  });

  it('opens a read-only checklist through Enter, double-click, and its explicit action while Space only selects', async () => {
    // Checklist activation emits one editor intent per gesture and never edits application-owned task state.
    const cards = signal<readonly Ticket[]>([ticket({ ticketNumber: 1, caption: 'Checklist card' })]);
    const before = JSON.stringify(cards());
    const intents: unknown[] = [];
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
      keyOf: (card: Ticket) => card.ticketNumber,
      columnOf: (card: Ticket) => card.columnId,
    });
    const board = new KanbanBoard({
      source,
      query: () => ({ filters: [], sort: [] }),
      card: adapter(),
      presentation: () => custom('preview', 12),
      formatting: () => formatting,
      cardPresentation: () => ({ selection: { checklistIds: ['tasks'] }, visualState: visualState() }),
      onInteraction: (intent: unknown) => intents.push(intent),
    });
    board.setLayout({ position: 'fill' });
    const host = new Group();
    host.add(board);
    const render = createRenderRoot(
      { width: 40, height: 18 },
      { caps: resolveCapabilities({ env: {}, platform: 'linux' }).profile },
    );
    render.mount(host);
    render.flush();

    const space = dispatchCardKey(board, 'space');
    await settleCardInteraction();
    expect(space.handled).toBe(true);
    expect(board.interaction().snapshot().selectedCardKeys).toEqual([1]);
    expect(intents).toEqual([]);

    const enter = dispatchCardKey(board, 'enter');
    await settleCardInteraction();
    expect(enter.handled).toBe(true);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ kind: 'open-card', origin: 'keyboard' });

    const action = board
      .inspection()
      .actionTargets.find((target) => target.kind === 'card-action' && target.actionId === 'kanban.card.open-editor');
    if (action === undefined) throw new Error('Expected one mounted checklist editor action target.');
    const actionDown = dispatchCardPointer(board, action, 'down', 1);
    const actionUp = dispatchCardPointer(board, action, 'up');
    await settleCardInteraction();
    expect([actionDown.handled, actionUp.handled]).toEqual([true, true]);
    expect(intents).toHaveLength(2);
    expect(intents[1]).toMatchObject({ kind: 'open-card', origin: 'pointer', actionId: 'kanban.card.open-editor' });

    const card = board.inspection().actionTargets.find((target) => target.kind === 'card');
    if (card === undefined) throw new Error('Expected one mounted card target.');
    dispatchCardPointer(board, card, 'down', 2);
    dispatchCardPointer(board, card, 'up');
    await settleCardInteraction();
    expect(intents).toHaveLength(3);
    expect(intents[2]).toMatchObject({ kind: 'open-card', origin: 'pointer' });
    expect(intents.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(cards())).toBe(before);
    expect(cards()[0]?.tasks.map(({ completed }) => completed)).toEqual([true, false, false]);

    render.unmount();
  });
});
