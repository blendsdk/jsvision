/**
 * Implementation tests — glyph fallback table (RD-04, PL-9).
 *
 * Exercises `fallbackGlyph` directly across the full box set (single + double),
 * tee/cross glyphs, blocks/shades, the non-UTF-8 path, and the no-fallback case
 * under full capabilities. Complements the ST-5 / ST-11 spec oracles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fallbackGlyph } from '../src/engine/render/glyphs.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

const FULL = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } });
const NO_BOX = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: false, halfBlocks: true } });
const NO_BLOCKS = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: false } });
const NO_UTF8 = caps({ unicode: { utf8: false }, glyphs: { boxDrawing: true, halfBlocks: true } });

test('single-line box glyphs fall back to + - |', () => {
  assert.equal(fallbackGlyph('┌', NO_BOX), '+');
  assert.equal(fallbackGlyph('┐', NO_BOX), '+');
  assert.equal(fallbackGlyph('└', NO_BOX), '+');
  assert.equal(fallbackGlyph('┘', NO_BOX), '+');
  assert.equal(fallbackGlyph('─', NO_BOX), '-');
  assert.equal(fallbackGlyph('│', NO_BOX), '|');
});

test('double-line box glyphs fall back to + - |', () => {
  assert.equal(fallbackGlyph('╔', NO_BOX), '+');
  assert.equal(fallbackGlyph('╝', NO_BOX), '+');
  assert.equal(fallbackGlyph('═', NO_BOX), '-');
  assert.equal(fallbackGlyph('║', NO_BOX), '|');
});

test('tee and cross glyphs fall back to +', () => {
  for (const g of ['├', '┤', '┬', '┴', '┼']) {
    assert.equal(fallbackGlyph(g, NO_BOX), '+', g);
  }
});

test('block and shade glyphs fall back to # when halfBlocks is off', () => {
  for (const g of ['█', '▀', '▄', '▌', '▐', '░', '▒', '▓']) {
    assert.equal(fallbackGlyph(g, NO_BLOCKS), '#', g);
  }
});

test('non-UTF-8 maps any non-ASCII non-box glyph to ? and passes ASCII', () => {
  assert.equal(fallbackGlyph('é', NO_UTF8), '?');
  assert.equal(fallbackGlyph('世', NO_UTF8), '?');
  assert.equal(fallbackGlyph('A', NO_UTF8), 'A');
  assert.equal(fallbackGlyph(' ', NO_UTF8), ' ');
});

test('non-UTF-8 still ASCII-substitutes box glyphs when boxDrawing is also off', () => {
  const noBoxNoUtf8 = caps({ unicode: { utf8: false }, glyphs: { boxDrawing: false, halfBlocks: true } });
  assert.equal(fallbackGlyph('┌', noBoxNoUtf8), '+', 'ASCII box wins over the ? path');
});

test('full capabilities pass every glyph through unchanged', () => {
  for (const g of ['┌', '█', 'é', '世', 'A', '─']) {
    assert.equal(fallbackGlyph(g, FULL), g, g);
  }
});

test('a continuation cell empty string passes through unchanged', () => {
  assert.equal(fallbackGlyph('', NO_UTF8), '');
});
