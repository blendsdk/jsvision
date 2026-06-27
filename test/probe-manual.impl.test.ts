/**
 * Implementation tests — manual-probe internals (RD-03, plan doc 03-03).
 *
 * Edge cases beyond the ST oracle: deterministic test-pattern output (glyphs +
 * truecolor swatch SGR), program-constant OSC sequences emitted via the loop, and
 * all-skip accumulation. Real ScreenBuffer + serialize (no mocks).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderProbePattern, runManualProbes } from '../examples/capability-probe/manual-probes.js';
import type { ProbeDescriptor } from '../examples/capability-probe/taxonomy.js';
import { ScreenBuffer, serialize, resolveCapabilities } from '../src/engine/index.js';

const TRUECOLOR = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function descriptor(id: string): ProbeDescriptor {
  return { id, group: 'osc', label: id, method: 'manual' };
}
function buildBuffer(id: string): ScreenBuffer {
  const buffer = new ScreenBuffer(60, 8, { fg: 'default', bg: 'default' });
  renderProbePattern(buffer, descriptor(id), TRUECOLOR);
  return buffer;
}

test('the box-drawing pattern stores real box-drawing glyphs in the buffer', () => {
  // Assert the buffer cells directly — the serialize default encoder applies glyph
  // fallback per caps, which is a render-time concern, not the renderer's output.
  const buffer = buildBuffer('glyph.boxDrawing');
  assert.equal(buffer.get(0, 2)?.char, '┌');
});

test('the truecolor swatch emits a truecolor background SGR', () => {
  const out = serialize(buildBuffer('color.swatch.truecolor'), null, { caps: TRUECOLOR });
  assert.ok(out.includes('48;2;255;0;0'), 'red truecolor background present');
});

test('the CJK pattern stores the wide sample glyph in the buffer', () => {
  const buffer = buildBuffer('unicode.cjkWidth');
  assert.equal(buffer.get(0, 2)?.char, '你');
});

test('fire-and-forget OSC probes emit program-constant sequences', async () => {
  const emitted: string[] = [];
  await runManualProbes({
    render: () => {},
    emit: (sequence) => emitted.push(sequence),
    nextKey: () => Promise.resolve('y'),
    probes: [descriptor('osc.bell'), descriptor('osc.title')],
    caps: TRUECOLOR,
  });
  assert.ok(emitted.includes('\x07'), 'bell emitted');
  assert.ok(emitted.includes('\x1b]0;capability-probe\x07'), 'title set emitted');
});

test('a purely visual probe emits no escape sequence', async () => {
  const emitted: string[] = [];
  await runManualProbes({
    render: () => {},
    emit: (sequence) => emitted.push(sequence),
    nextKey: () => Promise.resolve('y'),
    probes: [{ id: 'attr.bold', group: 'attributes', label: 'bold', method: 'manual' }],
    caps: TRUECOLOR,
  });
  assert.equal(emitted.length, 0, 'visual probe fires no OSC');
});

test('all-skip answers record every probe as null', async () => {
  const probes = [descriptor('osc.bell'), descriptor('osc.title'), descriptor('osc.notify9')];
  const results = await runManualProbes({
    render: () => {},
    emit: () => {},
    nextKey: () => Promise.resolve('s'),
    probes,
    caps: TRUECOLOR,
  });
  for (const probe of probes) {
    assert.deepEqual(results[probe.id], { supported: null, method: 'manual' });
  }
});
