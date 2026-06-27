/**
 * Implementation tests — report builder internals (RD-03, plan doc 03-04).
 *
 * Edge cases beyond the ST oracle: table header/markers/recommendation line,
 * JSON round-trip, and provided results overriding the null default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, deriveRecommendation, renderTable, renderJson } from '../examples/capability-probe/report.js';
import { gatherEnvMeta } from '../examples/capability-probe/env-meta.js';
import { resolveCapabilities } from '../src/engine/index.js';

const META = gatherEnvMeta({
  env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  platform: 'linux',
  now: () => '2026-06-28T00:00:00.000Z',
});
const CAPS = resolveCapabilities({ env: { COLORTERM: 'truecolor' }, platform: 'linux' }).profile;

test('renderTable shows the terminal header, group sections, and recommendation', () => {
  const report = buildReport({
    meta: META,
    results: {},
    recommendation: deriveRecommendation({ caps: CAPS, results: {} }),
  });
  const table = renderTable(report);
  assert.ok(table.includes('xterm-256color'), 'TERM in header');
  assert.ok(table.includes('truecolor'), 'COLORTERM in header / recommendation');
  assert.ok(table.includes('[color]') && table.includes('[osc]'), 'group sections present');
  assert.ok(table.includes('Recommendation:'), 'recommendation line present');
});

test('renderTable marks yes / no / ? per result', () => {
  const results = {
    'attr.bold': { supported: true as const, method: 'manual' as const },
    'attr.dim': { supported: false as const, method: 'manual' as const },
  };
  const table = renderTable(
    buildReport({ meta: META, results, recommendation: deriveRecommendation({ caps: CAPS, results }) }),
  );
  assert.ok(table.includes('yes  bold'), 'true → yes');
  assert.ok(table.includes('no  dim'), 'false → no');
  assert.ok(table.includes('?  italic'), 'unprovided → ?');
});

test('renderJson round-trips to an equal object', () => {
  const report = buildReport({
    meta: META,
    results: {},
    recommendation: deriveRecommendation({ caps: CAPS, results: {} }),
  });
  assert.deepEqual(JSON.parse(renderJson(report)), report);
});

test('a provided result overrides the null default', () => {
  const results = { 'attr.bold': { supported: true as const, method: 'manual' as const } };
  const report = buildReport({ meta: META, results, recommendation: deriveRecommendation({ caps: CAPS, results }) });
  assert.equal(report.results['attr.bold'].supported, true);
  assert.equal(report.results['attr.dim'].supported, null, 'unprovided stays null');
});
