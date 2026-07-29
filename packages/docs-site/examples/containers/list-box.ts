/**
 * A ListBox laboratory demonstrating navigation, activation, reactive replacement, and focus
 * clamping when a string collection shrinks.
 */
import { Dialog, Group, Label, ListBox, Text, at, createKeymap, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_REPLACE = 'list-box-lab.replace';
const CONTENT_WIDTH = 44;
const CONTENT_HEIGHT = 11;

export default defineExample({
  title: 'List Box Lab',
  blurb: 'Navigate and select a string list, then replace its source and watch focus clamp safely.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+r': CMD_REPLACE }),
    });
    const items = signal(['One', 'Two', 'Three', 'Four', 'Five']);
    const focused = signal(0);
    const selected = signal(-1);
    const choice = signal('none');
    const list = new ListBox({
      items,
      focused,
      selected,
      typeAhead: true,
      onSelect: (_index, value) => choice.set(value),
    });
    const dialog = new Dialog({ title: ' List Box Lab ', width: 48, height: 15 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Reactive strings with ListView navigation.'), 0, 0, 44, 1));
    content.add(at(new Label('~C~hoices', list.rows), 0, 2, 10, 1));
    content.add(at(list, 11, 2, 16, 6));
    content.add(at(new Text(() => `Selected: ${choice()}`), 29, 2, 15, 2));
    content.add(at(new Text(() => `Items: ${items().length} · focus ${focused()}`), 0, 8, 44, 1));
    content.add(at(new Text('End then Alt+R shrinks five values to two.'), 0, 9, 44, 1));
    content.add(at(new Text('Enter selects · prefix search · Alt+C focus'), 0, 10, 44, 1));

    app.onCommand(CMD_REPLACE, () => items.set(['One', 'Two']));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(list.rows);
    return app;
  },
});
