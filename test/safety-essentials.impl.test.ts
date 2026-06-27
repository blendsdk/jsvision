/**
 * Implementation tests — essentials gate internals (RD-08; AR-2, AR-8).
 *
 * Multiple simultaneous degradations and their deterministic order, the one-
 * notice-per-degradation logging order, `missing` content on a non-TTY, and the
 * structural typing of `HostFacts` (a started-host-like object is accepted).
 * Complements the ST-1…ST-8 spec oracle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateEssentials, essentialsMet, assertEssentials, createLogger } from '../src/engine/safety/index.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { DeepPartial, CapabilityProfile } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile>): CapabilityProfile {
  return resolveCapabilities({ override }).profile;
}

const ALL_DEGRADED = caps({ mouse: { sgr: false }, colorDepth: 'mono', altScreen: false });

test('all three non-essentials degrade together in mouse→color→altScreen order', () => {
  const report = evaluateEssentials(ALL_DEGRADED, { isTTY: true });
  assert.equal(report.met, true);
  assert.deepEqual(
    report.degradations.map((d) => d.cap),
    ['mouse', 'color', 'altScreen'],
  );
  assert.deepEqual(
    report.degradations.map((d) => d.mode),
    ['keyboard-only', 'monochrome', 'inline'],
  );
});

test('assertEssentials logs one gate notice per degradation, in order', () => {
  const ring = createLogger({ sink: 'ring' });
  assertEssentials(ALL_DEGRADED, { isTTY: true }, { logger: ring });
  const entries = ring.entries();
  assert.equal(entries.length, 3);
  assert.ok(
    entries.every((e) => e.component === 'gate'),
    'every notice is tagged gate',
  );
  assert.deepEqual(
    entries.map((e) => e.fields?.cap),
    ['mouse', 'color', 'altScreen'],
  );
});

test('a non-TTY reports exactly the interactive-TTY essential as missing', () => {
  const report = evaluateEssentials(ALL_DEGRADED, { isTTY: false });
  assert.equal(report.met, false);
  assert.equal(report.missing.length, 1);
  assert.match(report.missing[0], /interactive TTY/);
});

test('assertEssentials throws on a non-TTY even when degradations are present', () => {
  assert.throws(() => assertEssentials(ALL_DEGRADED, { isTTY: false }));
});

test('HostFacts is structural: a started-host-like object is accepted', () => {
  // A richer object (extra members) is structurally compatible with HostFacts.
  const hostLike = {
    isTTY: true,
    start: async () => undefined,
    stop: async () => undefined,
    render: () => undefined,
  };
  assert.equal(essentialsMet(caps({ mouse: { sgr: true }, colorDepth: 'truecolor', altScreen: true }), hostLike), true);
});
