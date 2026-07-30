/** Systematic boundary-classification and safe-evidence laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import {
  DEBUGGING_PROBE_COMMAND,
  DebuggingEvidencePanel,
} from '../../src/example-fixtures/debugging/debugging-evidence-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_LAYOUT = 'guide.debugging.layout';
const CMD_FOCUS = 'guide.debugging.focus';
const CMD_COMMAND = 'guide.debugging.command';
const CMD_RENDER = 'guide.debugging.render';
const CMD_CAPABILITY = 'guide.debugging.capability';
const CMD_LIFECYCLE = 'guide.debugging.lifecycle';
const CMD_VERIFY = 'guide.debugging.verify';

/** Read the root-buffer cells occupied by a view whose bounds are relative to its parent. */
function renderedCells(app: ReturnType<typeof demoApp>, view: View): string {
  let x = view.bounds.x;
  let y = view.bounds.y;
  let parent = view.parent;
  while (parent !== null) {
    x += parent.bounds.x;
    y += parent.bounds.y;
    parent = parent.parent;
  }
  return (
    app.loop.renderRoot
      .buffer()
      .rows()
      [y]?.slice(x, x + view.bounds.width)
      .map((cell) => cell.char)
      .join('') ?? ''
  );
}

export default defineExample({
  title: 'Debugging Evidence Laboratory',
  blurb:
    'Distinguish layout, focus, command, render, capability, and lifecycle failures through one bounded evidence ladder.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+l': CMD_LAYOUT,
        'alt+f': CMD_FOCUS,
        'alt+c': CMD_COMMAND,
        'alt+r': CMD_RENDER,
        'alt+p': CMD_CAPABILITY,
        'alt+h': CMD_LIFECYCLE,
        'alt+v': CMD_VERIFY,
        'alt+z': Commands.zoom,
      }),
    });
    app.loop.enableCommand(DEBUGGING_PROBE_COMMAND, false);
    const panel = new DebuggingEvidencePanel({
      getFocused: () => app.loop.getFocused(),
      isCommandEnabled: (command) => app.loop.isCommandEnabled(command),
      enableCommand: (command, enabled) => app.loop.enableCommand(command, enabled),
      emitCommand: (command) => app.loop.emitCommand(command),
      focusView: (view) => app.loop.focusView(view),
      flush: () => app.loop.renderRoot.flush(),
      readRendered: (view) => renderedCells(app, view),
      caps: ctx.caps,
    });
    app.onCommand(DEBUGGING_PROBE_COMMAND, () => panel.recordProbeCommand());

    app.onCommand(CMD_LAYOUT, () => panel.inspectLayout());
    app.onCommand(CMD_FOCUS, () => panel.inspectFocus());
    app.onCommand(CMD_COMMAND, () => panel.inspectCommand());
    app.onCommand(CMD_RENDER, () => panel.inspectRender());
    app.onCommand(CMD_CAPABILITY, () => panel.inspectCapability());
    app.onCommand(CMD_LIFECYCLE, () => panel.inspectLifecycle());
    app.onCommand(CMD_VERIFY, () => panel.verifyCorrection());

    const inspectLayout = new Button('Inspect ~l~ayout', { command: CMD_LAYOUT });
    const inspectFocus = new Button('Inspect ~f~ocus', { command: CMD_FOCUS });
    const inspectCommand = new Button('Inspect ~c~ommand', { command: CMD_COMMAND });
    const inspectRender = new Button('~R~ender probe', { command: CMD_RENDER });
    const inspectCapability = new Button('Ca~p~ability', { command: CMD_CAPABILITY });
    const inspectLifecycle = new Button('~H~ost life', { command: CMD_LIFECYCLE });
    const verify = new Button('~V~erify', { command: CMD_VERIFY });

    const content = new Group();
    content.add(at(panel, 0, 0, 54, 7));
    content.add(at(inspectLayout, 0, 7, 16, 2));
    content.add(at(inspectFocus, 17, 7, 15, 2));
    content.add(at(inspectCommand, 33, 7, 17, 2));
    content.add(at(inspectRender, 0, 9, 14, 2));
    content.add(at(inspectCapability, 15, 9, 12, 2));
    content.add(at(inspectLifecycle, 28, 9, 11, 2));
    content.add(at(verify, 40, 9, 8, 2));

    const dialog = new Template1Dialog({
      title: ' Debugging Evidence ',
      width: 58,
      height: 15,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 54, 11));
    app.desktop.addWindow(dialog);
    app.loop.focusView(inspectLayout);
    return app;
  },
});
