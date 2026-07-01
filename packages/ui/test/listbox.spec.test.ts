/**
 * Specification tests (immutable oracles) — RD-11 `ListBox` (03-04).
 *
 * Source: jsvision-ui/RD-11 AC-7 → ST-08 (containers-scrolling-lists/07-testing-strategy.md). TV
 * source: `TListBox` — `source/tvision/tlistbox.cpp` (`getText:52` = `items->at(item)`; `newList:63`
 * sets `range=count`, `focusItem(0)`). `ListBox` = `ListView<string>` with identity `getText` bound to
 * a `Signal<string[]>` (PA-15). Expectations derive from the AC + the decode. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListBox } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ST-08 / AC-7 — a ListBox over Signal<string[]> lists the strings from the signal.
test('ST-08: ListBox lists the strings from its Signal<string[]>', () => {
  const items = signal(['red', 'green', 'blue']);
  const box = new ListBox({ items });
  const rr = createRenderRoot({ width: 12, height: 5 }, { caps });
  rr.mount(box);
  const buf = rr.buffer();
  // Rows drawn at col 1 (TV draws item text at curCol+1).
  expect(buf.get(1, 0)?.char).toBe('r'); // red
  expect(buf.get(1, 1)?.char).toBe('g'); // green
  expect(buf.get(1, 2)?.char).toBe('b'); // blue
});

// ST-08 — updating the items signal re-renders the visible rows and clamps focused into the new range.
test('ST-08: updating the items signal re-renders and clamps focused', () => {
  const items = signal(['one', 'two', 'three', 'four', 'five']);
  const focused = signal(4); // last item
  const box = new ListBox({ items, focused });
  const root = new Group();
  root.add(box);
  box.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 6 } };
  const loop = createEventLoop({ width: 12, height: 6 }, { caps });
  loop.mount(root);
  const buf = () => loop.renderRoot.buffer();

  expect(buf().get(1, 4)?.char).toBe('f'); // 'five' at row 4

  // Shrink the list to 2 items ⇒ focused (was 4) clamps into [0,1]; rows re-render.
  items.set(['x', 'y']);
  loop.renderRoot.flush(); // a direct signal write marks dirty; the loop flushes only inside a tick
  expect(focused()).toBeLessThanOrEqual(1);
  expect(buf().get(1, 0)?.char).toBe('x');
  expect(buf().get(1, 1)?.char).toBe('y');
  // Old rows 2..4 are now blank.
  expect(buf().get(1, 4)?.char).toBe(' ');
});
