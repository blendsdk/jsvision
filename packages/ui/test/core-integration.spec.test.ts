/**
 * Specification test: `@jsvision/ui` is built on `@jsvision/core`.
 *
 * Verifies the workspace dependency resolves and the engine's public API is
 * reachable from this package by name (not by reaching into its internals) —
 * the wiring every future subsystem (renderer, host, input) depends on.
 */
import { test, expect } from 'vitest';
import { VERSION as coreVersion, ScreenBuffer } from '@jsvision/core';

test('the @jsvision/core public API is importable by name', () => {
  expect(typeof coreVersion).toBe('string');
  expect(ScreenBuffer).toBeTypeOf('function');
});
