import { describe, expect, it } from 'vitest';

import {
  inspectLegacyEditorCompatibility,
  inspectRetainedResources,
  inspectShippedDependencyClosure,
  runAccessibilityProbe,
  runFailureIsolationProbe,
  runHeadlessCompatibilityProbe,
  runHostileCorpusProbe,
} from '../src/architecture/feasibility.js';
import { runReferenceBenchmark, runSchedulingStressProbe } from '../bench/reference.js';
import { HARD_CODE_EDITOR_LIMITS, classifyDocumentSize, resolveCodeEditorLimits } from '../src/limits.js';
import { createDegradationState } from '../src/degradation.js';
import { createObservabilityChannel } from '../src/observability.js';
import { protocolHostileCorpus, terminalHostileCorpus, themeHostileCorpus } from './fuzz-corpus.js';

describe('code editor architecture feasibility', () => {
  it('loads every supported entry point in clean Node without starting unrelated runtime work', async () => {
    // A headless consumer can import the package and its supported language subpaths
    // without browser globals, eager parser startup, or child-process side effects.
    const result = await runHeadlessCompatibilityProbe();

    expect(result.compatible).toBe(true);
    expect(result.importedEntrypoints).toEqual(['root', 'javascript', 'typescript', 'postgresql', 'node']);
    expect(result.domGlobalsDetected).toEqual([]);
    expect(result.initializedUnrelatedParsers).toEqual([]);
    expect(result.spawnedProcesses).toBe(0);
  });

  it('keeps edit and viewport work within the interactive budget on reference fixtures', async () => {
    // The reference benchmark reports reproducible latency and memory evidence for
    // both the one-mebibyte and fifty-thousand-line fixture classes.
    const sampleCount = 3;
    const result = await runReferenceBenchmark({
      fixtures: [
        { label: '1 MiB', sizeBytes: 1_048_576 },
        { label: '50,000 lines', lineCount: 50_000 },
      ],
      sampleCount,
      warmupCount: 1,
    });

    expect(result.sampleCount).toBe(sampleCount);
    expect(result.runtime).toEqual(expect.any(String));
    expect(result.environment).toEqual(expect.any(String));
    expect(result.peakRetainedBytes).toEqual(expect.any(Number));
    expect(result.fixtures).toHaveLength(2);

    expect(result.fixtures.map((fixture) => fixture.label)).toEqual(['1 MiB', '50,000 lines']);

    for (const fixture of result.fixtures) {
      expect(fixture.editAndViewport.p50Ms).toEqual(expect.any(Number));
      expect(fixture.editAndViewport.p95Ms).toEqual(expect.any(Number));
      expect(fixture.editAndViewport.p95Ms).toBeLessThanOrEqual(16);
    }
  });

  it('prioritizes interactive work while stale background work yields and disappears', async () => {
    // Interactive updates run ahead of parser, diagnostic, and completion work;
    // background tasks yield, and cancellation prevents stale results from presenting.
    const result = await runSchedulingStressProbe({
      backgroundKinds: ['parser', 'diagnostic', 'completion'],
      interactiveUpdates: 3,
    });

    expect(result.interactivePrecededBackground).toEqual({
      parser: true,
      diagnostic: true,
      completion: true,
    });
    expect(result.backgroundWorkYielded).toBe(true);
    expect(result.cancelledStaleWorkPresented).toBe(false);
    expect(result.maximumBackgroundSliceMs).toBeLessThanOrEqual(result.backgroundSliceBudgetMs);
    expect(result.pendingWorkAfterCancellation).toBe(0);
  });

  it('ships only server-safe dependencies with licenses suitable for MIT distribution', async () => {
    // The distributable dependency closure excludes browser, DOM, and IDE runtime
    // packages, and every shipped license is compatible with MIT distribution.
    const result = await inspectShippedDependencyClosure();

    expect(result.domRuntimePackages).toEqual([]);
    expect(result.browserRuntimePackages).toEqual([]);
    expect(result.ideRuntimePackages).toEqual([]);
    expect(result.incompatibleLicenses).toEqual([]);
    expect(result.allLicensesMitCompatible).toBe(true);
  });

  it('centralizes safe limits, accepts only safer host overrides, and classifies every size tier', () => {
    const limits = resolveCodeEditorLimits({
      diagnostics: 40,
      completionItems: HARD_CODE_EDITOR_LIMITS.completionItems + 1,
      popupWidth: 20,
    });

    expect(limits.diagnostics).toBe(40);
    expect(limits.popupWidth).toBe(20);
    expect(limits.completionItems).toBe(HARD_CODE_EDITOR_LIMITS.completionItems);
    expect(Object.isFrozen(limits)).toBe(true);

    expect(classifyDocumentSize({ bytes: 1_048_576, lines: 50_000 })).toMatchObject({
      mode: 'full',
      confirmationRequired: false,
    });
    expect(classifyDocumentSize({ bytes: 1_048_577, lines: 50_001 })).toMatchObject({
      mode: 'large',
      confirmationRequired: false,
      preservedFeatures: expect.arrayContaining(['edit', 'search', 'lineNumbers', 'status', 'save', 'close']),
    });
    expect(classifyDocumentSize({ bytes: 10 * 1_048_576 + 1, lines: 50_001 })).toMatchObject({
      mode: 'reduced',
      confirmationRequired: true,
      language: 'plain',
    });
  });

  it('makes truncation and subsystem failures machine-readable without modifying source text', () => {
    const state = createDegradationState();

    state.suspend('diagnostics', { reason: 'limit', presented: 200, discarded: 800 });
    state.fail('languageService', new Error('hostile\n\u001b]0;title\u0007 const credential = "must not leak"'));

    expect(state.snapshot()).toMatchObject({
      mode: 'degraded',
      affectedFeatures: ['diagnostics', 'languageService'],
      notices: [
        expect.objectContaining({ feature: 'diagnostics', nonModal: true, truncated: true }),
        expect.objectContaining({ feature: 'languageService', nonModal: true }),
      ],
      availableActions: expect.arrayContaining(['edit', 'save', 'close', 'retryLanguageService']),
    });
    expect(JSON.stringify(state.snapshot())).not.toContain('credential');
    expect(JSON.stringify(state.snapshot())).not.toContain('\u001b');
  });

  it('isolates parser, service, popup, producer, host, and observability failures', async () => {
    const result = await runFailureIsolationProbe({
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

    expect(result.uncaughtFailures).toEqual([]);
    expect(result.editingAvailable).toBe(true);
    expect(result.saveAvailable).toBe(true);
    expect(result.closeAvailable).toBe(true);
    expect(result.retryPreservedDocument).toBe(true);
    expect(result.repeatedFailurePresentations).toBeLessThanOrEqual(result.failurePresentationLimit);
    expect(result.pendingWorkAfterDispose).toBe(0);
    expect(result.acceptedLateCallbacks).toBe(0);
  });

  it('keeps observability aggregate, bounded, content-free, asynchronous, and exception-safe', async () => {
    const observed: unknown[] = [];
    const channel = createObservabilityChannel({
      callback(event) {
        observed.push(event);
        throw new Error('observer failure');
      },
      limits: { retainedEvents: 2 },
    });

    const source = 'const credential = "do-not-report";';
    expect(() =>
      channel.record({
        kind: 'lsp',
        durationMs: 4,
        discardedStaleResults: 1,
        untrustedContent: {
          source,
          uri: 'file:///private/project.ts',
          completion: source,
          diagnostic: source,
        },
      }),
    ).not.toThrow();

    expect(channel.snapshot()).toMatchObject({
      counters: expect.objectContaining({ discardedStaleResults: 1 }),
      retainedEvents: expect.any(Array),
    });
    expect(channel.snapshot().retainedEvents.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(observed)).not.toContain('do-not-report');
    expect(JSON.stringify(channel.snapshot())).not.toContain('/private/project.ts');
    await expect(channel.whenIdle()).resolves.toBeUndefined();
  });

  it('exposes keyboard reachability and non-color accessibility state without trapping focus', async () => {
    const result = await runAccessibilityProbe({ input: 'keyboard-only' });

    expect(result.mouseEvents).toBe(0);
    expect(result.unreachableVersion1Commands).toEqual([]);
    expect(result.focusTraps).toEqual([]);
    expect(result.focusReturnedTo).toBe('editor');
    expect(result.dismissibleSurfaces).toEqual(
      expect.arrayContaining(['completion', 'chooser', 'diagnosticDetails', 'confirmation']),
    );
    expect(result.machineReadableState).toMatchObject({
      commandAvailability: expect.any(Object),
      language: expect.any(String),
      serviceState: expect.any(String),
      line: expect.any(Number),
      visualColumn: expect.any(Number),
      selectionSize: expect.any(Number),
      modified: expect.any(Boolean),
      readOnly: expect.any(Boolean),
      degradation: expect.any(Object),
    });
    expect(result.nonColorIndicators).toEqual(
      expect.arrayContaining([
        'selection',
        'activeLine',
        'folding',
        'diagnosticSeverity',
        'pending',
        'readOnly',
        'degradation',
      ]),
    );
  });

  it('sanitizes terminal, protocol, and theme hostile corpora without evaluating content', async () => {
    const result = await runHostileCorpusProbe({
      terminal: terminalHostileCorpus,
      protocol: protocolHostileCorpus,
      theme: themeHostileCorpus,
    });

    expect(terminalHostileCorpus.length).toBeGreaterThan(32);
    expect(protocolHostileCorpus.length).toBeGreaterThan(8);
    expect(themeHostileCorpus.length).toBeGreaterThan(8);
    expect(result.activeTerminalControls).toEqual([]);
    expect(result.executedAccessors).toBe(0);
    expect(result.dynamicEvaluations).toBe(0);
    expect(result.acceptedMalformedRanges).toBe(0);
    expect(result.acceptedOversizedMessages).toBe(0);
    expect(result.documentTextPreserved).toBe(true);
  });

  it('releases retained histories, decorations, results, requests, popups, and counters on disposal', async () => {
    const result = await inspectRetainedResources({
      create: {
        histories: 10_000,
        decorations: 10_000,
        diagnostics: 10_000,
        completions: 10_000,
        symbols: 10_000,
        popups: 100,
        requests: 10_000,
        telemetryEvents: 10_000,
      },
      cancel: true,
      dispose: true,
    });

    expect(result.beforeDispose.every((resource) => resource.retained <= resource.limit)).toBe(true);
    expect(result.afterDispose).toEqual({
      histories: 0,
      decorations: 0,
      diagnostics: 0,
      completions: 0,
      symbols: 0,
      popups: 0,
      requests: 0,
      telemetryEvents: 0,
    });
    expect(result.acceptedLateCallbacks).toBe(0);
    expect(result.peakRetainedBytes).toEqual(expect.any(Number));
  });

  it('preserves the legacy Editor surface while adding CodeEditor only through supported entry points', async () => {
    const result = await inspectLegacyEditorCompatibility();

    expect(result.legacyEditorApiChanged).toBe(false);
    expect(result.legacyEditorBehaviorChanged).toBe(false);
    expect(result.codeEditorRootImportWorks).toBe(true);
    expect(result.codeEditorInternalImportsBlocked).toBe(true);
    expect(result.unknownAdditiveContractFieldsIgnored).toBe(true);
    expect(result.incompatibleMajorVersionError).toMatch(/version/i);
  });
});
