/**
 * Event-routing laboratory for the Events, commands & keymaps course.
 *
 * The learner sends real key, paste, command, and mouse events through one retained tree. A
 * persistent ASCII trace makes the three-phase route and the separate pointer bubble observable.
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
import { eventTraceLabel, type RoutePhase } from '../../src/example-fixtures/events-commands-and-keymaps/trace.js';

const CMD_INSPECT = 'event-routing.inspect';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

/** Records one routing phase and paints its role in the retained tree. */
class RouteProbe extends View {
  constructor(
    private readonly caption: string,
    private readonly phase: RoutePhase,
    private readonly record: (event: DispatchEvent, phase: RoutePhase) => void,
  ) {
    super();
  }

  override draw(ctx: DrawContext): void {
    const role = this.state.focused ? 'buttonFocused' : 'button';
    ctx.fill(' ', ctx.color(role));
    const label = this.state.focused ? `${this.caption} [FOCUSED]` : this.caption;
    ctx.text(1, 0, label, ctx.color(role));
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'wheel') return;
    if (event.event.type === 'mouse') {
      if (event.event.kind === 'down') this.record(event, 'target');
      return;
    }
    this.record(event, this.phase);
  }
}

/** Records the target-up parent step used only by a mouse-down bubble. */
class RouteParent extends Group {
  constructor(private readonly record: (event: DispatchEvent, phase: RoutePhase) => void) {
    super();
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'mouse' && event.event.kind === 'down') this.record(event, 'parent');
  }
}

export default defineExample({
  title: 'Event Routing Laboratory',
  blurb: 'Send keyboard, paste, command, and mouse input through one tree and compare their exact routes.',
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
        keymap: createKeymap({ 'alt+c': CMD_INSPECT }),
      });
      const trace = signal('Route trace: pre > focused > post');
      let currentLabel = '';
      let phases: RoutePhase[] = [];
      const record = (event: DispatchEvent, phase: RoutePhase): void => {
        const label =
          event.event.type === 'command' && event.event.command === CMD_INSPECT
            ? 'Command inspect'
            : eventTraceLabel(event.event);
        if (label !== currentLabel) {
          currentLabel = label;
          phases = [];
        }
        phases.push(phase);
        trace.set(`${label}: ${phases.join(' > ')}`);
      };

      const pre = new RouteProbe('pre-process', 'pre', record);
      pre.preProcess = true;
      const focused = new RouteProbe('Mouse target', 'focused', record);
      focused.focusable = true;
      const parent = new RouteParent(record);
      parent.add(at(focused, 1, 0, 29, 1));
      const post = new RouteProbe('post-process', 'post', record);
      post.postProcess = true;

      const sendPaste = new Button('Send ~p~aste', {
        onClick: () => {
          app.loop.focusView(focused);
          app.loop.dispatch({ type: 'paste', text: 'sample', truncated: false });
        },
      });
      const sendCommand = new Button('Emit ~c~ommand', {
        onClick: () => {
          app.loop.focusView(focused);
          app.loop.emitCommand(CMD_INSPECT);
        },
      });
      const reset = new Button('~R~eset trace', {
        onClick: () => trace.set('Route trace: pre > focused > post'),
      });

      const content = new Group();
      content.add(
        at(new Text('Key, paste, and command: three phases. Mouse-down: hit target then parent.'), 0, 0, 66, 1),
      );
      content.add(at(pre, 0, 2, 16, 1));
      content.add(at(parent, 18, 2, 31, 1));
      content.add(at(post, 51, 2, 15, 1));
      content.add(at(new Text(() => trace()), 0, 5, 66, 1));
      content.add(at(sendPaste, 0, 8, 18, 2));
      content.add(at(sendCommand, 21, 8, 20, 2));
      content.add(at(reset, 44, 8, 18, 2));
      content.add(at(new Text('Try: X key | paste button | Alt+C command | click Mouse target'), 0, 12, 66, 1));
      content.add(at(new Text('Trace uses ASCII > so order remains visible without colour or Unicode.'), 0, 13, 66, 1));

      const dialog = new Template1Dialog({
        title: ' Event Routing Laboratory ',
        width: CONTENT_WIDTH + 4,
        height: CONTENT_HEIGHT + 4,
        preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view instanceof RouteProbe,
      });
      dialog.onMount(() => dialog.onCleanup(disposeLesson));
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(focused);
      return app;
    }),
});
