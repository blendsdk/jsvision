/** Immutable capability profile, reason-layer, query, and override evidence laboratory. */
import { resolveCapabilitiesAsync } from '@jsvision/core';
import type { TerminalQuery } from '@jsvision/core';
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { CapabilityResolutionPanel } from '../../src/example-fixtures/terminal-capabilities/capability-resolution-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_EXPLAIN = 'guide.capabilities.explain';

const runtimeQuery: TerminalQuery = {
  write: () => undefined,
  async *read() {
    yield new TextEncoder().encode('\x1b[?2026;2$yq');
  },
};
const runtimeResolution = resolveCapabilitiesAsync({
  env: {},
  platform: 'linux',
  query: runtimeQuery,
  timeoutMs: 20,
});

export default defineExample({
  title: 'Capability Resolution Laboratory',
  blurb: 'Compare immutable profile and reason evidence from unknown, environment, query, and override inputs.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+e': CMD_EXPLAIN, 'alt+z': Commands.zoom }),
    });
    const panel = new CapabilityResolutionPanel({ runtime: runtimeResolution });
    app.onCommand(CMD_EXPLAIN, () => panel.explainNext());
    const explain = new Button('~E~xplain next', { command: CMD_EXPLAIN, default: true });
    const content = new Group();
    content.add(at(panel, 0, 0, 54, 6));
    content.add(at(explain, 0, 6, 18, 2));
    content.add(at(new Text('Alt+E explain | click button | Alt+Z resize'), 0, 9, 54, 1));
    const dialog = new Template1Dialog({
      title: ' Capability Resolution ',
      width: 58,
      height: 14,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 54, 10));
    app.desktop.addWindow(dialog);
    app.loop.focusView(explain);
    return app;
  },
});
