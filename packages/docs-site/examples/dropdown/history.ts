/**
 * A History laboratory demonstrating deterministic app-owned MRU data, record-on-open behavior,
 * keyboard popup access, and replacement of a linked Input.
 */
import { Dialog, Group, History, Input, Label, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 50;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'History Lab',
  blurb: 'Record the current path into an app-owned MRU list, then recall an older value into its field.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const value = signal('/workspace/current');
    const entries = signal(['/tmp', '/var/log', '/srv/archive']);
    const input = new Input({ value, maxLength: 30 });
    const history = new History({ link: input, history: entries, maxRows: 5 });
    const dialog = new Dialog({ title: ' History Lab ', width: 54, height: 14 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('App-owned MRU records the current field on open.'), 0, 0, 50, 1));
    content.add(at(new Label('~P~ath', input), 0, 2, 8, 1));
    content.add(at(input, 9, 2, 30, 1));
    content.add(at(history, 39, 2, 3, 1));
    content.add(at(new Text(() => `Entries: ${entries().length}`), 0, 5, 16, 1));
    content.add(at(new Text(() => `Field: ${value()}`), 18, 5, 32, 1));
    content.add(at(new Text(() => `MRU: ${entries().join(' · ')}`), 0, 6, 50, 1));
    content.add(at(new Text('Alt+Down opens · Enter recalls focused /var/log'), 0, 8, 50, 1));
    content.add(at(new Text('Esc dismisses unchanged · Alt+P focuses field'), 0, 9, 50, 1));

    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(input);
    return app;
  },
});
