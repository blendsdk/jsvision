/**
 * Specification test (immutable oracle) — the virtual-FS file dialog (AC-9).
 *
 * A FileDialog mounted over the file-dialog example's seeded in-memory tree lists
 * the seeded top-level entries and, after its directory changes, re-scans to list
 * a subdirectory's entries — proving the browser file system browses with no
 * backend. The example exports its seeding (`seedFs`/`HOME`) so this oracle drives
 * the exact fixture the live demo ships.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication, createRoot, signal } from '@jsvision/ui';
import { FileDialog } from '@jsvision/files';
import { HOME, seedFs } from '../examples/files/file-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

test('ST-13: files/file-dialog lists the seeded tree and navigates into a subdir', () => {
  createRoot((dispose) => {
    const directory = signal(HOME);
    const dlg = new FileDialog({ fs: seedFs(), directory });
    const app = createApplication({ caps, viewport: VP });
    app.desktop.addWindow(dlg);
    app.loop.resize(VP); // compose → mounts the dialog → the FileList scans the seeded FS

    const topNames = dlg.fileList.entries().map((e) => e.name);
    expect(topNames).toContain('src'); // the seeded subdirectory
    expect(topNames.some((n) => n.endsWith('.md') || n.endsWith('.txt'))).toBe(true);

    // Enter the subdir — the listing re-scans reactively, no backend involved.
    directory.set(`${HOME}/src`);
    const subNames = dlg.fileList.entries().map((e) => e.name);
    expect(subNames).not.toEqual(topNames);
    expect(subNames.some((n) => n.endsWith('.ts'))).toBe(true);
    dispose();
  });
});
