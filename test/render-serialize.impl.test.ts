/**
 * Implementation tests — serializer internals (RD-04, plan doc 03-02).
 *
 * Edge cases: multi-row diffs, runs broken by an unchanged cell, full first
 * paint, the default encoder's mono vs truecolor behavior, and an injected
 * custom encoder. Complements the ST spec oracles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { serialize } from '../src/engine/render/serialize.js';
import type { StyleEncoder } from '../src/engine/render/serialize.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import { Attr } from '../src/engine/render/types.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

const DEFAULT_STYLE: Style = { fg: 'default', bg: 'default' };

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}
function blank(w: number, h: number): ScreenBuffer {
  return new ScreenBuffer(w, h, { fg: 'default', bg: 'default' });
}
function count(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

test('full first paint (previous === null) emits every cell', () => {
  const current = new ScreenBuffer(3, 2, { fg: 'default', bg: 'default', char: 'Q' });
  const out = serialize(current, null, { caps: caps() });
  assert.equal(count(out, 'Q'), 6);
});

test('changed cells on two different rows each get their own cursor move', () => {
  const previous = blank(10, 3);
  const current = blank(10, 3);
  current.set(0, 0, 'A', DEFAULT_STYLE);
  current.set(4, 2, 'B', DEFAULT_STYLE);
  const out = serialize(current, previous, { caps: caps() });
  assert.equal(count(out, '\x1b[1;1H'), 1, 'row 1 col 1');
  assert.equal(count(out, '\x1b[3;5H'), 1, 'row 3 col 5');
  assert.equal(count(out, 'H'), 2, 'exactly two cursor moves');
});

test('a run broken by an unchanged cell becomes two runs with two cursor moves', () => {
  const previous = blank(10, 1);
  const current = blank(10, 1);
  current.set(0, 0, 'A', DEFAULT_STYLE);
  // (1,0) stays an unchanged space.
  current.set(2, 0, 'B', DEFAULT_STYLE);
  const out = serialize(current, previous, { caps: caps() });
  assert.equal(count(out, '\x1b[1;1H'), 1);
  assert.equal(count(out, '\x1b[1;3H'), 1);
  assert.equal(count(out, 'H'), 2);
});

test('default encoder is monochrome under colorDepth mono (no color SGR)', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: '#ff0000', bg: 'default' });
  const out = serialize(current, previous, { caps: caps({ colorDepth: 'mono' }) });
  assert.equal(count(out, '38;2'), 0, 'mono emits no truecolor SGR');
});

test('default encoder emits truecolor under a color depth', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: '#ff0000', bg: 'default' });
  const out = serialize(current, previous, { caps: caps({ colorDepth: 'truecolor' }) });
  assert.equal(count(out, '38;2;255;0;0'), 1);
});

test('default encoder emits attribute SGR codes even when mono', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: 'default', bg: 'default', attrs: Attr.bold | Attr.underline });
  const out = serialize(current, previous, { caps: caps({ colorDepth: 'mono' }) });
  // bold=1, underline=4 combined into one SGR.
  assert.ok(out.includes('\x1b[1;4m'), 'bold + underline attribute SGR present');
});

test('named ANSI color resolves to truecolor via the default palette', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: 'brightRed', bg: 'default' });
  const out = serialize(current, previous, { caps: caps({ colorDepth: '256' }) });
  assert.equal(count(out, '38;2;255;0;0'), 1, 'brightRed → 255;0;0');
});

test('an injected custom encoder is used instead of the default', () => {
  const previous = blank(4, 1);
  const current = blank(4, 1);
  current.set(0, 0, 'a', { fg: '#ff0000', bg: 'default' });
  const tag: StyleEncoder = () => '\x1b[99m';
  const out = serialize(current, previous, { caps: caps({ colorDepth: 'truecolor' }), encodeStyle: tag });
  assert.ok(out.includes('\x1b[99m'), 'custom encoder output present');
  assert.equal(count(out, '38;2'), 0, 'default encoder not used');
});

test('a wide glyph emits a single lead glyph across its two-column run', () => {
  const previous = blank(6, 1);
  const current = blank(6, 1);
  current.text(0, 0, '世', DEFAULT_STYLE);
  const out = serialize(current, previous, { caps: caps({ unicode: { utf8: true } }) });
  assert.equal(count(out, '世'), 1, 'lead glyph emitted once; continuation emits nothing');
});
