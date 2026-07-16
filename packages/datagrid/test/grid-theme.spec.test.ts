/**
 * Specification tests (immutable oracles) — the additive core theme roles this engine introduces
 * (ST-16): `gridCursor` (the filled focused-cell highlight), `gridDirty` (the pending-commit `•`
 * marker colour), and `gridSelectedRow` (the multi-row selection band). Their attribute bytes are
 * frozen here, and `encode()` of each must not throw at any colour depth (so the roles downsample
 * cleanly on low-colour terminals). This is the canonical byte-level guard the ui `*-theme.spec`
 * allowlists defer to.
 *
 * Expectations derive from the requirements + the core DOS-16 palette, never the implementation:
 *   • `gridCursor` — black on pure white (`#ffffff`), the filled-reverse cell cursor.
 *   • `gridDirty`  — a brightRed (`#ff5555`) foreground; its stored bg (black) is nominal, since the
 *     marker foreground is composited over the cell's own background at draw time.
 *   • `gridSelectedRow` — pure white (`#ffffff`) on blue (`#0000aa`): a solid selection band with its
 *     OWN background, so a selected row stays distinct from a normal row (whose `listSelected` shares
 *     `listNormal`'s cyan) even under zebra striping.
 */
import { test, expect } from 'vitest';
import type { ColorDepth } from '@jsvision/core';
import { defaultTheme, encode } from '@jsvision/core';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];

test('ST-16: gridCursor is frozen at black-on-white (the filled cell cursor)', () => {
  expect(defaultTheme.gridCursor).toStrictEqual({ fg: '#000000', bg: '#ffffff' });
});

test('ST-16: gridDirty is frozen at a brightRed foreground', () => {
  expect(defaultTheme.gridDirty).toStrictEqual({ fg: '#ff5555', bg: '#000000' });
});

test('ST-16: gridSelectedRow is frozen at white-on-blue with a background distinct from a normal row', () => {
  expect(defaultTheme.gridSelectedRow).toStrictEqual({ fg: '#ffffff', bg: '#0000aa' });
  // The whole point of the dedicated role: its background is NOT a normal row's background.
  expect(defaultTheme.gridSelectedRow.bg).not.toBe(defaultTheme.listNormal.bg);
});

test('ST-16: encode() of each new role does not throw at any colour depth', () => {
  for (const role of [defaultTheme.gridCursor, defaultTheme.gridDirty, defaultTheme.gridSelectedRow]) {
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(role.fg, 'fg', depth)).not.toThrow();
      expect(() => encode(role.bg, 'bg', depth)).not.toThrow();
    }
  }
});
