/**
 * Implementation tests — designer app wiring internals.
 *
 * Covers menu/status command wiring (a depth command reaches the model synchronously; a preset command
 * routes through the async guarded handler), a role-target edit committing through the inspector, and
 * the save-error path (a filesystem write failure surfaces an error and keeps the model dirty). The
 * `.js` extension is required by NodeNext resolution.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities, slateTheme } from '@jsvision/core';
import type { FileSystem } from '@jsvision/files';

import { createDesignerApp } from '../src/app.js';
import type { DesignerAppOptions } from '../src/app.js';

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
