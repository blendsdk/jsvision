/**
 * Containers/scrolling/lists walkthrough (RD-11) — a narrated, headless console demo of `@jsvision/ui`'s
 * container tier: a `ScrollBar` stepped by mouse, a `Scroller` revealing lower content by keyboard, a
 * `ListView` navigated by ↑↓ + type-ahead + select, and a modal `Dialog` whose `valid()` gate vetoes
 * OK on an out-of-range field, then resolves once corrected. All driven by synthetic `dispatch()` /
 * `emitCommand()` (no TTY), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:containers
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import {
  Group,
  Text,
  ScrollBar,
  Scroller,
  ListBox,
  Dialog,
  Input,
  Label,
  okButton,
  cancelButton,
  createEventLoop,
  signal,
  range,
  Commands,
  cover,
  col,
  row,
  grow,
  fixed,
  spacer,
} from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}
/** A synthetic mouse click (1-based screen coords, as the decoder emits). */
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const line of rows) console.log(`|${line.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Step 1 — a vertical `ScrollBar` stepped by clicking its ▼ arrow + the page track. */
function stepScrollBar(): void {
  const pos = signal(0);
  const bar = new ScrollBar({ value: pos, min: 0, max: 100, orientation: 'vertical' });
  cover(bar);
  const root = new Group();
  root.add(bar);
  const loop = createEventLoop({ width: 1, height: 8 }, { caps });
  loop.mount(root);
  printFrame('Frame 1a — ScrollBar at 0 (▲ track ▼)', loop.renderRoot.buffer().rows());

  // Click the ▼ arrow (bottom cell, 1-based y=8) three times → +3 (arrow steps ±arrowStep).
  for (let i = 0; i < 3; i += 1) {
    loop.dispatch(mouse('down', 1, 8));
    loop.dispatch(mouse('up', 1, 8));
  }
  // Click mid-track (row 4, 1-based y=5) → the thumb JUMPS to that position (TV tscrlbar.cpp:193-207).
  loop.dispatch(mouse('down', 1, 5));
  loop.dispatch(mouse('up', 1, 5));
  printFrame('Frame 1b — after 3× ▼ arrow + a mid-track click (jump-to-position)', loop.renderRoot.buffer().rows());
  console.log(`  ScrollBar value: ${pos()} (arrow ±1; a track click jumps the thumb to that position)`);
}

/** Step 2 — a `Scroller` over oversized content, scrolled down by keyboard. */
function stepScroller(): void {
  // Twenty single-row lines stacked top to bottom — the Scroller's `extent` still declares the
  // scrollable size, since a col measures no taller than the viewport it is solved into.
  const content = fixed(
    col(
      ...Array.from({ length: 20 }, (_, i) =>
        fixed(new Text(`Line ${String(i + 1).padStart(2, '0')} of oversized content`), 1),
      ),
    ),
    20,
  );
  const scroller = new Scroller({ content, extent: { width: 30, height: 20 }, scrollbars: 'vertical' });
  cover(scroller);
  const root = new Group();
  root.add(scroller);
  const loop = createEventLoop({ width: 24, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(scroller);
  printFrame('Frame 2a — Scroller at top (Line 01 …)', loop.renderRoot.buffer().rows());

  loop.dispatch(key('pagedown'));
  loop.dispatch(key('down'));
  printFrame('Frame 2b — PgDn + ↓ reveals lower lines', loop.renderRoot.buffer().rows());
}

/** Step 3 — a `ListBox` navigated by ↑↓ then jumped by type-ahead + selected. */
function stepListView(): void {
  const items = signal([
    'Apple',
    'Apricot',
    'Banana',
    'Grape',
    'Grapefruit',
    'Kiwi',
    'Mango',
    'Orange',
    'Pear',
    'Plum',
  ]);
  const focused = signal(0);
  const selected = signal(-1);
  const list = new ListBox({ items, focused, selected, typeAhead: true });
  cover(list);
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: 20, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  printFrame('Frame 3a — ListBox, focus on Apple', loop.renderRoot.buffer().rows());

  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  printFrame('Frame 3b — ↓↓ moves focus to Banana', loop.renderRoot.buffer().rows());
  console.log(`  focused index: ${focused()} = ${items()[focused()]}`);

  // Type-ahead: "gr" jumps to Grape.
  loop.dispatch(key('g'));
  loop.dispatch(key('r'));
  printFrame('Frame 3c — type "gr" jumps to Grape (type-ahead)', loop.renderRoot.buffer().rows());
  console.log(`  type-ahead landed on: ${items()[focused()]}`);

  loop.dispatch(key('enter'));
  console.log(`  Enter selected index: ${selected()} = ${items()[selected()]}`);
}

/** Step 4 — a modal `Dialog` whose `valid()` gate vetoes OK on an out-of-range Age, then resolves. */
async function stepDialog(): Promise<void> {
  const age = signal('200'); // out of range(0,120)
  // A size (no explicit rect) ⇒ the dialog auto-centers in the viewport (TV ofCentered) and casts a
  // drop-shadow (TV sfShadow) — the modern default; no manual placement needed.
  const dlg = new Dialog({ title: ' Person ', width: 34, height: 9 });
  const ageInput = new Input({ value: age, validator: range(0, 120) });
  const label = new Label('~A~ge (0–120)', ageInput);
  const ok = okButton();
  const cancel = cancelButton();
  // A labelled field over a centred button pair. Every child is given an explicit main-axis size
  // because none of Label/Input/Button measures itself, and the spacer pushes the buttons to the
  // dialog's bottom edge the way TV's hand-computed rects did.
  dlg.setLayout({ direction: 'col' });
  dlg.add(
    grow(
      col(
        { gap: 1, padding: 1 },
        fixed(row({ gap: 1 }, fixed(label, 14), fixed(ageInput, 14)), 1),
        spacer(),
        fixed(row({ gap: 2, justify: 'center' }, fixed(ok, 10), fixed(cancel, 12)), 2),
      ),
    ),
  );

  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(root);
  const result = loop.execView<string>(dlg);

  let settled = false;
  void result.then(() => (settled = true));

  console.log(
    `  Dialog opened centered at ${JSON.stringify(dlg.bounds)} with a drop-shadow (TV ofCentered + sfShadow).`,
  );
  printFrame('Frame 4a — modal Dialog, Age="200" (invalid)', loop.renderRoot.buffer().rows());

  // OK with an out-of-range Age ⇒ vetoed by valid(); the dialog stays open.
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  console.log(`  OK with Age="200" → settled? ${settled} (vetoed by valid(); focus → Age)`);

  // Correct the Age, then OK resolves. A direct signal write outside a dispatch tick marks the
  // Input dirty but the loop only flushes inside a tick, so force one recompose for the frame.
  age.set('42');
  loop.renderRoot.flush();
  printFrame('Frame 4b — Age corrected to "42"', loop.renderRoot.buffer().rows());
  loop.emitCommand(Commands.ok);
  const cmd = await result;
  console.log(`  OK with Age="42" → resolved: ${cmd} (age = "${age()}")`);
}

/** Run the walkthrough. */
async function main(): Promise<void> {
  stepScrollBar();
  stepScroller();
  stepListView();
  await stepDialog();
  console.log('\nDone — a ScrollBar, a Scroller, a ListView (type-ahead + select), and a modal Dialog valid()-gate.');
}

void main();
