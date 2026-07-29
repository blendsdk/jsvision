/**
 * Implementation hardening for the Views & focus course laboratories.
 *
 * The specification proves the learner-facing contract. These checks stress exact traversal after
 * eligibility changes, both modal restore targets, responsive geometry, and host-owned teardown.
 */
import { describe, expect, test, vi } from 'vitest';
import { Button, Dialog, Group, createRoot } from '@jsvision/ui';
import type { Application, View } from '@jsvision/ui';
import modalityExample from '../examples/guides/views-focus-modality.js';
import traversalExample from '../examples/guides/views-focus-traversal.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { demoShell } from '../src/demo-shell.js';
import {
  EXAMPLE_CAPS,
  EXAMPLE_VIEWPORT,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const LESSONS = [
  { id: 'guides/views-focus-traversal', definition: traversalExample },
  { id: 'guides/views-focus-modality', definition: modalityExample },
] as const;

/** Grow a laboratory through the shared dialog's real south-east resize grip. */
function resizeDialog(app: Application, dialog: Dialog, widthDelta = 10, heightDelta = 4): void {
  const origin = absoluteOrigin(dialog);
  const grip = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: grip,
    to: { x: grip.x + widthDelta, y: grip.y + heightDelta },
  });
}

/** Assert that every solved descendant remains inside its immediate parent. */
function expectContained(view: View): void {
  const parent = view.parent;
  if (parent === null) return;
  expect(view.bounds.x).toBeGreaterThanOrEqual(0);
  expect(view.bounds.y).toBeGreaterThanOrEqual(0);
  expect(view.bounds.x + view.bounds.width).toBeLessThanOrEqual(parent.bounds.width);
  expect(view.bounds.y + view.bounds.height).toBeLessThanOrEqual(parent.bounds.height);
}

/**
 * Build through the browser host's cleanup seam without adding an ambient reactive owner.
 *
 * Live examples are constructed before the browser mounts them, so each module must establish its
 * own owner and give that disposer to the host.
 */
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

test('tree traversal skips hidden and disabled candidates in exact retained order', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('guides/views-focus-traversal', traversalExample);
    const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
    const [alpha, beta, gamma, last] = buttons;
    if (alpha === undefined || beta === undefined || gamma === undefined || last === undefined) {
      throw new Error('the traversal lesson is missing its four ordered focus targets');
    }

    expect(app.loop.getFocused()).toBe(alpha);
    app.loop.dispatch(key('tab'));
    expect(app.loop.getFocused()).toBe(beta);
    app.loop.dispatch(key('tab'));
    expect(app.loop.getFocused()).toBe(gamma);
    app.loop.dispatch(key('tab'));
    expect(app.loop.getFocused()).toBe(last);
    app.loop.dispatch(key('tab', { shift: true }));
    expect(app.loop.getFocused()).toBe(gamma);

    app.loop.focusView(alpha);
    app.loop.dispatch(key('h', { alt: true }));
    app.loop.dispatch(key('tab'));
    expect(app.loop.getFocused()).toBe(gamma);
    expect(frameText(app)).toContain('Hidden target: yes');

    app.loop.focusView(alpha);
    app.loop.dispatch(key('d', { alt: true }));
    app.loop.dispatch(key('tab'));
    expect(app.loop.getFocused()).toBe(last);
    expect(frameText(app)).toContain('Disabled target: yes');
    dispose();
  });
});

test('focusInto restores an eligible remembered child and falls back after that child is hidden', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('guides/views-focus-traversal', traversalExample);
    const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
    const [alpha, beta] = buttons;
    if (alpha === undefined || beta === undefined) {
      throw new Error('the traversal lesson is missing group-one targets');
    }

    app.loop.focusView(beta);
    app.loop.dispatch(key('i', { alt: true }));
    expect(app.loop.getFocused()).toBe(beta);

    app.loop.dispatch(key('h', { alt: true }));
    app.loop.dispatch(key('i', { alt: true }));
    expect(app.loop.getFocused()).toBe(alpha);
    expect(frameText(app)).toContain('Status: focusInto restored group 1 memory');
    dispose();
  });
});

test('modal close restores either launch target and removes the nested window after settlement', async () => {
  const built = createRoot((dispose) => {
    const lesson = buildLabExample('guides/views-focus-modality', modalityExample);
    return { ...lesson, dispose };
  });
  const buttons = viewsIn(built.dialog).filter((view): view is Button => view instanceof Button);
  const [open, workspace] = buttons;
  if (open === undefined || workspace === undefined) {
    built.dispose();
    throw new Error('the modality lesson is missing its launch targets');
  }

  try {
    for (const launchTarget of [open, workspace]) {
      built.app.loop.focusView(launchTarget);
      built.app.loop.dispatch(key('m', { alt: true }));
      const nested = built.app.desktop?.children.find(
        (view): view is Dialog => view instanceof Dialog && view !== built.dialog,
      );
      if (nested === undefined) throw new Error('the modality lesson did not mount its nested dialog');
      expect(viewsIn(nested)).toContain(built.app.loop.getFocused());

      built.app.loop.dispatch(key('tab'));
      expect(viewsIn(nested)).toContain(built.app.loop.getFocused());
      built.app.loop.dispatch(key('escape'));
      expect(built.app.loop.getFocused()).toBe(launchTarget);
      expect(frameText(built.app)).toContain('Restored focus:');

      await Promise.resolve();
      expect(built.app.desktop?.children).not.toContain(nested);
      expect(built.app.loop.getFocused()).toBe(launchTarget);
    }
  } finally {
    built.dispose();
  }
});

describe.each(LESSONS)('$id geometry hardening', ({ id, definition }) => {
  test('keeps every descendant contained through resize, maximize, and exact restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const content = dialog.children.find((child): child is Group => child instanceof Group);
      if (content === undefined) throw new Error(`${id} has no inset content group`);

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedContent = { ...content.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      for (const view of viewsIn(content)) expectContained(view);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(content.bounds.width).toBeGreaterThan(resizedContent.width);
      expect(content.bounds.height).toBeGreaterThan(resizedContent.height);
      for (const view of viewsIn(content)) expectContained(view);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resizedDialog);
      expect(content.bounds).toEqual(resizedContent);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });
});

describe.each(LESSONS)('$id host lifecycle', ({ definition }) => {
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
    } finally {
      app.loop.dispose();
      warning.mockRestore();
    }
  });
});
