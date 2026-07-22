/**
 * The smallest complete JSVision application: the standard shell — a menu bar, a
 * status line, and a patterned desktop — greeting you with a modal welcome
 * dialog. This is what `createApplication` gives you before you have written a
 * single widget of your own.
 *
 * The dialog is modal, so it owns the keyboard until it resolves: the menu-bar
 * and exit chords only apply once it is dismissed, which is why its text points
 * at OK and nothing else.
 */
import { Dialog, Text, okButton, at } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { SITE_META } from '../../src/site-meta.js';

const DIALOG_WIDTH = 46;
const DIALOG_HEIGHT = 10;
/** The dialog's frame and padding eat one cell per side; this is what is left to lay out in. */
const INTERIOR_WIDTH = DIALOG_WIDTH - 4;

/** Centre a line of text in the dialog interior — `Text` itself is always left-aligned. */
function centred(line: string, y: number): Text {
  const x = Math.max(0, Math.floor((INTERIOR_WIDTH - line.length) / 2));
  return at(new Text(line), x + 1, y, line.length, 1);
}

export default defineExample({
  title: 'Hello, JSVision',
  blurb: 'The standard application shell — menu bar, status line, desktop — and a modal welcome dialog.',
  build: (ctx) => {
    const app = demoApp(ctx);

    const dialog = new Dialog({ title: ' Welcome ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.add(centred(`Welcome to JSVision ${SITE_META.version}`, 1));
    dialog.add(centred('A terminal application, in your browser.', 3));
    dialog.add(centred('Press Enter or click OK to continue.', 4));
    dialog.add(at(okButton(), Math.floor((INTERIOR_WIDTH - 10) / 2) + 1, 6, 10, 2));

    // The dialog removes itself once it resolves, leaving the bare shell on screen — the point of
    // the demo is that the shell is already a complete app without it.
    app.desktop.addWindow(dialog);
    void app.loop.execView(dialog).finally(() => app.desktop.removeWindow(dialog));

    return app;
  },
});
