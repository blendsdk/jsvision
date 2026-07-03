/**
 * Story: `Spinner` (RD-18) — an indeterminate, caller-driven spinner (a documented new component; TV
 * had no spinner class, AR-186).
 *
 * All three presets (`dots` / `line` / `blocks`) share one `frame` signal and animate together as a
 * `~S~tep` button advances it, each labelled with its preset name (the `label` role). Under ASCII
 * caps the braille/block presets fall back to `line` automatically (preset swap, animation preserved).
 * Animation is caller-driven — the widget holds no clock (the `runSpinner` helper drives it under a
 * live app runtime); here the Step button advances the shared frame.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Button, Text, Spinner, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const spinnerStory: Story = {
  id: 'feedback/spinner',
  category: 'Feedback',
  title: 'Spinner',
  rd: 'RD-18',
  blurb: 'Spinner presets (dots/line/blocks) share one frame · Step (Alt-S) advances · ASCII → line.',
  build(ctx: StoryContext) {
    const frame = signal(0);
    const w = Math.max(16, ctx.width - 2);
    const g = new Group();

    g.add(at(new Text('Spinner presets (Step advances all — ASCII caps fall back to line):'), 1, 0, w, 1));
    g.add(at(new Spinner({ frame, preset: 'dots', label: 'Loading… (dots)' }), 1, 2, w, 1));
    g.add(at(new Spinner({ frame, preset: 'line', label: 'Loading… (line)' }), 1, 3, w, 1));
    g.add(at(new Spinner({ frame, preset: 'blocks', label: 'Loading… (blocks)' }), 1, 4, w, 1));

    g.add(at(new Button('~S~tep', { onClick: () => frame.set(frame() + 1) }), 1, 6, 10, 2));

    g.add(at(new Text(() => `frame: ${frame()}`), 1, 9, w, 1));
    g.add(at(new Text('Tab moves focus · Space / Enter advances the frame · Alt-S steps.'), 1, 10, w, 1));
    return g;
  },
};
