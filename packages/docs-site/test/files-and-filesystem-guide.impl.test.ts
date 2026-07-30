/**
 * Implementation hardening for the host-neutral filesystem laboratory.
 *
 * These checks stress isolated virtual state, canonical traversal denial, missing files, one-shot
 * policy denial, cancellation without mutation, responsive state, and repeat-safe cleanup.
 */
import { View, createRoot } from '@jsvision/ui';
import { afterEach, describe, expect, test, vi } from 'vitest';
import example from '../examples/guides/filesystem-seams.js';
import { FileSystemSeamPanel } from '../src/example-fixtures/files-and-filesystem/file-system-seam-panel.js';
import { buildLabExample, collectTemplate1Evidence, frameText, viewsIn } from './example-lab-harness.js';

/** Return the real teaching panel mounted inside the shared Template1 dialog. */
function panelIn(dialog: View): FileSystemSeamPanel {
  const panel = viewsIn(dialog).find((view): view is FileSystemSeamPanel => view instanceof FileSystemSeamPanel);
  if (panel === undefined) throw new Error('filesystem laboratory is missing its teaching panel');
  return panel;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('filesystem adapter edges', () => {
  test('keeps browser and application-defined trees isolated without network access', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const panel = new FileSystemSeamPanel();

    panel.browserFileSystem.writeFile('/workspace/readme.txt', 'browser-only');

    expect(panel.browserFileSystem.readFile('/workspace/readme.txt')).toBe('browser-only');
    expect(panel.customFileSystem.readFile('/workspace/readme.txt')).toBe('hello from the seam');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('denies canonical traversal and reports a missing in-root file distinctly', () => {
    const panel = new FileSystemSeamPanel();

    expect(() => panel.customFileSystem.readFile('/workspace/../outside.txt')).toThrow(
      'Access denied by application root policy',
    );
    expect(() => panel.customFileSystem.readFile('/workspace/missing.txt')).toThrow(/ENOENT/iu);
    expect(panel.customFileSystem.readFile('/workspace/readme.txt')).toBe('hello from the seam');
  });

  test('consumes one armed denial while preserving the file for a fresh retry', () => {
    const panel = new FileSystemSeamPanel();
    panel.armDenial('keyboard');

    panel.read('keyboard');
    expect(panel.deniedRuns).toBe(1);
    expect(panel.readRuns).toBe(0);

    panel.read('keyboard');
    expect(panel.deniedRuns).toBe(1);
    expect(panel.readRuns).toBe(1);
    expect(panel.customFileSystem.readFile('/workspace/readme.txt')).toBe('hello from the seam');
  });
});

describe('filesystem workflow and lifecycle edges', () => {
  test('keeps prior content while presenting a missing file separately from denial', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/filesystem-seams', example);
      const panel = panelIn(dialog);

      panel.read('keyboard');
      panel.readMissing('keyboard');
      app.loop.renderRoot.flush();

      expect(panel.failedRuns).toBe(1);
      expect(panel.deniedRuns).toBe(0);
      expect(panel.scanRuns).toBe(0);
      expect(panel.readRuns).toBe(1);
      expect(panel.writeRuns).toBe(0);
      expect(frameText(app)).toMatch(/Read:\s*readme\.txt[\s\S]*Content:\s*hello[\s\S]*Status:\s*missing/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('preserves adapter and operation evidence through maximize and restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/filesystem-seams', example, {
        viewport: { width: 120, height: 40 },
      });
      const panel = panelIn(dialog);
      panel.useApplicationAdapter('keyboard');
      panel.scan('keyboard');
      app.loop.renderRoot.flush();
      const before = frameText(app);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog);

      expect(before).toMatch(/Adapter:\s*application-defined[\s\S]*readme\.txt/iu);
      expect(frameText(app)).toMatch(/Adapter:\s*application-defined[\s\S]*readme\.txt/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('cleans the complete subtree exactly once under repeated disposal', () => {
    let panel: FileSystemSeamPanel | undefined;
    let descendants: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/filesystem-seams', example);
      panel = panelIn(dialog);
      descendants = viewsIn(dialog);

      app.loop.dispose();
      app.loop.dispose();
      dispose();
    });

    expect(panel?.cleanupCount).toBe(1);
    expect(descendants.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });
});
