/**
 * Public specification tests for deterministic asynchronous catalog sources.
 *
 * The sources are caller-owned functions. These tests control their completion directly so source
 * declaration order, failure classification, and cancellation do not depend on wall-clock timing.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

import { loadI18n } from '../src/index.js';
import {
  applicationSourceCatalog,
  controlledCatalogSource,
  frameworkSourceCatalog,
  packageSourceCatalog,
  successfulSourceCatalog,
} from './fixtures/sources.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source ordering', () => {
  test('retains declaration order when three colliding sources complete out of order', async () => {
    const starts: string[] = [];
    const framework = controlledCatalogSource('framework', starts);
    const packageLayer = controlledCatalogSource('package', starts);
    const application = controlledCatalogSource('application', starts);

    const loading = loadI18n({
      locale: 'en',
      sources: [framework.source, packageLayer.source, application.source],
    });

    expect(starts).toEqual(['framework', 'package', 'application']);

    application.resolve(applicationSourceCatalog);
    framework.resolve(frameworkSourceCatalog);
    packageLayer.resolve([packageSourceCatalog]);

    const i18n = await loading;
    expect(i18n.t('source.priority')).toBe('application');
  });
});

describe('source failure classification', () => {
  test('skips an optional failure, publishes successful catalogs, and records one sanitized diagnostic', async () => {
    const starts: string[] = [];
    const optional = controlledCatalogSource('optional-remote', starts, false);
    const required = controlledCatalogSource('required-local', starts);
    let sinkCalls = 0;

    const loading = loadI18n({
      sources: [optional.source, required.source],
      diagnosticSink: () => {
        sinkCalls += 1;
        throw new Error('observer failure');
      },
    });

    optional.reject(new Error('credential=optional-secret; translated text'));
    required.resolve(successfulSourceCatalog);

    const i18n = await loading;
    expect(i18n.t('source.loaded')).toBe('loaded');
    expect(i18n.diagnostics).toHaveLength(1);
    expect(i18n.diagnostics[0]).toMatchObject({
      code: 'SOURCE_FAILED',
      severity: 'warning',
      source: 'optional-remote',
    });
    expect(sinkCalls).toBe(1);

    const diagnosticText = JSON.stringify(i18n.diagnostics);
    expect(diagnosticText).not.toMatch(/optional-secret|credential|translated text|observer failure/);
    expect(i18n.diagnostics[0]).not.toHaveProperty('message');
    expect(i18n.diagnostics[0]).not.toHaveProperty('cause');
    expect(i18n.diagnostics[0]).not.toHaveProperty('value');
    expect(i18n.diagnostics[0]).not.toHaveProperty('text');
  });

  test('rejects a failed source when required is omitted and publishes no service', async () => {
    const starts: string[] = [];
    const required = controlledCatalogSource('required-by-default', starts);
    const successful = controlledCatalogSource('successful', starts);

    const loading = loadI18n({
      sources: [required.source, successful.source],
    });

    required.reject(new Error('credential=required-secret'));
    successful.resolve(successfulSourceCatalog);

    let failure: unknown;
    try {
      await loading;
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'I18nError',
      code: 'SOURCE_FAILED',
    });
    expect(String(failure)).not.toContain('required-secret');
  });
});

describe('source cancellation and ownership', () => {
  test('rejects with ABORTED when the shared caller signal aborts even if a source remains pending', async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const loading = loadI18n({
      signal: controller.signal,
      sources: [
        {
          name: 'abort-ignoring',
          load({ signal }: { readonly signal: AbortSignal }) {
            observedSignal = signal;
            return new Promise(() => undefined);
          },
        },
      ],
    });

    controller.abort('caller-secret');

    let failure: unknown;
    try {
      await loading;
    } catch (error) {
      failure = error;
    }

    expect(observedSignal).toBe(controller.signal);
    expect(failure).toMatchObject({
      name: 'I18nError',
      code: 'ABORTED',
    });
    expect(String(failure)).not.toContain('caller-secret');
  }, 1_000);

  test('gives every source the same concrete non-aborted signal when none is supplied', async () => {
    const observedSignals: AbortSignal[] = [];
    const sources = ['first', 'second', 'third'].map((name) => ({
      name,
      async load({ signal }: { signal: AbortSignal }) {
        observedSignals.push(signal);
        return successfulSourceCatalog;
      },
    }));

    await loadI18n({ sources });

    expect(observedSignals).toHaveLength(3);
    expect(observedSignals[0]).toBeInstanceOf(AbortSignal);
    expect(observedSignals.every((signal) => signal === observedSignals[0])).toBe(true);
    expect(observedSignals[0]?.aborted).toBe(false);
  });

  test('uses caller transport and signal without creating package-owned fetches or timeouts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const controller = new AbortController();
    const transport = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return successfulSourceCatalog;
    });

    const i18n = await loadI18n({
      signal: controller.signal,
      sources: [
        {
          name: 'caller-transport',
          load({ signal }: { readonly signal: AbortSignal }) {
            return transport(signal);
          },
        },
      ],
    });

    expect(i18n.t('source.loaded')).toBe('loaded');
    expect(transport).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});
