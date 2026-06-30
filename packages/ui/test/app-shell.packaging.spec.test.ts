/**
 * Specification test (immutable oracle) — RD-05 app-shell packaging & security (Phase 5).
 *
 * Source: RD-05 AC-21 → ST-21 (codeops/features/jsvision-ui/plans/app-shell/
 * 03-05-statusline-commands-theme-seams.md §Packaging + 07-testing-strategy.md). Imports the public
 * app-shell surface **by name** from `@jsvision/ui` (the published, built surface) and asserts the
 * sole cross-package edit — the additive `windowInactive` core `Theme` role — resolves. `check:deps`
 * (no native deps) is asserted separately by the gate. Expectations derive from the acceptance
 * criteria, never the implementation.
 *
 * Trace: RD-05 03-05 §Packaging · AR-73/AR-81 · ST-21 / AC-21.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import {
  createApplication,
  Desktop,
  Window,
  MenuBar,
  StatusLine,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  type Application,
  type ApplicationOptions,
  type MenuItem,
  type StatusItem,
} from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ST-21 / AC-21 — every public app-shell symbol imports from `@jsvision/ui`.
test('ST-21: the RD-05 public surface imports from @jsvision/ui', () => {
  expect(createApplication).toBeTypeOf('function');
  expect(menuBar).toBeTypeOf('function');
  expect(subMenu).toBeTypeOf('function');
  expect(item).toBeTypeOf('function');
  expect(separator).toBeTypeOf('function');
  expect(statusLine).toBeTypeOf('function');
  expect(statusItem).toBeTypeOf('function');
  expect(Commands.quit).toBe('quit');

  // Type-only usage — fails to typecheck if a contract type is missing from the public surface.
  const menuItem: MenuItem = item('~O~k', 'ok');
  const statusEntry: StatusItem = statusItem('~Q~uit', Commands.quit);
  expect(menuItem.kind).toBe('item');
  expect(statusEntry.command).toBe('quit');

  const opts: ApplicationOptions = { caps };
  const app: Application = createApplication(opts);
  expect(app.desktop).toBeInstanceOf(Desktop);
  expect(typeof app.run).toBe('function');

  // The chrome classes are constructable from the public surface.
  expect(new Window('W')).toBeInstanceOf(Window);
  expect(menuBar([subMenu('~F~ile', [])])).toBeInstanceOf(MenuBar);
  expect(statusLine([])).toBeInstanceOf(StatusLine);
});

// ST-21 / AC-21 — the sole cross-package edit is the additive `windowInactive` core Theme role.
test('ST-21: the additive windowInactive Theme role is present + distinct from window', () => {
  expect(defaultTheme.windowInactive).toBeDefined();
  // Same shape as the active `window` role (fg/bg + border/title).
  expect(typeof defaultTheme.windowInactive.fg).toBe('string');
  expect(typeof defaultTheme.windowInactive.bg).toBe('string');
  expect(defaultTheme.windowInactive.border).toBeDefined();
  expect(defaultTheme.windowInactive.title).toBeDefined();
  // Visibly distinct from the active role (a dimmed inactive frame).
  expect(defaultTheme.windowInactive.border).not.toBe(defaultTheme.window.border);
});
