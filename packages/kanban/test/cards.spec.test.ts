import { classicTheme } from '@jsvision/core';
import { stringWidth } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanTheme,
  createStandardKanbanCardAdapter,
  renderKanbanCardSafely,
  renderStandardKanbanCard,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCardAdapter,
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardRenderer,
  KanbanCardRow,
  KanbanCardSection,
  KanbanCardSectionKind,
  KanbanCardSpan,
  KanbanObservation,
  KanbanRevision,
  StandardCard,
} from '../src/index.js';

interface ApplicationTicket {
  readonly ticketNumber: CardKey;
  readonly caption: string;
  readonly workflowState: string;
  readonly renderVersion: string;
  readonly applicationOnly: { readonly confidential: boolean };
}

const FALLBACK_LABELS = {
  invalidCardTitle: 'Invalid work item',
  unknownStatus: 'Unknown status',
} as const;

/** Creates the bounded, deterministic context shared by pure card-renderer specifications. */
function renderContext(
  cardKey: CardKey,
  width: number,
  focused = false,
  presentationRevision?: KanbanRevision,
): KanbanCardRenderContext {
  return {
    cardKey,
    ...(presentationRevision === undefined ? {} : { presentationRevision }),
    width,
    rowBudget: 6,
    density: 'compact',
    focused,
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

/** Joins the semantic row text for one standard card section. */
function sectionText(descriptor: KanbanCardDescriptor, section: KanbanCardSectionKind): string {
  return descriptor.rows
    .filter((row: KanbanCardRow) => row.section === section)
    .flatMap((row: KanbanCardRow) => row.spans)
    .map((span: KanbanCardSpan) => span.text)
    .join('');
}

describe('generic Kanban card presentation', () => {
  it('should render an application-owned record through typed adapters without converting its identity or shape', () => {
    // Generic records retain their own field names and object identity throughout pure adapter reads.
    const ticket = Object.freeze<ApplicationTicket>({
      ticketNumber: 417,
      caption: 'Production alert',
      workflowState: 'triage',
      renderVersion: 'ticket-417-v3',
      applicationOnly: Object.freeze({ confidential: true }),
    });
    const before = JSON.stringify(ticket);
    const seenCards: ApplicationTicket[] = [];
    const adapter: KanbanCardAdapter<ApplicationTicket> = {
      keyOf: vi.fn((card) => {
        seenCards.push(card);
        return card.ticketNumber;
      }),
      titleOf: vi.fn((card) => {
        seenCards.push(card);
        return card.caption;
      }),
      statusOf: vi.fn((card) => {
        seenCards.push(card);
        return card.workflowState;
      }),
      presentationRevisionOf: vi.fn((card) => {
        seenCards.push(card);
        return card.renderVersion;
      }),
    };
    const key = adapter.keyOf(ticket);
    const descriptor = renderStandardKanbanCard(
      ticket,
      adapter,
      renderContext(key, 24, false, adapter.presentationRevisionOf?.(ticket)),
    );

    expect(descriptor.cardKey).toBe(ticket.ticketNumber);
    expect(descriptor.presentationRevision).toBe(ticket.renderVersion);
    expect(sectionText(descriptor, 'title')).toContain(ticket.caption);
    expect(sectionText(descriptor, 'status')).toContain(ticket.workflowState);
    expect(seenCards.length).toBeGreaterThan(0);
    expect(seenCards.every((card) => card === ticket)).toBe(true);
    expect(JSON.stringify(ticket)).toBe(before);
    expect(ticket).not.toHaveProperty('key');
    expect(ticket).not.toHaveProperty('title');
    expect(ticket).not.toHaveProperty('status');
  });
});

describe('standard Kanban card Phase A presentation', () => {
  it.each(Array.from({ length: 15 }, (_, index) => index + 18))(
    'should preserve title, status, focus, and stable boundary treatment at width %i',
    (width) => {
      // Mandatory semantics and a one-cell non-color cue survive every supported narrow width.
      const card: StandardCard = {
        key: 'standard-1',
        columnId: 'ready',
        rank: 10,
        presentationRevision: 'standard-1-v2',
        title: 'A readable title that may need terminal-cell ellipsis',
        status: 'Ready for review',
        description: 'DEFERRED-DESCRIPTION',
        type: 'DEFERRED-TYPE',
        priority: 'DEFERRED-PRIORITY',
        assignees: [{ id: 'person-1', label: 'DEFERRED-ASSIGNEE' }],
        labels: [{ id: 'label-1', label: 'DEFERRED-LABEL' }],
        estimate: 'DEFERRED-ESTIMATE',
        value: 'DEFERRED-VALUE',
        summaries: [{ fieldId: 'children', label: 'DEFERRED-SUMMARY', value: '100' }],
        checklists: [
          {
            checklistId: 'tasks',
            title: 'DEFERRED-CHECKLIST',
            items: [{ itemId: 'task-1', text: 'DEFERRED-CHECKLIST-ITEM', completed: false }],
          },
        ],
        custom: { deferred: 'DEFERRED-CUSTOM' },
      };
      const adapter = createStandardKanbanCardAdapter();
      const context = renderContext(card.key, width, true, adapter.presentationRevisionOf?.(card));
      const descriptor = renderStandardKanbanCard(card, adapter, context);
      const baseline = renderStandardKanbanCard(card, adapter, { ...context, width: 18 });
      const title = sectionText(descriptor, 'title');
      const status = sectionText(descriptor, 'status');

      expect(descriptor.width).toBe(width);
      expect(descriptor.cardKey).toBe(card.key);
      expect(descriptor.presentationRevision).toBe(card.presentationRevision);
      expect(title.trim().length).toBeGreaterThan(0);
      expect(status.trim().length).toBeGreaterThan(0);
      expect(stringWidth(title)).toBeLessThanOrEqual(width - 1);
      expect(stringWidth(status)).toBeLessThanOrEqual(width - 1);
      expect(descriptor.marker.cues).toContain('focused');
      expect(stringWidth(descriptor.marker.glyph)).toBe(1);
      expect(descriptor.marker.column).toBeGreaterThanOrEqual(0);
      expect(descriptor.marker.column).toBeLessThan(width);
      expect(descriptor.surfaceRole.length).toBeGreaterThan(0);
      expect(descriptor.borderRole.length).toBeGreaterThan(0);
      expect(descriptor.surfaceRole).toBe(baseline.surfaceRole);
      expect(descriptor.borderRole).toBe(baseline.borderRole);
      expect(descriptor.sections.map((section: KanbanCardSection) => section.kind)).toEqual(['title', 'status']);
      expect(descriptor.actions).toEqual([]);
      expect(descriptor.regions).toEqual([]);
      expect(JSON.stringify(descriptor)).not.toContain('DEFERRED-');
    },
  );

  it('should neutralize terminal controls and keep hostile card content out of diagnostics', () => {
    // Display text is sanitized and normalized before geometry, while diagnostics retain no card fields.
    const card: StandardCard = {
      key: 9,
      columnId: 'ready',
      title: '\u001b[31mConfidential title\u0007\nsecond line',
      status: '\u009b2J\tBlocked',
    };
    const adapter = createStandardKanbanCardAdapter();
    const observations: KanbanObservation[] = [];
    const context = renderContext(card.key, 24, true);
    const renderer: KanbanCardRenderer<StandardCard> = {
      render: (receivedCard: StandardCard, receivedContext: KanbanCardRenderContext) =>
        renderStandardKanbanCard(receivedCard, adapter, receivedContext),
    };

    const descriptor = renderKanbanCardSafely(card, renderer, context, {
      labels: FALLBACK_LABELS,
      observe: (observation: KanbanObservation) => observations.push(observation),
    });
    const renderedText = descriptor.rows
      .flatMap((row: KanbanCardRow) => row.spans)
      .map((span: KanbanCardSpan) => span.text)
      .join(' ');

    expect(renderedText).toContain('Confidential title');
    expect(renderedText).toContain('Blocked');
    expect(renderedText).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    expect(observations).toEqual([]);
  });

  it('should localize a bounded fallback and redact invalid mandatory card values from its observation', () => {
    // Empty mandatory adapter output fails locally and exposes only the stable card key and safe reason code.
    const invalidCard: StandardCard = {
      key: 'invalid-7',
      columnId: 'ready',
      title: '',
      status: '',
      custom: { secret: 'DO-NOT-OBSERVE-THIS' },
    };
    const adapter = createStandardKanbanCardAdapter();
    const context = renderContext(invalidCard.key, 18, true);
    const observations: KanbanObservation[] = [];
    const renderer: KanbanCardRenderer<StandardCard> = {
      render: (card: StandardCard, receivedContext: KanbanCardRenderContext) =>
        renderStandardKanbanCard(card, adapter, receivedContext),
    };

    const descriptor = renderKanbanCardSafely(invalidCard, renderer, context, {
      labels: FALLBACK_LABELS,
      observe: (observation: KanbanObservation) => observations.push(observation),
    });
    const descriptorText = JSON.stringify(descriptor);
    const observationText = JSON.stringify(observations);

    expect(descriptor.degradation.level).toBe('fallback');
    expect(sectionText(descriptor, 'title')).toContain(FALLBACK_LABELS.invalidCardTitle);
    expect(sectionText(descriptor, 'status')).toContain(FALLBACK_LABELS.unknownStatus);
    expect(descriptor.measuredHeight).toBeLessThanOrEqual(context.rowBudget);
    expect(descriptor.actions).toEqual([]);
    expect(descriptor.regions).toEqual([]);
    expect(descriptorText).not.toContain('DO-NOT-OBSERVE-THIS');
    expect(observations).toEqual([{ code: 'card-render-failed', scope: 'renderer', cardKey: invalidCard.key }]);
    expect(observationText).not.toContain('DO-NOT-OBSERVE-THIS');
  });
});
