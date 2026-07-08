/**
 * Specification tests (immutable oracles) — the `@jsvision/core` essentials re-exported from
 * `@jsvision/ui`, so a hello-world app imports from a single package.
 *
 * Imports the public surface **by name** from `@jsvision/ui` (the published barrel). Three of the four
 * re-exported values are functions; `Attr` is a runtime `const` object (not a type), so it is guarded
 * as a value — a type-only re-export would erase its binding and import `undefined`. The three type
 * re-exports are exercised by type-only usage that only compiles if the barrel forwards them.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import {
  resolveCapabilities,
  resolveCapabilitiesAsync,
  createKeymap,
  Attr,
  type CapabilityProfile,
  type Style,
  type Keymap,
} from '@jsvision/ui';

// ST-4 — the value re-exports: three functions plus the runtime `Attr` object.
test('should re-export the core capability/keymap functions and the Attr value from @jsvision/ui', () => {
  expect(resolveCapabilities).toBeTypeOf('function');
  expect(resolveCapabilitiesAsync).toBeTypeOf('function');
  expect(createKeymap).toBeTypeOf('function');

  // `Attr` is a runtime const, not a type — it must value-import (an `export type` would make it undefined).
  expect(typeof Attr).toBe('object');
  expect(typeof Attr.bold).toBe('number');
});

// ST-5 — the type re-exports: CapabilityProfile, Style, Keymap all resolve through the barrel.
test('should re-export the core capability/style/keymap types from @jsvision/ui', () => {
  const profile: CapabilityProfile = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const keymap: Keymap = createKeymap({ 'ctrl+s': 'save' });
  const style: Style = { fg: 'default', bg: 'default', attrs: Attr.none };

  expect(profile).toBeTypeOf('object');
  expect(keymap).toBeDefined();
  expect(style.attrs).toBe(Attr.none);
});
