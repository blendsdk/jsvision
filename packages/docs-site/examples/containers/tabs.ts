/**
 * A TabView laboratory showing enabled cycling, scoped accelerators, persistent mounted pages, and
 * closeable-tab lifecycle.
 */
import { Group, TabView, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { Tab } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_CLOSE = 'tabs-lab.close';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 12;

/** Build one compact persistent tab page. */
function page(title: string, detail: string): Group {
  const content = new Group();
  content.add(at(new Text(title), 1, 1, 40, 1));
  content.add(at(new Text(detail), 1, 3, 40, 2));
  return content;
}

export default defineExample({
  title: 'Tabs Lab',
  blurb: 'Cycle enabled pages, jump by accelerator, and close a live tab without rebuilding its siblings.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+c': CMD_CLOSE }),
    });
    const active = signal(0);
    const closed = signal('none');
    const tabs = signal<Tab[]>([
      { title: '~G~eneral', content: page('GENERAL', 'This page stays mounted while hidden.') },
      { title: '~A~dvanced', content: page('ADVANCED', 'Disabled pages are skipped.'), disabled: true },
      { title: '~O~utput', content: page('OUTPUT', 'This page is closeable.'), closeable: true },
    ]);
    const view = new TabView({
      tabs,
      active,
      onClose: (tab) => closed.set(tab.title.replaceAll('~', '')),
    });
    const dialog = new Template1Dialog({
      title: ' Tabs Lab ',
      width: 60,
      height: 16,
      preserveChildHeights: (child) => child !== view,
    });
    const content = new Group();

    content.add(at(new Text('All tab pages stay mounted; one lays out.'), 0, 0, 56, 1));
    content.add(at(view, 0, 2, 40, 7));
    content.add(
      at(
        new Text(() => `Active: ${tabs()[active()]?.title.replaceAll('~', '') ?? 'none'}\nTabs: ${tabs().length}`),
        42,
        2,
        14,
        3,
      ),
    );
    content.add(at(new Text(() => `Closed: ${closed()}`), 42, 6, 14, 2));
    content.add(at(new Text('Ctrl+PgUp/PgDn cycle enabled · Alt+G/O jump'), 0, 10, 56, 1));
    content.add(at(new Text('Alt+C closes active closeable tab · arrows work on strip'), 0, 11, 56, 1));

    app.onCommand(CMD_CLOSE, () => {
      const current = tabs()[active()];
      if (current?.closeable === true) view.closeTab(active());
      else closed.set(`ignored ${current?.title.replaceAll('~', '') ?? 'none'}`);
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(view.strip);
    return app;
  },
});
