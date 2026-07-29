/**
 * An interactive Label laboratory showing direct control links, Alt-hotkeys, click-to-focus,
 * selected-caption feedback, a non-interactive caption, and deterministic reset.
 */
import { Button, Group, Input, Label, Text, at, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

export default defineExample({
  title: 'Label Lab',
  blurb: 'Move focus through linked captions by mouse and hotkey, then compare a plain non-interactive caption.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const name = signal('');
    const email = signal('');
    const status = signal('ready — the Name field starts focused');
    const nameInput = new Input({ value: name, maxLength: 22, placeholder: 'Type a name' });
    const emailInput = new Input({ value: email, maxLength: 30, placeholder: 'Type an email' });
    const dialog = new Template1Dialog({
      title: ' Label Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('Linked captions move focus without adding extra Tab stops.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(new Label('~N~ame', nameInput), 0, 1, 10, 1));
    content.add(at(nameInput, 12, 1, 28, 1));
    content.add(at(new Text('click or Alt+N'), 43, 1, 16, 1));
    content.add(at(new Label('~E~mail', emailInput), 0, 3, 10, 1));
    content.add(at(emailInput, 12, 3, 28, 1));
    content.add(at(new Text('click or Alt+E'), 43, 3, 16, 1));

    content.add(at(new Text('Plain caption: informative only; it does not redirect focus.'), 0, 5, CONTENT_WIDTH, 1));
    content.add(at(new Text(() => `Name value: ${name() || '(empty)'}`), 0, 7, 29, 1));
    content.add(at(new Text(() => `Email value: ${email() || '(empty)'}`), 31, 7, 29, 1));
    content.add(at(new Text(() => `Status: ${status()}`), 0, 8, CONTENT_WIDTH, 1));
    content.add(
      at(
        new Button('~R~eset fields', {
          onClick: () => {
            name.set('');
            email.set('');
            status.set('reset — use a caption to choose the next field');
          },
        }),
        0,
        9,
        16,
        2,
      ),
    );
    content.add(at(new Text('Alt+N/E or click focuses · Tab skips Labels · Alt+R resets'), 0, 11, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
