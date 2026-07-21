/**
 * A small panel of themed widgets — buttons in every state, a text input, a
 * checkbox group, and a radio group — all drawn in the application's theme roles.
 * Switch the theme (13 presets) or the colour depth from the View menu and every
 * widget below repaints live: theme swaps are one recompose, a depth change
 * re-mounts to downsample the palette (truecolor → 256 → 16 → mono).
 */
import { Group, Button, Input, Label, CheckGroup, RadioGroup, Text, signal, at } from '@jsvision/ui';
import { defineExample } from '../_contract.js';

export default defineExample({
  title: 'Theme gallery',
  blurb: 'A panel of themed widgets — switch Theme or Depth from the View menu to watch them repaint.',
  build: (ctx) => {
    const text = signal('sample');
    const styles = signal([true, false, true]);
    const align = signal(1);

    const group = at(new Group(), 0, 0, ctx.width, ctx.height - 2);
    group.add(
      at(new Text('Switch Theme or Depth from the View menu — every widget below repaints.'), 1, 0, ctx.width - 2, 1),
    );
    group.add(at(new Button('~O~K', { default: true }), 1, 2, 10, 2));
    group.add(at(new Button('~C~ancel', {}), 12, 2, 12, 2));
    group.add(at(new Button('~D~isabled', { disabled: true }), 25, 2, 14, 2));

    const input = new Input({ value: text });
    group.add(at(new Label('~T~ext', input), 1, 5, 6, 1));
    group.add(at(input, 8, 5, 26, 1));

    group.add(at(new CheckGroup({ labels: ['~B~old', '~I~talic', '~U~nderline'], value: styles }), 1, 7, 20, 3));
    group.add(at(new RadioGroup({ labels: ['~L~eft', '~C~enter', '~R~ight'], value: align }), 24, 7, 16, 3));
    return group;
  },
});
