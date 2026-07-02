/**
 * Specification tests — ambiguous-width glyph auto-swap (feature glyph-auto-swap).
 *
 * IMMUTABLE ORACLE. Expectations derive exclusively from `01-requirements.md`
 * (FR-1/FR-2), `03-01-core-glyph-swap.md` (§1–2), and the Ambiguity Register
 * (AR-5/AR-6/AR-7) — never from reading the implementation. Traceability:
 * ST-01…ST-04 in `07-testing-strategy.md`.
 *
 *   • FR-1 / AR-5 — `GlyphCaps` gains `ambiguousWide: boolean`, default `false`
 *     in `CONSERVATIVE_DEFAULTS`.
 *   • FR-2 / AR-7 — `fallbackGlyph` swaps the 8 fallback-prone chrome glyphs
 *     `▲▼◄►•↑↕×` to the ncurses-style ASCII map `^ v < > * ^ v x` when
 *     `caps.glyphs.ambiguousWide` is `true`; box-drawing / block-shade fallbacks
 *     stay independent (AR-6 group independence).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import { fallbackGlyph } from '../src/engine/render/glyphs.js';
import { CONSERVATIVE_DEFAULTS } from '../src/engine/capability/defaults.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

/** Resolve a profile with an override, mirroring the render-glyphs spec helper. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

/** The 8 fallback-prone chrome glyphs and their expected ASCII degradations (AR-7). */
const AMBIGUOUS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['▲', '^'],
  ['▼', 'v'],
  ['◄', '<'],
  ['►', '>'],
  ['•', '*'],
  ['↑', '^'],
  ['↕', 'v'],
  ['×', 'x'],
];

describe('glyph-swap ST-01…ST-04 (fallback map + capability flag)', () => {
  // ST-01 — with ambiguousWide off, every chrome glyph passes through unchanged.
  it('ST-01: ambiguousWide=false leaves ▲▼◄►•↑↕× unchanged (utf8/box/half all on)', () => {
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: false } });
    for (const [glyph] of AMBIGUOUS_PAIRS) {
      expect(fallbackGlyph(glyph, c)).toBe(glyph);
    }
  });

  // ST-02 — with ambiguousWide on, each chrome glyph maps to its ncurses ASCII substitute.
  it('ST-02: ambiguousWide=true swaps ▲▼◄►•↑↕× to ^ v < > * ^ v x', () => {
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: true } });
    for (const [glyph, ascii] of AMBIGUOUS_PAIRS) {
      expect(fallbackGlyph(glyph, c)).toBe(ascii);
    }
  });

  // ST-03 — the ambiguous group flag is independent of the box/half flags (map disjointness, AR-6).
  it('ST-03: ambiguousWide=true with boxDrawing/halfBlocks on leaves ┌ █ ▒ unchanged', () => {
    const c = caps({ unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: true } });
    for (const glyph of ['┌', '█', '▒']) {
      expect(fallbackGlyph(glyph, c)).toBe(glyph);
    }
  });

  // ST-04 — defaults keep the all-false convention; an existing box/half override leaves ambiguousWide false.
  it('ST-04: CONSERVATIVE_DEFAULTS.glyphs is all-false; a box/half override keeps ambiguousWide false', () => {
    expect(CONSERVATIVE_DEFAULTS.glyphs).toEqual({ boxDrawing: false, halfBlocks: false, ambiguousWide: false });

    const resolved = caps({ glyphs: { boxDrawing: true, halfBlocks: true } });
    expect(resolved.glyphs.ambiguousWide).toBe(false);
  });
});
