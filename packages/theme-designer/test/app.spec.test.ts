/**
 * Specification tests (immutable oracles) — the designer app-core wiring (ST-24…ST-29).
 *
 * Driven headlessly: the app is built with a fixed `caps`/`viewport` and `requireTty: false`, and its
 * file/modal boundaries are injected as seams (a fake filesystem, opener, confirm, and error box) so
 * every branch is exercised without a terminal. The oracles pin: selecting a target loads the
 * inspector (ST-24), a channel edit updates the model and applies the theme (ST-25), the dirty guard
 * gates open/preset/quit (ST-26), open adopts a valid file / cancels cleanly (ST-27), save writes the
 * exported JSON and clears dirty (ST-28), and a malformed import surfaces an error leaving the theme
 * unchanged (ST-29). A failing case means the app wiring is wrong.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { FileSystem } from '@jsvision/files';

import { createDesignerApp } from '../src/app.js';
import type { DesignerAppOptions } from '../src/app.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const viewport = { width: 90, height: 30 };

/** A minimal in-memory filesystem seam (only readFile/writeFile are used by the app). */
function fakeFs(files: Record<string, string> = {}): Pick<FileSystem, 'readFile' | 'writeFile'> {
  return {
    readFile: (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    writeFile: (path: string, text: string) => {
      files[path] = text;
    },
  };
}

function make(opts: Partial<DesignerAppOptions> = {}): ReturnType<typeof createDesignerApp> {
  return createDesignerApp({ caps, viewport, requireTty: false, ...opts });
}

// ── ST-24: selecting a target loads the inspector picker ────────────────────────────────────────────

test('ST-24: selecting an alias sets model.selected and loads its color into the inspector', () => {
  const da = make();
  da.selectTarget({ kind: 'alias', name: 'accent' });
  expect(da.model.state().selected).toStrictEqual({ kind: 'alias', name: 'accent' });
  // A fresh model derives the accent alias to its seed (#3b82f6); the inspector hex field loads it.
  expect(da.inspector.hex()).toBe('#3b82f6');
});

// ── ST-25: a channel edit updates the model for the selected target and applies the theme ───────────

test('ST-25: editing a channel updates the selected target and applies the theme to the app', () => {
  const da = make();
  da.selectTarget({ kind: 'alias', name: 'accent' }); // #3b82f6 = r59 g130 b246
  // Spy on the theme application (the effect calls app.setTheme dynamically).
  let applied = 0;
  const orig = da.app.setTheme.bind(da.app);
  da.app.setTheme = (t) => {
    applied += 1;
    orig(t);
  };
  da.inspector.r.set(200); // simulate dragging the Red slider (0xc8)
  expect(da.model.colorOf({ kind: 'alias', name: 'accent' }), 'the red channel edit reached the model').toBe('#c882f6');
  expect(da.model.theme().button.bg, 'the accent role re-derived').toBe('#c882f6');
  expect(applied, 'the app applied the new theme').toBeGreaterThan(0);
});

// ── ST-26: the unsaved-changes guard gates open / load-preset / quit ────────────────────────────────

test('ST-26: a dirty load-preset is gated by confirm — declining leaves the theme unchanged', async () => {
  const confirmDiscard = vi.fn().mockResolvedValue(false);
  const da = make({ confirmDiscard });
  da.model.setAlias('accent', '#ff0000'); // now dirty
  const before = da.model.theme();
  await da.loadPresetGuarded('nord');
  expect(confirmDiscard, 'the guard was shown').toHaveBeenCalledOnce();
  expect(da.model.theme(), 'declining kept the current theme').toStrictEqual(before);
});

test('ST-26: accepting the guard proceeds with the load', async () => {
  const confirmDiscard = vi.fn().mockResolvedValue(true);
  const da = make({ confirmDiscard });
  da.model.setAlias('accent', '#ff0000');
  await da.loadPresetGuarded('nord');
  expect(confirmDiscard).toHaveBeenCalledOnce();
  expect(da.model.state().dirty, 'the preset loaded and cleared dirty').toBe(false);
});

test('ST-26: a dirty open is gated too — declining skips the file dialog', async () => {
  const confirmDiscard = vi.fn().mockResolvedValue(false);
  const openPath = vi.fn().mockResolvedValue('/theme.json');
  const da = make({ confirmDiscard, openPath, fs: fakeFs() });
  da.model.setAlias('accent', '#ff0000');
  await da.open();
  expect(confirmDiscard).toHaveBeenCalledOnce();
  expect(openPath, 'declining the guard never opened the dialog').not.toHaveBeenCalled();
});

// ── ST-27: open adopts a valid file; cancel is a no-op ──────────────────────────────────────────────

test('ST-27: open adopts a valid theme file (roles mode); cancel is a no-op', async () => {
  const da0 = make();
  const validJson = da0.model.exportJson(); // a known-valid theme document
  const before = da0.model.theme();

  const da = make({ openPath: () => Promise.resolve('/theme.json'), fs: fakeFs({ '/theme.json': validJson }) });
  await da.open();
  expect(da.model.state().roleSnapshot, 'a valid open enters roles mode').not.toBeNull();
  expect(da.model.state().dirty).toBe(false);

  const daCancel = make({ openPath: () => Promise.resolve(null), fs: fakeFs() });
  await daCancel.open();
  expect(daCancel.model.theme(), 'cancel left the theme unchanged').toStrictEqual(before);
});

// ── ST-28: save writes the exported JSON and clears dirty ───────────────────────────────────────────

test('ST-28: save writes exportJson to the chosen path and clears dirty', async () => {
  const files: Record<string, string> = {};
  const fs = fakeFs(files);
  const writeSpy = vi.spyOn(fs, 'writeFile');
  const da = make({ openPath: () => Promise.resolve('/out.json'), fs });
  da.model.setAlias('accent', '#3b82f6'); // dirty
  await da.save();
  expect(writeSpy, 'writeFile called with the path and exported JSON').toHaveBeenCalledWith(
    '/out.json',
    da.model.exportJson(),
  );
  expect(files['/out.json'], 'the file holds the exported theme').toBe(da.model.exportJson());
  expect(da.model.state().dirty, 'a successful save clears dirty').toBe(false);
});

// ── ST-29: a malformed import surfaces an error and leaves the theme unchanged ──────────────────────

test('ST-29: opening a malformed theme file shows an error and keeps the current theme', async () => {
  const showError = vi.fn().mockResolvedValue(undefined);
  const da = make({
    openPath: () => Promise.resolve('/bad.json'),
    fs: fakeFs({ '/bad.json': '{ not a theme' }),
    showError,
  });
  const before = da.model.theme();
  await expect(da.open(), 'open never rejects on a bad file').resolves.toBeUndefined();
  expect(showError, 'the error box was shown').toHaveBeenCalledOnce();
  expect(da.model.theme(), 'the current theme is unchanged').toStrictEqual(before);
});
