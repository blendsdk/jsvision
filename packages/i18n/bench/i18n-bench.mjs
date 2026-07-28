#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { createI18n, defineCatalog } from '../dist/index.js';

const WARM_CALLS = 100_000;
const SAMPLES = 7;
const WARM_MEDIAN_BUDGET_MS = 250;
const WARM_P95_BUDGET_MS = 250;

/** Return the nearest-rank percentile from a non-empty sample set. */
function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

/** Return the median from a non-empty sample set. */
function median(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Measure the fixed cold-construction and warm-translation workloads.
 *
 * @returns {{
 *   environment: { node: string, platform: string, arch: string },
 *   workload: { catalogMessages: number, warmCalls: number, samples: number },
 *   cold: { medianMs: number, p95Ms: number },
 *   warm: { medianMs: number, p95Ms: number },
 *   thresholds: { warmMedianMs: number, warmP95Ms: number }
 * }} Serializable benchmark result.
 * @example
 * const result = runI18nBenchmark();
 * console.log(result.warm.medianMs);
 */
export function runI18nBenchmark() {
  const catalog = defineCatalog({
    schema: 1,
    locale: 'en',
    messages: { 'benchmark.greeting': 'Hello ${name}' },
  });
  let sink = 0;
  const cold = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const start = performance.now();
    sink += createI18n({ locale: 'en', catalogs: [catalog] }).t('benchmark.greeting', {
      params: { name: 'Ada' },
    }).length;
    cold.push(performance.now() - start);
  }

  const i18n = createI18n({ locale: 'en', catalogs: [catalog] });
  i18n.t('benchmark.greeting', { params: { name: 'Ada' } });
  const warm = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const start = performance.now();
    for (let call = 0; call < WARM_CALLS; call += 1) {
      sink += i18n.t('benchmark.greeting', { params: { name: 'Ada' } }).length;
    }
    warm.push(performance.now() - start);
  }
  if (sink < 0) throw new Error('Unreachable benchmark sink.');

  return {
    environment: { node: process.versions.node, platform: process.platform, arch: process.arch },
    workload: { catalogMessages: 1, warmCalls: WARM_CALLS, samples: SAMPLES },
    cold: { medianMs: median(cold), p95Ms: percentile(cold, 0.95) },
    warm: { medianMs: median(warm), p95Ms: percentile(warm, 0.95) },
    thresholds: { warmMedianMs: WARM_MEDIAN_BUDGET_MS, warmP95Ms: WARM_P95_BUDGET_MS },
  };
}

/** Print the fixed benchmark and return a failing code when either warm threshold is exceeded. */
function main() {
  const result = runI18nBenchmark();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.warm.medianMs <= result.thresholds.warmMedianMs && result.warm.p95Ms <= result.thresholds.warmP95Ms
    ? 0
    : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
