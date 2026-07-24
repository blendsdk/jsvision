import { describe, expect, it, vi } from 'vitest';

import {
  inspectRetainedResources,
  runFailureIsolationProbe,
  runHostileCorpusProbe,
} from './architecture/feasibility.js';
import { createCodeEditorController } from './controller.js';
import { createDegradationState } from './degradation.js';
import { createDocumentModel } from './document/model.js';
import { HARD_CODE_EDITOR_LIMITS, classifyDocumentSize, resolveCodeEditorLimits } from './limits.js';
import { createObservabilityChannel } from './observability.js';
import { protocolHostileCorpus, terminalHostileCorpus, themeHostileCorpus } from '../test/fuzz-corpus.js';

describe('cross-cutting quality implementation', () => {
  it('resolves hostile limit objects without invoking accessors', () => {
    const getter = vi.fn(() => 1);
    const input = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(input, 'diagnostics', { enumerable: true, get: getter });
    Object.defineProperty(input, 'completionItems', {
      enumerable: true,
      value: Number.MAX_SAFE_INTEGER,
    });

    const limits = resolveCodeEditorLimits(input);

    expect(getter).not.toHaveBeenCalled();
    expect(limits.diagnostics).toBe(500);
    expect(limits.completionItems).toBe(HARD_CODE_EDITOR_LIMITS.completionItems);
  });

  it('classifies exact boundaries and rejects malformed document sizes', () => {
    expect(classifyDocumentSize({ bytes: 1_048_576, lines: 50_000 }).mode).toBe('full');
    expect(classifyDocumentSize({ bytes: 1_048_577, lines: 50_000 }).mode).toBe('large');
    expect(classifyDocumentSize({ bytes: 10 * 1_048_576, lines: 50_001 }).mode).toBe('large');
    expect(classifyDocumentSize({ bytes: 10 * 1_048_576 + 1, lines: 1 }).mode).toBe('reduced');
    expect(() => classifyDocumentSize({ bytes: Number.POSITIVE_INFINITY, lines: 1 })).toThrow(RangeError);
    expect(() => classifyDocumentSize({ bytes: 0, lines: 0 })).toThrow(RangeError);
  });

  it('rate-limits repeated failures, supports recovery, and clears state on disposal', () => {
    const degradation = createDegradationState();
    for (let index = 0; index < 100; index += 1) {
      degradation.fail('parser', new Error(`hostile ${index}\u001b]0;title\u0007`));
    }
    expect(degradation.snapshot().notices).toHaveLength(1);
    degradation.recover('parser');
    expect(degradation.snapshot().mode).toBe('ready');
    degradation.fail('languageAdapter');
    degradation.dispose();
    degradation.fail('parser');
    expect(degradation.snapshot()).toMatchObject({ mode: 'ready', notices: [] });
  });

  it('rejects hostile degradation runtime values without invoking accessors or leaking labels', () => {
    const degradation = createDegradationState();
    const details = new Proxy(Object.create(null), {
      getOwnPropertyDescriptor() {
        throw new Error('descriptor trap');
      },
    });

    expect(() => degradation.suspend('diagnostics', details as never)).not.toThrow();
    expect(() => degradation.fail('\u001b]0;owned\u0007' as never)).not.toThrow();
    expect(degradation.snapshot()).toMatchObject({ mode: 'degraded', affectedFeatures: ['diagnostics'] });
    expect(JSON.stringify(degradation.snapshot())).not.toContain('\u001b');
  });

  it('applies lowered policy ceilings to real controller mutations', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({ text: '' }),
      limits: { replacementBytes: 1 },
    });

    expect(controller.replaceSelection('x')).toBe(true);
    expect(controller.replaceSelection('xx')).toBe(false);
    expect(controller.document.text).toBe('x');
    controller.dispose();
  });

  it('schedules hostile observation callbacks out of band and contains rejections', async () => {
    const callback = vi.fn(async () => {
      throw new Error('host callback failed');
    });
    const channel = createObservabilityChannel({
      callback,
      limits: { retainedEvents: 1 },
    });

    channel.record({ kind: 'parse', durationMs: 2, discardedStaleResults: 1 });
    channel.record({ kind: 'render', durationMs: Number.POSITIVE_INFINITY, truncations: 1 });
    expect(callback).not.toHaveBeenCalled();
    expect(channel.snapshot().retainedEvents).toEqual([{ kind: 'render', durationMs: 0 }]);

    await channel.whenIdle();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(channel.snapshot().counters).toMatchObject({
      discardedStaleResults: 1,
      truncations: 1,
      callbackFailures: 2,
    });
    channel.dispose();
    channel.record({ kind: 'lsp', durationMs: 1 });
    expect(channel.snapshot().retainedEvents).toEqual([]);
  });

  it('bounds stalled observation floods and settles disposal even when scheduling fails', async () => {
    const stalled = createObservabilityChannel({
      callback: () => new Promise(() => undefined),
      limits: { retainedEvents: 2 },
    });
    for (let index = 0; index < 10_000; index += 1) {
      stalled.record({ kind: 'lsp', durationMs: 1 });
    }
    expect(stalled.snapshot().counters.pendingDeliveries).toBeLessThanOrEqual(65);
    expect(stalled.snapshot().counters.droppedEvents).toBeGreaterThan(0);
    stalled.dispose();
    await expect(stalled.whenIdle()).resolves.toBeUndefined();

    const throwingScheduler = createObservabilityChannel({
      callback: () => undefined,
      schedule() {
        throw new Error('schedule failed');
      },
    });
    expect(() => throwingScheduler.record({ kind: 'render' })).not.toThrow();
    expect(throwingScheduler.snapshot().counters.callbackFailures).toBe(1);
    await expect(throwingScheduler.whenIdle()).resolves.toBeUndefined();
  });

  it('rejects unbounded probe inputs and contains all supported failure targets', async () => {
    await expect(
      runFailureIsolationProbe({
        failures: ['parser', 'parser'],
      }),
    ).rejects.toThrow(RangeError);

    const isolated = await runFailureIsolationProbe({
      failures: [
        'documentModel',
        'parser',
        'languageAdapter',
        'sharedSession',
        'popupRenderer',
        'diagnosticProducer',
        'hostCallback',
        'observabilityCallback',
      ],
    });
    expect(isolated).toMatchObject({
      uncaughtFailures: [],
      pendingWorkAfterDispose: 0,
      acceptedLateCallbacks: 0,
    });

    await expect(
      runHostileCorpusProbe({
        terminal: Array.from({ length: 1_025 }),
        protocol: [],
        theme: [],
      }),
    ).rejects.toThrow(RangeError);
  });

  it('keeps hostile corpora inert and bounds every retained resource before disposal', async () => {
    const hostile = await runHostileCorpusProbe({
      terminal: terminalHostileCorpus,
      protocol: protocolHostileCorpus,
      theme: themeHostileCorpus,
    });
    expect(hostile).toMatchObject({
      activeTerminalControls: [],
      executedAccessors: 0,
      dynamicEvaluations: 0,
    });

    const resources = await inspectRetainedResources({
      create: Object.fromEntries(
        [
          'histories',
          'decorations',
          'diagnostics',
          'completions',
          'symbols',
          'popups',
          'requests',
          'telemetryEvents',
        ].map((resource) => [resource, Number.MAX_SAFE_INTEGER]),
      ),
      cancel: true,
      dispose: true,
    });
    expect(resources.beforeDispose.every(({ retained, limit }) => retained <= limit)).toBe(true);
    expect(resources.beforeDispose.find(({ resource }) => resource === 'histories')?.retained).toBeGreaterThan(0);
    expect(resources.beforeDispose.find(({ resource }) => resource === 'telemetryEvents')?.retained).toBeGreaterThan(0);
    expect(Object.values(resources.afterDispose).every((retained) => retained === 0)).toBe(true);
  });
});
