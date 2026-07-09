/**
 * Plumbing smoke test: the docs-site vitest project runs and resolves the built
 * `@jsvision/*` dist through the workspace symlinks. This is the guard that
 * docs-site's tests see FRESH built dist — turbo orders the engine packages'
 * `build` before `docs-site#test`, so a clean-`dist` `yarn verify` must rebuild
 * them first and these imports must resolve to the just-built output.
 *
 * Importing `buildBrowserCaps` (not the xterm-touching host surface) keeps this
 * headless and node-safe.
 */
import { test, expect } from 'vitest';
import { createRenderRoot } from '@jsvision/ui';
import { buildBrowserCaps } from '@jsvision/web';
import { EXAMPLES } from '../examples/index.js';

test('the built @jsvision/* dist resolves in the docs-site test project', () => {
  expect(typeof createRenderRoot).toBe('function');
  expect(typeof buildBrowserCaps).toBe('function');
});

test('the example registry is an array (placeholder until seed examples land)', () => {
  expect(Array.isArray(EXAMPLES)).toBe(true);
});
