/**
 * A push button bound to a click counter, with a live text echo of the count.
 * The simplest end-to-end live example: one component, centered in the minimal
 * demo shell. Focus it with Tab, activate with Space / Enter (or Alt-C), and the
 * count beside it updates reactively.
 */
import { Group, Button, Text, signal, View } from '@jsvision/ui';
import { defineExample } from '../_contract.js';

const WIDTH = 44;
const HEIGHT = 6;

/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'Button',
  blurb: 'A push button bound to a click counter, with a live count echo.',
  build: () => {
    const clicks = signal(0);
    const group = at(new Group(), 0, 0, WIDTH, HEIGHT);
    group.add(at(new Button('~C~lick me', { default: true, onClick: () => clicks.set(clicks() + 1) }), 0, 0, 14, 2));
    group.add(at(new Text(() => `Clicks: ${clicks()}`), 0, 3, WIDTH, 1));
    group.add(at(new Text('Space / Enter activates · Alt-C jumps to it.'), 0, 5, WIDTH, 1));
    return group;
  },
});
