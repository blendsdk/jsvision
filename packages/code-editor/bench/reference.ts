import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { resolveCapabilities } from '@jsvision/core';
import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  createLanguageScheduler,
  type LanguageAdapter,
  type LanguageCapabilityContext,
} from '@jsvision/code-editor';
import { parser as javascriptParser } from '@lezer/javascript';

import { createReferenceFixture, type ReferenceFixtureRequest } from './fixtures.js';

type BackgroundKind = 'parser' | 'diagnostic' | 'completion';

interface ReferenceBenchmarkOptions {
  readonly fixtures: readonly ReferenceFixtureRequest[];
  readonly sampleCount: number;
  readonly warmupCount: number;
}

interface LatencyPercentiles {
  readonly p50Ms: number;
  readonly p95Ms: number;
}

interface FixtureBenchmarkResult {
  readonly label: string;
  readonly editAndViewport: LatencyPercentiles;
  readonly rawSamplesMs: readonly number[];
}

/**
 * Reproducible document-model performance evidence for the architecture workload.
 */
export interface ReferenceBenchmarkResult {
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly runtime: string;
  readonly runtimeFlags: readonly string[];
  readonly environment: string;
  readonly processor: string;
  readonly memoryBaselineBytes: number;
  readonly peakWorkingBytes: number;
  readonly peakRetainedBytes: number;
  readonly memoryAfterDisposalBytes: number;
  readonly fixtures: readonly FixtureBenchmarkResult[];
}

interface SchedulingStressOptions {
  readonly backgroundKinds: readonly BackgroundKind[];
  readonly interactiveUpdates: number;
}

/**
 * Evidence that interactive work wins scheduling priority and stale work is discarded.
 */
export interface SchedulingStressResult {
  readonly interactivePrecededBackground: Readonly<Record<BackgroundKind, boolean>>;
  readonly backgroundWorkYielded: boolean;
  readonly cancelledStaleWorkPresented: boolean;
  readonly maximumBackgroundSliceMs: number;
  readonly backgroundSliceBudgetMs: number;
  readonly pendingWorkAfterCancellation: number;
}

const execFileAsync = promisify(execFile);

function requireBoundedInteger(value: number, name: string, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function validateBenchmarkOptions(options: ReferenceBenchmarkOptions): void {
  requireBoundedInteger(options.sampleCount, 'sampleCount', 1, 20);
  requireBoundedInteger(options.warmupCount, 'warmupCount', 0, 10);
  if (options.fixtures.length === 0 || options.fixtures.length > 10) {
    throw new RangeError('fixtures must contain between 1 and 10 entries');
  }
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * fraction) - 1;
  return Number(sorted[Math.max(0, index)]?.toFixed(3));
}

const benchmarkCapabilities = resolveCapabilities({
  override: { colorDepth: '16', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

function measureEditAndViewport(editor: CodeEditor): number {
  const editAt = Math.floor(editor.controller.document.snapshot.length / 2);
  const startedAt = performance.now();
  editor.controller.document.setSelection({ anchor: editAt, head: editAt });
  if (!editor.insertText('x')) throw new Error('Reference edit was rejected');
  const frame = editor.project({ width: 80, height: 20, caps: benchmarkCapabilities });
  if (frame.cells.length === 0) {
    throw new Error('Viewport projection produced no content');
  }
  return performance.now() - startedAt;
}

function garbageCollect(): void {
  const candidate: unknown = Reflect.get(globalThis, 'gc');
  if (typeof candidate !== 'function') {
    throw new Error('Reference benchmark requires Node --expose-gc');
  }
  candidate();
}

function measureFixture(
  request: ReferenceFixtureRequest,
  options: ReferenceBenchmarkOptions,
): { readonly result: FixtureBenchmarkResult; readonly peakBytes: number } {
  const source = createReferenceFixture(request);
  const document = createDocumentModel({ text: source });
  const controller = createCodeEditorController({ document });
  const editor = new CodeEditor({ controller });

  for (let index = 0; index < options.warmupCount; index += 1) {
    measureEditAndViewport(editor);
  }

  const samples: number[] = [];
  let peakBytes = process.memoryUsage().heapUsed;
  for (let index = 0; index < options.sampleCount; index += 1) {
    samples.push(measureEditAndViewport(editor));
    peakBytes = Math.max(peakBytes, process.memoryUsage().heapUsed);
  }

  const result = {
    result: {
      label: request.label,
      editAndViewport: {
        p50Ms: percentile(samples, 0.5),
        p95Ms: percentile(samples, 0.95),
      },
      rawSamplesMs: samples.map((sample) => Number(sample.toFixed(3))),
    },
    peakBytes,
  };
  (editor as CodeEditor & { dispose(): void }).dispose();
  return result;
}

function isReferenceBenchmarkResult(value: unknown): value is ReferenceBenchmarkResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sampleCount' in value &&
    typeof value.sampleCount === 'number' &&
    'fixtures' in value &&
    Array.isArray(value.fixtures) &&
    'peakRetainedBytes' in value &&
    typeof value.peakRetainedBytes === 'number'
  );
}

/**
 * Runs the measurement in an isolated process with explicit garbage collection.
 *
 * @example
 * ```ts
 * const result = await runReferenceBenchmark({
 *   fixtures: [{ label: '1 MiB', sizeBytes: 1_048_576 }],
 *   sampleCount: 3,
 *   warmupCount: 1,
 * });
 * ```
 */
export async function runReferenceBenchmark(options: ReferenceBenchmarkOptions): Promise<ReferenceBenchmarkResult> {
  validateBenchmarkOptions(options);
  for (const fixture of options.fixtures) createReferenceFixture(fixture);

  const parentDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const packageRoot = basename(parentDirectory) === 'dist' ? resolve(parentDirectory, '..') : parentDirectory;
  const moduleUrl = pathToFileURL(join(packageRoot, 'dist', 'bench', 'reference.js')).href;
  const script = `
    const module = await import(${JSON.stringify(moduleUrl)});
    const result = await module.runReferenceBenchmarkWorker(
      ${JSON.stringify(options)}
    );
    process.stdout.write(JSON.stringify(result));
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['--expose-gc', '--input-type=module', '--eval', script],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    },
  );
  if (stderr.length > 0) {
    throw new Error(`Reference benchmark wrote to stderr: ${stderr.slice(0, 200)}`);
  }

  const result: unknown = JSON.parse(stdout);
  if (!isReferenceBenchmarkResult(result)) {
    throw new Error('Reference benchmark returned invalid evidence');
  }
  return result;
}

/**
 * Performs the benchmark inside the isolated worker process.
 *
 * This function is exported for the child-process boundary and is not a package export.
 */
export function runReferenceBenchmarkWorker(options: ReferenceBenchmarkOptions): ReferenceBenchmarkResult {
  validateBenchmarkOptions(options);
  garbageCollect();
  const memoryBaselineBytes = process.memoryUsage().heapUsed;
  let peakWorkingBytes = memoryBaselineBytes;
  let peakRetainedBytes = 0;
  let memoryAfterDisposalBytes = memoryBaselineBytes;
  const fixtures: FixtureBenchmarkResult[] = [];

  for (const request of options.fixtures) {
    const measurement = measureFixture(request, options);
    fixtures.push(measurement.result);
    peakWorkingBytes = Math.max(peakWorkingBytes, measurement.peakBytes);
    garbageCollect();
    memoryAfterDisposalBytes = process.memoryUsage().heapUsed;
    peakRetainedBytes = Math.max(peakRetainedBytes, Math.max(0, memoryAfterDisposalBytes - memoryBaselineBytes));
  }

  return {
    sampleCount: options.sampleCount,
    warmupCount: options.warmupCount,
    runtime: process.version,
    runtimeFlags: ['--expose-gc'],
    environment: `${process.platform}-${process.arch}`,
    processor: cpus()[0]?.model ?? 'unknown',
    memoryBaselineBytes,
    peakWorkingBytes,
    peakRetainedBytes,
    memoryAfterDisposalBytes,
    fixtures,
  };
}

function executeBackgroundSlice(kind: BackgroundKind): void {
  if (kind === 'parser') {
    javascriptParser.parse('const answer = source + 1;');
    return;
  }
  if (kind === 'diagnostic') {
    /\b(?:TODO|FIXME)\b/gu.test('const safe = true; // TODO');
    return;
  }
  ['console', 'const', 'continue'].filter((candidate) => candidate.startsWith('con'));
}

/**
 * Exercises bounded background slices, strict interactive priority, and
 * generation-checked presentation through a deterministic scheduler model.
 *
 * @example
 * ```ts
 * const result = await runSchedulingStressProbe({
 *   backgroundKinds: ['parser', 'diagnostic', 'completion'],
 *   interactiveUpdates: 3,
 * });
 * ```
 */
export async function runSchedulingStressProbe(options: SchedulingStressOptions): Promise<SchedulingStressResult> {
  requireBoundedInteger(options.interactiveUpdates, 'interactiveUpdates', 1, 100);
  const kinds = new Set(options.backgroundKinds);
  if (
    options.backgroundKinds.length !== 3 ||
    kinds.size !== 3 ||
    !kinds.has('parser') ||
    !kinds.has('diagnostic') ||
    !kinds.has('completion')
  ) {
    throw new RangeError('backgroundKinds must contain parser, diagnostic, and completion once');
  }

  const backgroundSliceBudgetMs = 8;
  let maximumBackgroundSliceMs = 0;
  const events: string[] = [];
  for (const kind of options.backgroundKinds) executeBackgroundSlice(kind);
  const measure = (kind: BackgroundKind): void => {
    const startedAt = performance.now();
    executeBackgroundSlice(kind);
    maximumBackgroundSliceMs = Math.max(maximumBackgroundSliceMs, performance.now() - startedAt);
  };
  const adapter: LanguageAdapter = Object.freeze({
    contractVersion: 1,
    id: 'stress',
    extensions: Object.freeze(['.stress']),
    syntax: async (_text: string, context: LanguageCapabilityContext) => {
      await context.yieldControl();
      measure('parser');
      events.push('background:parser');
      return { items: [] };
    },
    folds: async (_text: string, context: LanguageCapabilityContext) => {
      await context.yieldControl();
      measure('diagnostic');
      events.push('background:diagnostic');
      return { items: [] };
    },
    brackets: async (_text: string, context: LanguageCapabilityContext) => {
      await context.yieldControl();
      measure('completion');
      events.push('background:completion');
      return { items: [] };
    },
  });
  const scheduler = createLanguageScheduler({ maxResults: 3_000 });
  const pending = new Set<Promise<unknown>>();
  const first = scheduler.analyze(adapter, 'const stale = true;', { lineage: 'stress', revision: 0 });
  pending.add(first);
  first.finally(() => pending.delete(first)).catch(() => undefined);
  const second = scheduler.analyze(adapter, 'const current = true;', { lineage: 'stress', revision: 1 });
  pending.add(second);
  second.finally(() => pending.delete(second)).catch(() => undefined);

  const document = createDocumentModel({ text: '', uri: 'file:///stress.ts', languageId: 'typescript' });
  const session = createInProcessLspSession({
    capabilities: { completion: true, diagnostics: true, documentSymbols: true },
  });
  const lsp = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///stress.ts',
    languageId: 'typescript',
  });
  const editor = new CodeEditor({ controller: createCodeEditorController({ document, lsp }) });
  await lsp.open();
  for (let index = 0; index < options.interactiveUpdates; index += 1) {
    events.push(`interactive:${index}`);
    editor.insertText('x');
    editor.routeKey({ key: 'Escape' });
  }
  const [stale, current] = await Promise.all([first, second]);
  const cancelledCompletion = lsp.requestCompletion({ line: 0, character: 0 });
  cancelledCompletion.cancel();
  session.respond(
    cancelledCompletion.requestId,
    Array.from({ length: 1_000 }, (_, index) => ({ label: `stale-${index}` })),
  );
  const completion = lsp.requestCompletion({ line: 0, character: 0 });
  session.respond(
    completion.requestId,
    Array.from({ length: 1_000 }, (_, index) => ({ label: `item-${index}` })),
  );
  await completion.settled;
  session.publishDiagnostics(
    'file:///stress.ts',
    Number(document.identity.revision),
    Array.from({ length: 10_000 }, (_, index) => ({
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: Math.min(index + 1, document.snapshot.length) },
      },
      message: `diagnostic-${index}`,
    })),
  );
  await Promise.resolve();
  const firstInteractive = events.findIndex((event) => event.startsWith('interactive:'));
  const preceded = (kind: BackgroundKind): boolean => {
    const background = events.findIndex((event) => event === `background:${kind}`);
    return firstInteractive >= 0 && background > firstInteractive;
  };
  const noCancelledCompletionPresented =
    lsp.presentation.completion?.items.every((item) => !item.label.startsWith('stale-')) ?? true;
  const observedPending = lsp.retainedState.pendingRequests;
  (editor as CodeEditor & { dispose(): void }).dispose();

  return {
    interactivePrecededBackground: {
      parser: preceded('parser'),
      diagnostic: preceded('diagnostic'),
      completion: preceded('completion'),
    },
    backgroundWorkYielded: current.state === 'ready',
    cancelledStaleWorkPresented: stale.state !== 'degraded' || !noCancelledCompletionPresented,
    maximumBackgroundSliceMs: Number(maximumBackgroundSliceMs.toFixed(3)),
    backgroundSliceBudgetMs,
    pendingWorkAfterCancellation: pending.size + observedPending,
  };
}
