/**
 * Immutable GroupBox container specifications.
 *
 * These tests pin initial layout, normal Group composition, passive focus behavior, nesting, and
 * renderer-owned shadow behavior without inspecting GroupBox internals.
 */
import { expect, test } from 'vitest';
import { defaultTheme, resolveCapabilities } from '@jsvision/core';
import { Button } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { GroupBox } from '../src/group-box/index.js';
import { Group, View, createRenderRoot } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

class PaintView extends View {
  constructor(private readonly glyph = 'X') {
    super();
  }

  override draw(ctx: DrawContext): void {
    ctx.fill(this.glyph);
  }
}

test('uses only the documented defaults and remains passive', () => {
  const box = new GroupBox();
  const event: DispatchEvent = {
    event: { type: 'key', key: 'x', ctrl: false, alt: false, shift: false },
    handled: false,
  };

  expect(box.layout).toEqual({ padding: 1 });
  expect(box.castsShadow).toBe(false);
  expect(box.focusable).toBe(false);
  expect(box.preProcess).toBe(false);
  expect(box.postProcess).toBe(false);
  expect(box.acceleratorScope).toBe(false);
  expect(box.accelerators()).toEqual([]);
  box.onEvent(event);
  expect(event.handled).toBe(false);
});

test('accepts every option without changing unrelated Group layout properties', () => {
  const padding = { top: 1, right: 2, bottom: 3, left: 4 };
  const box = new GroupBox({
    title: () => 'Settings',
    titleAlignment: 'end',
    padding,
    role: 'labelSelected',
    shadow: true,
  });

  expect(box.layout).toEqual({ padding });
  expect(box.castsShadow).toBe(true);
  expect(box.background).toBeUndefined();
  expect(box.children).toEqual([]);
});

test.each([
  [2, { x: 2, y: 2, width: 8, height: 4 }],
  [
    { top: 1, right: 2, bottom: 3, left: 4 },
    { x: 4, y: 1, width: 6, height: 4 },
  ],
] as const)('applies configured padding to ordinary fill children', (padding, expectedBounds) => {
  const child = new PaintView();
  child.setLayout({ position: 'fill' });
  const box = new GroupBox({ padding });
  box.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 8 } });
  box.add(child);
  const root = new Group();
  root.add(box);

  const renderRoot = createRenderRoot({ width: 12, height: 8 }, { caps });
  renderRoot.mount(root);

  expect(child.bounds).toEqual(expectedBounds);
});

test('applies padding to absolute children through normal Group layout', () => {
  const child = new PaintView();
  child.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 3, height: 2 } });
  const box = new GroupBox({ padding: { top: 1, right: 1, bottom: 1, left: 3 } });
  box.setLayout({ position: 'fill' });
  box.add(child);
  const root = new Group();
  root.add(box);

  const renderRoot = createRenderRoot({ width: 14, height: 7 }, { caps });
  renderRoot.mount(root);

  expect(child.bounds).toEqual({ x: 5, y: 2, width: 3, height: 2 });
});

test('allows later setLayout calls to replace padding and set ordinary layout properties', () => {
  const box = new GroupBox({ padding: 2 });
  box.setLayout({ padding: 0, direction: 'col', gap: 2, justify: 'end', align: 'center' });

  expect(box.layout).toMatchObject({ padding: 0, direction: 'col', gap: 2, justify: 'end', align: 'center' });
});

test('nests boxes with independent frame bounds and content padding', () => {
  const inner = new GroupBox({ title: 'Inner', padding: 1 });
  inner.setLayout({ position: 'fill' });
  const outer = new GroupBox({ title: 'Outer', padding: 2 });
  outer.setLayout({ position: 'fill' });
  outer.add(inner);
  const root = new Group();
  root.add(outer);

  const renderRoot = createRenderRoot({ width: 18, height: 9 }, { caps });
  renderRoot.mount(root);

  expect(outer.bounds).toEqual({ x: 0, y: 0, width: 18, height: 9 });
  expect(inner.bounds).toEqual({ x: 2, y: 2, width: 14, height: 5 });
  expect(renderRoot.buffer().get(0, 0)?.char).toBe('┌');
  expect(renderRoot.buffer().get(2, 2)?.char).toBe('┌');
});

test('focus traversal enters descendants and never focuses the GroupBox caption', () => {
  const first = new Button('~F~irst');
  const second = new Button('~S~econd');
  const box = new GroupBox({ title: '~G~roup' });
  box.add(first);
  box.add(second);
  const sibling = new Button('~A~fter');
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(box);
  root.add(sibling);
  const loop = createEventLoop({ width: 30, height: 10 }, { caps });
  loop.mount(root);

  loop.focusNext();
  expect(loop.getFocused()).toBe(first);
  loop.focusNext();
  expect(loop.getFocused()).toBe(second);
  loop.focusNext();
  expect(loop.getFocused()).toBe(sibling);
  expect(box.state.focused).toBe(false);
  expect(box.accelerators()).toEqual([]);
});

test('uses the renderer standard shadow only when opted in', () => {
  const make = (shadow: boolean) => {
    const box = new GroupBox({ shadow });
    box.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 6, height: 3 } });
    const root = new Group();
    root.background = 'desktop';
    root.add(box);
    const renderRoot = createRenderRoot({ width: 12, height: 7 }, { caps });
    renderRoot.mount(root);
    return renderRoot;
  };

  expect(make(false).buffer().get(7, 2)?.bg).toBe(defaultTheme.desktop.bg);
  expect(make(true).buffer().get(7, 2)?.bg).toBe(defaultTheme.shadow.bg);
  expect(make(true).buffer().get(2, 4)?.bg).toBe(defaultTheme.shadow.bg);
});

test('clips a shadow at the parent edge without changing layout bounds', () => {
  const box = new GroupBox({ shadow: true });
  box.setLayout({ position: 'absolute', rect: { x: 4, y: 2, width: 6, height: 3 } });
  const root = new Group();
  root.add(box);
  const renderRoot = createRenderRoot({ width: 10, height: 5 }, { caps });

  expect(() => renderRoot.mount(root)).not.toThrow();
  expect(box.bounds).toEqual({ x: 4, y: 2, width: 6, height: 3 });
  expect(renderRoot.buffer().width).toBe(10);
  expect(renderRoot.buffer().height).toBe(5);
});
