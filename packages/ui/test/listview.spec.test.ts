/**
 * Specification tests (immutable oracles) — RD-11 `ListView<T>` (03-04).
 *
 * Source: jsvision-ui/RD-11 AC-4/AC-5/AC-6 → ST-05/ST-06/ST-07 (containers-scrolling-lists/
 * 07-testing-strategy.md). TV source of truth: `TListViewer` — `source/tvision/tlstview.cpp`
 * (`draw:77` getColor 1–5 row selection; `focusItem:159` keep-visible; `handleEvent:213` mouse
 * `newItem = mouse.y + topItem`, keys, Space/double-click select; `selectItem:357` broadcast). The
 * focus indicator is the `listFocused` colour only (PA-5, no glyph/caret). Single column ⇒ no divider.
 * Expectations derive from that decode + the ACs, NEVER from the implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** A post-process spy recording every command dispatched on the tick. */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

/** Mount a ListView filling `w×h` under a root Group (+ optional command spy) and focus its rows. */
function hosted<T>(list: ListView<T>, w: number, h: number, spy?: CommandSpy) {
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(list);
  if (spy) root.add(spy);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

// ST-05 / AC-4 — virtual scroll: 1000 items but only ~viewport rows are rendered (getText spy ≪1000);
// ↑↓ move focused, PgDn pages, focused stays visible, the owned bar reflects position, focused row uses
// listFocused.
test('ST-05: ListView virtual-scrolls 1000 items, moves focus, keeps it visible', () => {
  let getTextCalls = 0;
  const items = signal(Array.from({ length: 1000 }, (_, i) => i));
  const focused = signal(0);
  const list = new ListView<number>({
    items,
    getText: (n) => {
      getTextCalls += 1;
      return `item-${n}`;
    },
    focused,
  });
  const loop = hosted(list, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  // Only the visible window is materialized (≪ 1000). A generous ceiling absorbs a few recomposes.
  expect(getTextCalls).toBeLessThan(100);

  // Focused row 0 renders in listFocused (white-on-green) — the colour is the only focus indicator.
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.listFocused.bg);

  // ↓ moves focus to item 1 (still visible ⇒ topItem stays 0, focused row is screen row 1).
  loop.dispatch(key('down'));
  expect(focused()).toBe(1);
  expect(buf().get(0, 1)?.bg).toBe(defaultTheme.listFocused.bg);

  // PgDn pages down by the viewport height (10) ⇒ focused 11, which scrolls the window to keep it
  // visible (topItem becomes 2 so item 11 is the last visible row).
  loop.dispatch(key('pagedown'));
  expect(focused()).toBe(11);
  // Item 11 is visible (the focused colour appears somewhere in the column).
  let found = false;
  for (let y = 0; y < 10; y += 1) if (buf().get(0, y)?.bg === defaultTheme.listFocused.bg) found = true;
  expect(found).toBe(true);
});

// ST-06 / AC-5 — Enter activates: sets selected, calls onSelect, emits command. A row click focuses +
// selects (listSelected colour).
test('ST-06: Enter emits command + onSelect + selects; a click focuses & selects', () => {
  const items = signal(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  const focused = signal(0);
  const selected = signal(-1);
  const picks: Array<{ index: number; item: string }> = [];
  const list = new ListView<string>({
    items,
    getText: (s) => s,
    focused,
    selected,
    command: 'chosen',
    onSelect: (index, item) => picks.push({ index, item }),
  });
  const spy = new CommandSpy();
  const loop = hosted(list, 20, 6, spy);

  // Focus item 2, then Enter.
  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  expect(focused()).toBe(2);
  loop.dispatch(key('enter'));
  expect(selected()).toBe(2);
  expect(picks).toEqual([{ index: 2, item: 'Charlie' }]);
  expect(spy.commands).toContain('chosen');

  // Click row 0 ⇒ focuses + selects it. TV `draw` (tlstview.cpp:66-70) prioritizes focused over
  // selected, so the clicked (focused) row shows listFocused; moving focus away reveals listSelected.
  const buf = () => loop.renderRoot.buffer();
  loop.dispatch(mouse('down', 1, 1));
  loop.dispatch(mouse('up', 1, 1));
  expect(focused()).toBe(0);
  expect(selected()).toBe(0);
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.listFocused.bg); // focused takes colour precedence
  loop.dispatch(key('down')); // move focus to row 1 ⇒ row 0 is now only selected
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.listSelected.bg);
  expect(buf().get(0, 1)?.bg).toBe(defaultTheme.listFocused.bg);
});

// ST-07 / AC-6 — sorted displays ascending; typeAhead jumps focused to the first case-insensitive
// prefix match; both are off by default.
test('ST-07: sorted orders the display; typeAhead jumps to a prefix match', () => {
  const items = signal(['Charlie', 'alpha', 'Bravo']);
  const focused = signal(0);
  const list = new ListView<string>({ items, getText: (s) => s, focused, sorted: true, typeAhead: true });
  const loop = hosted(list, 20, 6);
  const buf = () => loop.renderRoot.buffer();

  // Sorted (case-insensitive-ish ascending): 'alpha','Bravo','Charlie' ⇒ row 0 starts with 'a'.
  expect(buf().get(1, 0)?.char).toBe('a');
  expect(buf().get(1, 1)?.char).toBe('B');
  expect(buf().get(1, 2)?.char).toBe('C');

  // Type 'c' ⇒ jumps focused to 'Charlie' (display index 2), case-insensitive.
  loop.dispatch(key('c'));
  expect(focused()).toBe(2);
});

test('ST-07: sorted + typeAhead are off by default (source order, no search jump)', () => {
  const items = signal(['Charlie', 'alpha', 'Bravo']);
  const focused = signal(0);
  const list = new ListView<string>({ items, getText: (s) => s, focused });
  const loop = hosted(list, 20, 6);
  // Source order preserved (no sort): row 0 is 'Charlie'.
  expect(loop.renderRoot.buffer().get(1, 0)?.char).toBe('C');
  // Typing does not move focus (typeAhead off).
  loop.dispatch(key('a'));
  expect(focused()).toBe(0);
});

// A ListView needs a parent to be focusable-as-a-unit; the exposed rows renderer is the focus target.
test('ST-05: ListView exposes its focusable rows renderer', () => {
  const list = new ListView<number>({ items: signal([1, 2, 3]), getText: (n) => String(n) });
  const rr = createRenderRoot({ width: 10, height: 4 }, { caps });
  rr.mount(list);
  expect(list.rows.focusable).toBe(true);
});
