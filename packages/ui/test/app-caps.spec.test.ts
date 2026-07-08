/**
 * Specification tests (immutable oracles) — zero-config capability resolution for `createApplication`.
 *
 * `ApplicationOptions.caps` is optional: absent or `'auto'` resolves to `resolveCapabilities().profile`;
 * an explicit profile is used verbatim. The concrete profile is observed through a probe view whose
 * `draw()` reads the render context's `caps` — the same profile the loop threaded into the render root
 * (so a stray `'auto'` string would surface here).
 *
 * Expectations derive from the requirements, never the implementation.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';

/** A leaf that captures the render context's resolved capability profile the first time it paints. */
class CapsProbe extends View {
  seen: CapabilityProfile | null = null;
  draw(ctx: DrawContext): void {
    this.seen = ctx.caps;
    ctx.fill(' ');
  }
}

/** Build an app around a probe, paint one frame, and return the capabilities the frame carried. */
function observeCaps(opts: Parameters<typeof createApplication>[0]): CapabilityProfile | null {
  const app = createApplication(opts);
  const probe = new CapsProbe();
  app.desktop.add(probe);
  app.loop.renderRoot.flush();
  return probe.seen;
}

// ST-1 — no caps: the loop/render-root receive a concrete profile equal to resolveCapabilities().profile.
test('should resolve auto-detected capabilities when caps is omitted', () => {
  const seen = observeCaps({ viewport: { width: 20, height: 6 } });
  expect(seen).not.toBeNull();
  expect(typeof seen).toBe('object'); // a real profile object, never the string 'auto'
  expect(seen).toEqual(resolveCapabilities().profile);
});

// ST-2 — caps: 'auto' behaves identically to omitting caps.
test('should resolve auto-detected capabilities when caps is auto', () => {
  const seen = observeCaps({ caps: 'auto', viewport: { width: 20, height: 6 } });
  expect(seen).toEqual(resolveCapabilities().profile);
});

// ST-3 — an explicit profile is honored verbatim, with no re-resolution.
test('should use an explicit capability profile verbatim', () => {
  const explicit = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
  const seen = observeCaps({ caps: explicit, viewport: { width: 20, height: 6 } });
  expect(seen).toBe(explicit); // same object — used verbatim, not resolved
  expect(seen).toEqual(explicit);
});
