import { performance } from 'node:perf_hooks';

import { expect, it } from 'vitest';

import { createLanguageScheduler } from '../index.js';
import { postgresqlLanguageAdapter } from './postgresql.js';

it('keeps a 50,000-line PostgreSQL lexical pass bounded', async () => {
  const text = 'SELECT id FROM records WHERE id = 1;\n'.repeat(50_000);
  const started = performance.now();
  const result = await createLanguageScheduler({ maxResults: 1_000_000 }).analyze(postgresqlLanguageAdapter, text, {
    lineage: 'benchmark',
    revision: 0,
  });
  const elapsed = performance.now() - started;

  expect(result.state).toBe('ready');
  expect(elapsed).toBeLessThan(2_000);
}, 10_000);

it('keeps bounded PostgreSQL parser-region p95 below one interaction frame', async () => {
  const samples: number[] = [];
  for (let sample = 0; sample < 40; sample += 1) {
    const started = performance.now();
    await createLanguageScheduler().analyze(postgresqlLanguageAdapter, 'SELECT\n  id\nFROM records;', {
      lineage: `sample-${sample}`,
      revision: 0,
    });
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? Number.POSITIVE_INFINITY;

  expect(p95).toBeLessThan(16);
});
