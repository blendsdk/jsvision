/**
 * A pared-back text editor for trying the clipboard: a document window you can
 * type in, and a second window showing the shared clipboard editor, so a cut or
 * copy is visible the moment it happens.
 *
 * Deliberately stripped down to the clipboard story — there is no file handling
 * and no find/replace. Omitting `editorDialog` is what turns search off: the
 * default handler answers "cancel" to everything, so the find/replace keys are
 * safe no-ops rather than dead ends in a browser with no file system.
 */
import { Editor, EditWindow } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const SAMPLE_TEXT = [
  'Select some of this text and copy it.',
  '',
  'Shift+arrows extend a selection, or drag with the mouse.',
  'Ctrl+C copies, Ctrl+X cuts, Ctrl+V pastes.',
  'The classic Ctrl+Ins / Shift+Ins / Shift+Del work too.',
  '',
  'Whatever you copy appears in the Clipboard window below —',
  'that window is the clipboard, shown as an editor.',
  '',
  'Type here. Ctrl+Z undoes, Ctrl+Y redoes.',
].join('\n');

/** Rows reserved for the clipboard window at the bottom of the desktop. */
const CLIPBOARD_ROWS = 7;

export default defineExample({
  title: 'Editor & clipboard',
  blurb: 'A cut-down text editor beside the shared clipboard, shown live as you cut, copy, and paste.',
  build: (ctx) => {
    const app = demoApp(ctx);
    const { width, height } = app.desktop.bounds;

    // The clipboard is itself an Editor: copy fills it, paste reads its selection. Showing it in a
    // window is what makes the clipboard visible instead of an invisible buffer somewhere.
    const clipboard = new Editor();

    const docHeight = Math.max(6, height - CLIPBOARD_ROWS);
    // Passing the same editor as both `editor` and `clipboard` is what titles this window
    // "Clipboard" — the window recognises that it is hosting the shared clipboard itself.
    const clipboardWindow = new EditWindow({
      editor: clipboard,
      clipboard,
      rect: { x: 0, y: docHeight, width, height: height - docHeight },
    });
    const documentWindow = new EditWindow({
      clipboard,
      rect: { x: 0, y: 0, width, height: docHeight },
    });
    documentWindow.editor.setText(SAMPLE_TEXT);

    // Neither window can be closed away: with no File menu there would be no way to get one back.
    clipboardWindow.closable = false;
    documentWindow.closable = false;

    // The clipboard goes down first so the document window ends up on top and focused — typing
    // should land in the document, not in the clipboard.
    app.desktop.addWindow(clipboardWindow);
    app.desktop.addWindow(documentWindow);

    return app;
  },
});
