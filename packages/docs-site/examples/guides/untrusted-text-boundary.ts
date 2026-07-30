/** Deterministic terminal-sanitization and diagnostic-redaction comparison laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { UntrustedTextPanel } from '../../src/example-fixtures/untrusted-text/untrusted-text-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_NEXT = 'guide.untrusted-text.next';
const CMD_SANITIZE = 'guide.untrusted-text.sanitize';
const CMD_REDACT = 'guide.untrusted-text.redact';

export default defineExample({
  title: 'Untrusted Text Boundary Laboratory',
  blurb:
    'Compare unsafe escaped input, sanitized terminal output, and redacted diagnostics without replaying raw controls.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NEXT,
        'alt+s': CMD_SANITIZE,
        'alt+r': CMD_REDACT,
        'alt+z': Commands.zoom,
      }),
    });
    const panel = new UntrustedTextPanel();
    app.onCommand(CMD_NEXT, () => panel.nextSample());
    app.onCommand(CMD_SANITIZE, () => panel.sanitizeSelected());
    app.onCommand(CMD_REDACT, () => panel.redactSelected());

    const next = new Button('~N~ext sample', { command: CMD_NEXT, default: true });
    const sanitize = new Button('~S~anitize', { command: CMD_SANITIZE });
    const redact = new Button('~R~edact log', { command: CMD_REDACT });
    const content = new Group();
    content.add(at(panel, 0, 0, 54, 8));
    content.add(at(next, 0, 8, 14, 2));
    content.add(at(sanitize, 16, 8, 12, 2));
    content.add(at(redact, 30, 8, 14, 2));
    content.add(at(new Text('Alt+N next | Alt+S safe | Alt+R redact | Alt+Z zoom'), 0, 10, 54, 1));

    const dialog = new Template1Dialog({
      title: ' Untrusted Text Boundary ',
      width: 58,
      height: 15,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 54, 11));
    app.desktop.addWindow(dialog);
    app.loop.focusView(next);
    return app;
  },
});
