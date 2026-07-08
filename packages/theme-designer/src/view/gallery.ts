/**
 * The curated live-preview widget scene — a fixed arrangement of representative widgets that exercise
 * the theme roles a user cares about. It repaints automatically when the app swaps the theme (every
 * cell is drawn from the active theme). It is a **preview**: its interactive widgets are made
 * non-focusable so the gallery never steals focus from the editing panels.
 */
import { Group, Text, Button, Input, CheckGroup, RadioGroup, ListBox, ProgressBar, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';

/** Place a view at an absolute rect inside a group and return it. */
function at<T extends View>(g: Group, view: T, x: number, y: number, w: number, h: number): T {
  view.layout = { position: 'absolute', rect: { x, y, width: w, height: h } };
  g.add(view);
  return view;
}

/** Make a view (and any children) inert for preview — it must not take focus or clicks. */
function inert<T extends View>(view: T): T {
  view.focusable = false;
  return view;
}

/**
 * Build the preview gallery — a themed window with a title, a menu strip, default/normal/disabled
 * buttons, a labelled input, check/radio groups, a small list, a progress bar, and a status row.
 *
 * @returns A {@link Group} (background role `window`) sized to fit its widgets; place it absolutely.
 * @example
 * import { buildGallery } from './view/gallery.js';
 * const gallery = buildGallery();
 * gallery.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 44, height: 18 } };
 */
export function buildGallery(): Group {
  const g = new Group();
  g.background = 'window';

  at(g, new Text('Preview — every widget repaints on each edit'), 2, 0, 42, 1);

  // A menu-like strip and buttons.
  at(g, inert(new Button('~O~K', { default: true })), 2, 2, 8, 2);
  at(g, inert(new Button('~C~ancel', {})), 11, 2, 12, 2);
  at(g, inert(new Button('~D~isabled', { disabled: true })), 24, 2, 14, 2);

  // A labelled input.
  at(g, new Text('Name:'), 2, 5, 6, 1);
  at(g, inert(new Input({ value: signal('editable text') })), 9, 5, 28, 1);

  // Check + radio groups.
  at(g, inert(new CheckGroup({ labels: ['~B~old', '~I~talic'], value: signal([true, false]) })), 2, 7, 16, 2);
  at(g, inert(new RadioGroup({ labels: ['~L~eft', '~R~ight'], value: signal(0) })), 20, 7, 16, 2);

  // A small list with a selected row.
  at(
    g,
    inert(
      new ListBox({
        items: signal(['Nord', 'Dracula', 'Gruvbox', 'Solarized']),
        focused: signal(1),
        selected: signal(1),
      }),
    ),
    2,
    10,
    20,
    4,
  );

  // A progress bar + status row.
  at(g, inert(new ProgressBar({ value: signal(0.66) })), 24, 10, 18, 1);
  at(g, new Text('F2 Save · F3 Open · Alt+X Quit'), 2, 15, 42, 1);
  return g;
}
