/**
 * Implementation tests — the RD-11 `attachModalHost` loop seam (PA-1).
 *
 * `execView` injects a {@link ModalHost} into a modal view **only** when the view opts in by
 * implementing `attachModalHost` (duck-typed). These tests pin both branches: a plain view is
 * untouched (no behaviour change to any existing `execView` caller), and an opting-in view receives
 * a working host whose `endModal` resolves the `execView` promise and whose `isCommandEnabled`
 * reflects the loop's command registry. Real `View`/loop, no mocks.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ModalHost, ModalHostAware } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A plain modal-content view that does NOT opt into the modal-host seam. */
class PlainView extends View {
  draw(_ctx: DrawContext): void {}
}

/**
 * A view that opts into the modal-host seam and records the host it is handed. The field is named
 * `modalHost` (not `host`) to avoid shadowing `View`'s internal `host: ViewHost` render-root seam.
 */
class HostAwareView extends View implements ModalHostAware {
  modalHost: ModalHost | null = null;
  attachModalHost(host: ModalHost): void {
    this.modalHost = host;
  }
  draw(_ctx: DrawContext): void {}
}

function loopWith(view: View): ReturnType<typeof createEventLoop> {
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: 30, height: 10 }, { caps });
  loop.mount(root);
  return loop;
}

// PA-1 — a non-`ModalHostAware` view is opened without any attempt to attach a host (no new field,
// no thrown error): `execView` behaves exactly as before.
test('PA-1: execView does not attach a modal host to a plain view', () => {
  const plain = new PlainView();
  const loop = loopWith(plain);
  // The plain view does not opt in — the loop must not treat it as modal-host-aware.
  expect('attachModalHost' in plain).toBe(false);
  // execView still opens + resolves normally (no thrown error from the duck-typed guard).
  const promise = loop.execView<string>(plain);
  loop.endModal('done');
  return expect(promise).resolves.toBe('done');
});

// PA-1 — an opting-in view receives a host whose `endModal` resolves this very `execView`.
test('PA-1: attachModalHost.endModal resolves the execView promise', async () => {
  const view = new HostAwareView();
  const loop = loopWith(view);
  const promise = loop.execView<string>(view);
  expect(view.modalHost).not.toBeNull();
  view.modalHost?.endModal('accepted');
  await expect(promise).resolves.toBe('accepted');
});

// PA-1 — the injected `isCommandEnabled` reflects the loop's command registry.
test('PA-1: attachModalHost.isCommandEnabled reflects the loop registry', () => {
  const view = new HostAwareView();
  const loop = loopWith(view);
  loop.execView<string>(view);
  expect(view.modalHost?.isCommandEnabled('ok')).toBe(true); // unregistered ⇒ enabled by default (PA-3)
  loop.enableCommand('ok', false);
  expect(view.modalHost?.isCommandEnabled('ok')).toBe(false);
  loop.endModal('x');
});
