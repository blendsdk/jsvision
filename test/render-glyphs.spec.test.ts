/**
 * Specification tests — capability-driven glyph fallback (RD-04, AC-4).
 *
 * Immutable oracle: expectations derive from RD-04's acceptance criterion AC-4
 * and ST-5 / ST-11 in plan doc 07-testing-strategy (PL-9) — never from reading
 * the implementation. Fallback happens at serialize time, so these drive a
 * buffer through `serialize()`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { serialize } from '../src/engine/render/serialize.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

const STYLE: Style = { fg: 'default', bg: 'default' };

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

// ---------------------------------------------------------------------------
// ST-5 — box glyph fallback (AC-4)
// ---------------------------------------------------------------------------

test('ST-5: boxDrawing=false renders the frame in ASCII (+ - |), no Unicode box', () => {
  const buf = new ScreenBuffer(6, 4, { fg: 'default', bg: 'default' });
  buf.box(0, 0, 4, 3, STYLE, 'single');

  const out = serialize(buf, null, {
    caps: caps({ unicode: { utf8: true }, glyphs: { boxDrawing: false, halfBlocks: true } }),
  });
  for (const ascii of ['+', '-', '|']) {
    assert.ok(out.includes(ascii), `expected ASCII '${ascii}'`);
  }
  for (const uni of ['┌', '─', '┐', '│', '└', '┘']) {
    assert.ok(!out.includes(uni), `did not expect Unicode box glyph '${uni}'`);
  }
});

test('ST-5: boxDrawing=true keeps the Unicode box glyphs, no ASCII substitutes', () => {
  const buf = new ScreenBuffer(6, 4, { fg: 'default', bg: 'default' });
  buf.box(0, 0, 4, 3, STYLE, 'single');

  const out = serialize(buf, null, {
    caps: caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } }),
  });
  for (const uni of ['┌', '─', '┐', '│']) {
    assert.ok(out.includes(uni), `expected Unicode box glyph '${uni}'`);
  }
  for (const ascii of ['+', '-', '|']) {
    assert.ok(!out.includes(ascii), `did not expect ASCII substitute '${ascii}'`);
  }
});

// ---------------------------------------------------------------------------
// ST-11 — half-block & non-UTF-8 fallback (AC-4 detail, PL-9)
// ---------------------------------------------------------------------------

test('ST-11: halfBlocks=false maps block/shade glyphs to #', () => {
  const buf = new ScreenBuffer(4, 1, { fg: 'default', bg: 'default' });
  buf.set(0, 0, '█', STYLE);
  buf.set(1, 0, '░', STYLE);

  const out = serialize(buf, null, {
    caps: caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: false } }),
  });
  assert.ok(out.includes('#'), 'block/shade glyphs render as #');
  assert.ok(!out.includes('█') && !out.includes('░'), 'no raw block/shade glyphs');
});

test('ST-11: utf8=false maps a non-ASCII non-box glyph to ? and passes ASCII through', () => {
  const buf = new ScreenBuffer(4, 1, { fg: 'default', bg: 'default' });
  buf.set(0, 0, 'é', STYLE);
  buf.set(1, 0, 'A', STYLE);

  const out = serialize(buf, null, {
    caps: caps({ unicode: { utf8: false }, glyphs: { boxDrawing: true, halfBlocks: true } }),
  });
  assert.ok(out.includes('?'), 'é falls back to ?');
  assert.ok(!out.includes('é'), 'no raw é');
  assert.ok(out.includes('A'), 'ASCII passes through unchanged');
});
