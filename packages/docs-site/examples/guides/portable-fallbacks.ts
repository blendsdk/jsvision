/** SSH, tmux, Windows, browser, mouse, glyph, and geometry fallback laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { PortableFallbackPanel } from '../../src/example-fixtures/terminal-capabilities/portable-fallback-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PROFILE = 'guide.capabilities.profile';

export default defineExample({
  title: 'Portable Fallbacks Laboratory',
  blurb: 'Render honest SSH, tmux, Windows, browser, mouse, and glyph profile fallbacks.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+p': CMD_PROFILE, 'alt+z': Commands.zoom }),
    });
    const panel = new PortableFallbackPanel();
    app.onCommand(CMD_PROFILE, () => panel.nextProfile());
    const next = new Button('Next ~p~rofile', { command: CMD_PROFILE, default: true });
    const content = new Group();
    content.add(at(panel, 0, 0, 54, 6));
    content.add(at(next, 0, 6, 18, 2));
    content.add(at(new Text('Alt+P profile | keyboard stays | Alt+Z resize'), 0, 9, 54, 1));
    const dialog = new Template1Dialog({
      title: ' Portable Fallbacks ',
      width: 58,
      height: 14,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 54, 10));
    app.desktop.addWindow(dialog);
    app.loop.focusView(next);
    return app;
  },
});
