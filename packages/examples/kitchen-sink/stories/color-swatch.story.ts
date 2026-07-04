/**
 * Story: `ColorSwatch` (RD-21) — a faithful `TColorSelector` decode: a DOS-16 color grid (3-wide `█`
 * cells, `◘` marker on the selected cell) navigated by arrows / clicked / dragged. Shows the live bound
 * `value` echoed as its name + `#rrggbb` hex.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, ColorSwatch, Label, Text, signal } from '@jsvision/ui';
import { ANSI16_ORDER, toRgb } from '@jsvision/core';
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

export const colorSwatchStory: Story = {
  id: 'color/color-swatch',
  category: 'Color',
  title: 'ColorSwatch',
  rd: 'RD-21',
  blurb: 'ColorSwatch: the DOS-16 color grid (TColorSelector decode) — arrow-nav, click/drag, ◘ marker.',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);
    const value = signal<Color>('brightCyan');
    const swatch = new ColorSwatch({ value, colors: ANSI16_ORDER as readonly Color[], columns: 4 });

    const g = new Group();
    g.add(at(new Label('~P~alette', swatch), 1, 0, 10, 1));
    g.add(at(swatch, 1, 1, 12, 4)); // 4 columns × 4 rows = 12 × 4
    g.add(at(new Text(() => `selected: ${value()}  ${hexOf(value())}`), 1, 6, width, 1));
    g.add(
      at(
        new Text('Arrows navigate (wrap-around) · Enter/Space select · click or drag to pick · the ◘ marks the value.'),
        1,
        8,
        width,
        1,
      ),
    );
    return g;
  },
};
