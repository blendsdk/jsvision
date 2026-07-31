/**
 * Implementation hardening for The application shell laboratories.
 *
 * These checks stress repeated quit requests, body switching, command boundaries, geometry, and
 * teardown beyond the immutable learner-visible contract.
 */
import { Button, Commands, Group, View, Window, createApplication, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import chromeExample from '../examples/guides/application-chrome.js';
import bodiesExample from '../examples/guides/application-bodies.js';
import { ApplicationChromePanel } from '../src/example-fixtures/application-shell/application-chrome-panel.js';
import { ApplicationBodiesPanel } from '../src/example-fixtures/application-shell/application-bodies-panel.js';
import {
  GuideRuntimeAdapter,
  expectTestExit,
  quietTestInput,
  quietTestOutput,
} from './application-shell-runtime.fixtures.js';
import {
  EXAMPLE_CAPS,
  absoluteOrigin,
  buildLabExample,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

/** Return the single mounted fixture panel of the requested class. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

/** Activate one named laboratory button through the real pointer route. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`laboratory is missing ${label}`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

describe('application shell laboratory edges', () => {
  test('should keep repeated keyboard and mouse quit requests bounded and non-terminating', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/application-chrome', chromeExample);
      const panel = panelIn(dialog, ApplicationChromePanel);

      for (let request = 0; request < 3; request += 1) app.loop.dispatch(key('q', { alt: true }));
      clickButton(app, dialog, 'Request quit');
      expect(panel.quitRequests).toBe(4);
      expect(dialog.mounted).toBe(true);
      expect(frameText(app)).toMatch(/Quit requested:\s*yes[\s\S]*Action route:\s*button/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should preserve deterministic body ownership through repeated switching', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/application-bodies', bodiesExample);
      const panel = panelIn(dialog, ApplicationBodiesPanel);

      app.loop.dispatch(key('w', { alt: true }));
      expect(frameText(app)).toMatch(/Command outcome:\s*Desktop close: removed window \(2 -> 1\)/iu);
      for (let switchCount = 0; switchCount < 10; switchCount += 1) {
        app.loop.dispatch(key('b', { alt: true }));
      }
      expect(panel.bodyMode).toBe('Desktop');
      clickButton(app, dialog, 'Switch body');
      expect(panel.bodyMode).toBe('Custom content');
      expect(frameText(app)).toMatch(/Window commands:\s*not registered[\s\S]*Action source:\s*mouse/iu);
      app.loop.dispatch(key('w', { alt: true }));
      expect(frameText(app)).toMatch(/Command outcome:\s*Custom body received: Close window command/iu);
      expect(panel.windowCommandRuns).toBe(2);

      app.loop.dispose();
      dispose();
    });
  });

  test('should retain the public Desktop-only close-command boundary', () => {
    const desktopApp = createApplication({ caps: EXAMPLE_CAPS, viewport: { width: 40, height: 12 } });
    const first = new Window('First');
    const second = new Window('Second');
    desktopApp.desktop.addWindow(first);
    desktopApp.desktop.addWindow(second);
    desktopApp.loop.emitCommand(Commands.close);
    expect(desktopApp.desktop.children).toEqual([first]);

    const customBody = new Group();
    const customApp = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      content: customBody,
    });
    expect(customApp.desktop).toBeUndefined();
    desktopApp.loop.dispose();
    customApp.loop.dispose();
  });

  test.each([
    ['guides/application-chrome', chromeExample],
    ['guides/application-bodies', bodiesExample],
  ] as const)('should unmount every owned view when %s closes', (id, definition) => {
    let mounted: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      mounted = viewsIn(dialog);
      app.loop.dispose();
      dispose();
    });
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });

  test('should dispose both separately mounted body-comparison applications exactly once', () => {
    let panel: ApplicationBodiesPanel | undefined;
    let nestedRoots: readonly View[] = [];
    let disposeOuter: (() => void) | undefined;
    createRoot((dispose) => {
      disposeOuter = dispose;
      const { app, dialog } = buildLabExample('guides/application-bodies', bodiesExample);
      panel = panelIn(dialog, ApplicationBodiesPanel);
      nestedRoots = panel.nestedRoots;
      expect(panel.nestedApplicationsMounted).toBe(true);
      app.loop.dispose();
      expect(panel.nestedCleanupCount).toBe(2);
      dispose();
    });

    expect(nestedRoots.every((root) => !root.mounted && root.scope === null)).toBe(true);
    disposeOuter?.();
    expect(panel?.nestedCleanupCount).toBe(2);
  });
});

describe('application run and restoration edges', () => {
  test('should resolve a non-zero quit code, restore the host, then dispose view-owned cleanup', async () => {
    const runtime = new GuideRuntimeAdapter();
    const app = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      runtime,
      input: quietTestInput(),
      output: quietTestOutput(),
      warnAmbiguousWidth: false,
      systemClipboard: false,
    });
    const owned = new Group();
    let cleanups = 0;
    owned.onMount(() => owned.onCleanup(() => (cleanups += 1)));
    app.desktop.add(owned);

    const running = app.run();
    app.loop.emitCommand(Commands.quit, 7);
    expect(await running).toBe(7);
    expect(runtime.restored).toBe(true);
    expect(owned.mounted).toBe(true);
    expect(cleanups).toBe(0);

    app.loop.dispose();
    expect(owned.mounted).toBe(false);
    expect(cleanups).toBe(1);
  });

  test('should restore the host when an uncaught failure escapes the running application', () => {
    const runtime = new GuideRuntimeAdapter();
    const app = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      runtime,
      input: quietTestInput(),
      output: quietTestOutput(),
      warnAmbiguousWidth: false,
      systemClipboard: false,
    });
    void app.run();

    expect(runtime.restored).toBe(false);
    expectTestExit(() => runtime.emitUncaught(new Error('injected failure')));
    expect(runtime.restored).toBe(true);
    app.loop.dispose();
  });
});
