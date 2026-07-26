/**
 * Public requirements for equal-width translated Button groups.
 *
 * These expectations describe the terminal-cell contract only. They deliberately avoid relying on
 * private layout metadata so the implementation may evolve without weakening the public behavior.
 */
import { expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import {
  at,
  Button,
  buttonColumn,
  buttonGroup,
  col,
  createEventLoop,
  createRenderRoot,
  Group,
  measureButtonGroup,
  row,
} from '../src/index.js';
import type { View } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Return every descendant in stable tree order. */
function descendants(view: View): readonly View[] {
  const children = view instanceof Group ? view.children : [];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Mount a composed group at its reported intrinsic extent and solve one layout frame. */
function solve(group: Group, width: number, height: number): ReturnType<typeof createRenderRoot> {
  const root = new Group();
  root.add(at(group, 0, 0, width, height));
  const render = createRenderRoot({ width, height }, { caps });
  render.mount(root);
  render.flush();
  return render;
}

/** Build one normalized key event for real event-loop interaction checks. */
function key(name: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Convert a zero-based buffer cell to the event protocol's one-based mouse coordinate. */
function mouse(kind: 'down' | 'up', x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

test('reports zero geometry for an empty logical action group', () => {
  // An empty group has no button, gap, row, or column extent.
  expect(measureButtonGroup([])).toEqual({
    buttonWidth: 0,
    columnCount: 0,
    rowCount: 0,
    width: 0,
    height: 0,
  });
});

test('uses the configured minimum or widest natural face for every sibling', () => {
  // The natural Button measurement already owns accelerator removal, face padding, and shadow width.
  const ok = new Button('~O~K');
  const cancel = new Button('~C~ancel');
  const minimum = measureButtonGroup([ok, cancel], { minimumButtonWidth: 14, gap: 2 });
  const natural = measureButtonGroup([ok, cancel], { minimumButtonWidth: 4, gap: 2 });

  expect(minimum).toEqual({
    buttonWidth: 14,
    columnCount: 2,
    rowCount: 1,
    width: 30,
    height: 2,
  });
  expect(natural.buttonWidth).toBe(cancel.measure().width);
  expect(natural.width).toBe(cancel.measure().width * 2 + 2);
});

test('measures accelerators, wide glyphs, and combining sequences in renderer display cells', () => {
  // Tilde markup consumes no cells, CJK glyphs consume two cells, and a combining mark adds no cell.
  const accelerator = new Button('~O~K');
  const wide = new Button('~選~択');
  const combining = new Button('~E\u0301~dit');
  const metrics = measureButtonGroup([accelerator, wide, combining]);

  expect(accelerator.measure().width).toBe(6);
  expect(wide.measure().width).toBe(8);
  expect(combining.measure().width).toBe(8);
  expect(metrics.buttonWidth).toBe(8);
});

test('reports deterministic row-major wrapping with one width across every row', () => {
  // A five-action group constrained to three columns keeps one complete-group width in its 3/2 split.
  const buttons = ['Save', 'Apply', 'Delete', 'Set Default', 'Reset'].map((text) => new Button(text));
  const metrics = measureButtonGroup(buttons, { gap: 1, rowGap: 1, maxColumns: 3 });
  const group = buttonGroup(buttons, { gap: 1, rowGap: 1, maxColumns: 3 });

  expect(metrics).toEqual({
    buttonWidth: buttons[3].measure().width,
    columnCount: 3,
    rowCount: 2,
    width: buttons[3].measure().width * 3 + 2,
    height: 5,
  });

  const render = solve(group, metrics.width, metrics.height);
  const composed = descendants(group).filter((view): view is Button => view instanceof Button);
  expect(composed).toEqual(buttons);
  expect(composed.map((button) => button.bounds.width)).toEqual(Array(5).fill(metrics.buttonWidth));
  expect(composed.slice(0, 3).map((button) => render.originOf(button)?.y)).toEqual([0, 0, 0]);
  expect(composed.slice(3).map((button) => render.originOf(button)?.y)).toEqual([3, 3]);

  const rows = group.children as Group[];
  const finalWidths = rows[1].children.map((cell) => cell.bounds.width);
  expect(Math.abs(finalWidths[0] - finalWidths[1])).toBeLessThanOrEqual(1);
  const finalOrigins = composed.slice(3).map((button) => render.originOf(button)?.x);
  expect(finalOrigins).toEqual([
    Math.floor((finalWidths[0] - metrics.buttonWidth) / 2),
    rows[1].children[1].bounds.x + Math.floor((finalWidths[1] - metrics.buttonWidth) / 2),
  ]);
});

test('distributes extra host width across equal cells and keeps every Button centered', () => {
  const buttons = [new Button('OK'), new Button('A much longer action'), new Button('Cancel')];
  const metrics = measureButtonGroup(buttons, { gap: 1 });
  const group = buttonGroup(buttons, { gap: 1 });
  const render = solve(group, metrics.width + 11, metrics.height);

  const cellWidths = group.children.map((cell) => cell.bounds.width);
  expect(Math.max(...cellWidths) - Math.min(...cellWidths)).toBeLessThanOrEqual(1);
  expect(cellWidths.reduce((total, width) => total + width, 0)).toBe(metrics.width + 9);
  for (let index = 0; index < buttons.length; index += 1) {
    const cell = group.children[index];
    const origin = render.originOf(buttons[index]);
    expect(origin).not.toBeNull();
    const lead = (origin?.x ?? 0) - cell.bounds.x;
    const trail = cell.bounds.x + cell.bounds.width - ((origin?.x ?? 0) + buttons[index].bounds.width);
    expect(Math.abs(lead - trail)).toBeLessThanOrEqual(1);
  }
});

test('composes a vertical action column with one width and stable source order', () => {
  const buttons = [new Button('Open'), new Button('Very Long Action'), new Button('Cancel')];
  const metrics = measureButtonGroup(buttons, { gap: 1, maxColumns: 1 });
  const column = buttonColumn(buttons, { gap: 1 });

  expect(metrics.columnCount).toBe(1);
  expect(metrics.rowCount).toBe(3);
  expect(metrics.width).toBe(metrics.buttonWidth);
  expect(metrics.height).toBe(8);

  const render = solve(column, metrics.width, metrics.height);
  const composed = descendants(column).filter((view): view is Button => view instanceof Button);
  expect(composed).toEqual(buttons);
  expect(composed.map((button) => button.bounds.width)).toEqual(Array(3).fill(metrics.buttonWidth));
  expect(composed.map((button) => render.originOf(button)?.y)).toEqual([0, 3, 6]);
});

test('keeps intrinsic geometry when composed inside horizontal and vertical flow parents', () => {
  const columnButtons = [new Button('Open'), new Button('Long translated action')];
  const columnMetrics = measureButtonGroup(columnButtons, { gap: 1, maxColumns: 1 });
  const column = buttonColumn(columnButtons, { gap: 1 });
  const horizontalHost = row(column);
  const horizontalRender = solve(horizontalHost, 60, columnMetrics.height);

  expect(column.bounds.width).toBe(columnMetrics.width);
  expect(column.bounds.height).toBe(columnMetrics.height);
  expect(columnButtons.map((button) => horizontalRender.originOf(button)?.y)).toEqual([0, 3]);

  const rowButtons = [new Button('Save'), new Button('Cancel')];
  const rowMetrics = measureButtonGroup(rowButtons, { gap: 1 });
  const actionRow = buttonGroup(rowButtons, { gap: 1 });
  const verticalHost = col(actionRow);
  const verticalRender = solve(verticalHost, rowMetrics.width, 8);

  expect(actionRow.bounds.width).toBe(rowMetrics.width);
  expect(actionRow.bounds.height).toBe(rowMetrics.height);
  expect(rowButtons.map((button) => verticalRender.originOf(button)?.y)).toEqual([0, 0]);
});

test('preserves source-order focus, keyboard activation, and accelerators after wrapping', () => {
  const activations: string[] = [];
  const labels = ['~S~ave', '~A~pply', '~D~elete', 'Set ~D~efault', '~R~eset'];
  const buttons = labels.map((label) => new Button(label, { onClick: () => activations.push(label) }));
  const metrics = measureButtonGroup(buttons, { gap: 1, rowGap: 1, maxColumns: 3 });
  const root = new Group();
  root.add(at(buttonGroup(buttons, { gap: 1, rowGap: 1, maxColumns: 3 }), 0, 0, metrics.width, metrics.height));
  const loop = createEventLoop({ width: metrics.width, height: metrics.height }, { caps });
  loop.mount(root);

  for (const button of buttons) {
    loop.focusNext();
    expect(loop.getFocused()).toBe(button);
    loop.dispatch(key('space'));
  }
  expect(activations).toEqual(labels);

  loop.dispatch(key('r', { alt: true }));
  expect(activations.at(-1)).toBe('~R~eset');
});

test('keeps every action in the tree when an absolute caller imposes an infeasible bound', () => {
  // The explicit rect remains the hard bound; the normal render tree clips instead of dropping actions.
  const buttons = [new Button('Long translated action'), new Button('Cancel')];
  const group = buttonGroup(buttons, { minimumButtonWidth: 10, gap: 2 });

  solve(group, 12, 2);

  expect(group.bounds).toEqual({ x: 0, y: 0, width: 12, height: 2 });
  expect(descendants(group).filter((view) => view instanceof Button)).toEqual(buttons);
  expect(buttons.every((button) => button.focusable)).toBe(true);
});

test('clips pointer routing at a hard bound without losing focusable descendants', () => {
  const activations: string[] = [];
  const clippedButtons = [
    new Button('Long translated action', { onClick: () => activations.push('clipped-a') }),
    new Button('Cancel', { onClick: () => activations.push('clipped-b') }),
  ];
  const sibling = new Button('Next', { onClick: () => activations.push('sibling') });
  const root = new Group();
  root.add(at(buttonGroup(clippedButtons, { gap: 1 }), 0, 0, 12, 2));
  root.add(at(sibling, 12, 0, 8, 2));
  const loop = createEventLoop({ width: 20, height: 2 }, { caps });
  loop.mount(root);

  loop.dispatch(mouse('down', 14, 0));
  loop.dispatch(mouse('up', 14, 0));
  expect(activations).toEqual(['sibling']);

  loop.focusNext();
  expect(loop.getFocused()).toBe(clippedButtons[0]);
  loop.focusNext();
  expect(loop.getFocused()).toBe(clippedButtons[1]);
  loop.focusNext();
  expect(loop.getFocused()).toBe(sibling);
});
