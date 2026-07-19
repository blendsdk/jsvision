/**
 * The window half of `demo:chrome-bars`, kept beside the entrypoint so it can be built and inspected
 * without starting the demo. `main.ts` runs the application the moment it is imported, so anything
 * that wants the composed window — a test, a screenshot tool — needs it from here instead.
 */
import { Window, Text } from '@jsvision/ui';

/** The body copy shown inside the window — one line per point the demo is making. */
const BODY_LINES = [
  'The status line and menu bar pack through the layout engine.',
  '',
  'spacer()      right-aligns the progress bar + clock',
  'menuSpacer()  pushes Help to the right edge',
  '',
  'Alt-X quits.',
];

/**
 * Build the demo's window: a fixed 48×9 frame at (2,2) holding a single body text that fills it.
 *
 * @returns A `Window` ready to hand to `desktop.addWindow()`.
 *
 * @example
 * ```ts
 * const app = createApplication({ menuBar, statusLine });
 * app.desktop.addWindow(buildChromeBarsWindow());
 * ```
 */
export function buildChromeBarsWindow(): Window {
  const win = new Window('Flexible Chrome Bars');
  win.number = 1;
  win.layout.rect = { x: 2, y: 2, width: 48, height: 9 };
  const body = new Text(BODY_LINES.join('\n'));
  body.layout = { size: { kind: 'fr', weight: 1 } };
  win.add(body);
  return win;
}
