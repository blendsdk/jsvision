/**
 * Story: `Slider` — the framework's value control (a fresh design; Turbo Vision had no trackbar). Three
 * horizontal R/G/B sliders (0–255) plus one vertical slider drive a live `#rrggbb` echo, showing the
 * two-way signal binding, keyboard stepping, and mouse drag the theme designer's inspector is built on.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Slider, Label, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Two hex digits for a 0–255 channel. */
function hex2(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

export const sliderStory: Story = {
  id: 'controls/slider',
  category: 'Controls',
  title: 'Slider',
  blurb: 'Slider: a focusable value groove + draggable thumb — arrows/Home/End/PgUp/PgDn, drag, wheel.',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);
    const r = signal(59);
    const g = signal(130);
    const b = signal(246);
    const vol = signal(60);

    const grooveW = Math.min(30, width - 10);

    const g0 = new Group();
    g0.add(at(new Text('Drag the thumb, or focus (Tab) and use ← → · Home/End · PgUp/PgDn · wheel.'), 1, 0, width, 1));

    // R / G / B horizontal channels — each Label linked to its Slider (Alt+letter focuses it).
    const rs = new Slider({ value: r, min: 0, max: 255 });
    const gs = new Slider({ value: g, min: 0, max: 255 });
    const bs = new Slider({ value: b, min: 0, max: 255 });
    g0.add(at(new Label('~R~ed', rs), 1, 2, 6, 1));
    g0.add(at(rs, 8, 2, grooveW, 1));
    g0.add(at(new Label('~G~reen', gs), 1, 4, 6, 1));
    g0.add(at(gs, 8, 4, grooveW, 1));
    g0.add(at(new Label('~B~lue', bs), 1, 6, 6, 1));
    g0.add(at(bs, 8, 6, grooveW, 1));

    // A vertical slider alongside.
    g0.add(at(new Text('vol'), grooveW + 12, 1, 4, 1));
    g0.add(at(new Slider({ value: vol, min: 0, max: 100, orientation: 'vertical' }), grooveW + 13, 2, 1, 5));

    g0.add(at(new Text(() => `color: #${hex2(r())}${hex2(g())}${hex2(b())}   volume: ${vol()}%`), 1, 8, width, 1));
    return g0;
  },
};
