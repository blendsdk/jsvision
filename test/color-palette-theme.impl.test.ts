/**
 * Implementation tests — palette & theme internals (RD-05).
 *
 * Every DOS-16 palette value round-trips through `encode` at every depth without
 * throwing, and the theme's structural roles (border/title accents) are wired to
 * valid colors. Complements the ST-15/ST-16 spec oracle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PALETTE, defaultTheme, encode } from '../src/engine/color/index.js';
import type { ColorDepth } from '../src/engine/capability/index.js';

const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

test('every palette value encodes at every depth without throwing', () => {
  for (const value of Object.values(PALETTE)) {
    for (const depth of DEPTHS) {
      assert.doesNotThrow(() => encode(value, 'fg', depth), `${value} @ ${depth}`);
    }
  }
});

test('palette values emit truecolor 38;2 SGR (valid colors, not default)', () => {
  // A concrete spot-check: blue '#0000aa' = (0,0,170).
  assert.equal(encode(PALETTE.blue, 'fg', 'truecolor'), '\x1b[38;2;0;0;170m');
  assert.equal(encode(PALETTE.white, 'bg', 'truecolor'), '\x1b[48;2;255;255;255m');
});

test('window and dialog roles carry border and title colors', () => {
  for (const role of [defaultTheme.window, defaultTheme.dialog]) {
    assert.doesNotThrow(() => encode(role.border, 'fg', '256'));
    assert.doesNotThrow(() => encode(role.title, 'fg', '256'));
  }
});

test('roles with a hotkey accent reference a valid color', () => {
  for (const role of [defaultTheme.menuBar, defaultTheme.menuSelected, defaultTheme.statusBar]) {
    const hotkey = role.hotkey;
    assert.ok(hotkey, 'hotkey present');
    assert.doesNotThrow(() => encode(hotkey, 'fg', '16'));
  }
});
