/**
 * Specification test — jsvision-ui RD-14 core History theme roles (ST-32).
 *
 * Immutable oracle (RD-14 AC-10 → ST-32, input-dropdowns/03-04-seams-and-theme.md §3 + the GATE-1
 * decode in 03-01-history.md §1/§4): the five additive `defaultTheme` History roles the dropdown
 * subsystem draws in must deep-equal the Turbo Vision source decode, and `encode()` of each must not
 * throw at any colour depth.
 *
 * Expectations are computed DIRECTLY from the TV source palettes (the AUTHORING RULE — never from the
 * implementation), reusing the shared `./theme-decode.helpers.ts` gray-dialog chain (cpGrayDialog →
 * cpAppColor → attribute byte → PALETTE). A hand-decode error in `theme.ts` fails this test (RED),
 * not the oracle.
 *
 * Decode chains (gray `TDialog` owner — this project's default; PA-12):
 *   • Button — `cpHistory="\x16\x17"` (`thistory.cpp:37`), palette layout `1=Arrow, 2=Sides`
 *     (`dialogs.h:999-1002`). Each byte is an owner (gray-dialog) slot:
 *       - Arrow (↓) `0x16`→slot 22 → `cpAppColor[53]=0x20` black-on-green.
 *       - Sides (▐▌) `0x17`→slot 23 → `cpAppColor[54]=0x72` green-on-lightGray.
 *   • Window — `cpHistoryWindow="\x13\x13\x15\x18\x17\x13\x14"` (`thistwin.cpp:26`); the frame's
 *     active border resolves to entry 1 `0x13`→slot 19 → `0x1F` white-on-blue; the icon/accent to
 *     entry 3 `0x15`→slot 21 → `0x1A` brightGreen-on-blue (`thistwin.cpp`, `tframe.cpp`).
 *   • Viewer — `cpHistoryViewer="\x06\x06\x07\x06\x06"` (`thstview.cpp:33`); a viewer index maps
 *     THROUGH the window palette: normal `0x06`→`cpHistoryWindow[6]=0x13`→slot 19 → `0x1F`
 *     white-on-blue; focused `0x07`→`cpHistoryWindow[7]=0x14`→slot 20 → `0x2F` white-on-green
 *     (`tlstview.cpp:88-96`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import type { ColorDepth } from '../src/engine/capability/index.js';
import { defaultTheme, encode } from '../src/engine/color/index.js';
import type { Color } from '../src/engine/render/index.js';

import { decodeGrayDialogSlot } from './theme-decode.helpers.js';

/**
 * The TV local palettes, transcribed verbatim (1-based; index 0 is an unused placeholder so the
 * table indexes match the C++ `p[n]` 1-based access):
 *   cpHistory       = "\x16\x17"                         (`thistory.cpp:37`)
 *   cpHistoryWindow = "\x13\x13\x15\x18\x17\x13\x14"     (`thistwin.cpp:26`)
 *   cpHistoryViewer = "\x06\x06\x07\x06\x06"             (`thstview.cpp:33`)
 */
const CP_HISTORY = [0, 0x16, 0x17] as const;
const CP_HISTORY_WINDOW = [0, 0x13, 0x13, 0x15, 0x18, 0x17, 0x13, 0x14] as const;
const CP_HISTORY_VIEWER = [0, 0x06, 0x06, 0x07, 0x06, 0x06] as const;

// A viewer index resolves through the window palette, then the window slot decodes in the gray dialog.
const viewerNormal = decodeGrayDialogSlot(CP_HISTORY_WINDOW[CP_HISTORY_VIEWER[1]]); // 0x1F white-on-blue
const viewerFocused = decodeGrayDialogSlot(CP_HISTORY_WINDOW[CP_HISTORY_VIEWER[3]]); // 0x2F white-on-green
const windowInterior = decodeGrayDialogSlot(CP_HISTORY_WINDOW[1]); // border 0x1F white-on-blue
const windowIcon = decodeGrayDialogSlot(CP_HISTORY_WINDOW[3]); // icon 0x1A brightGreen-on-blue

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-32: History button roles deep-equal the cpHistory source decode', () => {
  expect(defaultTheme.historyButtonArrow, 'historyButtonArrow (cpHistory[1]=0x16 → black-on-green)').toStrictEqual(
    decodeGrayDialogSlot(CP_HISTORY[1]),
  );
  expect(defaultTheme.historyButtonSides, 'historyButtonSides (cpHistory[2]=0x17 → green-on-lightGray)').toStrictEqual(
    decodeGrayDialogSlot(CP_HISTORY[2]),
  );
});

test('ST-32: historyWindow role deep-equals the cpHistoryWindow frame decode (interior + border + icon)', () => {
  expect(defaultTheme.historyWindow.fg, 'historyWindow.fg (0x1F white)').toBe(windowInterior.fg);
  expect(defaultTheme.historyWindow.bg, 'historyWindow.bg (0x1F blue)').toBe(windowInterior.bg);
  expect(defaultTheme.historyWindow.border, 'historyWindow.border (0x1F white)').toBe(windowInterior.fg);
  expect(defaultTheme.historyWindow.icon, 'historyWindow.icon (0x1A brightGreen)').toBe(windowIcon.fg);
});

test('ST-32: History viewer roles deep-equal the cpHistoryViewer source decode', () => {
  expect(defaultTheme.historyViewer, 'historyViewer (→ 0x1F white-on-blue)').toStrictEqual(viewerNormal);
  expect(defaultTheme.historyViewerFocused, 'historyViewerFocused (→ 0x2F white-on-green)').toStrictEqual(
    viewerFocused,
  );
});

test('ST-32: encode() of each History theme role does not throw at any colour depth', () => {
  const pairs: readonly { fg: Color; bg: Color }[] = [
    defaultTheme.historyButtonArrow,
    defaultTheme.historyButtonSides,
    { fg: defaultTheme.historyWindow.fg, bg: defaultTheme.historyWindow.bg },
    defaultTheme.historyViewer,
    defaultTheme.historyViewerFocused,
  ];
  for (const { fg, bg } of pairs) {
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(fg, 'fg', depth)).not.toThrow();
      expect(() => encode(bg, 'bg', depth)).not.toThrow();
    }
  }
});
