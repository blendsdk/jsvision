/** Deterministic responsiveness oracle for the complete Phase D projection transaction. */
import { describe, expect, test } from 'vitest';

import * as kanbanTesting from '../src/testing.js';

const CARDS = 2_000;
const COLUMNS = 8;
const SWIMLANES = 4;
const FILTERS = 10;
const WARMUPS = 20;
const ITERATIONS = 200;
const MEDIAN_BUDGET_MS = 16;
const timingTest = process.env.CI || process.env.TUI_SKIP_PERF ? test.skip : test;

/** Closed per-commit work evidence required from the public deterministic fixture. */
interface PhaseDCommitEvidence {
  readonly candidateOpens: number;
  readonly activations: number;
  readonly layoutReflows: number;
  readonly renderInvalidations: number;
  readonly deliveries: number;
  readonly fullSceneInvalidations: number;
}

/** Complete performance result returned after exact fake-clock debounce. */
interface PhaseDPerformanceResult {
  readonly cards: number;
  readonly columns: number;
  readonly swimlanes: number;
  readonly filters: number;
  readonly warmups: number;
  readonly iterations: number;
  readonly samplesMs: readonly number[];
  readonly commits: readonly PhaseDCommitEvidence[];
}

/** Validates one closed numeric per-commit evidence record. */
function isCommitEvidence(value: unknown): value is PhaseDCommitEvidence {
  if (typeof value !== 'object' || value === null) return false;
  return [
    'candidateOpens',
    'activations',
    'layoutReflows',
    'renderInvalidations',
    'deliveries',
    'fullSceneInvalidations',
  ].every((key) => typeof Reflect.get(value, key) === 'number');
}

/** Validates the deterministic fixture result without trusting a testing implementation cast. */
function isPerformanceResult(value: unknown): value is PhaseDPerformanceResult {
  if (typeof value !== 'object' || value === null) return false;
  const samples: unknown = Reflect.get(value, 'samplesMs');
  const commits: unknown = Reflect.get(value, 'commits');
  return (
    ['cards', 'columns', 'swimlanes', 'filters', 'warmups', 'iterations'].every(
      (key) => typeof Reflect.get(value, key) === 'number',
    ) &&
    Array.isArray(samples) &&
    samples.every((sample) => typeof sample === 'number') &&
    Array.isArray(commits) &&
    commits.every(isCommitEvidence)
  );
}

/** Reads and validates the testing-only performance fixture factory. */
function createHarness(): Readonly<{ run: () => PhaseDPerformanceResult; dispose: () => void }> {
  const factory: unknown = Reflect.get(kanbanTesting, 'createKanbanPhaseDPerformanceHarness');
  expect(factory).toBeTypeOf('function');
  if (typeof factory !== 'function') throw new Error('Missing deterministic Phase D performance harness.');
  const harness: unknown = Reflect.apply(factory, kanbanTesting, [
    {
      cards: CARDS,
      columns: COLUMNS,
      swimlanes: SWIMLANES,
      filters: FILTERS,
      debounceMs: 150,
      warmups: WARMUPS,
      iterations: ITERATIONS,
    },
  ]);
  if (typeof harness !== 'object' || harness === null) throw new Error('Invalid Phase D performance harness.');
  const run: unknown = Reflect.get(harness, 'run');
  const dispose: unknown = Reflect.get(harness, 'dispose');
  if (typeof run !== 'function' || typeof dispose !== 'function') {
    throw new Error('Incomplete Phase D performance harness.');
  }
  return Object.freeze({
    run: () => {
      const result: unknown = Reflect.apply(run, harness, []);
      if (!isPerformanceResult(result)) throw new Error('Invalid Phase D performance result.');
      return result;
    },
    dispose: () => {
      Reflect.apply(dispose, harness, []);
    },
  });
}

/** Returns the median without mutating the fixture's ordered evidence. */
function median(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)] ?? Number.POSITIVE_INFINITY;
}

describe('Phase D productivity performance', () => {
  test('keeps every measured commit inside deterministic work-count budgets', () => {
    const harness = createHarness();
    const result = harness.run();

    expect(result).toMatchObject({
      cards: CARDS,
      columns: COLUMNS,
      swimlanes: SWIMLANES,
      filters: FILTERS,
      warmups: WARMUPS,
      iterations: ITERATIONS,
    });
    expect(result.commits).toHaveLength(ITERATIONS);
    for (const commit of result.commits) {
      expect(commit.candidateOpens).toBe(1);
      expect(commit.activations).toBe(1);
      expect(commit.layoutReflows).toBeLessThanOrEqual(1);
      expect(commit.renderInvalidations).toBeLessThanOrEqual(2);
      expect(commit.deliveries).toBe(1);
      expect(commit.fullSceneInvalidations).toBe(0);
    }
    harness.dispose();
  });

  timingTest('keeps median post-debounce work within one 16 ms terminal frame', () => {
    const harness = createHarness();
    const result = harness.run();

    expect(result.samplesMs).toHaveLength(ITERATIONS);
    expect(median(result.samplesMs), `median ${median(result.samplesMs).toFixed(3)}ms`).toBeLessThanOrEqual(
      MEDIAN_BUDGET_MS,
    );
    harness.dispose();
  });
});
