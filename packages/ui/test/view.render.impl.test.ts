/**
 * Implementation tests — render root + compose walker (internals & edges; 07 §impl).
 *
 * Background showing under uncovered cells, per-view error isolation (one log per throwing view,
 * siblings continue), and resize → reflow → recompose.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, createLogger } from '@jsvision/core';
import { View, Group, createRenderRoot, themeRoleToStyle } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class PaintView extends View {
  constructor(private readonly ch: string) {
    super();
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch);
  }
}

class ThrowView extends View {
  draw(): void {
    throw new Error('boom');
  }
}

test('a Group background shows under cells a child does not cover', () => {
  const child = new PaintView('X');
  child.setLayout({ size: { kind: 'fixed', cells: 2 } });
  const root = new Group();
  root.setLayout({ direction: 'row' });
  root.background = 'window';
  root.add(child);

  const rr = createRenderRoot({ width: 6, height: 2 }, { caps });
  rr.mount(root);

  const buf = rr.buffer();
  const windowBg = themeRoleToStyle(defaultTheme.window).bg;
  expect(buf.get(0, 0)?.char).toBe('X'); // child covers cols 0..1
  expect(buf.get(2, 0)?.bg).toBe(windowBg); // background under an uncovered cell
  expect(buf.get(5, 1)?.bg).toBe(windowBg); // background under the far corner
});

test('each throwing draw() logs once; siblings still render', () => {
  const bad1 = new ThrowView();
  bad1.setLayout({ size: { kind: 'fixed', cells: 2 } });
  const good = new PaintView('G');
  good.setLayout({ size: { kind: 'fixed', cells: 2 } });
  const bad2 = new ThrowView();
  bad2.setLayout({ size: { kind: 'fixed', cells: 2 } });

  const root = new Group();
  root.setLayout({ direction: 'row' });
  root.add(bad1);
  root.add(good);
  root.add(bad2);

  const logger = createLogger({ sink: 'ring' });
  const rr = createRenderRoot({ width: 6, height: 1 }, { caps, logger });
  rr.mount(root);

  expect(logger.entries().length).toBe(2); // one log per throwing view (single flush)
  expect(rr.buffer().get(2, 0)?.char).toBe('G'); // the good sibling (cols 2..3) rendered
});

test('resize reflows and recomposes to the new viewport', () => {
  const a = new PaintView('#');
  a.setLayout({ size: { kind: 'fr', weight: 1 } });
  const root = new Group();
  root.setLayout({ direction: 'row' });
  root.add(a);

  const rr = createRenderRoot({ width: 4, height: 1 }, { caps });
  rr.mount(root);
  expect(a.bounds.width).toBe(4);

  rr.resize({ width: 8, height: 1 });
  rr.flush(); // resize schedules asynchronously; force a synchronous frame
  expect(a.bounds.width).toBe(8); // reflowed to the new viewport
  expect(rr.buffer().get(7, 0)?.char).toBe('#'); // recomposed across the wider buffer
});
