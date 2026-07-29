/**
 * An editable ComboBox laboratory demonstrating typed candidates, live filtering, an anchored
 * popup, and exact value/text synchronization.
 */
import { ComboBox, Dialog, Group, Label, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 46;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Combo Box Lab',
  blurb: 'Filter typed color candidates, open the anchored popup, and commit an exact value.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const items = signal(['Red', 'Green', 'Blue', 'Gold', 'Gray']);
    const value = signal<string | null>(null);
    const text = signal('');
    const picked = signal('none');
    const combo = new ComboBox<string>({
      items,
      getText: (item) => item,
      value,
      text,
      placeholder: 'type a color',
      onSelect: (_index, item) => picked.set(item),
    });
    const dialog = new Dialog({ title: ' Combo Box Lab ', width: 50, height: 14 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Editable text filters typed color candidates.'), 0, 0, 46, 1));
    content.add(at(new Label('~C~olor', combo.input), 0, 2, 9, 1));
    content.add(at(combo, 10, 2, 24, 1));
    content.add(at(new Text(() => `Candidates: ${combo.filtered().length}`), 36, 2, 10, 2));
    content.add(at(new Text(() => `Text: ${text() || 'empty'}`), 0, 5, 22, 1));
    content.add(at(new Text(() => `Value: ${value() ?? 'none'}`), 24, 5, 22, 1));
    content.add(at(new Text(() => `Picked callback: ${picked()}`), 0, 6, 46, 1));
    content.add(at(new Text('Type “gr” · Alt+Down opens · Enter picks Green'), 0, 8, 46, 1));
    content.add(at(new Text('Unmatched text keeps value null · Alt+C focus'), 0, 9, 46, 1));

    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(combo.input);
    return app;
  },
});
