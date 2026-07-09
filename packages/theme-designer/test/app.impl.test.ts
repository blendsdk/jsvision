/**
 * Implementation tests — designer app wiring internals.
 *
 * Covers menu/status command wiring (a depth command reaches the model synchronously; a preset command
 * routes through the async guarded handler), a role-target edit committing through the inspector, and
 * the save-error path (a filesystem write failure surfaces an error and keeps the model dirty). The
 * `.js` extension is required by NodeNext resolution.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities, slateTheme, defaultTheme } from '@jsvision/core';
import type { FileSystem, Theme } from '@jsvision/core';
import type { TimerSeam } from '@jsvision/ui';

import { createDesignerApp } from '../src/app.js';
import type { DesignerAppOptions } from '../src/app.js';
import { downsampleTheme, flashColorFor } from '../src/model/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const viewport = { width: 90, height: 30 };

function make(opts: Partial<DesignerAppOptions> = {}): ReturnType<typeof createDesignerApp> {
  return createDesignerApp({ caps, viewport, requireTty: false, ...opts });
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test('a depth command updates the model depth synchronously', () => {
  const da = make();
  da.app.loop.emitCommand('depth:256');
  expect(da.model.state().depth).toBe('256');
});

test('a preset command routes through the guarded handler and loads the preset', async () => {
  const da = make();
  da.app.loop.emitCommand('preset:slate');
  await tick(); // the handler is async (guardDirty resolves on a microtask)
  expect(da.model.theme()).toStrictEqual(slateTheme);
  expect(da.model.state().dirty).toBe(false);
});

test('editing a role target commits its background through the inspector', () => {
  const da = make();
  da.selectTarget({ kind: 'role', name: 'button' });
  // The inspector loaded the role's current background.
  expect(da.inspector.hex()).toBe(da.model.theme().button.bg);
  da.inspector.b.set(0); // move the Blue slider
  const rgb = da.inspector;
  const expected = `#${rgb.r().toString(16).padStart(2, '0')}${rgb.g().toString(16).padStart(2, '0')}00`;
  expect(da.model.theme().button.bg, 'the role background reflects the edit').toBe(expected);
});

test('selecting a target after loading a preset does NOT re-commit its color (snapshot preserved)', () => {
  const da = make();
  da.model.loadPreset('turbo-vision'); // a literal snapshot preset (roles mode)
  expect(da.model.state().roleSnapshot, 'loaded as a role snapshot').not.toBeNull();

  // Merely selecting rail items must not write anything back — an alias re-commit would drop the
  // snapshot and revert the theme to the default generated palette.
  da.selectTarget({ kind: 'alias', name: 'accent' });
  da.selectTarget({ kind: 'role', name: 'button' });

  expect(da.model.state().roleSnapshot, 'the snapshot survived selection').not.toBeNull();
  expect(da.model.state().dirty, 'selection never dirties').toBe(false);
  expect(da.model.theme(), 'the theme is still the loaded preset').toStrictEqual(defaultTheme);
});

test('a depth change downsamples the whole applied theme (export stays authored)', () => {
  const da = make();
  let applied: Theme | null = null;
  const orig = da.app.setTheme.bind(da.app);
  da.app.setTheme = (t) => {
    applied = t;
    orig(t);
  };
  da.app.loop.emitCommand('depth:16');
  expect(da.model.state().depth).toBe('16');
  expect(applied, 'the applied theme is the 16-color downsample').toStrictEqual(
    downsampleTheme(da.model.theme(), '16'),
  );
  // The model's own theme (what export serializes) is unchanged by the preview depth.
  expect(da.model.theme(), 'the authored theme keeps truecolor').not.toStrictEqual(applied);
});

test('the fg/bg toggle edits a role foreground independently of its background', () => {
  const da = make();
  da.selectTarget({ kind: 'role', name: 'button' });
  const bgBefore = da.model.theme().button.bg;

  da.inspector.field.set(1); // switch to editing the foreground
  expect(da.inspector.hex(), 'the inspector loaded the role foreground').toBe(da.model.theme().button.fg);

  da.inspector.r.set(0); // move the Red slider on the foreground
  const rgb = da.inspector;
  const expectedFg = `#00${rgb.g().toString(16).padStart(2, '0')}${rgb.b().toString(16).padStart(2, '0')}`;
  expect(da.model.theme().button.fg, 'the foreground reflects the edit').toBe(expectedFg);
  expect(da.model.theme().button.bg, 'the background is untouched').toBe(bgBefore);
});

test('flashPreview blinks the selected color across the applied theme, then reverts', () => {
  // A deterministic timer: capture the pending callback so the test can drain the blink toggles.
  let pending: (() => void) | null = null;
  const timer: TimerSeam = {
    setTimer: (fn: () => void) => {
      pending = fn;
      return 1;
    },
    clearTimer: () => {
      pending = null;
    },
  };
  const da = make({ timer });

  // Record every theme the app applies (the blink toggles it on/off).
  const applied: Theme[] = [];
  const orig = da.app.setTheme.bind(da.app);
  da.app.setTheme = (t) => {
    applied.push(t);
    orig(t);
  };

  const base = da.model.theme();
  const c = base.button.bg; // a color the theme actually uses
  da.flashPreview(c);

  // The first lit frame recolors every cell using `c` to its high-contrast substitute.
  expect(applied.at(-1)?.button.bg, 'the flashed cell changed').toBe(flashColorFor(c));
  expect(applied.at(-1)?.button.bg).not.toBe(base.button.bg);

  // Drain the blink's toggles; it ends unlit, restoring the authored theme.
  let guard = 10;
  while (pending && guard-- > 0) {
    const fn: () => void = pending;
    pending = null;
    fn();
  }
  expect(da.model.theme(), 'the model theme was never mutated').toStrictEqual(base);
  expect(applied.at(-1), 'the blink reverts to the authored theme').toStrictEqual(base);
});

test('save-error path: a write failure shows an error and keeps the model dirty', async () => {
  const showError = vi.fn().mockResolvedValue(undefined);
  const fs: Pick<FileSystem, 'readFile' | 'writeFile'> = {
    readFile: () => '',
    writeFile: () => {
      throw new Error('disk full');
    },
  };
  const da = make({ openPath: () => Promise.resolve('/out.json'), fs, showError });
  da.model.setAlias('accent', '#3b82f6'); // dirty
  await da.save();
  expect(showError, 'the write error surfaced').toHaveBeenCalledOnce();
  expect(da.model.state().dirty, 'a failed save stays dirty').toBe(true);
});
