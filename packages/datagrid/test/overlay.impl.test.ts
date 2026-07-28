/**
 * Implementation tests — `absoluteRect`'s parent-chain walk and overlay re-mounting.
 */
import { test, expect } from 'vitest';
import { Group, View, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { absoluteRect, mountCellOverlay } from '../src/overlay.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

class Box extends View {
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('staticText'));
  }
}

/** A popup-like box whose intrinsic size changes reactively after it is mounted. */
class DesiredBox extends Box {
  readonly desired = signal({ width: 6, height: 2 });

  desiredSize(): { readonly width: number; readonly height: number } {
    return this.desired();
  }
}

test('should sum parent-relative bounds up the tree', () => {
  const root = new Group();
  const mid = new Group();
  const leaf = new Box();
  root.bounds = { x: 1, y: 2, width: 10, height: 10 };
  mid.bounds = { x: 3, y: 4, width: 5, height: 5 };
  leaf.bounds = { x: 2, y: 1, width: 2, height: 1 };
  root.add(mid);
  mid.add(leaf);
  expect(absoluteRect(leaf)).toEqual({ x: 1 + 3 + 2, y: 2 + 4 + 1 });
});

test('should allow re-mounting a view after dispose', () => {
  const host = new Group();
  const render = createRenderRoot({ width: 10, height: 4 }, { caps });
  render.mount(host);
  const loop = { focusView: (): void => undefined };
  const view = new Box();

  const dispose1 = mountCellOverlay({
    host,
    loop,
    rect: { x: 0, y: 0, width: 4, height: 1 },
    origin: { x: 0, y: 0 },
    view,
  });
  expect(host.children).toContain(view);
  dispose1();
  expect(host.children).not.toContain(view);

  const dispose2 = mountCellOverlay({
    host,
    loop,
    rect: { x: 1, y: 0, width: 4, height: 1 },
    origin: { x: 0, y: 0 },
    view,
  });
  expect(host.children).toContain(view);
  expect(view.layout).toEqual({ position: 'absolute', rect: { x: 1, y: 0, width: 4, height: 1 } });
  dispose2();
  expect(host.children).not.toContain(view);
});

test('should re-clamp reactive desired geometry and dispose the sizing effect with the overlay', () => {
  const host = new Group();
  const render = createRenderRoot({ width: 12, height: 6 }, { caps });
  render.mount(host);
  const view = new DesiredBox();
  const dispose = mountCellOverlay({
    host,
    loop: { focusView: (): void => undefined },
    rect: { x: 9, y: 4, width: 6, height: 2 },
    origin: { x: 0, y: 0 },
    view,
    clamp: { width: 12, height: 6 },
  });
  render.flush();
  expect(view.bounds).toEqual({ x: 6, y: 4, width: 6, height: 2 });

  view.desired.set({ width: 20, height: 9 });
  render.flush();
  expect(view.bounds).toEqual({ x: 0, y: 0, width: 12, height: 6 });

  dispose();
  const layoutAfterDispose = view.layout.rect;
  view.desired.set({ width: 1, height: 1 });
  render.flush();
  expect(host.children).not.toContain(view);
  expect(view.layout.rect).toEqual(layoutAfterDispose);
});

test('should floor invalid non-integer desired geometry at zero cells', () => {
  const host = new Group();
  const render = createRenderRoot({ width: 12, height: 6 }, { caps });
  render.mount(host);
  const view = new DesiredBox();
  view.desired.set({ width: Number.NaN, height: -2 });

  mountCellOverlay({
    host,
    loop: { focusView: (): void => undefined },
    rect: { x: 2, y: 1, width: 6, height: 2 },
    origin: { x: 0, y: 0 },
    view,
    clamp: { width: 12, height: 6 },
  });
  render.flush();

  expect(view.bounds).toEqual({ x: 2, y: 1, width: 0, height: 0 });
});
