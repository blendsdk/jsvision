/**
 * A custom View laboratory demonstrating clipped drawing, focus, input, and reactive repainting.
 */
import { Group, Text, View, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { DispatchEvent, DrawContext, Signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 58;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_ACTIVATE = 'view-lab.activate';

/** Small hand-drawn focusable widget whose paint depends on a shared signal. */
class DemoView extends View {
  /** Make the custom canvas a real keyboard focus target. */
  override focusable = true;

  /**
   * @param active Shared state read by both the custom pixels and the explanatory text.
   */
  constructor(private readonly active: Signal<boolean>) {
    super();
    this.onMount(() => {
      this.bind(() => active());
      this.bind(() => this.focusSignal()());
    });
  }

  /** Paint a bordered canvas with a focus-sensitive marker and state label. */
  override draw(ctx: DrawContext): void {
    const surface = ctx.color('dialog');
    const accent = ctx.color(this.state.focused ? 'labelShortcut' : 'staticText');
    ctx.fill(' ', surface);
    ctx.text(0, 0, '┌──────────────────────────────────────┐', accent);
    ctx.text(0, 1, `│  Custom pixels: ${this.active() ? '◆ ACTIVE' : '◇ idle  '}                 │`, accent);
    ctx.text(0, 2, '└──────────────────────────────────────┘', accent);
  }

  /** Toggle on Space or a pointer click and consume only those owned events. */
  override onEvent(ev: DispatchEvent): void {
    const isSpace = ev.event.type === 'key' && ev.event.key === 'space';
    const isClick = ev.event.type === 'mouse' && ev.event.kind === 'up';
    if (!isSpace && !isClick) return;
    this.active.update((value) => !value);
    ev.handled = true;
  }
}

export default defineExample({
  title: 'View Lab',
  blurb: 'Focus and activate a custom-drawn View while observing bounds, input, and reactive repainting.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+k': CMD_ACTIVATE }),
    });
    const active = signal(false);
    const canvas = new DemoView(active);
    const dialog = new Template1Dialog({ title: ' View Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    const content = new Group();

    content.add(at(new Text('A View owns pixels, input, focus, layout, and mount scope.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(canvas, 8, 2, 42, 3));
    content.add(at(new Text(() => `Canvas state: ${active() ? 'active' : 'idle'}`), 0, 7, 30, 1));
    content.add(at(new Text(() => `Focus: ${canvas.state.focused ? 'DemoView' : 'outside'}`), 31, 7, 27, 1));
    content.add(at(new Text('Alt+K focuses + activates · Space toggles when focused'), 0, 10, CONTENT_WIDTH, 1));
    content.add(at(new Text('Click the canvas for the equivalent pointer path'), 0, 11, CONTENT_WIDTH, 1));

    app.onCommand(CMD_ACTIVATE, () => {
      app.loop.focusView(canvas);
      active.update((value) => !value);
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
