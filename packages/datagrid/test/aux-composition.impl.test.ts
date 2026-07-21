/**
 * Implementation tests — the internal composition of the grid's auxiliary views.
 *
 * These characterize the *solved geometry* of three small view trees that had no structural
 * coverage: the command button row, the lifecycle placeholder shells, and the value-list popup's
 * section stack. Each is a flow container whose children's positions depend on properties that are
 * easy to lose when the composition is rewritten — a row's `gap`, a cell's `justify`, a shell's
 * stacking `direction` — and none of which any golden-screen or behavioral test pins today.
 *
 * They assert children's rects, not just the container's, because a container keeps its own bounds
 * even when its children flow the wrong way. Every case carries an exact child count so a
 * mis-targeted lookup fails rather than passing vacuously against an empty list.
 *
 * This is an implementation test by intent: it captures internal structure, which later layout work
 * may legitimately change.
 */
import { test, expect } from 'vitest';
import { Group, Button, View, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { buttonRow, buttonCellWidth } from '../src/button-row.js';
import { createLifecycleController } from '../src/grid-lifecycle.js';
import { ValueList } from '../src/value-list-popup.js';
import type { DistinctResult } from '../src/filter.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount `view` at an absolute `w × h` rect and solve one frame. */
function solve(view: View, w: number, h: number): void {
  view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(view);
  const render = createRenderRoot({ width: w, height: h }, { caps });
  render.mount(root);
  render.flush();
}

/**
 * Mount `view` as a flow child of a `w × h` column and solve one frame. Unlike {@link solve} this
 * leaves the view's own `size` in charge of its height — an absolute rect would override it, hiding
 * exactly the property under test.
 */
function solveInColumn(view: View, w: number, h: number): void {
  const root = new Group();
  root.setLayout({ direction: 'col', position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  root.add(view);
  const render = createRenderRoot({ width: w, height: h }, { caps });
  render.mount(root);
  render.flush();
}

/**
 * The value list's solved geometry at 24 x 14: the list row absorbs the column's slack, and the
 * checkbox list gives up its rightmost cell to the scroll bar. Stated as absolutes (parent-relative,
 * as `bounds` always is) so a collapsed list fails rather than satisfying a relation between zeroes.
 */
const LIST_ROW_HEIGHT = 9;
const LIST_RECT = { x: 0, y: 0, width: 23, height: LIST_ROW_HEIGHT };
const SCROLLBAR_RECT = { x: 23, y: 0, width: 1, height: LIST_ROW_HEIGHT };

/** Flush pending microtasks (the value list's async `distinct()` population resolves on one). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

// --- the command button row ------------------------------------------------------------------------

test('buttonRow lays its cells left-to-right, gapped, with each button centered in its cell', () => {
  const first = new Button('Select All', { onClick: () => undefined });
  const second = new Button('Apply', { onClick: () => undefined });
  const width = 10;
  const row = buttonRow([first, second], width);

  solveInColumn(row, 30, 6);

  expect(row.children.length).toBe(2); // one cell per button — non-vacuity
  expect(row.bounds.height).toBe(2); // a button face plus its shadow row, from the row's own size
  expect(row.bounds.width).toBe(30);

  const [cellA, cellB] = row.children as Group[];
  expect(cellA.children.length).toBe(1);
  expect(cellB.children.length).toBe(1);

  // Both buttons are forced to the shared cell width, not their own label widths.
  expect(first.bounds.width).toBe(width);
  expect(second.bounds.width).toBe(width);

  // Horizontal flow: the second cell starts after the first, and the row is not collapsed.
  expect(cellA.bounds.width).toBeGreaterThan(0);
  expect(cellB.bounds.x).toBeGreaterThan(cellA.bounds.x);
  expect(cellA.bounds.y).toBe(cellB.bounds.y);

  // The gap between cells: the second cell begins one cell past the first cell's right edge. This is
  // the assertion that catches a lost `gap` — without it the buttons simply shift left, silently.
  expect(cellB.bounds.x).toBe(cellA.bounds.x + cellA.bounds.width + 1);

  // Each button is centered in its own cell, not left-aligned against it.
  const leadA = first.bounds.x - cellA.bounds.x;
  const trailA = cellA.bounds.x + cellA.bounds.width - (first.bounds.x + first.bounds.width);
  expect(Math.abs(leadA - trailA)).toBeLessThanOrEqual(1);
  expect(leadA).toBeGreaterThan(0); // genuinely inset — proves centering, not a coincidental fit
});

test('buttonCellWidth sizes every button to the widest natural face', () => {
  const wide = new Button('Select All', { onClick: () => undefined });
  const narrow = new Button('OK', { onClick: () => undefined });
  const shared = buttonCellWidth([wide, narrow]);

  expect(shared).toBe(wide.measure().width);
  expect(shared).toBeGreaterThan(narrow.measure().width);
});

// --- the lifecycle placeholder shells --------------------------------------------------------------

test('the loading placeholder stacks its lead spacer above the spinner', () => {
  const lifecycle = createLifecycleController({ status: () => 'loading' });
  const shell = lifecycle.placeholder();
  expect(shell).not.toBeNull();

  solve(shell as View, 24, 8);
  const children = (shell as Group).children;
  expect(children.length).toBe(2); // the one-row lead + the spinner

  const [lead, spinner] = children;
  expect(lead.bounds.width).toBe(24); // full-width bands — an x-only check holds at width 0 too
  expect(spinner.bounds.width).toBe(24);
  expect(lead.bounds.height).toBe(1);
  // Vertical stacking: the spinner sits *below* the lead, at the same x. A shell that lost its
  // column direction would place them side by side instead.
  expect(spinner.bounds.y).toBe(lead.bounds.y + lead.bounds.height);
  expect(spinner.bounds.x).toBe(lead.bounds.x);
  expect(spinner.bounds.height).toBe(1);
});

test('the error placeholder stacks lead, message and Retry button top-to-bottom', () => {
  const lifecycle = createLifecycleController({
    status: () => ({ kind: 'error', message: 'boom', retry: () => undefined }),
  });
  const shell = lifecycle.placeholder();
  expect(shell).not.toBeNull();

  solve(shell as View, 24, 8);
  const children = (shell as Group).children;
  expect(children.length).toBe(3); // lead + message + Retry

  const [lead, message, retry] = children;
  for (const band of [lead, message, retry]) expect(band.bounds.width).toBe(24);
  expect(message.bounds.y).toBe(lead.bounds.y + lead.bounds.height);
  expect(retry.bounds.y).toBe(message.bounds.y + message.bounds.height);
  expect(message.bounds.x).toBe(retry.bounds.x); // stacked, not flowed sideways
  expect(message.bounds.height).toBe(1);
  expect(retry.bounds.height).toBe(2); // a content row plus the shadow row
});

test('the error placeholder omits the Retry button when no retry is offered', () => {
  const lifecycle = createLifecycleController({ status: () => ({ kind: 'error', message: 'boom' }) });
  const shell = lifecycle.placeholder() as Group;
  solve(shell, 24, 8);
  expect(shell.children.length).toBe(2); // lead + message only
});

// --- the value-list popup's section stack ----------------------------------------------------------

test('the value list stacks search label, input, list row, gap, controls and status', async () => {
  const list = new ValueList({
    distinct: (): Promise<DistinctResult> => Promise.resolve({ values: ['A', 'B', 'C'] }),
    onApply: () => undefined,
  });
  solve(list, 24, 14);
  await tick();

  expect(list.children.length).toBe(1); // one `inner` column fills the popup
  const inner = list.children[0] as Group;
  expect(inner.children.length).toBe(6); // label, input, list row, spacer, controls, status

  const [label, input, listRow, gap, controls, status] = inner.children;

  // The status row collapses once the values have loaded without truncation or error, so it takes no
  // part in the layout below — its rect is whatever it last solved to and must not be read.
  expect(status.state.visible).toBe(false);

  // Every laid-out section is a full-width band stacked in order, with no overlap and no gap.
  const bands = [label, input, listRow, gap, controls];
  for (const band of bands) expect(band.bounds.width).toBe(24);
  for (let i = 1; i < bands.length; i += 1) {
    expect(bands[i].bounds.y).toBe(bands[i - 1].bounds.y + bands[i - 1].bounds.height);
  }

  expect(label.bounds.y).toBe(0);
  expect(label.bounds.height).toBe(1);
  expect(input.bounds.height).toBe(1);
  expect(gap.bounds.height).toBe(1);
  expect(controls.bounds.height).toBe(2);
  expect(listRow.bounds.height).toBe(LIST_ROW_HEIGHT); // the list absorbs the slack

  // The list row itself flows horizontally: the checkbox list, then its one-cell scroll bar. These
  // are absolutes, not relations between the two — a relation like `scrollBar.x === list.x +
  // list.width` is an identity that holds even if both collapsed to zero, which is exactly the
  // failure this witness exists to catch.
  const rowChildren = (listRow as Group).children;
  expect(rowChildren.length).toBe(2);
  const [checkList, scrollBar] = rowChildren;
  expect(checkList.bounds).toEqual(LIST_RECT);
  expect(scrollBar.bounds).toEqual(SCROLLBAR_RECT);
});
