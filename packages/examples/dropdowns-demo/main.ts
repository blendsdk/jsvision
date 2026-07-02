/**
 * Input-dropdowns walkthrough (RD-14) — a narrated, headless console demo of `@jsvision/ui`'s
 * dropdown tier: a `History` `▐↓▌` button dropping an Input's past values, an **editable** `ComboBox`
 * (free text + filter → pick), a **select-only** `ComboBox` (open → type-ahead → pick), and an
 * Esc-cancel that leaves the field unchanged. All driven by synthetic `dispatch()` (no TTY) over a
 * loop whose `popupHost` overlay hosts the anchored popup, printing a composed ASCII frame per step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:dropdowns
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import {
  Group,
  Input,
  History,
  ComboBox,
  historyAdd,
  clearHistory,
  createEventLoop,
  createRoot,
  signal,
} from '@jsvision/ui';
import type { EventLoop, PopupHost } from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed); `mods` sets alt/ctrl/shift. */
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

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const WIDTH = 40;
const HEIGHT = 12;

/** Build a loop + a full-viewport overlay wired as the popup host; the caller adds field controls. */
function makeApp(controls: Group): { loop: EventLoop; overlay: Group } {
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: WIDTH, height: HEIGHT } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(controls);
  root.add(overlay);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  return { loop, overlay };
}

/** Step 1 — a `History` button dropping the field's MRU list; pick fills the field. */
function stepHistory(): void {
  clearHistory();
  const value = signal('/etc/hosts');
  const input = new Input({ value });
  input.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 20, height: 1 } };
  for (const past of ['/usr/bin', '/etc/hosts', '~/dev']) historyAdd(1, past);
  const hist = new History({ link: input, historyId: 1 });
  hist.layout = { position: 'absolute', rect: { x: 22, y: 1, width: 3, height: 1 } };
  const controls = new Group();
  controls.add(input);
  controls.add(hist);
  const { loop } = makeApp(controls);
  loop.focusView(input);
  printFrame('Frame 1a — field + ▐↓▌ History button', loop.renderRoot.buffer().rows());

  loop.dispatch(key('down', { alt: true })); // Alt+↓ opens; records the current value first
  loop.renderRoot.flush();
  printFrame('Frame 1b — history dropped (oldest at top, current value recorded)', loop.renderRoot.buffer().rows());

  loop.dispatch(key('enter')); // pick the focused entry (index 1 when count > 1)
  loop.renderRoot.flush();
  printFrame('Frame 1c — picked → field filled', loop.renderRoot.buffer().rows());
  console.log(`  History picked: ${value()}`);
}

/** Step 2 — an editable `ComboBox`: type to filter, open, pick the match. */
function stepComboEditable(): void {
  const items = signal(['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go']);
  const text = signal('');
  const value = signal<string | null>(null);
  const combo = new ComboBox<string>({ items, getText: (s) => s, value, text, editable: true });
  combo.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 22, height: 1 } };
  const controls = new Group();
  controls.add(combo);
  const { loop } = makeApp(controls);
  loop.focusView(combo.input);
  printFrame('Frame 2a — editable ComboBox (empty)', loop.renderRoot.buffer().rows());

  for (const ch of 'ru') loop.dispatch(key(ch)); // filter as you type
  loop.renderRoot.flush();
  console.log(`  editable filtered to: ${combo.filtered().join(', ')}`);
  printFrame('Frame 2b — typed "ru" → field narrows the candidates', loop.renderRoot.buffer().rows());

  loop.dispatch(key('down', { alt: true })); // open the (filtered) dropdown
  loop.renderRoot.flush();
  printFrame('Frame 2c — dropdown shows the single match', loop.renderRoot.buffer().rows());

  loop.dispatch(key('enter')); // pick
  loop.renderRoot.flush();
  printFrame('Frame 2d — picked → text + value set', loop.renderRoot.buffer().rows());
  console.log(`  editable value: ${value() ?? 'null'} (text="${text()}")`);
}

/** Step 3 — a select-only `ComboBox`: open, type-ahead to jump, pick. */
function stepComboSelect(): void {
  const items = signal(['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow']);
  const value = signal<string | null>('Blue');
  const combo = new ComboBox<string>({ items, getText: (s) => s, value, editable: false });
  combo.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 22, height: 1 } };
  const controls = new Group();
  controls.add(combo);
  const { loop } = makeApp(controls);
  loop.focusView(combo.input);
  printFrame('Frame 3a — select-only ComboBox showing "Blue" (read-only)', loop.renderRoot.buffer().rows());

  loop.dispatch(key('down')); // ↓ opens the picker
  loop.renderRoot.flush();
  loop.dispatch(key('m')); // type-ahead → Magenta
  loop.renderRoot.flush();
  printFrame('Frame 3b — opened + typed "m" jumps to Magenta (type-ahead)', loop.renderRoot.buffer().rows());

  loop.dispatch(key('enter')); // pick
  loop.renderRoot.flush();
  printFrame('Frame 3c — picked', loop.renderRoot.buffer().rows());
  console.log(`  type-ahead landed on: Magenta`);
  console.log(`  select-only value: ${value() ?? 'null'}`);
}

/** Step 4 — Esc cancels an open dropdown, leaving the field untouched. */
function stepCancel(): void {
  clearHistory();
  const value = signal('keep-me');
  const input = new Input({ value });
  input.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 20, height: 1 } };
  for (const past of ['alpha', 'beta']) historyAdd(9, past);
  const hist = new History({ link: input, historyId: 9 });
  hist.layout = { position: 'absolute', rect: { x: 22, y: 1, width: 3, height: 1 } };
  const controls = new Group();
  controls.add(input);
  controls.add(hist);
  const { loop, overlay } = makeApp(controls);
  loop.focusView(input);

  loop.dispatch(key('down', { alt: true })); // open
  loop.renderRoot.flush();
  printFrame('Frame 4a — dropdown open over "keep-me"', loop.renderRoot.buffer().rows());

  loop.dispatch(key('escape')); // cancel — no pick
  loop.renderRoot.flush();
  printFrame('Frame 4b — Esc cancelled; field unchanged', loop.renderRoot.buffer().rows());
  console.log(`  after Esc, popup open? ${overlay.state.visible}`);
  console.log(`  after Esc, field unchanged: ${value()}`);
}

/**
 * Run the walkthrough. The whole tree is built inside a `createRoot` (the canonical jsvision
 * pattern — mirrors `createApplication` / the kitchen-sink shell): every signal/computed a widget
 * creates in its constructor (e.g. `ComboBox.filtered`, the list's sorted display) is owned by this
 * scope and disposed by `dispose()` at the end — so a headless demo never leaks a computation
 * outside an owner (which would dev-warn and, in a live TUI, corrupt the screen).
 */
function main(): void {
  createRoot((dispose) => {
    stepHistory();
    stepComboEditable();
    stepComboSelect();
    stepCancel();
    dispose();
  });
  console.log('\nDone — a History MRU dropdown, an editable + a select-only ComboBox, and an Esc-cancel.');
}

main();
