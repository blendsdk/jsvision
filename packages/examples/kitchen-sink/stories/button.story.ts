/**
 * Story: `Button` (RD-06) — the faithful `TButton` faces + activation.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Button, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const buttonStory: Story = {
  id: 'controls/button',
  category: 'Controls',
  title: 'Button',
  rd: 'RD-06',
  blurb: 'Command buttons — default, normal, and disabled faces, each with the TV ▄█▀ block shadow.',
  build(ctx: StoryContext) {
    const w = ctx.width;
    const last = signal('(none)');
    const g = new Group();
    g.add(at(new Button('~O~K', { default: true, onClick: () => last.set('OK (default)') }), 1, 0, 12, 2));
    g.add(at(new Button('~C~ancel', { onClick: () => last.set('Cancel') }), 14, 0, 12, 2));
    g.add(at(new Button('~S~ave', { disabled: true }), 27, 0, 12, 2));
    g.add(at(new Text(() => `Last activated: ${last()}`), 1, 3, w, 1));
    g.add(at(new Text('Tab / Shift-Tab move focus · Space / Enter activates · Alt-O / Alt-C jump.'), 1, 5, w, 1));
    return g;
  },
};
