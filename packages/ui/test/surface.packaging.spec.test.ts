/**
 * Specification test (immutable oracle) — jsvision-ui RD-19 packaging (ST-11 + the ST-10 no-new-role
 * half). Source: RD-19 AC-10/AC-11 (plans/surface-family/03-03-packaging.md).
 *   • `@jsvision/ui` re-exports `Surface`/`SurfaceView` (+ the option types, type-only); the pure
 *     `surface-geometry` helpers stay INTERNAL (not on the barrel).
 *   • Every `src/surface/` file ≤ 500 lines; `check:deps` clean (asserted by the CI job + zero imports).
 *   • **0 new core theme roles** and no existing `@jsvision/core` export/role changed (the empty area
 *     reuses `windowInactive`); `encodeStyle(windowInactive)` does not throw.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as core from '@jsvision/core';
import { defaultTheme, encodeStyle, resolveCapabilities, PALETTE } from '@jsvision/core';
import * as ui from '../src/index.js';
import { Surface, SurfaceView } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACE_DIR = resolve(HERE, '../src/surface');
const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

// ── ST-11 — public API surface ──────────────────────────────────────────────────────────────────

test('ST-11: @jsvision/ui re-exports Surface + SurfaceView (explicit named re-exports)', () => {
  expect(typeof Surface, 'Surface re-exported').toBe('function');
  expect(typeof SurfaceView, 'SurfaceView re-exported').toBe('function');
  expect((ui as Record<string, unknown>).Surface, 'same binding via the namespace').toBe(Surface);
  expect((ui as Record<string, unknown>).SurfaceView).toBe(SurfaceView);
});

test('ST-11: the pure surface-geometry helpers stay INTERNAL (not on the @jsvision/ui barrel)', () => {
  const barrel = ui as Record<string, unknown>;
  expect(barrel.computeClip, 'computeClip internal').toBeUndefined();
  expect(barrel.marginRects, 'marginRects internal').toBeUndefined();
  expect(barrel.clampDelta, 'clampDelta internal').toBeUndefined();
});

test('ST-11: Point stays exported once (reused from view/geometry, PA-13 — no duplicate)', () => {
  // Point is a type-only export; its single presence is a compile-time guarantee. Assert the value
  // barrel does not accidentally carry a runtime `Point` binding (it is types-only).
  expect((ui as Record<string, unknown>).Point, 'Point is type-only, no runtime binding').toBeUndefined();
});

test('ST-11: every src/surface/ source file is ≤ 500 lines', () => {
  const files = readdirSync(SURFACE_DIR).filter((f) => f.endsWith('.ts'));
  expect(files.length, 'surface/ has source files').toBeGreaterThan(0);
  for (const f of files) {
    const lines = readFileSync(resolve(SURFACE_DIR, f), 'utf8').split('\n').length;
    expect(lines, `${f} ≤ 500 lines`).toBeLessThanOrEqual(500);
  }
});

test('ST-11: src/surface/ imports no runtime dependency (zero-dep, check:deps clean)', () => {
  const files = readdirSync(SURFACE_DIR).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const src = readFileSync(resolve(SURFACE_DIR, f), 'utf8');
    // Only intra-repo (relative or @jsvision/*) imports are allowed — no bare third-party specifier.
    const bareImports = [...src.matchAll(/from\s+['"]([^'".][^'"]*)['"]/g)]
      .map((m) => m[1])
      .filter((spec) => !spec.startsWith('@jsvision/') && !spec.startsWith('node:'));
    expect(bareImports, `${f} has no third-party runtime import`).toEqual([]);
  }
});

// ── ST-10 (no-new-role half) — 0 new core theme roles; windowInactive reused ─────────────────────

test('ST-10: the empty-area role windowInactive exists and encodes without throwing (AC-10)', () => {
  const role = defaultTheme.windowInactive;
  expect(role, 'windowInactive role present').toBeTruthy();
  expect(typeof role.fg, 'has fg').toBe('string');
  expect(typeof role.bg, 'has bg').toBe('string');
  expect(() => encodeStyle(role.fg, role.bg, 0, caps), 'encodeStyle(windowInactive) does not throw').not.toThrow();
});

test('ST-10: no new surface-specific core theme role was added (0 new roles, AC-10)', () => {
  const theme = defaultTheme as unknown as Record<string, unknown>;
  expect(theme.surface, 'no theme.surface role').toBeUndefined();
  expect(theme.surfaceView, 'no theme.surfaceView role').toBeUndefined();
  expect(theme.surfaceEmpty, 'no theme.surfaceEmpty role').toBeUndefined();
});

test('ST-10: existing @jsvision/core exports are intact (additive-only, no byte changed)', () => {
  expect(typeof PALETTE.black, 'PALETTE intact').toBe('string');
  expect(defaultTheme.window, 'defaultTheme.window intact').toBeTruthy();
  expect(typeof core.encode, 'encode still exported').toBe('function');
  expect(typeof core.ScreenBuffer, 'ScreenBuffer still exported').toBe('function');
});
