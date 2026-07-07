/**
 * Story: Accelerator overlay (F12) — the discoverability + reliability affordance (jsvision #40/#41).
 *
 * Press **F12** to reveal every reachable `~X~` accelerator at once (each hot glyph gains an
 * underline on its existing accent), then press the bare letter to fire the matching accelerator —
 * the always-works path on terminals that mangle Alt. This panel gathers a menu strip, a linked
 * label, and command buttons so one F12 lights them all up together.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Button, Label, Input, Text, menuBar, subMenu, item, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const acceleratorsStory: Story = {
  id: 'controls/accelerators',
  category: 'Controls',
  blurb: 'Press F12 to reveal every ~hotkey~ at once (underlined), then a bare letter fires it — the Alt-proof path.',
  title: 'Accelerator overlay (F12)',
  build(ctx: StoryContext) {
    const w = ctx.width;

    // A small menu strip whose ~F~ile/~E~dit titles light up on F12 (presentational here — the live
    // shell's own menu chrome also reveals, so accelerators across the whole scope light up together).
    const bar = menuBar([
      subMenu('~F~ile', [item('~N~ew', 'new'), item('~Q~uit', 'quit')]),
      subMenu('~E~dit', [item('~C~opy', 'copy')]),
    ]);

    const name = signal('');
    const input = new Input({ value: name });
    const label = new Label('~N~ame', input);

    const g = new Group();
    g.add(at(bar, 0, 0, w, 1));
    g.add(at(label, 1, 2, 6, 1));
    g.add(at(input, 8, 2, 24, 1));
    g.add(at(new Button('~O~pen', { default: true, command: 'open' }), 1, 4, 12, 2));
    g.add(at(new Button('~C~ancel', { command: 'cancel' }), 14, 4, 12, 2));
    g.add(
      at(
        new Text('Press F12 to light up every hotkey, then O / C / N to fire one (Alt-letter still works too).'),
        1,
        7,
        w,
        1,
      ),
    );
    g.add(at(new Text('F12 again, Esc, a click, or any other key dismisses the overlay.'), 1, 9, w, 1));
    return g;
  },
};
