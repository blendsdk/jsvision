import { buildBrowserCaps, createBrowserFileSystem, mountApp } from '@jsvision/web';
import { createApplication, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import boundariesDefinition from '../examples/guides/browser-capability-boundaries.js';
import lifecycleDefinition from '../examples/guides/browser-host-lifecycle.js';
import { BrowserCapabilityPanel } from '../src/example-fixtures/running-in-the-browser/browser-capability-panel.js';
import { BrowserHostLifecyclePanel } from '../src/example-fixtures/running-in-the-browser/browser-host-lifecycle-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  key,
  viewsIn,
} from './example-lab-harness.js';

describe('Running in the browser hardening', () => {
  test('should reject a mount with neither a terminal nor a terminal factory', () => {
    const caps = buildBrowserCaps();
    const app = createApplication({ caps, viewport: { width: 20, height: 6 } });
    expect(() => mountApp({ element: { tagName: 'DIV' }, app, caps })).toThrow(/term|createTerminal/u);
    app.loop.dispose();
  });

  test('should replace and dispose nested hosts without retaining input or resize owners', () => {
    createRoot((dispose) => {
      const lab = buildLabExample('guides/browser-host-lifecycle', lifecycleDefinition);
      const panel = viewsIn(lab.dialog).find(
        (view): view is BrowserHostLifecyclePanel => view instanceof BrowserHostLifecyclePanel,
      );
      if (panel === undefined) throw new Error('Missing browser lifecycle panel');
      panel.mountHost('mouse');
      panel.sendInput('mouse');
      panel.resizeHost('mouse');
      panel.mountHost('keyboard');
      expect(panel.mounts).toBe(2);
      expect(panel.hostDisposals).toBe(1);
      panel.disposeHost('mouse');
      expect(panel.hostDisposals).toBe(2);
      lab.app.loop.dispose();
      expect(panel.cleanupCount).toBe(1);
      expect(panel.hostDisposals).toBe(2);
      dispose();
    });
  });

  test('should keep authorization outcomes and virtual files deterministic across repeats', async () => {
    let disposeRoot: () => void = () => undefined;
    const lab = createRoot((dispose) => {
      disposeRoot = dispose;
      const lab = buildLabExample('guides/browser-capability-boundaries', boundariesDefinition);
      return lab;
    });
    const panel = viewsIn(lab.dialog).find(
      (view): view is BrowserCapabilityPanel => view instanceof BrowserCapabilityPanel,
    );
    if (panel === undefined) throw new Error('Missing browser capability panel');
    for (let index = 0; index < 3; index += 1) {
      panel.checkReclaim('keyboard');
      await panel.copyAuthorized('keyboard');
      await panel.copyDenied('keyboard');
      panel.useVirtualFile('keyboard');
    }
    expect(panel.reclaimedKeys).toBe(3);
    expect(panel.clipboardWrites).toBe(3);
    expect(panel.deniedClipboardWrites).toBe(3);
    expect(panel.virtualFileOperations).toBe(3);
    lab.app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    disposeRoot();
  });

  test('should confine browser files to their in-memory tree after lexical traversal', () => {
    const fs = createBrowserFileSystem({
      tree: { '/workspace': { 'safe.txt': 'bounded' } },
      home: '/workspace',
    });
    expect(fs.resolve('/workspace', '../../etc/passwd')).toBe('/etc/passwd');
    expect(() => fs.readFile('/etc/passwd')).toThrow();
    expect(() => fs.readFile('/workspace/missing.txt')).toThrow();
    fs.writeFile('/workspace/new.txt', 'local');
    expect(fs.readFile('/workspace/new.txt')).toBe('local');
  });

  test.each([
    ['guides/browser-host-lifecycle', lifecycleDefinition],
    ['guides/browser-capability-boundaries', boundariesDefinition],
  ] as const)('should preserve %s through repeated resize, maximize, and restore', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      for (let index = 0; index < 2; index += 1) {
        const origin = absoluteOrigin(dialog);
        const corner = {
          x: origin.x + dialog.bounds.width - 1,
          y: origin.y + dialog.bounds.height - 1,
        };
        dispatchExampleAction(app, {
          kind: 'mouse',
          gesture: 'drag',
          at: corner,
          to: { x: corner.x + 4, y: corner.y + 2 },
        });
      }
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      const resized = { ...dialog.bounds };
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      app.loop.dispatch(key(id.includes('lifecycle') ? 'm' : 'f', { alt: true }));
      app.loop.dispose();
      dispose();
    });
  });
});
