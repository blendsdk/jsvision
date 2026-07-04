/**
 * Story: `ColorPicker` (RD-21) — a compact color chip + a trailing `▐↓▌` button opening a `ColorSwatch`
 * (+ a hex `Input`) in the anchored popup. Shows the live bound `value` echoed as its name + hex.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, ColorPicker, Label, Text, signal } from '@jsvision/ui';
import { toRgb } from '@jsvision/core';
import type { Color } from '@jsvision/core';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Serialize a color to `#rrggbb` for the echo (falls back to the raw value). */
function hexOf(c: Color): string {
  try {
    const rgb = toRgb(c);
    if (rgb === null) return '(default)';
    const h = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
  } catch {
    return String(c);
  }
}

export const colorPickerStory: Story = {
  id: 'color/color-picker',
  category: 'Color',
  title: 'ColorPicker',
  rd: 'RD-21',
  blurb: 'ColorPicker: a chip + ▐↓▌ opening the swatch grid + a hex field (allowCustom) in a dropdown.',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);
    const value = signal<Color>('red');
    const picker = new ColorPicker({ value, allowCustom: true });

    const g = new Group();
    g.add(at(new Label('~C~olor', picker), 1, 0, 8, 1));
    g.add(at(picker, 10, 0, 20, 1));
    g.add(at(new Text(() => `value = ${value()}  ${hexOf(value())}`), 1, 2, width, 1));
    g.add(
      at(
        new Text(
          '↓ / Alt+↓ / the ▐↓▌ button opens · pick a swatch, or Tab to the hex field and type #rrggbb · Esc cancels.',
        ),
        1,
        4,
        width,
        1,
      ),
    );
    return g;
  },
};
