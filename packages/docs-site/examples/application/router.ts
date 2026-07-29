/**
 * A typed Router laboratory demonstrating push, back, replace, and reset on a real screen stack.
 */
import { Button, Dialog, Group, Text, at, createKeymap, createRouter } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 62;
const CONTENT_HEIGHT = 13;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_NEXT = 'router-lab.next';
const CMD_BACK = 'router-lab.back';
const CMD_REPLACE = 'router-lab.replace';
const CMD_RESET = 'router-lab.reset';

type Routes = {
  home: void;
  detail: { id: number };
  settings: void;
};

/** Build one compact route view for the embedded navigation stage. */
function routeView(title: string, detail: string): Group {
  const screen = new Group();
  screen.background = 'dialog';
  screen.add(at(new Text(title), 1, 1, 48, 1));
  screen.add(at(new Text(detail), 1, 3, 48, 1));
  screen.add(at(new Button('Focusable action'), 1, 5, 18, 2));
  return screen;
}

export default defineExample({
  title: 'Router Lab',
  blurb: 'Drive push, back, replace, and reset on a typed stack with a live location readout.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NEXT,
        'alt+b': CMD_BACK,
        'alt+p': CMD_REPLACE,
        'alt+r': CMD_RESET,
      }),
    });
    const router = createRouter<Routes>({
      initial: { name: 'home' },
      routes: {
        home: { build: () => ({ view: routeView('HOME', 'Root screen — no back target') }) },
        detail: {
          build: ({ params }) => ({ view: routeView('DETAIL', `Typed record id: ${params.id}`) }),
        },
        settings: { build: () => ({ view: routeView('SETTINGS', 'Replaced without growing the stack') }) },
      },
    });
    const dialog = new Dialog({ title: ' Router Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Router owns a typed stack of full-screen View roots.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(router, 4, 2, 54, 7));
    content.add(
      at(
        new Text(() => `Route: ${String(router.location().name)} · canGoBack: ${router.canGoBack() ? 'yes' : 'no'}`),
        0,
        10,
        CONTENT_WIDTH,
        1,
      ),
    );
    content.add(at(new Text('Alt+N push Detail · Alt+B back · Alt+P replace Settings'), 0, 11, CONTENT_WIDTH, 1));
    content.add(at(new Text('Alt+R reset Home and discard every previous frame'), 0, 12, CONTENT_WIDTH, 1));

    app.onCommand(CMD_NEXT, () => router.push('detail', { id: 42 }));
    app.onCommand(CMD_BACK, () => router.back());
    app.onCommand(CMD_REPLACE, () => router.replace('settings'));
    app.onCommand(CMD_RESET, () => router.reset('home'));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
