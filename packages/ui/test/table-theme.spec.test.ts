/**
 * Specification test — jsvision-ui RD-16 core `tableHeader` theme role (ST-20).
 *
 * Immutable oracle (RD-16 AC-10 → ST-20; plans/table/03-03-theme-packaging.md §1, AR-172). Turbo
 * Vision has NO table/grid class, so `tableHeader` is a *documented TV-extension* colour — not a
 * `getColor` decode but a design choice among faithful `cpAppColor` bytes: `0x3F` = bg cyan (`3`) +
 * fg white (`F`) = white-on-cyan (a bright heading on the list's own cyan field).
 *
 * Expectations are pinned DIRECTLY from the spec doc (the AUTHORING RULE — never from the
 * implementation): the new role must be exactly `{ fg: white, bg: cyan }`, `encode()` of it must not
 * throw at any colour depth, and the reused `list*` roles must be byte-for-byte unchanged (a
 * regression guard — the additive role must not perturb the existing `cpListViewer` decode).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode, PALETTE } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-20: tableHeader role is white-on-cyan (0x3F)', () => {
  expect(defaultTheme.tableHeader, 'tableHeader = 0x3F white-on-cyan (AR-172)').toStrictEqual({
    fg: PALETTE.white,
    bg: PALETTE.cyan,
  });
});

test('ST-20: encode() of tableHeader does not throw at any colour depth', () => {
  const { fg, bg } = defaultTheme.tableHeader;
  for (const depth of ALL_DEPTHS) {
    expect(() => encode(fg, 'fg', depth)).not.toThrow();
    expect(() => encode(bg, 'bg', depth)).not.toThrow();
  }
});

test('ST-20: the reused list* row/divider roles are unchanged (regression guard)', () => {
  expect(defaultTheme.listNormal, 'listNormal 0x30 black-on-cyan').toStrictEqual({
    fg: PALETTE.black,
    bg: PALETTE.cyan,
  });
  expect(defaultTheme.listFocused, 'listFocused 0x2F white-on-green').toStrictEqual({
    fg: PALETTE.white,
    bg: PALETTE.green,
  });
  expect(defaultTheme.listSelected, 'listSelected 0x3E yellow-on-cyan').toStrictEqual({
    fg: PALETTE.yellow,
    bg: PALETTE.cyan,
  });
  expect(defaultTheme.listDivider, 'listDivider 0x31 blue-on-cyan').toStrictEqual({
    fg: PALETTE.blue,
    bg: PALETTE.cyan,
  });
});
