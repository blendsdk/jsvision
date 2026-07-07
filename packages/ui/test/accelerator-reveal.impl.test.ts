/**
 * Implementation tests (edges) — accelerator-overlay reveal seam.
 *
 * Source: accelerator-overlay/07-testing-strategy.md — IT-2 (one coalesced recompose per flag flip;
 * a redundant flip is a no-op), IT-3 (a TabView strip's tab hotkey underlines on reveal), IT-4 (the
 * Cluster family — CheckGroup/RadioGroup — hot labels underline on reveal). The arm-to-fire legs of
 * IT-3/IT-4 live in `accelerator-fire.impl.test.ts` (Phase 2). Real `View`/`RenderRoot` over fixed caps.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, Attr } from '@jsvision/core';
import type { Cell, ScreenBuffer } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { CheckGroup, RadioGroup } from '../src/controls/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** The first cell (row-major) whose glyph is `ch`, or `undefined`. */
function findChar(buf: ScreenBuffer, ch: string): Cell | undefined {
  for (let y = 0; y < buf.height; y += 1) {
    for (let x = 0; x < buf.width; x += 1) {
      const cell = buf.get(x, y);
      if (cell?.char === ch) return cell;
    }
  }
  return undefined;
}
function underlined(cell: Cell | undefined): boolean {
  return cell !== undefined && (cell.attrs & Attr.underline) !== 0;
}

/** A trivial tab page. */
function page(): Group {
  const g = new Group();
  g.layout = { direction: 'col' };
  return g;
}

// IT-2 — a flag flip forces exactly one coalesced recompose (through markRelayout → fullCompose);
// a redundant flip to the same value is a no-op (no extra schedule) and clears no underline.
test('IT-2: one coalesced recompose per flag flip; a redundant flip is a no-op', () => {
  let scheduled = 0;
  const cg = new CheckGroup(['~Y~es'], signal([false]));
  cg.layout = { direction: 'col' };
  const rr = createRenderRoot(
    { width: 12, height: 1 },
    {
      caps,
      schedule: (fn) => {
        scheduled += 1;
        fn(); // run synchronously so the recompose lands inline
      },
    },
  );
  rr.mount(cg); // mount flushes directly, not via `schedule`
  const base = scheduled;

  rr.setRevealAccelerators(true); // a real change → exactly one scheduled recompose
  expect(scheduled - base).toBe(1);
  expect(underlined(findChar(rr.buffer(), 'Y'))).toBe(true);

  rr.setRevealAccelerators(true); // same value → no-op, no extra schedule
  expect(scheduled - base).toBe(1);

  rr.setRevealAccelerators(false); // flip back → one more recompose, underline cleared
  expect(scheduled - base).toBe(2);
  expect(underlined(findChar(rr.buffer(), 'Y'))).toBe(false);
});

// IT-3 — reveal underlines the TabView strip's tab hotkey (`G` of `~G~eneral`).
test('IT-3: a TabView tab hotkey underlines on reveal', () => {
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: page() },
    { title: '~D~isplay', content: page() },
  ]);
  const view = new TabView({ tabs, active: signal(0) });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 6 } };
  const root = new Group();
  root.add(view);
  const rr = createRenderRoot({ width: 40, height: 6 }, { caps });
  rr.mount(root);

  expect(underlined(findChar(rr.buffer(), 'G'))).toBe(false); // off by default
  rr.setRevealAccelerators(true);
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'G'))).toBe(true);
});

// IT-4 — the Cluster family (CheckGroup + RadioGroup) hot labels underline on reveal.
test('IT-4: CheckGroup + RadioGroup hot labels underline on reveal', () => {
  const cg = new CheckGroup(['~Y~es'], signal([false]));
  const rg = new RadioGroup(['~R~ed', '~G~reen'], signal(0));
  const root = new Group();
  root.layout = { direction: 'col' };
  cg.layout = { size: { kind: 'fixed', cells: 1 } };
  rg.layout = { size: { kind: 'fixed', cells: 2 } };
  root.add(cg);
  root.add(rg);
  const rr = createRenderRoot({ width: 14, height: 3 }, { caps });
  rr.mount(root);

  rr.setRevealAccelerators(true);
  rr.flush();
  expect(underlined(findChar(rr.buffer(), 'Y'))).toBe(true); // CheckGroup hot glyph
  expect(underlined(findChar(rr.buffer(), 'R'))).toBe(true); // RadioGroup hot glyph
});
