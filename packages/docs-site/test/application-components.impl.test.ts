/**
 * Implementation hardening for the foundations and application-shell laboratories.
 *
 * These checks cover tree ownership and teardown details beyond the public behavior oracle.
 */
import { createRoot, Desktop, Dialog, MenuBar, StatusLine, Window } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';
import { APPLICATION_EXAMPLE_IDS } from './contracts/application.js';

/** Load a definition from the public lazy registry. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing application example ${exampleId}`);
  return (await entry.load()).default;
}

/**
 * Mount one laboratory inside a reactive root and guarantee both loop and owner disposal.
 *
 * @param exampleId Registry ID to build.
 * @param inspect Assertions to run while the example is mounted.
 */
async function withLab(exampleId: string, inspect: (app: Application, dialog: Dialog) => void): Promise<void> {
  const definition = await loadDefinition(exampleId);
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition);
    try {
      inspect(app, dialog);
    } finally {
      try {
        app.loop.dispose();
      } finally {
        dispose();
      }
    }
  });
}

describe('foundation example ownership', () => {
  test('custom View receives focus through the documented application command', async () => {
    await withLab('foundations/view', (app) => {
      dispatchExampleAction(app, { kind: 'key', key: 'k', modifiers: ['Alt'] });
      expect(app.loop.getFocused()?.constructor.name).toBe('DemoView');
      expect(frameText(app)).toContain('Focus: DemoView');
    });
  });

  test('dynamic Group overlay mounts and unmounts without leaving an extra child', async () => {
    await withLab('foundations/group', (app, dialog) => {
      const before = viewsIn(dialog).length;
      dispatchExampleAction(app, { kind: 'key', key: 'a', modifiers: ['Alt'] });
      expect(viewsIn(dialog).length).toBe(before + 1);
      dispatchExampleAction(app, { kind: 'key', key: 'a', modifiers: ['Alt'] });
      expect(viewsIn(dialog).length).toBe(before);
    });
  });
});

describe('application composition and navigation', () => {
  test('Desktop and Window labs retain real nested manager surfaces inside the template dialog', async () => {
    await withLab('application/desktop', (_app, dialog) => {
      const descendants = viewsIn(dialog);
      expect(descendants.some((view) => view instanceof Desktop)).toBe(true);
      const windows = descendants.filter((view): view is Window => view instanceof Window && !(view instanceof Dialog));
      expect(windows).toHaveLength(2);
      dispatchExampleAction(_app, { kind: 'key', key: 't', modifiers: ['Alt'] });
      expect(Math.max(...windows.map((window) => window.bounds.height))).toBeLessThan(7);
    });
    await withLab('application/window', (app, dialog) => {
      const descendants = viewsIn(dialog);
      expect(descendants.some((view) => view instanceof Desktop)).toBe(true);
      const specimen = descendants.find((view): view is Window => view instanceof Window && !(view instanceof Dialog));
      expect(specimen).toBeDefined();
      dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
      expect(specimen?.mounted).toBe(true);
      expect(specimen?.parent).toBeInstanceOf(Desktop);
    });
  });

  test('Router reset disposes navigation history and restores the root location', async () => {
    await withLab('application/router', (app) => {
      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Route: detail · canGoBack: yes');
      dispatchExampleAction(app, { kind: 'key', key: 'b', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Route: home · canGoBack: no');
      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Route: home · canGoBack: no');
      dispatchExampleAction(app, { kind: 'key', key: 'b', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Route: home · canGoBack: no');
    });
  });
});

describe('application chrome behavior', () => {
  test('MenuBar replacement inserts a real Tools title and preserves command routing', async () => {
    await withLab('application/menu-bar', (app) => {
      const root = app.desktop?.parent ?? app.desktop;
      expect(root).toBeDefined();
      const menu =
        root === undefined ? undefined : viewsIn(root).find((view): view is MenuBar => view instanceof MenuBar);
      expect(menu).toBeDefined();
      dispatchExampleAction(app, { kind: 'key', key: 'd', modifiers: ['Alt'] });
      expect(
        menu?.items.some(
          (node) => (node.kind === 'sub' || node.kind === 'item') && node.title.replaceAll('~', '') === 'Tools',
        ),
      ).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'o', modifiers: [] });
      expect(frameText(app)).toContain('Menu command: Open');
    });
  });

  test('StatusLine command enablement blocks a disabled accelerator', async () => {
    await withLab('application/status-line', (app) => {
      const root = app.desktop?.parent ?? app.desktop;
      expect(root).toBeDefined();
      expect(root !== undefined && viewsIn(root).some((view) => view instanceof StatusLine)).toBe(true);
      dispatchExampleAction(app, { kind: 'key', key: 'e', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 's', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Status action: none · saves 0');
      expect(frameText(app)).toContain('Save enabled: no');
    });
  });
});

test('every foundation/application laboratory unmounts its complete dialog subtree', async () => {
  for (const exampleId of APPLICATION_EXAMPLE_IDS) {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      const descendants = viewsIn(dialog);
      try {
        expect(descendants.every((view) => view.mounted)).toBe(true);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
      expect(descendants.every((view) => !view.mounted)).toBe(true);
    });
  }
});
