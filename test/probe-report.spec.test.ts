/**
 * Specification tests — report builder & recommendation (RD-03, plan doc 03-04).
 *
 * Oracle source: 07-testing-strategy.md ST-8/9/10/11 (RD AC-4/AC-5, AR-10/AR-11).
 * Expectations derive from the report schema and the recommendation rule, not the
 * implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, deriveRecommendation } from '../examples/capability-probe/report.js';
import { gatherEnvMeta } from '../examples/capability-probe/env-meta.js';
import { runAutoProbes } from '../examples/capability-probe/auto-probes.js';
import { PROBES } from '../examples/capability-probe/taxonomy.js';
import { resolveCapabilities } from '../src/engine/index.js';
import type { TerminalQuery } from '../src/engine/index.js';

const META = gatherEnvMeta({ env: { TERM: 'xterm' }, platform: 'linux', now: () => '2026-06-28T00:00:00.000Z' });

function silentQuery(): TerminalQuery {
  async function* nothing(): AsyncGenerator<Uint8Array> {
    /* yields nothing, ends immediately */
  }
  return { write(): void {}, read: () => nothing() };
}

// ST-8: the report has every schema field.
test('ST-8: buildReport produces all schema fields', () => {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const recommendation = deriveRecommendation({ caps, results: {} });
  const report = buildReport({ meta: META, results: {}, recommendation });
  for (const key of [
    'terminal',
    'version',
    'os',
    'term',
    'colorterm',
    'termProgram',
    'multiplexer',
    'timestamp',
    'results',
    'recommendation',
  ]) {
    assert.ok(key in report, `report has ${key}`);
  }
});

// ST-9: with only auto results, every manual probe is supported:null.
test('ST-9: manual probes default to supported:null when unprovided (--auto)', () => {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const report = buildReport({ meta: META, results: {}, recommendation: deriveRecommendation({ caps, results: {} }) });
  for (const probe of PROBES) {
    if (probe.method === 'manual') {
      assert.deepEqual(report.results[probe.id], { supported: null, method: 'manual' }, probe.id);
    }
  }
});

// ST-10: recommendation echoes the resolved profile's key fields.
test('ST-10: deriveRecommendation populates the key fields from the profile', () => {
  const caps = resolveCapabilities({ env: { COLORTERM: 'truecolor' }, platform: 'linux' }).profile;
  const rec = deriveRecommendation({ caps, results: {} });
  assert.equal(rec.colorDepth, 'truecolor');
  assert.equal(typeof rec.mouse, 'boolean');
  assert.equal(typeof rec.unicodeWidth, 'string');
  assert.equal(typeof rec.altScreen, 'boolean');
  assert.equal(typeof rec.bracketedPaste, 'boolean');
});

// ST-11: COLORTERM=truecolor surfaces in the report's recommendation + color results.
test('ST-11: COLORTERM=truecolor surfaces as a truecolor recommendation', async () => {
  const env = { COLORTERM: 'truecolor' };
  const caps = resolveCapabilities({ env, platform: 'linux' }).profile;
  const auto = await runAutoProbes({ query: silentQuery(), env, platform: 'linux', timeoutMs: 30 });
  const report = buildReport({
    meta: META,
    results: auto,
    recommendation: deriveRecommendation({ caps, results: auto }),
  });
  assert.equal(report.recommendation.colorDepth, 'truecolor');
  assert.equal(report.results['color.truecolor'].supported, true);
});
