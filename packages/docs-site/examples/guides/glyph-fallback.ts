/**
 * Interactive capability-fallback laboratory for the Text, Unicode & terminal cells course.
 */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { GlyphFallbackPanel } from '../../src/example-fixtures/text-unicode-and-cells/glyph-fallback-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PROFILE = 'text-unicode.glyph-fallback.profile';
const CMD_UTF8 = 'text-unicode.glyph-fallback.utf8';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Glyph Fallback Laboratory',
  blurb: 'Compare UTF-8, adapted chrome, and ASCII-safe output through real capability-driven fallbacks.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+p': CMD_PROFILE,
        'alt+u': CMD_UTF8,
      }),
    });
    const panel = new GlyphFallbackPanel();

    app.onCommand(CMD_PROFILE, () => panel.cycleProfile('keyboard'));
    app.onCommand(CMD_UTF8, () => panel.toggleUtf8('keyboard'));

    const cycleProfile = new Button('Next ~p~rofile', {
      onClick: () => panel.cycleProfile('mouse'),
    });
    const toggleUtf8 = new Button('Toggle ~U~TF-8', {
      onClick: () => panel.toggleUtf8('mouse'),
    });

    const content = new Group();
    content.add(at(new Text('Capabilities selectively degrade Unicode chrome.'), 0, 0, 66, 1));
    content.add(at(panel, 0, 2, 66, 9));
    content.add(at(cycleProfile, 0, 11, 19, 2));
    content.add(at(toggleUtf8, 21, 11, 18, 2));
    content.add(at(new Text('Alt+P profile · Alt+U UTF-8 · click · READY stays visible'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Glyph Fallback Laboratory ',
      width: CONTENT_WIDTH + 4,
      height: CONTENT_HEIGHT + 4,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(cycleProfile);
    return app;
  },
});
