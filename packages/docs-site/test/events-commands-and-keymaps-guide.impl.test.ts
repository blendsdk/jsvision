/**
 * Implementation hardening for the Events, commands & keymaps laboratories.
 *
 * The specification proves the learner-facing contract. These checks stress repeated command
 * enablement, raw-key suppression, pointer boundaries, deterministic paste, and host-owned cleanup.
 */
import { Button, createRoot } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { describe, expect, test, vi } from 'vitest';
import precedenceExample from '../examples/guides/command-precedence.js';
import routingExample from '../examples/guides/event-routing.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { demoShell } from '../src/demo-shell.js';
import {
  EXAMPLE_CAPS,
  EXAMPLE_VIEWPORT,
  buildLabExample,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

/** Find the first rendered occurrence of a learner-visible label. */
function renderedTextOrigin(app: Application, text: string): { x: number; y: number } {
  const rows = app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''));
  for (const [y, row] of rows.entries()) {
    const x = row.indexOf(text);
    if (x >= 0) return { x, y };
  }
  throw new Error(`laboratory is missing rendered text: ${text}`);
}

/** Build a laboratory through the same cleanup seam used by the browser host. */
function buildThroughHostLifecycle(definition: ExampleDefinition): {
  readonly app: Application;
  readonly cleanups: Array<() => void>;
} {
  const cleanups: Array<() => void> = [];
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: 'app',
    caps: EXAMPLE_CAPS,
    viewport: EXAMPLE_VIEWPORT,
    onCleanup: (cleanup) => cleanups.push(cleanup),
  });
  app.loop.resize(EXAMPLE_VIEWPORT);
  return { app, cleanups };
}

test('routing trace remains deterministic across key, paste, command, reset, and mouse input', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/event-routing', routingExample);

    expect(frameText(app)).toContain('Mouse target [FOCUSED]');
    app.loop.dispatch(key('x'));
    expect(frameText(app)).toContain('Key x: pre > focused > post');

    app.loop.dispatch({ type: 'paste', text: 'sample', truncated: false });
    expect(frameText(app)).toContain('Paste sample: pre > focused > post');

    app.loop.dispatch(key('c', { alt: true }));
    expect(frameText(app)).toContain('Command inspect: pre > focused > post');

    const target = renderedTextOrigin(app, 'Mouse target');
    dispatchExampleAction(app, {
      kind: 'mouse',
      gesture: 'click',
      at: { x: target.x + 1, y: target.y },
    });
    expect(frameText(app)).toContain('Mouse: target > parent');
    expect(frameText(app)).not.toContain('Mouse: target > parent >');
    dispose();
  });
});

test('routing buttons preserve the focused route for mouse and keyboard activation', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('guides/event-routing', routingExample);
    const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
    const paste = buttons.find((button) => button.activation.label === 'Send paste');
    const command = buttons.find((button) => button.activation.label === 'Emit command');
    if (paste === undefined || command === undefined) throw new Error('routing lesson buttons are missing');

    for (const button of [paste, command]) {
      const origin = renderedTextOrigin(app, button.activation.label);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: origin.x, y: origin.y },
      });
      const expected = button === paste ? 'Paste sample' : 'Command inspect';
      expect(frameText(app)).toContain(`${expected}: pre > focused > post`);
      expect(frameText(app)).toContain('Mouse target [FOCUSED]');

      app.loop.focusView(button);
      expect(app.loop.getFocused()).toBe(button);
      app.loop.dispatch(key('space'));
      expect(frameText(app)).toContain(`${expected}: pre > focused > post`);
      expect(frameText(app)).toContain('Mouse target [FOCUSED]');
    }
    dispose();
  });
});

test('a click outside the routing target does not invent a target-up trace', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/event-routing', routingExample);
    app.loop.dispatch(key('x'));
    const before = frameText(app);

    dispatchExampleAction(app, {
      kind: 'mouse',
      gesture: 'click',
      at: { x: 1, y: 2 },
    });
    expect(frameText(app)).not.toContain('Mouse: target > parent');
    expect(before).toContain('Key x: pre > focused > post');
    dispose();
  });
});

test('precedence remains stable across collision, disable, dropped command, and re-enable', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/command-precedence', precedenceExample);

    app.loop.dispatch(key('c', { ctrl: true }));
    expect(frameText(app)).toContain('Status: Ctrl+C app binding won; inspect command handled');
    expect(frameText(app)).toContain('Raw key deliveries: 0');

    app.loop.dispatch(key('d', { alt: true }));
    expect(frameText(app)).toContain('Save enabled: no');
    app.loop.dispatch(key('s', { ctrl: true }));
    expect(frameText(app)).toContain('save disabled; mapped save commands are dropped');
    expect(frameText(app)).toContain('Raw key deliveries: 0');

    app.loop.dispatch(key('d', { alt: true }));
    app.loop.dispatch(key('s', { ctrl: true }));
    expect(frameText(app)).toContain('Save enabled: yes');
    expect(frameText(app)).toContain('Winner: app onCommand');
    expect(frameText(app)).toContain('Raw key deliveries: 0');
    dispose();
  });
});

test('only unbound keys reach the precedence laboratory raw-key target', () => {
  createRoot((dispose) => {
    const { app } = buildLabExample('guides/command-precedence', precedenceExample);

    app.loop.dispatch(key('s', { ctrl: true }));
    app.loop.dispatch(key('c', { ctrl: true }));
    expect(frameText(app)).toContain('Raw key deliveries: 0');

    app.loop.dispatch(key('x'));
    expect(frameText(app)).toContain('Raw key deliveries: 1');
    expect(frameText(app)).toContain('unbound raw key reached the focused view');
    dispose();
  });
});

test('disabling Save greys its button, removes it from focus, and exposes a non-colour focus cue', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('guides/command-precedence', precedenceExample);
    const emitSave = viewsIn(dialog)
      .filter((view): view is Button => view instanceof Button)
      .find((button) => button.activation.label === 'Emit save');
    if (emitSave === undefined) throw new Error('precedence lesson Save button is missing');

    app.loop.focusView(emitSave);
    expect(app.loop.getFocused()).toBe(emitSave);
    app.loop.dispatch(key('d', { alt: true }));

    expect(emitSave.state.disabled).toBe(true);
    expect(app.loop.getFocused()).not.toBe(emitSave);
    expect(frameText(app)).toContain('Raw-key target [FOCUSED]');
    app.loop.focusView(emitSave);
    expect(app.loop.getFocused()).not.toBe(emitSave);

    app.loop.dispatch(key('d', { alt: true }));
    expect(emitSave.state.disabled).toBe(false);
    dispose();
  });
});

describe.each([
  ['routing', routingExample],
  ['precedence', precedenceExample],
] as const)('$name laboratory host lifecycle', (_name, definition) => {
  test('registers one owned disposer and tolerates repeated host teardown', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { app, cleanups } = buildThroughHostLifecycle(definition);
    try {
      expect(cleanups).toHaveLength(1);
      expect(warning.mock.calls.flat().join('\n')).not.toContain('created outside any createRoot() scope');
      expect(() => {
        cleanups[0]?.();
        cleanups[0]?.();
        app.loop.dispose();
      }).not.toThrow();
      app.loop.dispatch(key('x'));
    } finally {
      app.loop.dispose();
      warning.mockRestore();
    }
  });
});
