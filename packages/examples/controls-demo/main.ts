/**
 * Essential-controls walkthrough (RD-06) — a narrated, headless console demo of `@jsvision/ui`'s
 * leaf controls: a `Label`-linked `Input` (with a live `filter` validator), a `CheckGroup`, a
 * `RadioGroup`, and a default `Button` that emits a command — all driven by a synthetic `dispatch()`
 * sequence (no TTY needed), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:controls
 *
 * It builds a small form, mounts it through the loop-built `RenderRoot`, then: focuses the `Input`
 * and types `Al3x` (the `3` is rejected live by `filter('A-Za-z ')`), Tabs to the `CheckGroup` and
 * toggles `Bold`, Tabs to the `RadioGroup` and selects `Center`, and Tabs to the `Button` and
 * activates it so its `'ok'` command reaches a post-process command spy (via `ev.emit`, PA-1).
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import {
  View,
  Group,
  createEventLoop,
  signal,
  Label,
  Input,
  CheckGroup,
  RadioGroup,
  Button,
  filter,
  type DrawContext,
  type DispatchEvent,
} from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** A post-process view that records the commands the controls emit on the tick. */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(ctx: DrawContext): void {
    const last = this.commands.at(-1);
    ctx.fill(' ', ctx.color('statusBar'));
    ctx.text(0, 0, last !== undefined ? `command: ${last}` : 'command: (none)', ctx.color('statusBar'));
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') {
      this.commands.push(ev.event.command);
      this.invalidate(); // repaint the panel to show the recorded command this tick
    }
  }
}

function main(): void {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

  // Bound state (two-way signals).
  const name = signal('');
  const styleFlags = signal([false, false]);
  const align = signal(0);

  // The form controls (the Label links to the Input).
  const input = new Input({ value: name, validator: filter('A-Za-z ') });
  const label = new Label('~N~ame', input);
  const check = new CheckGroup(['~B~old', '~I~talic'], styleFlags);
  const radio = new RadioGroup(['~L~eft', '~C~enter', '~R~ight'], align);
  const button = new Button('~O~K', { command: 'ok', default: true });
  const spy = new CommandSpy();

  const form = new Group();
  form.background = 'window';
  form.layout = { direction: 'col', padding: 1, gap: 0 };
  for (const [view, rows] of [
    [label, 1],
    [input, 1],
    [check, 2],
    [radio, 3],
    [button, 2],
    [spy, 1],
  ] as const) {
    view.layout = { size: { kind: 'fixed', cells: rows } };
    form.add(view);
  }

  const loop = createEventLoop({ width: 30, height: 12 }, { caps });
  loop.mount(form);

  // Step 1 — the form composed, the Input focused.
  loop.focusView(input);
  printFrame('Frame 1 — form composed; Input focused', loop.renderRoot.buffer().rows());

  // Step 2 — type "Al3x"; the '3' is rejected live by filter('A-Za-z ').
  for (const ch of 'Al3x') loop.dispatch(key(ch));
  printFrame('Frame 2 — typed "Al3x" into the Input', loop.renderRoot.buffer().rows());
  console.log(`  filter('A-Za-z ') rejected '3' live → Name value: ${JSON.stringify(name())}`);

  // Step 3 — Tab to the CheckGroup; Space toggles Bold.
  loop.dispatch(key('tab'));
  loop.dispatch(key('space'));
  printFrame('Frame 3 — Tab → CheckGroup; Space toggles Bold', loop.renderRoot.buffer().rows());
  console.log(`  CheckGroup value (Bold,Italic): ${JSON.stringify(styleFlags())}`);

  // Step 4 — Tab to the RadioGroup; ↓ selects Center (exclusive).
  loop.dispatch(key('tab'));
  loop.dispatch(key('down'));
  printFrame('Frame 4 — Tab → RadioGroup; ↓ selects Center', loop.renderRoot.buffer().rows());
  console.log(`  RadioGroup selected index: ${align()}`);

  // Step 5 — Tab to the Button; Space activates → emits 'ok' to the command spy.
  loop.dispatch(key('tab'));
  loop.dispatch(key('space'));
  printFrame('Frame 5 — Tab → Button; Space emits the command', loop.renderRoot.buffer().rows());
  console.log(`  Button emitted command via ev.emit → spy recorded: ${JSON.stringify(spy.commands)}`);

  console.log('\nDone — a Label-linked Input (+ live filter), a CheckGroup, a RadioGroup, and a Button command.');
}

main();
