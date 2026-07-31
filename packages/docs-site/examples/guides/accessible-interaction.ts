/** Keyboard-complete focus, discovery, and pointer-parity accessibility laboratory. */
import { Button, Commands, Group, Text, at, createKeymap, createRoot, effect } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { AccessibleInteractionPanel } from '../../src/example-fixtures/accessibility/accessible-interaction-panel.js';
import type { InteractionSource } from '../../src/example-fixtures/accessibility/accessible-interaction-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 54;
const CONTENT_HEIGHT = 10;
const CMD_ACTIVATE = 'guide.accessibility.activate';
const CMD_INSPECT = 'guide.accessibility.inspect';

/** Button that records the real input path before delegating to the public Button behavior. */
class TracedActivateButton extends Button {
  protected readonly panel: AccessibleInteractionPanel;

  /** @param panel Evidence owner updated by real activation events. */
  public constructor(panel: AccessibleInteractionPanel) {
    super('~A~ctivate', { command: CMD_ACTIVATE, default: true });
    this.panel = panel;
  }

  /** Record mouse release or Alt accelerator activation, then run normal Button dispatch. */
  public override onEvent(event: DispatchEvent): void {
    const input = event.event;
    let source: InteractionSource | null = null;
    if (input.type === 'mouse' && input.kind === 'up' && this.inFace(event.local)) source = 'mouse';
    if (input.type === 'key' && input.alt && input.key.toLowerCase() === 'a') source = 'hotkey';
    if (input.type === 'key' && input.key === 'space' && this.state.focused) source = 'focused-key';
    if (input.type === 'key' && input.key === 'enter' && !input.alt && !input.ctrl) source = 'focused-key';
    if (source !== null) this.panel.prepareActivation(source);
    super.onEvent(event);
  }
}

export default defineExample({
  title: 'Accessible Interaction Laboratory',
  blurb: 'Prove keyboard focus, accelerator discovery, non-color state cues, and pointer parity on one task.',
  build: (ctx) =>
    createRoot((disposeReactive) => {
      let active = true;
      const disposeLesson = (): void => {
        if (!active) return;
        active = false;
        disposeReactive();
      };
      ctx.onCleanup?.(disposeLesson);
      const app = demoApp(ctx, {
        themeMenu: true,
        keymap: createKeymap({ 'alt+z': Commands.zoom }),
      });
      const panel = new AccessibleInteractionPanel();
      app.onCommand(CMD_ACTIVATE, () => panel.activateSharedCommand());
      app.onCommand(CMD_INSPECT, () => panel.inspectSharedCommand());
      const activate = new TracedActivateButton(panel);
      const inspect = new Button('~I~nspect', { command: CMD_INSPECT });
      const unavailable = new Button('~D~elete', { disabled: true });

      effect(() => {
        activate.focusSignal()();
        inspect.focusSignal()();
        if (activate.state.focused) panel.observeFocus('Activate');
        else if (inspect.state.focused) panel.observeFocus('Inspect');
      });

      const content = new Group();
      content.add(at(panel, 0, 0, CONTENT_WIDTH, 6));
      content.add(at(activate, 0, 6, 15, 2));
      content.add(at(inspect, 17, 6, 14, 2));
      content.add(at(unavailable, 33, 6, 15, 2));
      content.add(at(new Text('Tab/Shift+Tab | F12 then A | Alt+A | mouse click'), 0, 9, CONTENT_WIDTH, 1));

      const dialog = new Template1Dialog({
        title: ' Accessible Interaction ',
        width: 58,
        height: 14,
        preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
      });
      dialog.onMount(() => dialog.onCleanup(disposeLesson));
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(activate);
      return app;
    }),
});
