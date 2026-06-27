/**
 * Specification tests — manual probes (RD-03, plan doc 03-03).
 *
 * Oracle source: 07-testing-strategy.md ST-12 / ST-12b (RD AC-3, AR-8, AR-15).
 * The manual loop must record EVERY probe and never stop early when one is "no";
 * confirmation keys map y→true, n→false, s→null. Expectations derive from the
 * spec, not the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runManualProbes, classifyConfirmation } from '../examples/capability-probe/manual-probes.js';
import type { ProbeDescriptor } from '../examples/capability-probe/taxonomy.js';
import { resolveCapabilities } from '../src/engine/index.js';

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

const PROBES: readonly ProbeDescriptor[] = [
  { id: 'attr.bold', group: 'attributes', label: 'bold', method: 'manual' },
  { id: 'attr.italic', group: 'attributes', label: 'italic', method: 'manual' },
  { id: 'osc.bell', group: 'osc', label: 'bell', method: 'manual' },
];

// ST-12: one "no" does not stop the loop; every probe is recorded.
test('ST-12: a "no" answer does not stop the loop; every probe is recorded', async () => {
  const answers: Array<'y' | 'n' | 's'> = ['y', 'n', 'y'];
  let i = 0;
  const results = await runManualProbes({
    render: () => {},
    emit: () => {},
    nextKey: () => Promise.resolve(answers[i++]),
    probes: PROBES,
    caps: CAPS,
  });

  assert.deepEqual(Object.keys(results).sort(), ['attr.bold', 'attr.italic', 'osc.bell'].sort());
  assert.equal(results['attr.bold'].supported, true);
  assert.equal(results['attr.italic'].supported, false, 'the "no" probe is recorded false');
  assert.equal(results['osc.bell'].supported, true, 'the loop continued past the "no"');
});

// ST-12b: confirmation key mapping.
test('ST-12b: classifyConfirmation maps y/n/s to true/false/null (method manual)', () => {
  assert.deepEqual(classifyConfirmation('y'), { supported: true, method: 'manual' });
  assert.deepEqual(classifyConfirmation('n'), { supported: false, method: 'manual' });
  assert.deepEqual(classifyConfirmation('s'), { supported: null, method: 'manual' });
});
