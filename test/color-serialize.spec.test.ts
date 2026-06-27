/**
 * Specification tests — color/serializer integration (RD-05).
 *
 * Immutable oracle: expectations derive from RD-05 AC-1 + AR-3 via ST-17 in plan
 * doc 07-testing-strategy — never from reading the implementation. The depth-aware
 * encoder is now `serialize()`'s default, so a frame DOWNSAMPLES by default at 256
 * while still emitting full truecolor at `truecolor` depth (RD-04 oracle preserved).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { serialize } from '../src/engine/render/serialize.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile>): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}
function blank(w: number, h: number): ScreenBuffer {
  return new ScreenBuffer(w, h, { fg: 'default', bg: 'default' });
}

// ST-17 — serialize() downsamples by default at 256; truecolor unchanged.
test('ST-17: a brightRed cell downsamples to 38;5;9 at colorDepth 256', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: 'brightRed', bg: 'default' });
  const out = serialize(current, previous, { caps: caps({ colorDepth: '256' }) });
  assert.ok(out.includes('38;5;9'), 'downsampled 256 index for brightRed');
  assert.ok(!out.includes('38;2'), 'no truecolor over-emit at 256');
});

test('ST-17: the same cell still emits full truecolor at colorDepth truecolor', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: 'brightRed', bg: 'default' });
  const out = serialize(current, previous, { caps: caps({ colorDepth: 'truecolor' }) });
  assert.ok(out.includes('38;2;255;0;0'), 'truecolor preserved (RD-04 oracle)');
});
