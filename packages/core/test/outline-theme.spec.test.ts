/**
 * Specification test — jsvision-ui RD-15 core Outline/Tree theme roles (ST-20).
 *
 * Immutable oracle (RD-15 AC-9 → ST-20; tree/03-01-tree.md §5 GATE-1 decode + tree/03-03 §Theme,
 * runtime PA-16): the four additive `defaultTheme` outline roles the `Tree` renderer draws in must
 * deep-equal the Turbo Vision `cpOutlineViewer` source decode, and `encode()` of each must not throw
 * at any colour depth.
 *
 * Expectations are computed DIRECTLY from the TV source palettes (the AUTHORING RULE — never from the
 * implementation), reusing the shared `./theme-decode.helpers.ts` `cpBlueWindow → cpAppColor` chain.
 * A hand-decode error in `theme.ts` fails this test (RED), not the oracle.
 *
 * Decode chain — **blue-window owner** (the canonical `TOutlineViewer` host; PA-16 supersedes PA-9's
 * gray-dialog pin, which resolved `Normal == Focus == 0x70` and hid the focus row):
 *   • `cpOutlineViewer = "\x6\x7\x3\x8"` (`toutline.cpp:15`), palette layout `1=Normal · 2=Focus ·
 *     3=Select · 4=NotExpanded` (`outline.h:66-70`). Each byte is an owner (blue-window) slot:
 *       - Normal (1)      `0x06` → `cpBlueWindow[6]=0x0D` → `cpAppColor[13]=0x1E` yellow-on-blue.
 *       - Focused (2)     `0x07` → `cpBlueWindow[7]=0x0E` → `cpAppColor[14]=0x71` blue-on-lightGray.
 *       - Selected (3)    `0x03` → `cpBlueWindow[3]=0x0A` → `cpAppColor[10]=0x1A` brightGreen-on-blue.
 *       - NotExpanded (4) `0x08` → `cpBlueWindow[8]=0x0F` → `cpAppColor[15]=0x1F` white-on-blue.
 *   The two-tone collapsed text (`toutline.cpp:82` `c = (flags & ovExpanded) ? color : (color>>8)`)
 *   reads the high byte of the `getColor(0x0401)` Normal pair = slot 4 = `outlineNotExpanded`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import type { ColorDepth } from '../src/engine/capability/index.js';
import { defaultTheme, encode } from '../src/engine/color/index.js';

import { decodeBlueWindowSlot } from './theme-decode.helpers.js';

/**
 * `cpOutlineViewer = "\x6\x7\x3\x8"` (`toutline.cpp:15`), transcribed verbatim (1-based; index 0 is
 * an unused placeholder so the table indexes match the C++ `p[n]` 1-based access).
 */
const CP_OUTLINE_VIEWER = [0, 0x06, 0x07, 0x03, 0x08] as const;

// Each outline slot is a blue-window index; the blue-window slot decodes in the app palette.
const outlineNormal = decodeBlueWindowSlot(CP_OUTLINE_VIEWER[1]); // 0x1E yellow-on-blue
const outlineFocused = decodeBlueWindowSlot(CP_OUTLINE_VIEWER[2]); // 0x71 blue-on-lightGray
const outlineSelected = decodeBlueWindowSlot(CP_OUTLINE_VIEWER[3]); // 0x1A brightGreen-on-blue
const outlineNotExpanded = decodeBlueWindowSlot(CP_OUTLINE_VIEWER[4]); // 0x1F white-on-blue

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-20: outline theme roles deep-equal the cpOutlineViewer blue-window source decode', () => {
  expect(defaultTheme.outlineNormal, 'outlineNormal (slot 1 → 0x1E yellow-on-blue)').toStrictEqual(outlineNormal);
  expect(defaultTheme.outlineFocused, 'outlineFocused (slot 2 → 0x71 blue-on-lightGray)').toStrictEqual(outlineFocused);
  expect(defaultTheme.outlineSelected, 'outlineSelected (slot 3 → 0x1A brightGreen-on-blue)').toStrictEqual(
    outlineSelected,
  );
  expect(defaultTheme.outlineNotExpanded, 'outlineNotExpanded (slot 4 → 0x1F white-on-blue)').toStrictEqual(
    outlineNotExpanded,
  );
});

test('ST-20: Focus is distinct from Normal (the blue-window decode avoids the gray-dialog collision)', () => {
  // PA-16: the gray-dialog pin resolved Normal == Focus == 0x70 (focus invisible). Blue-window keeps
  // them apart — this asserts the degeneracy is gone.
  expect(defaultTheme.outlineFocused).not.toStrictEqual(defaultTheme.outlineNormal);
});

test('ST-20: encode() of each outline theme role does not throw at any colour depth', () => {
  const pairs: readonly { fg: string; bg: string }[] = [
    defaultTheme.outlineNormal,
    defaultTheme.outlineFocused,
    defaultTheme.outlineSelected,
    defaultTheme.outlineNotExpanded,
  ];
  for (const { fg, bg } of pairs) {
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(fg, 'fg', depth)).not.toThrow();
      expect(() => encode(bg, 'bg', depth)).not.toThrow();
    }
  }
});
