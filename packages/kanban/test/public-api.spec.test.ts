import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanRequestEnvelope,
  dispatchKanbanRequest,
  reconcileKanbanPublication,
  snapshotKanbanRequestProposal,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCapabilities,
  KanbanExtensionRequest,
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequestContext,
  KanbanRequestDispatcher,
  KanbanRequestResult,
} from '../src/index.js';
import type { ConsumerRequestCompatibility, RequestUsesSemanticAxisNames } from './fixtures/consumer-types.js';

/** Creates the minimal raw extension request used at the application-authority boundary. */
function createReviewRequest(
  cardKey: CardKey,
  signal: AbortSignal,
): KanbanExtensionRequest<'example.review', { readonly cardKey: CardKey }> {
  return {
    kind: 'extension',
    extensionId: 'example.review',
    operationId: `review-${typeof cardKey}-${String(cardKey)}`,
    expected: {},
    payload: { cardKey },
    signal,
  };
}

/** Creates metadata that describes one expected authoritative card publication. */
function createPublicationExpectation(operationId: string, cardKey: CardKey): KanbanPublicationExpectation {
  return {
    operationId,
    subjects: [
      {
        kind: 'card',
        cardKey,
        baselineRevision: 'before',
        expectedRevision: 'after',
      },
    ],
  };
}

describe('Kanban public authority contracts', () => {
  it('should construct and dispatch a standard proposal through the public package surface', async () => {
    const proposal = snapshotKanbanRequestProposal({ kind: 'card-delete', cardKey: 7 });
    const signal = new AbortController().signal;
    const request = createKanbanRequestEnvelope(proposal, {
      operationId: 'delete-card-7',
      expected: { source: 'source-r8', entities: [{ kind: 'card', cardKey: 7, revision: 'card-r3' }] },
      signal,
    });
    const dispatcher = vi.fn((received) => ({ kind: 'accepted' as const, operationId: received.operationId }));

    await expect(dispatchKanbanRequest(request, dispatcher, { capabilities: {} })).resolves.toEqual({
      kind: 'accepted',
      operationId: 'delete-card-7',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
    expect(dispatcher.mock.calls[0]?.[0]).toMatchObject({ kind: 'card-delete', cardKey: 7, signal });
  });

  it('should adopt the historical extension envelope without replacing its lifecycle values', () => {
    const legacy = createReviewRequest(7, new AbortController().signal);

    const adopted = createKanbanRequestEnvelope(legacy);

    expect(adopted).toEqual(legacy);
    expect(adopted.operationId).toBe(legacy.operationId);
    expect(adopted.signal).toBe(legacy.signal);
  });

  it('should leave authoritative application records unchanged when a raw request is accepted', async () => {
    // Accepted means queued for application handling; only a later source publication commits data.
    const card = Object.freeze({ id: 7, title: 'Awaiting review', status: 'ready' });
    const column = Object.freeze({ id: 'ready', title: 'Ready' });
    const cardBefore = JSON.stringify(card);
    const columnBefore = JSON.stringify(column);
    const request = createReviewRequest(card.id, new AbortController().signal);
    const capabilities: KanbanCapabilities = {};
    const context: KanbanRequestContext = { capabilities };
    const dispatcher: KanbanRequestDispatcher = vi.fn((receivedRequest): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: receivedRequest.operationId,
    }));

    const result = await dispatchKanbanRequest(request, dispatcher, context);

    expect(result).toEqual({ kind: 'accepted', operationId: request.operationId });
    expect(dispatcher).toHaveBeenCalledOnce();
    expect(JSON.stringify(card)).toBe(cardBefore);
    expect(JSON.stringify(column)).toBe(columnBefore);
  });

  it('should dispatch a raw request when its capability description is disabled', async () => {
    // Capabilities describe discoverability and never authorize application data changes.
    const request = createReviewRequest(7, new AbortController().signal);
    const capabilities: KanbanCapabilities = {
      extensions: {
        'example.review': {
          state: 'disabled',
          reasonCode: 'application-policy',
        },
      },
    };
    const context: KanbanRequestContext = { capabilities };
    const rejection: KanbanRequestResult = {
      kind: 'rejected',
      operationId: request.operationId,
      code: 'not-authorized',
      label: 'The application denied this request.',
    };
    const dispatcher: KanbanRequestDispatcher = vi.fn(() => rejection);

    const result = await dispatchKanbanRequest(request, dispatcher, context);

    expect(dispatcher).toHaveBeenCalledWith(request, context);
    expect(result).toEqual(rejection);
  });

  it.each(['matching', 'contradictory'] as const)(
    'should clear pending metadata for a %s authoritative publication without application records',
    (kind) => {
      // Reconciliation observes safe identity and revision metadata, never mutable card bodies.
      const expectation = createPublicationExpectation('review-7', 7);
      const pending = [expectation];
      const notice: KanbanPublicationNotice = {
        kind,
        operationId: expectation.operationId,
        subjects: expectation.subjects,
      };

      const reconciliation = reconcileKanbanPublication(pending, notice);

      expect(reconciliation.pending).toEqual([]);
      expect(reconciliation.cleared).toEqual({
        kind,
        operationId: expectation.operationId,
        subjects: expectation.subjects,
      });
      expect(pending).toEqual([expectation]);
    },
  );

  it('should keep numeric and string card keys in distinct reconciliation entries', () => {
    // Card identity follows JavaScript key identity; stringification must never merge 1 and "1".
    const numeric = createPublicationExpectation('review-number', 1);
    const textual = createPublicationExpectation('review-string', '1');
    const pending = [numeric, textual];
    const notice: KanbanPublicationNotice = {
      kind: 'matching',
      operationId: numeric.operationId,
      subjects: numeric.subjects,
    };

    const reconciliation = reconcileKanbanPublication(pending, notice);

    expect(reconciliation.pending).toEqual([textual]);
    expect(reconciliation.pending[0]?.subjects[0]).toMatchObject({ cardKey: '1' });
  });

  it('should expose semantic column and swimlane terminology in compile-time contracts', () => {
    // These assignments compile only while generic requests are compatible and bare lane stays absent.
    const requestCompatibility: ConsumerRequestCompatibility = true;
    const semanticAxisNames: RequestUsesSemanticAxisNames = true;

    expect(requestCompatibility).toBe(true);
    expect(semanticAxisNames).toBe(true);
  });
});
