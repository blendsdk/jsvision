/**
 * Command and keymap precedence laboratory for the Events, commands & keymaps course.
 *
 * Conflicting app/default chords, app-level command ownership, raw-key suppression, and disabled
 * command drops are shown together with persistent textual feedback.
 */
import {
  Button,
  Group,
  Text,
  View,
  at,
  createKeymap,
  createRoot,
  signal,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_SAVE = 'command-precedence.save';
const CMD_INSPECT = 'command-precedence.inspect';
const CMD_TOGGLE = 'command-precedence.toggle';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

/** Focus target that counts only raw keys which survive keymap conversion. */
class RawKeyProbe extends View {
  constructor(private readonly onRawKey: (key: string) => void) {
    super();
    this.focusable = true;
  }

  override draw(ctx: DrawContext): void {
    const role = this.state.focused ? 'buttonFocused' : 'button';
    ctx.fill(' ', ctx.color(role));
    ctx.text(1, 0, 'Raw-key focus target', ctx.color(role));
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key') this.onRawKey(event.event.key);
  }
}

export default defineExample({
  title: 'Command Precedence Laboratory',
  blurb: 'Trigger mapped chords, inspect the winning handler, then disable Save and observe the command drop.',
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
        keymap: createKeymap({
          'ctrl+s': CMD_SAVE,
          'ctrl+c': CMD_INSPECT,
          'alt+d': CMD_TOGGLE,
        }),
      });
      const enabled = signal(true);
      const winner = signal('ready');
      const status = signal('Status: mapped chords become commands before the focused view');
      const rawKeys = signal(0);

      const offSave = app.onCommand(CMD_SAVE, () => {
        winner.set('app onCommand');
        status.set('Status: save handled once by the app command owner');
      });
      const offInspect = app.onCommand(CMD_INSPECT, () => {
        winner.set('app onCommand');
        status.set('Status: Ctrl+C app binding won; inspect command handled');
      });
      const offToggle = app.onCommand(CMD_TOGGLE, () => {
        const next = !enabled.peek();
        enabled.set(next);
        app.loop.enableCommand(CMD_SAVE, next);
        status.set(
          next
            ? 'Status: save enabled; Ctrl+S routes again'
            : 'Status: save disabled; mapped save commands are dropped',
        );
      });

      const rawTarget = new RawKeyProbe(() => {
        rawKeys.update((count) => count + 1);
        status.set('Status: an unbound raw key reached the focused view');
      });
      const emitSave = new Button('Emit ~s~ave', { command: CMD_SAVE });
      const toggle = new Button('Toggle ~d~isabled', { command: CMD_TOGGLE });

      const content = new Group();
      content.add(
        at(new Text('Ctrl+S -> save | Ctrl+C -> inspect (app binding wins over clipboard default)'), 0, 0, 66, 1),
      );
      content.add(at(new Text(() => `Save enabled: ${enabled() ? 'yes' : 'no'}`), 0, 2, 31, 1));
      content.add(at(new Text(() => `Winner: ${winner()} | Raw key deliveries: ${rawKeys()}`), 0, 4, 66, 1));
      content.add(at(rawTarget, 0, 6, 24, 1));
      content.add(at(emitSave, 27, 6, 16, 2));
      content.add(at(toggle, 45, 6, 20, 2));
      content.add(at(new Text(() => status()), 0, 10, 66, 1));
      content.add(at(new Text('Try: Ctrl+S | Ctrl+C collision | Alt+D disable/enable | X raw key'), 0, 12, 66, 1));
      content.add(at(new Text('Status and Winner provide ASCII, non-colour evidence for every action.'), 0, 13, 66, 1));

      const dialog = new Template1Dialog({
        title: ' Command Precedence Laboratory ',
        width: CONTENT_WIDTH + 4,
        height: CONTENT_HEIGHT + 4,
        preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view instanceof RawKeyProbe,
      });
      dialog.onMount(() =>
        dialog.onCleanup(() => {
          offToggle();
          offInspect();
          offSave();
          disposeLesson();
        }),
      );
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(rawTarget);
      return app;
    }),
});
