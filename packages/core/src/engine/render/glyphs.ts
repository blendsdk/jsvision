/**
 * Capability-driven ASCII glyph fallback.
 *
 * The {@link ScreenBuffer} always stores the real Unicode glyph; the serializer
 * passes each emitted glyph through {@link fallbackGlyph} so the same buffer
 * renders Unicode on a capable terminal and ASCII on a minimal one — you never
 * keep a second buffer. Substitution is a paint-time concern, driven entirely by
 * the terminal's resolved `glyphs`/`unicode` capabilities.
 */

import type { CapabilityProfile } from '../capability/index.js';

/**
 * Unicode box-drawing glyphs → their ASCII substitute when `boxDrawing` is off.
 * Corners and tees/cross collapse to `+`, horizontals to `-`, verticals to `|`
 * (single and double variants alike).
 */
const BOX_FALLBACK: ReadonlyMap<string, string> = new Map([
  // Corners (single + double).
  ['\u250C', '+'], // ┌
  ['\u2510', '+'], // ┐
  ['\u2514', '+'], // └
  ['\u2518', '+'], // ┘
  ['\u2554', '+'], // ╔
  ['\u2557', '+'], // ╗
  ['\u255A', '+'], // ╚
  ['\u255D', '+'], // ╝
  // Horizontals.
  ['\u2500', '-'], // ─
  ['\u2550', '-'], // ═
  // Verticals.
  ['\u2502', '|'], // │
  ['\u2551', '|'], // ║
  // Tees / cross.
  ['\u251C', '+'], // ├
  ['\u2524', '+'], // ┤
  ['\u252C', '+'], // ┬
  ['\u2534', '+'], // ┴
  ['\u253C', '+'], // ┼
]);

/**
 * Fallback-prone (mostly East-Asian-Ambiguous) chrome glyphs → ASCII when
 * `glyphs.ambiguousWide` is set — ncurses-ACS-style degradations. Disjoint from
 * {@link BOX_FALLBACK} and {@link BLOCK_SHADE}
 * (U+25B2/25BC/25C4/25BA/2022/2191/2195/00D7), so its check ordering is
 * collision-free.
 */
const AMBIGUOUS_FALLBACK: ReadonlyMap<string, string> = new Map([
  ['▲', '^'], // ▲ scroll-up arrow
  ['▼', 'v'], // ▼ scroll-down arrow
  ['◄', '<'], // ◄ scroll-left / input-scroll / submenu arrow
  ['►', '>'], // ► scroll-right / input-scroll / submenu arrow
  ['•', '*'], // • radio mark
  ['↑', '^'], // ↑ zoom icon
  ['↕', 'v'], // ↕ restore icon
  ['×', 'x'], // × close icon
]);

/** Block and shade glyphs that collapse to `#` when `halfBlocks` is off. */
const BLOCK_SHADE: ReadonlySet<string> = new Set([
  '\u2588',
  '\u2580',
  '\u2584',
  '\u258C',
  '\u2590',
  '\u2591',
  '\u2592',
  '\u2593',
]); // █▀▄▌▐░▒▓

/**
 * Substitute a glyph for the terminal's capabilities.
 *
 * Resolution order: ASCII ambiguous-chrome fallback (when `ambiguousWide` is on,
 * most specific — its keys collide with no other table) → ASCII box fallback
 * (when `boxDrawing` is off) → `#` for block/shade glyphs (when `halfBlocks` is
 * off) → `?` for any other code point above U+007F (when `utf8` is off) → the
 * glyph unchanged.
 *
 * @param char A single buffer glyph (a continuation cell's empty string passes
 *   straight through).
 * @param caps The resolved terminal capabilities.
 * @returns The original glyph when supported, else its ASCII fallback.
 * @example
 * import { fallbackGlyph, resolveCapabilities } from '@jsvision/core';
 * const caps = resolveCapabilities().profile;
 *
 * fallbackGlyph('│', caps); // '│' on a UTF-8 terminal; '|' when box-drawing is unavailable
 * fallbackGlyph('█', caps); // '█' normally; '#' when half/solid blocks are unavailable
 */
export function fallbackGlyph(char: string, caps: CapabilityProfile): string {
  if (char === '') return char;

  if (caps.glyphs.ambiguousWide) {
    const ascii = AMBIGUOUS_FALLBACK.get(char);
    if (ascii !== undefined) return ascii;
  }
  if (!caps.glyphs.boxDrawing) {
    const ascii = BOX_FALLBACK.get(char);
    if (ascii !== undefined) return ascii;
  }
  if (!caps.glyphs.halfBlocks && BLOCK_SHADE.has(char)) {
    return '#';
  }
  if (!caps.unicode.utf8) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp > 0x7f) return '?';
  }
  return char;
}
