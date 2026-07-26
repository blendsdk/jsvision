import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { createDocumentModel } from './model.js';
import { offsetToVisualColumn } from './positions.js';

interface DocumentBenchmarkOptions {
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly historyEdits: number;
}

interface Percentiles {
  readonly p50Ms: number;
  readonly p95Ms: number;
}

interface DocumentFixtureEvidence {
  readonly label: string;
  readonly edit: Percentiles;
  readonly visualColumn: Percentiles;
  readonly rawEditSamplesMs: readonly number[];
  readonly rawVisualSamplesMs: readonly number[];
  readonly coldVisualColumnMs: number;
  readonly retainedHeapBytes: number;
  readonly retainedHistoryBytes: number;
}

/**
 * Reproducible isolated evidence for document edit, position-query, and retained-history budgets.
 */
export interface DocumentBenchmarkEvidence {
  readonly runtime: string;
  readonly environment: string;
  readonly processor: string;
  readonly sampleCount: number;
  readonly warmupCount: number;
  readonly historyEdits: number;
  readonly fixtures: readonly DocumentFixtureEvidence[];
}

const execFileAsync = promisify(execFile);

/**
 * Runs document measurements in a clean Node process with explicit garbage collection.
 */
export async function runDocumentBenchmark(options: DocumentBenchmarkOptions): Promise<DocumentBenchmarkEvidence> {
  validateOptions(options);
  const moduleUrl = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), 'document-benchmark.js')).href;
  const script = `
    const module = await import(${JSON.stringify(moduleUrl)});
    const result = module.runDocumentBenchmarkWorker(${JSON.stringify(options)});
    process.stdout.write(JSON.stringify(result));
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['--expose-gc', '--input-type=module', '--eval', script],
    { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 60_000 },
  );
  if (stderr.length > 0) {
    throw new Error(`Document benchmark wrote to stderr: ${stderr.slice(0, 200)}`);
  }
  const evidence: unknown = JSON.parse(stdout);
  if (!isDocumentBenchmarkEvidence(evidence)) {
    throw new Error('Document benchmark returned malformed evidence.');
  }
  return evidence;
}

/**
 * Performs the benchmark inside the isolated worker process.
 */
export function runDocumentBenchmarkWorker(options: DocumentBenchmarkOptions): DocumentBenchmarkEvidence {
  validateOptions(options);
  return {
    runtime: process.version,
    environment: `${process.platform}-${process.arch}`,
    processor: cpus()[0]?.model ?? 'unknown',
    sampleCount: options.sampleCount,
    warmupCount: options.warmupCount,
    historyEdits: options.historyEdits,
    fixtures: [
      measureFixture('1 MiB', 'x'.repeat(1_048_576), options),
      measureFixture('50,000 lines', `${'x\n'.repeat(49_999)}x`, options),
    ],
  };
}

function measureFixture(label: string, text: string, options: DocumentBenchmarkOptions): DocumentFixtureEvidence {
  const model = createDocumentModel({ text });
  const editSamples: number[] = [];
  const edit = (iteration: number): number => {
    const at = (iteration * 25_007) % model.snapshot.length;
    const started = performance.now();
    const result = model.apply(
      model.createTransaction({
        edits: [{ range: { from: at, to: at + 1 }, text: iteration % 2 === 0 ? 'y' : 'x' }],
        origin: 'typing',
      }),
    );
    if (!result.accepted) {
      throw new Error('Reference document edit was rejected.');
    }
    return performance.now() - started;
  };
  for (let iteration = 0; iteration < options.warmupCount; iteration += 1) {
    edit(iteration);
  }
  for (let iteration = 0; iteration < options.sampleCount; iteration += 1) {
    editSamples.push(edit(iteration + options.warmupCount));
  }

  const snapshot = model.snapshot;
  const queryOffset = snapshot.lineCount === 1 ? snapshot.length : snapshot.line(25_000).to;
  const coldVisualStarted = performance.now();
  offsetToVisualColumn(snapshot, queryOffset);
  const coldVisualColumnMs = performance.now() - coldVisualStarted;
  const visualSamples: number[] = [];
  for (let iteration = 0; iteration < options.sampleCount; iteration += 1) {
    const started = performance.now();
    offsetToVisualColumn(snapshot, queryOffset);
    visualSamples.push(performance.now() - started);
  }

  garbageCollect();
  const memoryBeforeHistory = process.memoryUsage().heapUsed;
  for (let iteration = 0; iteration < options.historyEdits; iteration += 1) {
    edit(iteration + options.sampleCount + options.warmupCount);
  }
  garbageCollect();
  const retainedHeapBytes = Math.max(0, process.memoryUsage().heapUsed - memoryBeforeHistory);
  return {
    label,
    edit: percentiles(editSamples),
    visualColumn: percentiles(visualSamples),
    rawEditSamplesMs: rounded(editSamples),
    rawVisualSamplesMs: rounded(visualSamples),
    coldVisualColumnMs: Number(coldVisualColumnMs.toFixed(3)),
    retainedHeapBytes,
    retainedHistoryBytes: model.historyRetainedBytes,
  };
}

function validateOptions(options: DocumentBenchmarkOptions): void {
  requireInteger(options.sampleCount, 5, 100, 'sampleCount');
  requireInteger(options.warmupCount, 1, 20, 'warmupCount');
  requireInteger(options.historyEdits, 100, 2_000, 'historyEdits');
}

function requireInteger(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
}

function percentiles(samples: readonly number[]): Percentiles {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return Number((sorted[index] ?? Number.POSITIVE_INFINITY).toFixed(3));
}

function rounded(samples: readonly number[]): readonly number[] {
  return samples.map((sample) => Number(sample.toFixed(3)));
}

function garbageCollect(): void {
  const candidate: unknown = Reflect.get(globalThis, 'gc');
  if (typeof candidate !== 'function') {
    throw new Error('Document benchmark requires Node --expose-gc.');
  }
  candidate();
}

function isDocumentBenchmarkEvidence(value: unknown): value is DocumentBenchmarkEvidence {
  return (
    typeof value === 'object' &&
    value !== null &&
    'runtime' in value &&
    typeof value.runtime === 'string' &&
    'fixtures' in value &&
    Array.isArray(value.fixtures) &&
    value.fixtures.length === 2
  );
}
