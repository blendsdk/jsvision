/**
 * Specification tests (immutable oracles) — `TabView`'s content-layout contract.
 *
 * `Tab` and `TabViewOptions` are part of the package's public surface, so the content `Group` a
 * caller hands to a tab is a caller-owned view. `TabView` deliberately **replaces** that view's
 * layout rather than merging into it: the tab body governs how a page is sized, and any descriptor
 * the caller set — padding, a fixed size, a stacking direction — is discarded on mount.
 *
 * That discard is easy to mistake for an oversight when reading the source, so it is pinned here.
 * Softening it to a merge would silently change what a published API does to a caller's view.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A focusable leaf so the page has something real to lay out. */
class Leaf extends View {
  override focusable = true;
  draw(ctx: DrawContext): void {
    ctx.text(0, 0, 'x');
  }
}

/** Mount a `TabView` filling `w×h` and flush one frame, so page layouts are applied. */
function mount(view: TabView, w = 30, h = 10): void {
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
}

// ST-W3 — a caller's own layout on a tab's content view is replaced wholesale, not merged.
test('ST-W3: TabView discards the caller layout on a tab content view', () => {
  const content = new Group();
  content.add(new Leaf());
  content.layout = { padding: 2, size: { kind: 'fixed', cells: 3 } };

  const tabs = signal<Tab[]>([{ title: '~G~eneral', content }]);
  const view = new TabView({ tabs: () => tabs(), active: () => 0 });
  mount(view);

  // Exactly the shell's descriptor — the caller's `padding` AND `size` are both gone.
  expect(content.layout).toEqual({ size: { kind: 'fr', weight: 1 } });
  // Non-vacuity: the page really was laid out, so the assertion above is about a live view.
  expect(content.bounds.width).toBeGreaterThan(0);
  expect(content.bounds.height).toBeGreaterThan(0);
});
