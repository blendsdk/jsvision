/**
 * Compatibility requirements for Datagrid's equal-width action rows.
 *
 * Datagrid may delegate these helpers to the shared UI contract, but existing callers retain the
 * historical one-cell gap, widest-natural-face width, and cross-row reuse behavior.
 */
import { expect, test } from 'vitest';
import { Button, createRenderRoot, Group, resolveCapabilities } from '@jsvision/ui';
import { buttonCellWidth, buttonRow, buttonRowMinWidth } from '../src/button-row.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Solve a Datagrid action row in a vertical host without overriding its own two-row height. */
function solve(row: Group, width: number): void {
  const host = new Group();
  host.setLayout({ direction: 'col', position: 'absolute', rect: { x: 0, y: 0, width, height: 2 } });
  host.add(row);
  const render = createRenderRoot({ width, height: 2 }, { caps });
  render.mount(host);
  render.flush();
}

test('retains zero metrics for an empty Datagrid action row', () => {
  expect(buttonCellWidth([])).toBe(0);
  expect(buttonRowMinWidth([])).toBe(0);
});

test('retains the widest natural Button face and historical one-cell gaps', () => {
  const short = new Button('OK');
  const long = new Button('Select All');
  const third = new Button('Apply');

  expect(buttonCellWidth([short, long, third])).toBe(long.measure().width);
  expect(buttonRowMinWidth([short, long, third])).toBe(long.measure().width * 3 + 2);
});

test('retains one explicit complete-group width across separate rows', () => {
  const all = ['Save', 'Apply', 'Delete', 'Set Default', 'Reset'].map((label) => new Button(label));
  const shared = buttonCellWidth(all);
  const first = buttonRow(all.slice(0, 3), shared);
  const second = buttonRow(all.slice(3), shared);

  solve(first, shared * 3 + 2);
  solve(second, shared * 2 + 1);

  expect(all.map((button) => button.bounds.width)).toEqual(Array(5).fill(shared));
  expect(first.bounds.height).toBe(2);
  expect(second.bounds.height).toBe(2);
});
