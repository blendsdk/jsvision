/**
 * Implementation tests — the color-depth preview transform (`colorAtDepth`/`downsampleTheme`) and the
 * field-aware `colorOf`. These back the View-menu depth preview (the whole live preview recolors to a
 * chosen depth while the exported theme keeps its authored truecolor) and the inspector's fg/bg edit
 * toggle. Pure/headless — no view, no I/O.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { defaultTheme, nearest16, rgb256, nearest256, toRgb, PALETTE } from '@jsvision/core';

import { colorAtDepth, downsampleTheme } from '../src/model/downsample.js';
import { createDesignerModel } from '../src/model/index.js';

test('colorAtDepth returns the color as an exact hex at truecolor and downsamples at lower depths', () => {
  expect(colorAtDepth('#3b82f6', 'truecolor')).toBe('#3b82f6');
  const rgb = toRgb('#3b82f6')!;
  expect(colorAtDepth('#3b82f6', '256')).toBe(
    `#${[rgb256(nearest256(rgb)).r, rgb256(nearest256(rgb)).g, rgb256(nearest256(rgb)).b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')}`,
  );
  expect(['#000000', '#ffffff']).toContain(colorAtDepth('#3b82f6', 'mono'));
});

test('colorAtDepth at 16 emits the DOS-16 palette hex for the nearest slot', () => {
  const rgb = toRgb('#3b82f6')!;
  const dos16: readonly (keyof typeof PALETTE)[] = [
    'black',
    'red',
    'green',
    'brown',
    'blue',
    'magenta',
    'cyan',
    'lightGray',
    'darkGray',
    'brightRed',
    'brightGreen',
    'yellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'white',
  ];
  expect(colorAtDepth('#3b82f6', '16')).toBe(PALETTE[dos16[nearest16(rgb)]]);
});

test("colorAtDepth passes 'default' (and non-color glyphs) through unchanged", () => {
  expect(colorAtDepth('default', '16')).toBe('default');
  expect(colorAtDepth('default', 'mono')).toBe('default');
});

test('downsampleTheme returns the same theme instance at truecolor (no-op)', () => {
  expect(downsampleTheme(defaultTheme, 'truecolor')).toBe(defaultTheme);
});

test('downsampleTheme collapses every role color at 16 and preserves non-color fields', () => {
  const at16 = downsampleTheme(defaultTheme, '16');
  // Every resolvable role color is now one of the DOS-16 palette hexes.
  const palette = new Set(Object.values(PALETTE));
  for (const role of Object.values(at16)) {
    for (const [key, value] of Object.entries(role)) {
      if (typeof value !== 'string') continue;
      if (key === 'pattern') continue; // the desktop pattern is a glyph, not a color
      if (value === 'default') continue; // 'default' has no fixed RGB
      expect(palette.has(value), `${key}=${value} is a DOS-16 palette color`).toBe(true);
    }
  }
  // The desktop pattern glyph is untouched by the color transform.
  expect(at16.desktop.pattern).toBe(defaultTheme.desktop.pattern);
});

test('downsampleTheme does not mutate the input theme', () => {
  const before = defaultTheme.button.bg;
  downsampleTheme(defaultTheme, 'mono');
  expect(defaultTheme.button.bg).toBe(before);
});

test('colorOf selects a role field: bg by default, fg when asked; aliases ignore the field', () => {
  const m = createDesignerModel();
  expect(m.colorOf({ kind: 'role', name: 'button' })).toBe(m.theme().button.bg);
  expect(m.colorOf({ kind: 'role', name: 'button' }, 'fg')).toBe(m.theme().button.fg);
  // An alias is a single color — the field argument is ignored.
  const accent = m.colorOf({ kind: 'alias', name: 'accent' });
  expect(m.colorOf({ kind: 'alias', name: 'accent' }, 'fg')).toBe(accent);
});
