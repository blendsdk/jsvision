import { describe, expect, it, vi } from 'vitest';

import { KanbanInvalidSemanticValueError, dispatchKanbanRequest, reconcileKanbanPublication } from '../src/index.js';
import { KanbanBoardAuthority } from '../src/board/board-authority.js';
import type {
  KanbanExtensionRequest,
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequestDispatcher,
  KanbanRequestResult,
} from '../src/index.js';

/** Creates one valid application extension request for dispatcher edge coverage. */
function request(operationId = 'review-1'): KanbanExtensionRequest<'example.review', { readonly cardKey: number }> {
  return {
    kind: 'extension',
    extensionId: 'example.review',
    operationId,
    expected: { board: 'board-1', entities: [{ kind: 'card', cardKey: 1, revision: 'card-1' }] },
    payload: { cardKey: 1 },
    signal: new AbortController().signal,
  };
}

/** Creates publication metadata without any application card record. */
function expectation(operationId = 'review-1'): KanbanPublicationExpectation {
  return {
    operationId,
    subjects: [
      {
        kind: 'card',
        cardKey: 1,
        baselineRevision: 'card-1',
        expectedRevision: 'card-2',
      },
    ],
  };
}

describe('dispatcher implementation boundary', () => {
  it('passes detached frozen request and capability snapshots while preserving the live signal', async () => {
    const original = request();
    const capabilities = { extensions: { 'example.review': { state: 'disabled' as const } } };
    const dispatcher: KanbanRequestDispatcher = vi.fn((received, context): KanbanRequestResult => {
      expect(received).not.toBe(original);
      expect(received.signal).toBe(original.signal);
      expect(Object.isFrozen(received)).toBe(true);
      expect(Object.isFrozen(received.payload)).toBe(true);
      expect(Object.isFrozen(received.expected)).toBe(true);
      expect(Object.isFrozen(context.capabilities.extensions)).toBe(true);
      return { kind: 'accepted', operationId: received.operationId };
    });

    await expect(dispatchKanbanRequest(original, dispatcher, { capabilities })).resolves.toEqual({
      kind: 'accepted',
      operationId: original.operationId,
    });
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'throw',
      () => {
        throw new Error('private rejection payload');
      },
    ],
    ['reject', () => Promise.reject(new Error('private async payload'))],
  ] as const)('normalizes an application %s to a sanitized correlated rejection', async (_name, fail) => {
    const original = request();
    const result = await dispatchKanbanRequest(original, fail, { capabilities: {} });

    expect(result).toEqual({ kind: 'rejected', operationId: original.operationId, code: 'dispatcher-failed' });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('never invokes an arbitrary thenable returned by application code', async () => {
    const original = request();
    const then = vi.fn(() => {
      throw new Error('must not run');
    });
    const outcome = {
      kind: 'accepted',
      operationId: original.operationId,
      then,
    } as const;
    const dispatcher = () => outcome;

    await expect(dispatchKanbanRequest(original, dispatcher, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: original.operationId,
      code: 'invalid-dispatch-result',
    });
    expect(then).not.toHaveBeenCalled();
  });

  it('never invokes request or capability accessors before rejecting malformed boundary data', async () => {
    const requestGetter = vi.fn(() => 'example.review');
    const capabilityGetter = vi.fn(() => ({}));
    const hostileRequest = Object.defineProperty(request(), 'extensionId', {
      enumerable: true,
      get: requestGetter,
    });
    const hostileCapabilities = Object.defineProperty({}, 'extensions', {
      enumerable: true,
      get: capabilityGetter,
    });
    const dispatcher: KanbanRequestDispatcher = vi.fn((): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: 'review-1',
    }));

    await expect(
      dispatchKanbanRequest(hostileRequest, dispatcher, { capabilities: hostileCapabilities }),
    ).rejects.toThrow(KanbanInvalidSemanticValueError);
    await expect(dispatchKanbanRequest(request(), dispatcher, { capabilities: hostileCapabilities })).rejects.toThrow(
      KanbanInvalidSemanticValueError,
    );
    expect(requestGetter).not.toHaveBeenCalled();
    expect(capabilityGetter).not.toHaveBeenCalled();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('rejects prototype meta-properties without invoking inherited accessors', async () => {
    const getter = vi.fn(() => 'extension');
    const injectedPrototype = Object.defineProperty({}, 'kind', { get: getter });
    const hostileRequest = Object.defineProperty(request(), '__proto__', {
      enumerable: true,
      value: injectedPrototype,
    });
    const dispatcher: KanbanRequestDispatcher = vi.fn((): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: 'review-1',
    }));

    await expect(dispatchKanbanRequest(hostileRequest, dispatcher, { capabilities: {} })).rejects.toThrow(
      KanbanInvalidSemanticValueError,
    );
    expect(getter).not.toHaveBeenCalled();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('rejects Promise subclasses without invoking an overridden then member', async () => {
    const then = vi.fn(() => {
      throw new Error('must not run');
    });
    class ApplicationPromise extends Promise<KanbanRequestResult> {}
    const outcome = new ApplicationPromise((resolve) => {
      resolve({ kind: 'accepted', operationId: 'review-1' });
    });
    Object.defineProperty(outcome, 'then', { configurable: true, value: then });

    await expect(dispatchKanbanRequest(request(), () => outcome, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'review-1',
      code: 'invalid-dispatch-result',
    });
    expect(then).not.toHaveBeenCalled();
  });

  it('rejects transparent Promise proxies without reading their then member', async () => {
    const thenLookup = vi.fn();
    const native = Promise.resolve<KanbanRequestResult>({
      kind: 'accepted',
      operationId: 'review-1',
    });
    const proxy = new Proxy(native, {
      get(target, property, receiver) {
        if (property === 'then') thenLookup();
        return Reflect.get(target, property, receiver);
      },
    });

    await expect(dispatchKanbanRequest(request(), () => proxy, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'review-1',
      code: 'invalid-dispatch-result',
    });
    expect(thenLookup).not.toHaveBeenCalled();
  });

  it('does not invoke accessors on dispatcher results', async () => {
    const getter = vi.fn(() => 'accepted');
    const result = Object.defineProperty({ kind: 'accepted' as const, operationId: 'review-1' }, 'kind', {
      enumerable: true,
      get: getter,
    });

    await expect(dispatchKanbanRequest(request(), () => result, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'review-1',
      code: 'invalid-dispatch-result',
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects fields that do not apply to a dispatcher result discriminator', async () => {
    const malformed = {
      kind: 'accepted' as const,
      operationId: 'review-1',
      code: 'not-valid-on-accepted',
    };

    await expect(dispatchKanbanRequest(request(), () => malformed, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'review-1',
      code: 'invalid-dispatch-result',
    });
  });

  it.each([undefined, 'Invalid Code'])('rejects a rejected outcome whose reason code is %s', async (code) => {
    const malformed: KanbanRequestResult = Object.defineProperty(
      { kind: 'rejected' as const, operationId: 'review-1', code: 'valid-code' },
      'code',
      { enumerable: true, value: code },
    );

    await expect(dispatchKanbanRequest(request(), () => malformed, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'review-1',
      code: 'invalid-dispatch-result',
    });
  });

  it('rejects duplicate captured entities before invoking the dispatcher', async () => {
    const original = request();
    const entity = original.expected.entities![0]!;
    const duplicateRequest: KanbanExtensionRequest = {
      ...original,
      expected: { ...original.expected, entities: [entity, entity] },
    };
    const dispatcher: KanbanRequestDispatcher = vi.fn((): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: 'review-1',
    }));

    await expect(dispatchKanbanRequest(duplicateRequest, dispatcher, { capabilities: {} })).rejects.toThrow(
      KanbanInvalidSemanticValueError,
    );
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('rejects a mismatched result operation without exposing the application value', async () => {
    const original = request();
    const dispatcher: KanbanRequestDispatcher = (): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: 'different-operation',
    });

    await expect(dispatchKanbanRequest(original, dispatcher, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: original.operationId,
      code: 'operation-mismatch',
    });
  });
});

describe('publication reconciliation implementation', () => {
  it('is idempotent and leaves the caller collection unchanged after contradictory authority wins', () => {
    const pending = [expectation()];
    const notice: KanbanPublicationNotice = {
      kind: 'contradictory',
      operationId: pending[0]!.operationId,
      subjects: pending[0]!.subjects,
    };

    const first = reconcileKanbanPublication(pending, notice);
    const second = reconcileKanbanPublication(first.pending, notice);

    expect(first.pending).toEqual([]);
    expect(first.cleared).toEqual(notice);
    expect(second).toEqual({ pending: [] });
    expect(pending).toEqual([expectation()]);
    expect(Object.isFrozen(first.pending)).toBe(true);
  });

  it('rejects duplicate subjects and more than 32 pending operations', () => {
    const duplicate = expectation();
    const duplicateNotice: KanbanPublicationNotice = {
      kind: 'matching',
      operationId: duplicate.operationId,
      subjects: [duplicate.subjects[0]!, duplicate.subjects[0]!],
    };
    const excessive = Array.from({ length: 33 }, (_value, index) => expectation(`review-${index}`));

    expect(() => reconcileKanbanPublication([duplicate], duplicateNotice)).toThrow();
    expect(() =>
      reconcileKanbanPublication(excessive, {
        kind: 'matching',
        operationId: 'review-0',
        subjects: duplicate.subjects,
      }),
    ).toThrow();
  });

  it('does not invoke publication-notice accessors', () => {
    const getter = vi.fn(() => 'matching');
    const notice: KanbanPublicationNotice = Object.defineProperty(
      { kind: 'matching' as const, operationId: 'review-1', subjects: expectation().subjects },
      'kind',
      { enumerable: true, get: getter },
    );

    expect(() => reconcileKanbanPublication([expectation()], notice)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('board authority coordinator compatibility', () => {
  it('adopts a legacy identity and cancellation signal while owning the dispatched abort signal', async () => {
    const controller = new AbortController();
    let settle: ((result: KanbanRequestResult) => void) | undefined;
    const deferred = new Promise<KanbanRequestResult>((resolve) => {
      settle = resolve;
    });
    let dispatchedSignal: AbortSignal | undefined;
    const dispatcher: KanbanRequestDispatcher = vi.fn((received) => {
      dispatchedSignal = received.signal;
      return deferred;
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));
    const legacy = { ...request('legacy-operation-1'), signal: controller.signal };

    const completion = authority.request(legacy);
    controller.abort();
    settle?.({ kind: 'accepted', operationId: legacy.operationId });

    await expect(completion).resolves.toEqual({
      kind: 'cancelled',
      operationId: legacy.operationId,
      code: 'operation-cancelled',
    });
    expect(dispatchedSignal).not.toBe(controller.signal);
    expect(dispatchedSignal?.aborted).toBe(true);
    expect(authority.snapshot()).toEqual([]);
  });

  it('captures current revisions for a standard proposal and rejects requests after disposal', async () => {
    let submittedOperationId = '';
    const dispatcher: KanbanRequestDispatcher = vi.fn((received) => {
      submittedOperationId = received.operationId;
      expect(received.expected).toEqual({ source: 'source-current', query: 7 });
      return { kind: 'rejected', operationId: received.operationId, code: 'test-complete' };
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      operationId: () => 'generated-operation-1',
      expected: () => ({ source: 'source-current', query: 7 }),
    });

    await expect(authority.request({ kind: 'card-update', cardKey: 4, patch: { title: 'Updated' } })).resolves.toEqual({
      kind: 'rejected',
      operationId: 'generated-operation-1',
      code: 'test-complete',
    });
    expect(submittedOperationId).toBe('generated-operation-1');

    authority.dispose();
    await expect(authority.request(request('after-authority-dispose'))).resolves.toEqual({
      kind: 'rejected',
      operationId: 'after-authority-dispose',
      code: 'dispatcher-unavailable',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
  });
});
