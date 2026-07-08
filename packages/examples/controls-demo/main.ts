/**
 * Essential-controls walkthrough (RD-06 + RD-07) — a narrated, headless console demo of
 * `@jsvision/ui`'s leaf controls: a `Label`-linked `Input` (with a live `filter` validator + text
 * selection, clipboard paste, and the visible logical caret), a `picture(mask)` auto-fill field, a
 * `CheckGroup`, a `RadioGroup`, a `MultiCheckGroup`, and a default `Button` that emits a command —
 * all driven by a synthetic `dispatch()` sequence (no TTY needed), printing a composed ASCII frame
 * after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:controls
 *
 * It builds a small form, mounts it through the loop-built `RenderRoot`, then: focuses the `Input`
 * and types `Al3x` (the `3` is rejected live by `filter('A-Za-z ')`), Shift-selects + pastes over the
 * selection, fills a `picture('(###) ###-####')` phone field (literals auto-insert), Tabs to the
 * `CheckGroup`/`RadioGroup`/`MultiCheckGroup` and toggles them, and Tabs to the `Button` and activates
 * it so its `'ok'` command reaches a post-process command spy (via `ev.emit`, PA-1).
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
  MultiCheckGroup,
  Button,
  filter,
  picture,
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
  const phone = signal('');
  const styleFlags = signal([false, false]);
  const align = signal(0);
  const levels = signal([0, 0]);

  // The form controls (the Label links to the Input).
  const input = new Input({ value: name, validator: filter('A-Za-z ') });
  const label = new Label('~N~ame', input);
  const phoneInput = new Input({ value: phone, validator: picture('###-###-####') });
  const phoneLabel = new Label('~P~hone', phoneInput);
  const check = new CheckGroup({ labels: ['~B~old', '~I~talic'], value: styleFlags });
  const radio = new RadioGroup({ labels: ['~L~eft', '~C~enter', '~R~ight'], value: align });
  const multi = new MultiCheckGroup({ items: ['~V~olume', '~T~reble'], states: ' xX', value: levels });
  const button = new Button('~O~K', { command: 'ok', default: true });
  const spy = new CommandSpy();

  const form = new Group();
  form.background = 'window';
  form.layout = { direction: 'col', padding: 1, gap: 0 };
  for (const [view, rows] of [
    [label, 1],
    [input, 1],
    [phoneLabel, 1],
    [phoneInput, 1],
    [check, 2],
    [radio, 3],
    [multi, 2],
    [button, 2],
    [spy, 1],
  ] as const) {
    view.layout = { size: { kind: 'fixed', cells: rows } };
    form.add(view);
  }

  const loop = createEventLoop({ width: 30, height: 18 }, { caps });
  loop.mount(form);

  // Step 1 — the form composed, the Input focused (the reversed logical caret cell is visible).
  loop.focusView(input);
  printFrame('Frame 1 — form composed; Input focused (caret shows)', loop.renderRoot.buffer().rows());

  // Step 2 — type "Al3x"; the '3' is rejected live by filter('A-Za-z ').
  for (const ch of 'Al3x') loop.dispatch(key(ch));
  printFrame('Frame 2 — typed "Al3x" into the Input', loop.renderRoot.buffer().rows());
  console.log(`  filter('A-Za-z ') rejected '3' live → Name value: ${JSON.stringify(name())}`);

  // Step 3 — Shift+Left ×2 selects the last two chars; a bracketed paste replaces the selection.
  loop.dispatch(key('left', { shift: true }));
  loop.dispatch(key('left', { shift: true }));
  console.log(`  Shift+Left ×2 → selection: ${JSON.stringify(input.selection)}`);
  loop.dispatch({ type: 'paste', text: 'ex', truncated: false });
  printFrame('Frame 3 — Shift-select + paste "ex" over it', loop.renderRoot.buffer().rows());
  console.log(`  paste replaced the selection → Name value: ${JSON.stringify(name())}`);

  // Step 4 — Tab to the picture phone field; type digits → the mask literals auto-fill.
  loop.dispatch(key('tab'));
  for (const ch of '5551234567') loop.dispatch(key(ch));
  printFrame('Frame 4 — picture("###-###-####") auto-fill', loop.renderRoot.buffer().rows());
  console.log(`  picture mask auto-inserted literals → Phone value: ${JSON.stringify(phone())}`);

  // Step 5 — Tab to the CheckGroup; Space toggles Bold.
  loop.dispatch(key('tab'));
  loop.dispatch(key('space'));
  printFrame('Frame 5 — Tab → CheckGroup; Space toggles Bold', loop.renderRoot.buffer().rows());
  console.log(`  CheckGroup value (Bold,Italic): ${JSON.stringify(styleFlags())}`);

  // Step 6 — Tab to the RadioGroup; ↓ selects Center (exclusive).
  loop.dispatch(key('tab'));
  loop.dispatch(key('down'));
  printFrame('Frame 6 — Tab → RadioGroup; ↓ selects Center', loop.renderRoot.buffer().rows());
  console.log(`  RadioGroup selected index: ${align()}`);

  // Step 7 — Tab to the MultiCheckGroup; Space cycles the focused box through the states.
  loop.dispatch(key('tab'));
  loop.dispatch(key('space'));
  loop.dispatch(key('space'));
  printFrame('Frame 7 — Tab → MultiCheckGroup; Space cycles (0→1→2)', loop.renderRoot.buffer().rows());
  console.log(`  MultiCheckGroup state indices (Volume,Treble): ${JSON.stringify(levels())}`);

  // Step 8 — Tab to the Button; Space activates → emits 'ok' to the command spy.
  loop.dispatch(key('tab'));
  loop.dispatch(key('space'));
  printFrame('Frame 8 — Tab → Button; Space emits the command', loop.renderRoot.buffer().rows());
  console.log(`  Button emitted command via ev.emit → spy recorded: ${JSON.stringify(spy.commands)}`);

  console.log(
    '\nDone — Input (filter + selection + paste + caret), a picture phone field, CheckGroup, RadioGroup, MultiCheckGroup, and a Button command.',
  );
}

main();
