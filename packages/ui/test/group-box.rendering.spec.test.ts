/**
 * Immutable GroupBox rendering specifications.
 *
 * These tests describe the public frame, caption, safety, theme, and reactive-lifecycle contract.
 * They intentionally use real buffers and render roots so clipping and terminal-cell behavior are
 * verified at the same boundary consumers use.
 */
import { expect, test } from 'vitest';
import { ScreenBuffer, defaultTheme, nordTheme, resolveCapabilities } from '@jsvision/core';
import type { Theme } from '@jsvision/core';
import { GroupBox } from '../src/group-box/index.js';
import { signal } from '../src/reactive/index.js';
import { Group, createRenderRoot, makeDrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function rowText(buffer: ScreenBuffer, y: number, width: number): string {
  let text = '';
  for (let x = 0; x < width; x += 1) text += buffer.get(x, y)?.char ?? '';
  return text;
}

function renderBox(
  options: ConstructorParameters<typeof GroupBox>[0] = {},
  width = 14,
  height = 4,
  theme: Theme = defaultTheme,
) {
  const box = new GroupBox(options);
  box.setLayout({ position: 'fill' });
  const root = new Group();
  root.add(box);
  const renderRoot = createRenderRoot({ width, height }, { caps, theme });
  renderRoot.mount(root);
  return { box, renderRoot, buffer: renderRoot.buffer() };
}

test('paints an opaque single-line frame with one theme role', () => {
  const { buffer } = renderBox();

  expect(rowText(buffer, 0, 14)).toBe('┌────────────┐');
  expect(rowText(buffer, 3, 14)).toBe('└────────────┘');
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 14; x += 1) {
      const cell = buffer.get(x, y);
      expect(cell?.fg).toBe(defaultTheme.staticText.fg);
      expect(cell?.bg).toBe(defaultTheme.staticText.bg);
    }
  }
  expect(rowText(buffer, 1, 14)).toBe('│            │');
});

test('leaves the top border uninterrupted for omitted, empty, or sanitized-empty titles', () => {
  const noTitle = renderBox().buffer;
  const empty = renderBox({ title: '' }).buffer;
  const unsafeOnly = renderBox({ title: '\u001b\\\u0007' }).buffer;

  expect(rowText(empty, 0, 14)).toBe(rowText(noTitle, 0, 14));
  expect(rowText(unsafeOnly, 0, 14)).toBe(rowText(noTitle, 0, 14));
});

test.each([
  ['start', '┌ A ─────────┐'],
  ['center', '┌──── A ─────┐'],
  ['end', '┌───────── A ┐'],
] as const)('aligns a decorated caption at %s by display cells', (titleAlignment, expected) => {
  const { buffer } = renderBox({ title: 'A', titleAlignment });
  expect(rowText(buffer, 0, 14)).toBe(expected);
});

test('uses paired decoration only when the full title and both spaces fit', () => {
  expect(rowText(renderBox({ title: 'AB' }, 6, 3).buffer, 0, 6)).toBe('┌ AB ┐');
  expect(rowText(renderBox({ title: 'ABCDE' }, 6, 3).buffer, 0, 6)).toBe('┌ABCD┐');
});

test.each(['start', 'center', 'end'] as const)(
  'preserves the same leading prefix without ellipsis when %s-aligned text is clipped',
  (titleAlignment) => {
    const { buffer } = renderBox({ title: 'ABCDEFGHI', titleAlignment }, 7, 3);
    expect(rowText(buffer, 0, 7)).toBe('┌ABCDE┐');
  },
);

test('clips wide and combining captions without splitting or corrupting adjacent cells', () => {
  const wide = renderBox({ title: '界界界' }, 7, 3).buffer;
  const combining = renderBox({ title: 'e\u0301x' }, 8, 3).buffer;

  expect(rowText(wide, 0, 7)).toBe('┌界界─┐');
  expect(wide.get(5, 0)?.char).toBe('─');
  expect(combining.get(2, 0)?.char).toBe('e\u0301');
  expect(combining.get(3, 0)?.char).toBe('x');
});

test('uses one sanitized single-line value for geometry and drawing', () => {
  const control = renderBox({ title: 'A\u001b\\B', titleAlignment: 'end' }, 10, 3).buffer;
  const multiline = renderBox({ title: 'A\tB\nC', titleAlignment: 'center' }, 12, 3).buffer;

  expect(rowText(control, 0, 10)).toBe('┌──── AB ┐');
  expect(rowText(multiline, 0, 12)).toBe('┌─ A B C ──┐');
});

test.each([
  [0, 0],
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
] as const)('handles tiny %d×%d bounds without painting outside them', (width, height) => {
  const buffer = new ScreenBuffer(4, 4, { fg: 'white', bg: 'blue' });
  const viewRect = { x: 1, y: 1, width, height };
  const ctx = makeDrawContext(buffer, viewRect, viewRect, defaultTheme, caps);

  expect(() => new GroupBox({ title: 'wide title' }).draw(ctx)).not.toThrow();
  expect(buffer.get(0, 0)?.bg).toBe('blue');
  expect(buffer.get(3, 3)?.bg).toBe('blue');
  if (width > 0 && height > 0) expect(buffer.get(1, 1)?.bg).toBe(defaultTheme.staticText.bg);
});

test('honors an ancestor clip for fill, frame, and caption writes', () => {
  const buffer = new ScreenBuffer(10, 4, { fg: 'white', bg: 'blue' });
  const viewRect = { x: 1, y: 0, width: 8, height: 4 };
  const clip = { x: 3, y: 1, width: 4, height: 2 };
  const ctx = makeDrawContext(buffer, viewRect, clip, defaultTheme, caps);

  new GroupBox({ title: 'caption' }).draw(ctx);

  expect(buffer.get(2, 1)?.bg).toBe('blue');
  expect(buffer.get(3, 1)?.bg).toBe(defaultTheme.staticText.bg);
  expect(buffer.get(6, 2)?.bg).toBe(defaultTheme.staticText.bg);
  expect(buffer.get(7, 2)?.bg).toBe('blue');
});

test('repaints getter titles and disposes their subscription while unmounted', () => {
  const title = signal('First');
  const box = new GroupBox({ title });
  box.setLayout({ position: 'fill' });
  const root = new Group();
  root.add(box);
  let scheduled = 0;
  const renderRoot = createRenderRoot({ width: 14, height: 4 }, { caps, schedule: () => (scheduled += 1) });
  renderRoot.mount(root);

  scheduled = 0;
  title.set('Second');
  expect(scheduled).toBe(1);
  renderRoot.flush();
  expect(rowText(renderRoot.buffer(), 0, 14)).toContain('Second');

  root.remove(box);
  renderRoot.flush();
  scheduled = 0;
  title.set('Detached');
  expect(scheduled).toBe(0);
});

test('re-establishes exactly one getter subscription when the same box is re-added', () => {
  const title = signal('First');
  const box = new GroupBox({ title });
  box.setLayout({ position: 'fill' });
  const root = new Group();
  root.add(box);
  let scheduled = 0;
  const renderRoot = createRenderRoot({ width: 14, height: 4 }, { caps, schedule: () => (scheduled += 1) });
  renderRoot.mount(root);

  root.remove(box);
  renderRoot.flush();
  root.add(box);
  renderRoot.flush();
  scheduled = 0;
  title.set('Remounted');

  expect(scheduled).toBe(1);
  renderRoot.flush();
  expect(rowText(renderRoot.buffer(), 0, 14)).toContain('Remounted');
});

test('resolves the configured role on every draw and reflects theme replacement', () => {
  const custom: Theme = {
    ...defaultTheme,
    labelSelected: { ...defaultTheme.labelSelected, fg: '#111111', bg: '#eeeeee' },
  };
  const { box, renderRoot } = renderBox({ title: 'Role', role: 'labelSelected' }, 12, 3, custom);
  expect(renderRoot.buffer().get(0, 0)?.bg).toBe('#eeeeee');

  const replacement: Theme = {
    ...nordTheme,
    labelSelected: { ...nordTheme.labelSelected, fg: '#ffffff', bg: '#123456' },
  };
  const origin = renderRoot.originOf(box);
  renderRoot.setTheme(replacement);
  renderRoot.flush();

  expect(renderRoot.buffer().get(0, 0)?.bg).toBe('#123456');
  expect(renderRoot.buffer().get(3, 0)?.bg).toBe('#123456');
  expect(renderRoot.originOf(box)).toEqual(origin);
});
