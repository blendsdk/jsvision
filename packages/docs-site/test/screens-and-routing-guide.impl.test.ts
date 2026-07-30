/**
 * Hardening coverage for routing laboratory repetition, runtime-invalid names, focus, and disposal.
 */
import { createLogger, resolveCapabilities } from '@jsvision/core';
import { Button, Group, Text, createApplication, createEventLoop, createRoot, createRouter } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { Logger } from '@jsvision/core';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { RoutingLifecyclePanel } from '../src/example-fixtures/screens-and-routing/routing-lifecycle-panel.js';
import { buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';

const stackLabId = 'guides/routing-stack';
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

interface RoutingStackPanel extends Group {
  readonly lessonName: 'Typed routes, history, and shared chrome';
  readonly routeName: 'home' | 'detail' | 'settings';
  readonly pushRuns: number;
  readonly backRuns: number;
  readonly rootBackRuns: number;
  readonly cleanupCount: number;
}

/** Load the stack laboratory through the public docs registry. */
async function loadStackLab(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === stackLabId);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${stackLabId}`);
  return (await entry.load()).default;
}

/** Find the stable stack panel in the rendered lesson. */
function stackPanel(dialog: Group): RoutingStackPanel {
  const panel = viewsIn(dialog).find(
    (view): view is RoutingStackPanel =>
      'lessonName' in view && view.lessonName === 'Typed routes, history, and shared chrome',
  );
  if (panel === undefined) throw new Error('Routing stack panel is missing');
  return panel;
}

/** Dispatch one Alt accelerator through the real example application. */
function alt(app: ReturnType<typeof buildLabExample>['app'], key: string): void {
  dispatchExampleAction(app, {
    kind: 'key',
    key,
    modifiers: ['Alt'],
  });
}

describe('Screens & routing hardening', () => {
  test('should isolate a runtime-unknown route even when a broad host map permits the string type', () => {
    const errors: string[] = [];
    const logger: Logger = {
      ...createLogger(),
      error: (component, message) => errors.push(`${component}:${message}`),
    };
    const router = createRouter<Record<string, void>>({
      initial: { name: 'home' },
      logger,
      routes: {
        home: { build: () => ({ view: new Text('Home') }) },
      },
    });

    router.push('unknown');

    expect(router.location()).toEqual({ name: 'home', params: undefined });
    expect(router.canGoBack()).toBe(false);
    expect(errors).toEqual(['router:route build threw']);
  });

  test('should keep repeated root Back attempts separate from successful history transitions', async () => {
    const definition = await loadStackLab();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(stackLabId, definition);
      const panel = stackPanel(dialog);

      alt(app, 'b');
      alt(app, 'b');
      alt(app, 'n');
      alt(app, 'b');
      alt(app, 'n');

      expect(panel.routeName).toBe('detail');
      expect(panel.rootBackRuns).toBe(2);
      expect(panel.backRuns).toBe(1);
      expect(panel.pushRuns).toBe(2);
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });

  test('should rebuild and restore the keyed filter on every disposable round trip', () => {
    const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
    const panel = new RoutingLifecyclePanel({
      focusView: (view) => app.loop.focusView(view),
      getFocused: () => app.loop.getFocused(),
    });
    app.desktop.add(panel);
    app.loop.renderRoot.flush();

    panel.roundTrip('keyboard');
    panel.roundTrip('mouse');

    expect(panel.policy).toBe('dispose');
    expect(panel.navigationRuns).toBe(2);
    expect(panel.listBuilds).toBe(3);
    expect(panel.listCleanups).toBe(2);
    expect(panel.restoredFocus).toBe('filter field');
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(panel.listCleanups).toBe(3);
  });

  test('should retain one mounted List instance across repeated keep-alive round trips', () => {
    const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
    const panel = new RoutingLifecyclePanel({
      focusView: (view) => app.loop.focusView(view),
      getFocused: () => app.loop.getFocused(),
    });
    app.desktop.add(panel);
    app.loop.renderRoot.flush();

    panel.togglePolicy('keyboard');
    expect(panel.policy).toBe('keep-alive');
    const buildsAfterToggle = panel.listBuilds;
    const cleanupsAfterToggle = panel.listCleanups;
    panel.roundTrip('keyboard');
    panel.roundTrip('mouse');

    expect(panel.listBuilds).toBe(buildsAfterToggle);
    expect(panel.listCleanups).toBe(cleanupsAfterToggle);
    expect(panel.restoredFocus).toBe('filter field');
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(panel.listCleanups).toBe(cleanupsAfterToggle + 1);
  });

  test('should release warm and active screens when reset replaces the complete history', () => {
    type Routes = { root: void; detail: void; fresh: void };
    const cleanups: string[] = [];
    const screen = (name: string): Group => {
      const view = new Group();
      view.onMount(() => view.onCleanup(() => cleanups.push(name)));
      return view;
    };
    const router = createRouter<Routes>({
      initial: { name: 'root' },
      routes: {
        root: { keepAlive: true, build: () => ({ view: screen('root') }) },
        detail: { keepAlive: true, build: () => ({ view: screen('detail') }) },
        fresh: { build: () => ({ view: screen('fresh') }) },
      },
    });
    const app = createApplication({ caps, content: router, viewport: { width: 40, height: 12 } });
    app.loop.renderRoot.flush();
    router.push('detail');
    app.loop.renderRoot.flush();

    router.reset('fresh');
    app.loop.renderRoot.flush();

    expect(router.location().name).toBe('fresh');
    expect(router.canGoBack()).toBe(false);
    expect(cleanups).toEqual(['root', 'detail']);
    app.loop.dispose();
    expect(cleanups).toEqual(['root', 'detail', 'fresh']);
  });

  test('should stop after a keyed ineligible focus attempt instead of claiming Router tier fallthrough', () => {
    type Routes = { form: void; detail: void };
    const keys = new WeakMap<Button, string>();
    const builtTargets: Button[] = [];
    const attempts: Button[] = [];
    let focused: Button | null = null;
    const router = createRouter<Routes>({
      initial: { name: 'form' },
      routes: {
        form: {
          focusKey: (view) => (view instanceof Button ? (keys.get(view) ?? 'other') : 'screen'),
          build: () => {
            const screen = new Group();
            screen.add(new Button('First'));
            const target = new Button('Target');
            keys.set(target, 'target');
            if (builtTargets.length > 0) target.state.disabled = true;
            builtTargets.push(target);
            screen.add(target);
            return { view: screen };
          },
        },
        detail: { build: () => ({ view: new Button('Detail') }) },
      },
    });
    router.attachFocusHost({
      getFocused: () => focused,
      focusView: (view) => {
        if (!(view instanceof Button)) return;
        attempts.push(view);
        if (!view.state.disabled && view.state.visible) focused = view;
      },
    });
    const loop = createEventLoop({ width: 40, height: 12 }, { caps });
    loop.mount(router);
    const initialTarget = builtTargets[0];
    if (initialTarget === undefined) throw new Error('Initial focus target is missing');
    focused = initialTarget;

    router.push('detail');
    const attemptsBeforeBack = attempts.length;
    router.back();
    const rebuiltTarget = builtTargets[1];
    if (rebuiltTarget === undefined) throw new Error('Rebuilt focus target is missing');

    expect(rebuiltTarget.state.disabled).toBe(true);
    expect(attempts.slice(attemptsBeforeBack)).toEqual([rebuiltTarget]);
    expect(focused).not.toBe(rebuiltTarget);
    loop.dispose();
  });
});
