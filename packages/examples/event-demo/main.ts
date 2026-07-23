/**
 * Event-loop walkthrough (RD-04) — a narrated, headless console demo of `@jsvision/ui`'s
 * host-agnostic `EventLoop`: focus traversal, a typed command, and an async modal — all driven by a
 * synthetic `dispatch()` sequence (no TTY needed), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:events
 *
 * It builds a small themed desktop (two focusable buttons + a modal dialog), mounts it through the
 * loop-built `RenderRoot`, then: focuses the first button, presses Enter to raise the `'ok'` command
 * (handled by a post-process status bar), Tabs to the second button, opens the dialog with
 * `execView` (capturing input), and presses Enter inside it so the dialog's Close button calls
 * `endModal('ok')` — resolving the awaited promise and restoring focus.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import {
  View,
  createEventLoop,
  col,
  row,
  fixed,
  grow,
  type DrawContext,
  type DispatchEvent,
  type ThemeRoleName,
} from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}

/** A focusable button: highlights when focused; Enter runs its action and consumes the key. */
class Button extends View {
  constructor(
    private readonly label: string,
    private readonly onEnter: () => void,
  ) {
    super();
    this.focusable = true;
  }
  draw(ctx: DrawContext): void {
    const focused = this.state.focused;
    const style = ctx.color(focused ? 'buttonFocused' : 'button');
    ctx.fill(' ', style);
    ctx.text(1, 0, `${focused ? '>' : ' '} ${this.label}`, style);
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key' && ev.event.key === 'enter') {
      this.onEnter();
      ev.handled = true;
    }
  }
}

/** A static themed text line. */
class Label extends View {
  constructor(
    private readonly content: string,
    private readonly role: ThemeRoleName,
  ) {
    super();
  }
  draw(ctx: DrawContext): void {
    const style = ctx.color(this.role);
    ctx.fill(' ', style);
    ctx.text(1, 0, this.content, style);
  }
}

/** A post-process status bar that records the last command it sees (consuming none). */
class StatusBar extends View {
  private last = '(none)';
  constructor() {
    super();
    this.postProcess = true;
  }
  draw(ctx: DrawContext): void {
    const style = ctx.color('statusBar');
    ctx.fill(' ', style);
    ctx.text(1, 0, `Last command: ${this.last}`, style);
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') {
      this.last = ev.event.command;
      this.invalidate();
    }
  }
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const line of rows) {
    console.log(`|${line.map((cell) => cell.char).join('')}|`);
  }
  console.log(`+${'-'.repeat(width)}+`);
}

async function main(): Promise<void> {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
  const loop = createEventLoop({ width: 50, height: 12 }, { caps });

  // --- Build the themed desktop tree (the modal dialog is part of the tree, per the RD-04 contract).
  const header = new Label('jsvision — Event Loop (RD-04)', 'menuBar');

  const btnOk = new Button('OK', () => loop.emitCommand('ok'));
  const btnOpen = new Button('Open Dialog', () => undefined); // opened from the script below
  const body = fixed(row({ gap: 2 }, grow(btnOk), grow(btnOpen)), 1);

  const dialogLabel = new Label('Dialog — press Enter to close', 'dialog');
  const btnClose = new Button('Close', () => loop.endModal('ok'));
  const dialog = fixed(col(fixed(dialogLabel, 1), fixed(btnClose, 1)), 2);
  dialog.background = 'dialog';

  const status = new StatusBar();

  const root = col({ padding: 1 }, fixed(header, 1), body, dialog, fixed(status, 1));
  root.background = 'desktop';

  loop.mount(root);

  // --- Drive a synthetic event sequence, printing a frame after each step. -----------------------
  loop.focusView(btnOk);
  printFrame('Frame 1 — focus on [OK]', loop.renderRoot.buffer().rows());

  loop.dispatch(key('enter')); // btnOk → emitCommand('ok') → status records it
  printFrame("Frame 2 — Enter on [OK] → 'ok' command handled (post-process)", loop.renderRoot.buffer().rows());

  loop.dispatch(key('tab')); // built-in Tab → focus advances
  printFrame('Frame 3 — Tab → focus [Open Dialog]', loop.renderRoot.buffer().rows());

  const dialogResult = loop.execView<string>(dialog); // open the modal (captures input)
  printFrame('Frame 4 — execView(dialog): modal open, input captured', loop.renderRoot.buffer().rows());

  loop.dispatch(key('enter')); // routed within the modal → Close → endModal('ok')
  const result = await dialogResult;
  printFrame('Frame 5 — endModal: dialog closed, focus restored', loop.renderRoot.buffer().rows());

  console.log(`\nDialog resolved with: ${result}`);
  console.log('Done — focus traversal, a typed command, and an async modal, all from dispatch().');
}

void main();
