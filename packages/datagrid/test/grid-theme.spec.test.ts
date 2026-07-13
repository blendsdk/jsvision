/**
 * Specification tests (immutable oracles) — the two additive core theme roles this engine introduces
 * (ST-16): `gridCursor` (the filled focused-cell highlight) and `gridDirty` (the pending-commit `•`
 * marker colour). Their attribute bytes are frozen here, and `encode()` of each must not throw at any
 * colour depth (so the roles downsample cleanly on low-colour terminals).
 *
 * Expectations derive from the requirements + the core DOS-16 palette, never the implementation:
 *   • `gridCursor` — black on pure white (`#ffffff`), the filled-reverse cell cursor.
 *   • `gridDirty`  — a brightRed (`#ff5555`) foreground; its stored bg (black) is nominal, since the
 *     marker foreground is composited over the cell's own background at draw time.
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

test('ST-16: encode() of each new role does not throw at any colour depth', () => {
  for (const role of [defaultTheme.gridCursor, defaultTheme.gridDirty]) {
    for (const depth of ALL_DEPTHS) {
      expect(() => encode(role.fg, 'fg', depth)).not.toThrow();
      expect(() => encode(role.bg, 'bg', depth)).not.toThrow();
    }
  }
});
