/**
 * Specification tests (immutable oracles) — the app shell's root composition contract.
 *
 * `createApplication` assembles a top-to-bottom column from optional chrome, a body, and a
 * full-screen popup overlay. Three things about that assembly are contract rather than accident,
 * and none of them had a test before this file:
 *
 * 1. The exact child list of the root, across every combination of optional chrome — four other
 *    suites locate the overlay by scanning `root.children` for `position: 'absolute'`, which only
 *    works while the overlay is a *direct* child.
 * 2. The chrome rows solve to exactly one cell high.
 * 3. `opts.content`'s own layout is deliberately **discarded**, not merged — the shell governs the
 *    body's sizing no matter what the caller set.
 *
 * Every assertion carries a non-vacuity clause (an exact count, or a non-zero solved rect) so a
 * mis-targeted lookup fails loudly instead of passing against an empty list.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import type { MenuBar } from '../src/menu/index.js';
import { statusLine, statusItem, Commands } from '../src/status/index.js';
import type { StatusLine } from '../src/status/index.js';
import { Button } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const viewport = { width: 40, height: 12 };

/** A plain focusable-free content view, so `content.parent` reaches the root. */
class Body extends Group {
  draw(_ctx: DrawContext): void {}
}

function bar(): MenuBar {
  return menuBar([subMenu('~F~ile', [item('E~x~it', Commands.quit)])]);
}
function status(): StatusLine {
  return statusLine([statusItem('~Q~uit', Commands.quit, 'Alt+X')]);
}

/** The root group of a composed, flushed app, reached through the body the caller passed in. */
function rootOf(view: View): Group {
  const root = view.parent;
  if (root === undefined) throw new Error('the body was never mounted — no parent');
  return root as Group;
}

/** True when every rect in `views` has been solved to a non-zero area (the non-vacuity clause). */
function allSolved(views: readonly View[]): boolean {
  return views.every((v) => v.bounds.width > 0 && v.bounds.height > 0);
}

// ST-W1 — the root's child list, in order, for each shape of optional chrome. The overlay is always
// last (it paints over everything) and always a direct child.
test('ST-W1: the root children are exactly [menuBar?, body, statusLine?, overlay] in order', () => {
  // the full shape: both chrome rows present
  const menu = bar();
  const line = status();
  const content = new Body();
  const app = createApplication({ caps, viewport, menuBar: menu, content, statusLine: line });
  app.loop.renderRoot.flush();

  const root = rootOf(content);
  expect(root.children.length).toBe(4);
  // Identity per slot, not a deep compare: `toEqual` on a View walks a cyclic tree and would accept
  // a different-but-structurally-equal view in a slot.
  expect(root.children[0]).toBe(menu);
  expect(root.children[1]).toBe(content);
  expect(root.children[2]).toBe(line);
  // The overlay is characterized by what the shell writes on it, not by comparing it to itself.
  expect(root.children[3].layout.position).toBe('absolute');
  expect(root.children[3].state.visible).toBe(false);
  expect(allSolved([menu, content, line])).toBe(true);

  // content only
  const contentOnly = new Body();
  const appC = createApplication({ caps, viewport, content: contentOnly });
  appC.loop.renderRoot.flush();
  const rootC = rootOf(contentOnly);
  expect(rootC.children.length).toBe(2);
  expect(rootC.children[0]).toBe(contentOnly);
  expect(rootC.children[1].layout.position).toBe('absolute');
  expect(allSolved([contentOnly])).toBe(true);

  // menu bar + content, no status line
  const menuM = bar();
  const contentM = new Body();
  const appM = createApplication({ caps, viewport, menuBar: menuM, content: contentM });
  appM.loop.renderRoot.flush();
  const rootM = rootOf(contentM);
  expect(rootM.children.length).toBe(3);
  expect(rootM.children.slice(0, 2)).toEqual([menuM, contentM]);
  expect(rootM.children[2].layout.position).toBe('absolute');
  expect(allSolved([menuM, contentM])).toBe(true);

  // no options at all — the default Desktop becomes the body
  const appD = createApplication({ caps, viewport });
  appD.loop.renderRoot.flush();
  const rootD = rootOf(appD.desktop);
  expect(rootD.children.length).toBe(2);
  expect(rootD.children[0]).toBe(appD.desktop);
  expect(rootD.children[1].layout.position).toBe('absolute');
  expect(allSolved([appD.desktop])).toBe(true);
});

// ST-W1 — the chrome rows are pinned to a single cell, and the body takes the rest of the column.
test('ST-W1: the menu bar and status line each solve to exactly one row', () => {
  const menu = bar();
  const line = status();
  const content = new Body();
  const app = createApplication({ caps, viewport, menuBar: menu, content, statusLine: line });
  app.loop.renderRoot.flush();

  expect(menu.bounds.height).toBe(1);
  expect(line.bounds.height).toBe(1);
  expect(menu.bounds.width).toBe(viewport.width);
  expect(line.bounds.width).toBe(viewport.width);
  // the body absorbs the remaining rows — proves the chrome heights are pins, not a collapse
  expect(content.bounds.height).toBe(viewport.height - 2);
  expect(content.bounds.y).toBe(1);
});

// ST-W2 — the shell's Tab ring, as an explicit named list plus its exact length. This pins the set
// and order of focusables reachable through `content`, and that the chrome rows contribute none.
// (It would not, on its own, detect a non-focusable wrapper Group: tree-order traversal skips one.)
test('ST-W2: the app-shell focus ring visits the content views in tree order', () => {
  const content = new Body();
  const first = new Button('~O~ne', { command: 'one' });
  const second = new Button('~T~wo', { command: 'two' });
  content.add(first);
  content.add(second);

  const app = createApplication({ caps, viewport, menuBar: bar(), content, statusLine: status() });
  app.loop.renderRoot.flush();
  app.loop.focusView(first);

  const start = app.loop.getFocused();
  const ring: (View | null)[] = [start];
  for (let i = 0; i < 8; i++) {
    app.loop.focusNext();
    const current = app.loop.getFocused();
    if (current === start) break;
    ring.push(current);
  }

  expect(ring).toEqual([first, second]);
  expect(ring.length).toBe(2);
});

// ST-W4 — the body clobber contract. `createApplication` replaces `content.layout` wholesale; a
// caller's own descriptor is intentionally lost so the shell alone governs the body's sizing.
test('ST-W4: createApplication discards the caller layout on `content`', () => {
  const content = new Body();
  content.layout = { padding: 1, direction: 'row' };

  const app = createApplication({ caps, viewport, content });
  app.loop.renderRoot.flush();

  expect(content.layout).toEqual({ size: { kind: 'fr', weight: 1 } });
  expect(content.bounds.height).toBe(viewport.height); // no chrome — the body fills the column
});
