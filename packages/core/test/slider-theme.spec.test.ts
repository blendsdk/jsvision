/**
 * Specification test (immutable oracle) — the two additive `slider*` theme roles (ST-11).
 *
 * `Slider` is a documented new control (no Turbo Vision counterpart), so `sliderTrack`/`sliderThumb`
 * are a fresh design pinned by analogy to the shipped chrome families: the groove is a dim rule
 * (darkGray-on-lightGray) and the thumb a solid accent block (blue-on-lightGray), both sitting on the
 * classic gray dialog field where a slider lives. This oracle freezes that DOS-16 byte pair and checks
 * that each encodes at every colour depth without throwing. A failing case means `theme.ts` is wrong.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import type { ColorDepth } from '../src/engine/capability/index.js';
import { defaultTheme, encode, PALETTE } from '../src/engine/color/index.js';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-11: sliderTrack / sliderThumb equal the pinned DOS-16 byte pair', () => {
  expect(defaultTheme.sliderTrack, 'sliderTrack = darkGray-on-lightGray dim rule').toStrictEqual({
    fg: PALETTE.darkGray,
    bg: PALETTE.lightGray,
  });
  expect(defaultTheme.sliderThumb, 'sliderThumb = blue-on-lightGray solid block').toStrictEqual({
    fg: PALETTE.blue,
    bg: PALETTE.lightGray,
  });
});

test('ST-11: encode() of each slider* role does not throw at any colour depth', () => {
  for (const role of [defaultTheme.sliderTrack, defaultTheme.sliderThumb]) {
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(role.fg, 'fg', depth)).not.toThrow();
      expect(() => encode(role.bg, 'bg', depth)).not.toThrow();
    }
  }
});
