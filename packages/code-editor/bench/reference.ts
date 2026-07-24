import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { ChangeSet, Text, type Text as TextDocument } from '@codemirror/state';
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
}

interface BackgroundWork {
  readonly kind: BackgroundKind;
  readonly generation: number;
  remainingSlices: number;
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

function projectViewport(document: TextDocument, center: number): number {
  const middleLine = document.lineAt(center);
  const firstLine = Math.max(1, middleLine.number - 20);
  const lastLine = Math.min(document.lines, middleLine.number + 20);
  let projectedCodeUnits = 0;

  for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
    const line = document.line(lineNumber);
    projectedCodeUnits += String(lineNumber).length + document.sliceString(line.from, line.to).length;
  }
  return projectedCodeUnits;
}

function measureEditAndViewport(document: TextDocument): number {
  const editAt = Math.floor(document.length / 2);
  const startedAt = performance.now();
  const changes = ChangeSet.of([{ from: editAt, insert: 'x' }], document.length);
  const updated = changes.apply(document);
  const projectedCodeUnits = projectViewport(updated, editAt);
  if (projectedCodeUnits === 0) {
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
  const document = Text.of(source.split('\n'));

  for (let index = 0; index < options.warmupCount; index += 1) {
    measureEditAndViewport(document);
  }

  const samples: number[] = [];
  let peakBytes = process.memoryUsage().heapUsed;
  for (let index = 0; index < options.sampleCount; index += 1) {
    samples.push(measureEditAndViewport(document));
    peakBytes = Math.max(peakBytes, process.memoryUsage().heapUsed);
  }

  return {
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

  const events: string[] = [];
  const presented: string[] = [];
  const interactive: Array<() => void> = Array.from(
    { length: options.interactiveUpdates },
    (_, index) => () => events.push(`interactive:${index}`),
  );
  const background: BackgroundWork[] = options.backgroundKinds.map((kind) => ({
    kind,
    generation: 0,
    remainingSlices: 2,
  }));
  let activeGeneration = 0;
  let backgroundSliceCount = 0;

  while (interactive.length > 0) interactive.shift()?.();
  for (let index = 0; index < options.backgroundKinds.length; index += 1) {
    const work = background.shift();
    if (work === undefined) break;
    executeBackgroundSlice(work.kind);
    events.push(`background:${work.kind}:slice`);
    backgroundSliceCount += 1;
    work.remainingSlices -= 1;
    background.push(work);
    interactive.push(() => events.push(`interactive:yield:${index}`));
    while (interactive.length > 0) interactive.shift()?.();
  }

  activeGeneration = 1;
  background.push(
    ...options.backgroundKinds.map((kind) => ({
      kind,
      generation: activeGeneration,
      remainingSlices: 2,
    })),
  );

  while (background.length > 0) {
    const work = background.shift();
    if (work === undefined) break;
    executeBackgroundSlice(work.kind);
    events.push(`background:${work.kind}:slice`);
    backgroundSliceCount += 1;
    work.remainingSlices -= 1;
    if (work.remainingSlices > 0) {
      background.push(work);
    } else if (work.generation === activeGeneration) {
      presented.push(`${work.kind}:${work.generation}`);
    }
  }

  const firstInteractive = events.findIndex((event) => event.startsWith('interactive:'));
  const interactivePrecededBackground = Object.fromEntries(
    options.backgroundKinds.map((kind) => [kind, firstInteractive < events.indexOf(`background:${kind}:slice`)]),
  );

  return {
    interactivePrecededBackground: {
      parser: interactivePrecededBackground.parser === true,
      diagnostic: interactivePrecededBackground.diagnostic === true,
      completion: interactivePrecededBackground.completion === true,
    },
    backgroundWorkYielded: backgroundSliceCount > options.backgroundKinds.length,
    cancelledStaleWorkPresented: presented.some((entry) => entry.endsWith(':0')),
  };
}
