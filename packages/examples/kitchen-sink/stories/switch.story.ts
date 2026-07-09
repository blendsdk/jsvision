/**
 * Story: `Switch` — a compact on/off toggle bound to a `Signal<boolean>` (the Slider idiom for a
 * single boolean). Three switches — one with an `~X~` Alt-hotkey, one disabled — drive a live
 * bound-state echo, showing Space/Enter/click/Alt-hotkey toggling, the green-on vs. dim-off track,
 * and the sliding `●` knob.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Switch, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const switchStory: Story = {
  id: 'controls/switch',
  category: 'Controls',
  title: 'Switch',
  blurb: 'Switch: an on/off toggle bound to a signal — Space/Enter/click toggles, Alt+letter jumps + toggles.',
  build(ctx: StoryContext) {
    const width = Math.max(30, ctx.width - 2);
    const wifi = signal(true);
    const sound = signal(false);
    const locked = signal(true);

    const g = new Group();
    g.add(
      at(
        new Text('Tab between switches · Space/Enter or click toggles · Alt+W / Alt+S jumps + toggles.'),
        1,
        0,
        width,
        1,
      ),
    );

    // A labelled switch with an Alt-hotkey, a second toggle, and a disabled one.
    g.add(at(new Switch({ value: wifi, label: '~W~i-Fi', onLabel: 'On', offLabel: 'Off' }), 1, 2, 22, 1));
    g.add(at(new Switch({ value: sound, label: '~S~ound', onLabel: 'On', offLabel: 'Off' }), 1, 4, 22, 1));
    g.add(at(new Switch({ value: locked, label: 'Locked', disabled: true }), 1, 6, 22, 1));

    g.add(
      at(
        new Text(() => `wifi: ${wifi() ? 'on' : 'off'}   sound: ${sound() ? 'on' : 'off'}   (locked: disabled)`),
        1,
        8,
        width,
        1,
      ),
    );
    return g;
  },
};
