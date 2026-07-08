/**
 * Implementation tests — capability resolution internals for `createApplication`.
 *
 * Guards that the `'auto'` sentinel (and an omitted `caps`) is resolved to a concrete profile before
 * it reaches the loop/render root: a stray `'auto'` string downstream would break color encoding.
 * The resolved profile is a plain object carrying the expected capability fields, observed through a
 * probe view's render context — the exact surface the loop threads caps into.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { CapabilityProfile } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';

/** Captures the render context's resolved capability profile on first paint. */
class CapsProbe extends View {
  seen: CapabilityProfile | null = null;
  draw(ctx: DrawContext): void {
    this.seen = ctx.caps;
    ctx.fill(' ');
  }
}

function observe(caps?: 'auto'): CapabilityProfile | null {
  const app = createApplication({ caps, viewport: { width: 16, height: 4 } });
  const probe = new CapsProbe();
  app.desktop.add(probe);
  app.loop.renderRoot.flush();
  return probe.seen;
}

test('should thread a real profile object, never the auto string, when caps is omitted', () => {
  const seen = observe();
  expect(seen).not.toBeNull();
  // A concrete profile object with real capability fields — not the string 'auto'.
  expect(typeof seen).toBe('object');
  expect(seen).not.toBe('auto');
  expect(seen).toHaveProperty('colorDepth');
  expect(typeof seen?.colorDepth).toBe('string');
});

test('should thread a real profile object, never the auto string, when caps is auto', () => {
  const seen = observe('auto');
  expect(typeof seen).toBe('object');
  expect(seen).not.toBe('auto');
  expect(seen).toHaveProperty('colorDepth');
});
