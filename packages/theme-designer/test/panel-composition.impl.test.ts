/**
 * Composition witnesses for the designer's three-pane workspace.
 *
 * Everything is asserted against the **real** app tree built by `createDesignerApp`, not against a
 * panel mounted standalone. A witness must observe the composition the app actually produces: the
 * workspace row in `app.ts` and each builder's own stacking are separate decisions, and only the
 * assembled tree shows what they add up to. Mounting a panel alone would test one half of that and
 * silently miss the other.
 *
 * Every rect is a literal captured from a solved layout, and the layout is flushed before any
 * `bounds` is read: `bounds` refreshes only on a layout pass, so reading early captures `{0,0,0,0}`
 * and would bake the zeros in as the expected rect. Relationships between two solved values are
 * avoided — they hold when both collapse to zero, which is the failure being guarded against.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, describe } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '@jsvision/ui';
import type { View } from '@jsvision/ui';

import { createDesignerApp } from '../src/app.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const viewport = { width: 90, height: 30 };

/** Build the real app at a fixed viewport and return its solved workspace row. */
function solvedWorkspace(): Group {
  const da = createDesignerApp({ caps, viewport, requireTty: false });
  da.app.loop.renderRoot.flush();
  const desktop = da.app.desktop;
  if (desktop === undefined) throw new Error('the designer app no longer builds a desktop');
  const workspace = desktop.children.find((child): child is Group => child instanceof Group);
  if (workspace === undefined) throw new Error('the designer app no longer adds a workspace group to its desktop');
  return workspace;
}

/** Assert a solved rect is real geometry — the guard against recording an unsolved view. */
function expectSolved(view: View): void {
  expect(view.bounds.width, 'width collapsed — the layout was read before it was solved').toBeGreaterThan(0);
  expect(view.bounds.height, 'height collapsed — the layout was read before it was solved').toBeGreaterThan(0);
}

describe('the designer workspace', () => {
  test('the roles panel stacks its list under its title', () => {
    const [rail] = solvedWorkspace().children as [Group, Group, Group];

    expect(rail.background).toBe('dialog');
    expect(rail.children).toHaveLength(2);
    const [title, list] = rail.children as [View, View];
    expectSolved(title);
    expectSolved(list);

    // Vertical stacking: were the panel to flow as a row, the title would take a slice of the width
    // and the list would sit beside it rather than beneath.
    expect(title.bounds).toEqual({ x: 0, y: 0, width: 28, height: 1 });
    expect(list.bounds).toEqual({ x: 0, y: 1, width: 28, height: 27 });
  });

  test('the preview panel stacks its scroller under its title', () => {
    const [, preview] = solvedWorkspace().children as [Group, Group, Group];

    expect(preview.children).toHaveLength(2);
    const [title, scroller] = preview.children as [View, View];
    expectSolved(title);
    expectSolved(scroller);

    expect(title.bounds).toEqual({ x: 0, y: 0, width: 30, height: 1 });
    expect(scroller.bounds).toEqual({ x: 0, y: 1, width: 30, height: 27 });
  });

  test('the workspace lays its three panes out across the full width', () => {
    const workspace = solvedWorkspace();

    expect(workspace.children).toHaveLength(3);
    const [rail, preview, inspector] = workspace.children as [Group, Group, Group];
    for (const pane of [rail, preview, inspector]) expectSolved(pane);

    expect(rail.bounds).toEqual({ x: 0, y: 0, width: 28, height: 28 }); // fixed rail
    expect(preview.bounds).toEqual({ x: 28, y: 0, width: 30, height: 28 }); // fills what is left
    expect(inspector.bounds).toEqual({ x: 58, y: 0, width: 32, height: 28 }); // fixed inspector
  });
});
