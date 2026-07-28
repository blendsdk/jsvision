import { describe, expect, it, vi } from 'vitest';
import { createCodeEditorController } from './controller.js';
import { createDegradationState } from './degradation.js';
import { createDocumentModel } from './document/model.js';
import { createCodeEditorLspCoordinator } from './lsp/coordinator.js';

describe('CodeEditor degradation implementation', () => {
  it('coalesces controller presentation notification after independent subsystem transitions', async () => {
    const controller = createCodeEditorController({ document: createDocumentModel({ text: 'safe' }) });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.degradation.fail('parser');
    controller.degradation.pending('languageService', { reason: 'retry' });
    controller.degradation.suspend('diagnostics', { reason: 'limit', presented: 10, discarded: 2 });
    await Promise.resolve();
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'presentation' }));
    expect(controller.publicState.degradation.affectedFeatures).toEqual(['parser', 'languageService', 'diagnostics']);
  });

  it('isolates throwing observers and suppresses duplicate failure notifications', async () => {
    const observer = vi.fn(() => {
      throw new Error('observer failure');
    });
    const state = createDegradationState({ onChange: observer });

    expect(() => state.fail('parser')).not.toThrow();
    expect(() => state.fail('parser')).not.toThrow();
    await Promise.resolve();

    expect(observer).toHaveBeenCalledTimes(1);
    expect(state.snapshot().notices).toHaveLength(1);
  });

  it('suppresses observer reentrancy instead of recursively publishing transitions', async () => {
    const observer = vi.fn(() => {
      state.recover('parser');
      state.fail('parser');
    });
    const state = createDegradationState({ onChange: observer });

    state.fail('parser');
    await Promise.resolve();
    await Promise.resolve();

    expect(observer).toHaveBeenCalledTimes(1);
    expect(state.snapshot().features.find(({ feature }) => feature === 'parser')).toMatchObject({
      status: 'degraded',
    });
  });

  it('mirrors real coordinator connection failure and recovery into shared feature state', async () => {
    const document = createDocumentModel({ text: 'const value = 1;', languageId: 'typescript' });
    const lsp = createCodeEditorLspCoordinator({
      document,
      uri: 'file:///lifecycle.ts',
      languageId: 'typescript',
    });
    const controller = createCodeEditorController({ document, lsp });

    expect(
      controller.publicState.degradation.features.find(({ feature }) => feature === 'languageService'),
    ).toMatchObject({ status: 'suspended', reason: 'unavailable' });

    lsp.serviceState = 'connecting';
    expect(
      controller.publicState.degradation.features.find(({ feature }) => feature === 'languageService'),
    ).toMatchObject({ status: 'pending' });

    lsp.serviceState = 'degraded';
    expect(
      controller.publicState.degradation.features.find(({ feature }) => feature === 'languageService'),
    ).toMatchObject({ status: 'degraded' });

    lsp.serviceState = 'ready';
    expect(
      controller.publicState.degradation.features.find(({ feature }) => feature === 'languageService'),
    ).toMatchObject({ status: 'enabled', reason: 'recovered' });
    await Promise.resolve();
  });

  it('keeps repeated hostile transitions bounded to the fixed feature inventory', () => {
    const state = createDegradationState();
    const descriptorTrap = new Proxy(Object.create(null), {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor');
      },
    });

    for (let index = 0; index < 10_000; index += 1) {
      state.fail('completion', descriptorTrap);
      state.suspend('diagnostics', {
        reason: 'limit',
        presented: Number.MAX_SAFE_INTEGER,
        discarded: Number.MAX_SAFE_INTEGER,
      });
    }

    const snapshot = state.snapshot();
    expect(snapshot.notices).toHaveLength(2);
    expect(snapshot.features).toHaveLength(12);
    expect(JSON.stringify(snapshot)).not.toContain('hostile');
    expect(JSON.stringify(snapshot).length).toBeLessThan(8_192);
  });

  it('rejects malformed limit counters without committing a fabricated transition', () => {
    const state = createDegradationState();
    const getter = vi.fn(() => 10);
    const malformed = { reason: 'limit', discarded: 1 };
    Object.defineProperty(malformed, 'presented', { get: getter });

    state.suspend('diagnostics', malformed as never);
    state.suspend('symbols', { reason: 'limit', presented: -1, discarded: 1 });

    expect(getter).not.toHaveBeenCalled();
    expect(state.snapshot()).toMatchObject({ mode: 'ready', affectedFeatures: [], notices: [] });
  });
});
