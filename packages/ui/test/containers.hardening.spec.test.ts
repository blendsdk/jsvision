/**
 * Specification tests (immutable oracles) — containers/lists hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-49…HR-62, plan docs 03-09-containers-lists.md + 07-testing-strategy.md
 * (ST-8.n–s). TV-derived oracles defer to the GATE-1 decode of the cited `.cpp`. Driven through the
 * real loop / render root; expectations derive from the RD/AC + the C++, never the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { ScrollBar, Scroller } from '../src/scroll/index.js';
import { ListBox, ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** A focusable stub for the focus-away case. */
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

// ST-8.n — a track click jumps the thumb to the clicked position, then follows the drag (HR-49).
test('ST-8.n: a ScrollBar track click jumps to the position and follows the drag — HR-49', () => {
  const value = signal(0);
  const bar = new ScrollBar({ value, min: 0, max: 100, orientation: 'vertical' });
  const loop = createEventLoop({ width: 1, height: 12 }, { caps });
  loop.mount(bar);

  loop.dispatch(mouse('down', 1, 10)); // click low in the track (not an arrow, not the thumb)
  const afterJump = value();
  expect(afterJump).toBeGreaterThan(50); // jumped toward the clicked (low) position, not a page-step

  loop.dispatch(mouse('drag', 1, 4)); // dragging up follows the pointer
  expect(value()).toBeLessThan(afterJump);
  loop.dispatch(mouse('up', 1, 4));
});

// ST-8.o — the focused row keeps a listSelected highlight after the list loses focus (HR-50).
test('ST-8.o: a list keeps its focused-row highlight when focus leaves — HR-50', () => {
  const items = signal(['Alpha', 'Bravo', 'Charlie']);
  const list = new ListBox({ items, focused: signal(0) });
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 3 } });
  const stub = new FocusStub();
  stub.setLayout({ position: 'absolute', rect: { x: 0, y: 4, width: 4, height: 1 } });
  const g = new Group();
  g.add(list);
  g.add(stub);
  const loop = createEventLoop({ width: 13, height: 6 }, { caps });
  loop.mount(g);

  loop.focusView(list.rows);
  expect(loop.renderRoot.buffer().get(1, 0)?.bg).toBe(defaultTheme.listFocused.bg); // active → bright green

  loop.focusView(stub); // focus leaves the list
  // listSelected/listNormal share the cyan bg; they differ by fg (yellow vs black), so assert fg.
  const fg = loop.renderRoot.buffer().get(1, 0)?.fg;
  expect(fg).toBe(defaultTheme.listSelected.fg); // HR-50: keeps a highlight (listSelected, not normal)
  expect(fg).not.toBe(defaultTheme.listNormal.fg);
});

// ST-8.p — an empty list draws <empty> at column 1 (HR-51).
test('ST-8.p: an empty list draws <empty> at column 1 — HR-51', () => {
  const list = new ListBox({ items: signal<string[]>([]) });
  const rr = createRenderRoot({ width: 12, height: 4 }, { caps });
  rr.mount(list);
  const buf = rr.buffer();
  expect(buf.get(0, 0)?.char).toBe(' '); // column 0 is blank (the text inset)
  expect([1, 2, 3, 4, 5, 6, 7].map((x) => buf.get(x, 0)?.char).join('')).toBe('<empty>');
});

// ST-8.q — the owned bar's page step is size.y - 1 (HR-53).
test('ST-8.q: the owned list bar page step is height - 1 — HR-53', () => {
  class ProbeList extends ListView<string> {
    barPageStep(): number {
      return this.bar.pageStep();
    }
  }
  const list = new ProbeList({ items: signal(['a', 'b', 'c', 'd', 'e']), getText: (s) => s });
  const rr = createRenderRoot({ width: 12, height: 5 }, { caps });
  rr.mount(list);
  rr.flush();
  expect(list.barPageStep()).toBe(4); // height 5 → pgStep 4 (size.y - 1)
});

// ST-8.r — a both-bars Scroller reserves the SE corner cell (bar background, never content) (HR-61).
test('ST-8.r: a both-bars Scroller reserves the SE corner cell — HR-61', () => {
  const content = new (class extends View {
    draw(ctx: DrawContext): void {
      ctx.fill('#', ctx.color('listNormal')); // fill everything with a marker glyph
    }
  })();
  const scroller = new Scroller({ content, extent: { width: 40, height: 40 }, scrollbars: 'both' });
  scroller.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 6 } });
  const g = new Group();
  g.add(scroller);
  const rr = createRenderRoot({ width: 10, height: 6 }, { caps });
  rr.mount(g);
  rr.flush();
  const corner = rr.buffer().get(9, 5); // SE corner (vpW=9, vpH=5)
  expect(corner?.char).not.toBe('#'); // content ('#') never renders in the corner
  expect(corner?.bg).toBe(defaultTheme.scrollBarPage.bg); // painted in the bar background role
});

// ST-8.s — a click below the last row of a non-empty list focuses/selects the last item (HR-62).
test('ST-8.s: a click below the last row selects the last item — HR-62', () => {
  const items = signal(['one', 'two', 'three']);
  const selected = signal(-1);
  const list = new ListBox({ items, selected });
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 6 } });
  const g = new Group();
  g.add(list);
  const loop = createEventLoop({ width: 13, height: 6 }, { caps });
  loop.mount(g);
  loop.focusView(list.rows);

  loop.dispatch(mouse('down', 2, 5)); // row 4 (below the 3 items) → clamps to the last (index 2)
  expect(selected()).toBe(2);
});
