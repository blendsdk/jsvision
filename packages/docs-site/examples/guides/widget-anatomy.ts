/** Custom-leaf measurement, drawing, focus, reactivity, and input laboratory. */
import { Button, Group, Text, View, at } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { WidgetAnatomyPanel } from '../../src/example-fixtures/writing-your-own-widget/widget-anatomy-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

/** Resolve a mounted view's top-left cell in terminal coordinates. */
function absoluteOrigin(view: View): { readonly x: number; readonly y: number } {
  let x = view.bounds.x;
  let y = view.bounds.y;
  let parent = view.parent;
  while (parent !== null) {
    x += parent.bounds.x;
    y += parent.bounds.y;
    parent = parent.parent;
  }
  return { x, y };
}

/** Route a genuine mouse-down through application hit-testing into the custom meter. */
function dispatchMeterMouse(app: Application, meter: View): void {
  const origin = absoluteOrigin(meter);
  app.loop.dispatch({
    type: 'mouse',
    kind: 'down',
    button: 0,
    x: origin.x + 1,
    y: origin.y + 1,
  });
}

export default defineExample({
  title: 'Widget Anatomy Laboratory',
  blurb: 'Measure and draw a reactive custom View, then compare handled keyboard and mouse input.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const panel = new WidgetAnatomyPanel();
    const increment = new Button('Increment', {
      onClick: () => dispatchMeterMouse(app, panel.meter),
    });
    increment.grabsFocus = false;

    const content = new Group();
    content.add(at(panel, 0, 0, 56, 6));
    content.add(at(increment, 0, 7, 14, 2));
    content.add(at(new Text('Right/Enter updates · click Increment uses the same focused route'), 0, 10, 56, 1));
    content.add(at(new Text('Focus has a > marker · clipping and status use non-colour text'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Widget Anatomy ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(panel.meter);
    return app;
  },
});
