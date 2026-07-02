/**
 * Implementation tests — ambiguous-width glyph auto-swap internals & edge cases.
 *
 * Covers behaviour beyond the ST oracle: the `ambiguousWide` map's interplay with
 * the `utf8:false` catch-all and the box/half flags, continuation-cell (`''`)
 * passthrough, and non-mapped glyphs. The `render-glyphs.impl.test.ts` suite
 * separately confirms the pre-existing fallbacks stay green (behaviour-neutral
 * default `ambiguousWide:false`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import { fallbackGlyph } from '../src/engine/render/glyphs.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

describe('fallbackGlyph — ambiguousWide interplay', () => {
  it('swaps chrome glyphs even when utf8 is off (map wins over the ? catch-all)', () => {
    // The ambiguous map is checked first, so a chrome glyph degrades to its ASCII
    // substitute rather than the generic `?` the utf8-off path would otherwise emit.
    const c = caps({ unicode: { utf8: false }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: true } });
    expect(fallbackGlyph('▲', c)).toBe('^');
    expect(fallbackGlyph('×', c)).toBe('x');
  });

  it('a non-chrome glyph above U+007F still falls through to ? when utf8 is off', () => {
    const c = caps({ unicode: { utf8: false }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: true } });
    expect(fallbackGlyph('é', c)).toBe('?');
  });

  it('passes a continuation cell (empty string) straight through regardless of flags', () => {
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true } });
    expect(fallbackGlyph('', c)).toBe('');
  });

  it('leaves a plain ASCII glyph unchanged with ambiguousWide on', () => {
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: true } });
    expect(fallbackGlyph('A', c)).toBe('A');
  });

  it('still applies box/block fallbacks independently while ambiguousWide is on', () => {
    // Both an ambiguous flip and a box flip active at once — each table fires for its own glyphs.
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true } });
    expect(fallbackGlyph('▲', c)).toBe('^'); // ambiguous map
    expect(fallbackGlyph('┌', c)).toBe('+'); // box fallback (boxDrawing off)
    expect(fallbackGlyph('█', c)).toBe('#'); // block/shade fallback (halfBlocks off)
  });
});
