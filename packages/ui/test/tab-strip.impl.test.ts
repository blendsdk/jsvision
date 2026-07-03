/**
 * Implementation tests — RD-17 `TabStrip` geometry + the GATE-1 glyph AFTER-diff (03-02, 07 §Impl).
 *
 * Covers `stripGeometry` edges (no-overflow, both-end overflow, a single over-wide tab, active at the
 * boundaries), `hitStrip` boundary columns, and the **GATE-1 glyph-set code-point identity** — the
 * cell-level half of the AFTER-diff (task 3.1.1): every `TAB_GLYPHS`/arrow/close code point equals the
 * pinned CP437↔Unicode decode. `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import {
  stripGeometry,
  hitStrip,
  TAB_GLYPHS,
  OVERFLOW_LEFT,
  OVERFLOW_RIGHT,
  CLOSE_MARK,
} from '../src/tabs/tab-strip.js';

/** A minimal tab descriptor the geometry reads. */
function tab(title: string, closeable = false): { title: string; closeable?: boolean } {
  return closeable ? { title, closeable } : { title };
}

// --- GATE-1 glyph code-point identity (the AFTER-diff, cell-level) -------------------------------

test('GATE-1: every glyph code point equals its pinned CP437↔Unicode decode', () => {
  expect(TAB_GLYPHS.h.codePointAt(0)).toBe(0x2500); // ─
  expect(TAB_GLYPHS.v.codePointAt(0)).toBe(0x2502); // │
  expect(TAB_GLYPHS.tl.codePointAt(0)).toBe(0x250c); // ┌
  expect(TAB_GLYPHS.tr.codePointAt(0)).toBe(0x2510); // ┐
  expect(TAB_GLYPHS.bl.codePointAt(0)).toBe(0x2514); // └
  expect(TAB_GLYPHS.br.codePointAt(0)).toBe(0x2518); // ┘
  expect(TAB_GLYPHS.tdown.codePointAt(0)).toBe(0x252c); // ┬  (0xC2)
  expect(TAB_GLYPHS.tup.codePointAt(0)).toBe(0x2534); // ┴  (0xC1)
  expect(TAB_GLYPHS.tright.codePointAt(0)).toBe(0x251c); // ├  (0xC3)
  expect(TAB_GLYPHS.tleft.codePointAt(0)).toBe(0x2524); // ┤  (0xB4)
  expect(OVERFLOW_LEFT.codePointAt(0)).toBe(0x25c4); // ◄
  expect(OVERFLOW_RIGHT.codePointAt(0)).toBe(0x25ba); // ►
  expect(CLOSE_MARK.codePointAt(0)).toBe(0x00d7); // ×
});

// --- stripGeometry edges -------------------------------------------------------------------------

test('stripGeometry: no overflow places every slot from col 1, no arrows', () => {
  const geo = stripGeometry([tab('~G~en'), tab('~D~isp')], 0, 40, 0);
  expect(geo.showLeftArrow).toBe(false);
  expect(geo.showRightArrow).toBe(false);
  expect(geo.slots.length).toBe(2);
  expect(geo.slots[0].x, 'first slot starts at col 1 (after ┌)').toBe(1);
});

test('stripGeometry: both-end overflow with a middle-active tab shows both arrows', () => {
  const many = Array.from({ length: 8 }, (_, i) => tab(`LongTab${i}`));
  const geo = stripGeometry(many, 4, 24, 0);
  expect(geo.showLeftArrow, 'hidden tabs to the left').toBe(true);
  expect(geo.showRightArrow, 'hidden tabs to the right').toBe(true);
  expect(
    geo.slots.some((s) => s.index === 4),
    'active tab is visible',
  ).toBe(true);
  expect(geo.leftArrowX).toBe(1);
  expect(geo.rightArrowX).toBe(24 - 2);
});

test('stripGeometry: active at index 0 shows no left arrow; at the last shows no right arrow', () => {
  const many = Array.from({ length: 8 }, (_, i) => tab(`LongTab${i}`));
  expect(stripGeometry(many, 0, 24, 0).showLeftArrow, 'first active → no left arrow').toBe(false);
  expect(stripGeometry(many, 7, 24, 0).showRightArrow, 'last active → no right arrow').toBe(false);
});

test('stripGeometry: a single tab wider than the strip clips without throwing', () => {
  const geo = stripGeometry([tab('AnExtremelyLongSingleTabTitle')], 0, 12, 0);
  expect(() => geo).not.toThrow();
  // It overflows (too wide for the window) → the over-wide slot is clipped out; geometry stays sane.
  expect(geo.firstVisible).toBe(0);
  expect(Array.isArray(geo.slots)).toBe(true);
});

test('stripGeometry: an empty tab list yields no slots and no arrows', () => {
  const geo = stripGeometry([], 0, 20, 0);
  expect(geo.slots).toEqual([]);
  expect(geo.showLeftArrow || geo.showRightArrow).toBe(false);
});

// --- hitStrip boundaries -------------------------------------------------------------------------

test('hitStrip: the first and last cells of a slot both map to that tab', () => {
  const geo = stripGeometry([tab('~G~eneral'), tab('~D~isplay')], 0, 40, 0);
  const s0 = geo.slots[0];
  expect(hitStrip(geo, s0.x), 'first cell of slot 0').toEqual({ kind: 'tab', index: 0 });
  expect(hitStrip(geo, s0.x + s0.width - 1), 'last cell of slot 0').toEqual({ kind: 'tab', index: 0 });
  expect(hitStrip(geo, s0.x + s0.width), 'the ┬ separator just past the slot').toBeUndefined();
});

test('hitStrip: a closeable tab’s × column wins over its label', () => {
  const geo = stripGeometry([tab('~D~isplay', true)], 0, 40, 0);
  const slot = geo.slots[0];
  expect(slot.closeX, 'closeable slot has a close column').toBeTypeOf('number');
  expect(hitStrip(geo, slot.closeX!)).toEqual({ kind: 'close', index: 0 });
  // A label cell (not the × cell) still maps to the tab.
  expect(hitStrip(geo, slot.x + 1)).toEqual({ kind: 'tab', index: 0 });
});

test('hitStrip: the arrow columns win over any overlapping content', () => {
  const many = Array.from({ length: 8 }, (_, i) => tab(`LongTab${i}`));
  const geo = stripGeometry(many, 4, 24, 0);
  expect(hitStrip(geo, geo.leftArrowX)).toEqual({ kind: 'arrow', dir: -1 });
  expect(hitStrip(geo, geo.rightArrowX)).toEqual({ kind: 'arrow', dir: 1 });
});
