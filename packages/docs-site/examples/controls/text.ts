/**
 * An interactive Text laboratory showing fixed and reactive content, word wrapping, explicit line
 * breaks, display-cell-aware Unicode wrapping, semantic severity roles, natural measurement, and
 * the control's non-focusable presentation role.
 */
import { Button, Group, Text, at, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 15;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

const CONCISE_COPY = 'Concise mode wraps words cleanly and repaints whenever its getter reads a changed signal.';
const DETAILED_COPY = 'Detailed mode keeps explicit line breaks.\nIts reactive getter can replace the whole message.';

export default defineExample({
  title: 'Text Lab',
  blurb: 'Compare static, reactive, wrapped, Unicode, warning, and error Text in a centered Classic dialog.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const count = signal(0);
    const detailed = signal(false);
    const status = signal('ready');

    const dialog = new Template1Dialog({
      title: ' Text Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('Text presents information without entering the Tab order.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(
      at(
        new Text(() => `Reactive readout — Count: ${count()} · ${detailed() ? 'detailed' : 'concise'} copy`),
        0,
        2,
        CONTENT_WIDTH,
        1,
      ),
    );

    content.add(at(new Text(() => (detailed() ? DETAILED_COPY : CONCISE_COPY)), 0, 4, 40, 3));
    content.add(at(new Text('Display-cell wrap:\n日本語 + 😀 emoji stay intact.'), 43, 4, 23, 3));

    content.add(at(new Text('Normal: supporting information uses the static text role.'), 0, 8, CONTENT_WIDTH, 1));
    content.add(at(new Text('Warning: review before continuing.', { severity: 'warning' }), 0, 9, CONTENT_WIDTH, 1));
    content.add(at(new Text('Error: a required value is missing.', { severity: 'error' }), 0, 10, CONTENT_WIDTH, 1));
    content.add(at(new Text(() => `Status: ${status()}`), 0, 11, CONTENT_WIDTH, 1));

    content.add(
      at(
        new Button('~I~ncrement', {
          onClick: () => {
            count.set(count() + 1);
            status.set('reactive getter repainted');
          },
        }),
        0,
        12,
        14,
        2,
      ),
    );
    content.add(
      at(
        new Button('~T~oggle copy', {
          onClick: () => {
            detailed.set(!detailed());
            status.set('content and wrapping changed');
          },
        }),
        16,
        12,
        16,
        2,
      ),
    );
    content.add(
      at(
        new Button('~R~eset', {
          onClick: () => {
            count.set(0);
            detailed.set(false);
            status.set('reset');
          },
        }),
        34,
        12,
        11,
        2,
      ),
    );

    content.add(
      at(new Text('Alt+I/T/R changes signals · Tab skips every Text · View switches theme'), 0, 14, CONTENT_WIDTH, 1),
    );

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
