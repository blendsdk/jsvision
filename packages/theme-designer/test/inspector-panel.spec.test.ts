/**
 * Specification test (immutable oracle) — the inspector's live color swatch.
 *
 * The inspector shows the exact color being edited as a solid block directly under the `#rrggbb`
 * text field, so the user sees the true (truecolor) color, not just its DOS-16 approximation in the
 * picker grid. The block must reflect the current color signal on first paint and repaint whenever
 * that color changes — including a bare rail selection, which swaps the loaded color without swapping
 * the theme. A failing case means the swatch is missing or not tracking the color.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Color } from '@jsvision/core';
import { createRenderRoot, createRoot, signal } from '@jsvision/ui';

import { createDesignerModel } from '../src/model/index.js';
import { buildInspectorPanel } from '../src/view/inspector-panel.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount the inspector at a fixed rect and return a reader for a rendered cell's background color. */
function mountInspector(color: ReturnType<typeof signal<Color>>): {
  bgAt: (x: number, y: number) => Color;
  flush: () => void;
  dispose: () => void;
} {
  let result!: { bgAt: (x: number, y: number) => Color; flush: () => void; dispose: () => void };
  createRoot((dispose) => {
    const view = buildInspectorPanel({
      r: signal(0),
      g: signal(0),
      b: signal(0),
      hexText: signal('#000000'),
      color,
      fieldIndex: signal(0),
      model: createDesignerModel(),
      onSwatchInput: () => {},
    });
    view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 30 } });
    const rr = createRenderRoot({ width: 40, height: 30 }, { caps });
    rr.mount(view);
    result = {
      bgAt: (x, y) => rr.buffer().rows()[y][x].bg,
      flush: () => rr.flush(),
      dispose,
    };
  });
  return result;
}

test('the inspector paints a solid swatch of the current color under the hex field', () => {
  const color = signal<Color>('#123456');
  const ins = mountInspector(color);
  // The swatch sits on the row under the hex input (x=6, y=10), matching the hex field's column.
  expect(ins.bgAt(6, 10), 'the swatch shows the current color').toBe('#123456');
  ins.dispose();
});

test('the swatch repaints when the current color changes (e.g. a bare rail selection)', () => {
  const color = signal<Color>('#123456');
  const ins = mountInspector(color);
  color.set('#abcdef');
  ins.flush();
  expect(ins.bgAt(6, 10), 'the swatch tracks the color signal').toBe('#abcdef');
  ins.dispose();
});
