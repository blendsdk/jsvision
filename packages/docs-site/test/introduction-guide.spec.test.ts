/**
 * Specification coverage for the Introduction course and its runtime laboratory.
 *
 * A first-time reader must understand the relationship between a JSVision application, the host
 * runtime that drives it, and the terminal frame the user sees. The course then provides one real
 * first-run application and routes the reader toward the next course that matches their goal.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Button, Commands, Text, createApplication, createRoot, signal, statusItem, statusLine } from '@jsvision/ui';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { RuntimeStagePanel } from '../src/example-fixtures/introduction/runtime-stage-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'index.md'), 'utf8');
const EXAMPLE_ID = 'guides/introduction-runtime';

/** Load the published Introduction example through the same lazy registry used by the docs site. */
async function loadRuntimeExample(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === EXAMPLE_ID);
  if (entry === undefined) throw new Error(`the ${EXAMPLE_ID} laboratory is not registered`);
  const module = await entry.load();
  return module.default;
}

describe('Introduction course content', () => {
  test('should teach the application and runtime model before the first useful result', () => {
    const requiredLessons = [
      '## Who this course is for',
      '## Mental model',
      '## Your first JSVision application',
      '## Run the application',
      '## Common first-run failures',
      '## Choose your next course',
      '## Practice',
    ];

    for (const lesson of requiredLessons) expect(GUIDE).toContain(lesson);
    expect(GUIDE).toMatch(/\bapplication\b[\s\S]*\b(?:host|runtime)\b[\s\S]*\b(?:terminal|frame)\b/iu);
    expect(GUIDE).toMatch(/\bNode\b[\s\S]*\binteractive terminal\b/iu);
    expect(GUIDE).toMatch(/\bbrowser host\b[\s\S]*\breal\s+application\b/iu);
    expect(GUIDE).toMatch(/```ts[\s\S]*from '@jsvision\/ui'[\s\S]*\bcreateApplication\s*\(/u);
    expect(GUIDE).toContain("statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')");
    expect(GUIDE).toContain(`<PlayExample id="${EXAMPLE_ID}"`);
  });

  test('should render the advertised quit chord and bind it to the standard command', () => {
    const exit = statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X');
    const app = createApplication({
      content: new Text('Hello from JSVision'),
      statusLine: statusLine([exit]),
    });

    app.loop.resize({ width: 80, height: 24 });
    expect(frameText(app)).toContain('Alt-X Quit');
    expect(exit.key).toBe('Alt+X');
    expect(exit.command).toBe(Commands.quit);
    app.loop.dispose();
  });

  test('should direct each beginner goal to a real follow-on course', () => {
    expect(GUIDE).toContain('](/guide/install-and-packages)');
    expect(GUIDE).toContain('](/guide/layout)');
    expect(GUIDE).toContain('](/guide/reactive-state)');
    expect(GUIDE).toContain('](/guide/codex-plugin)');
  });

  test('should register the runtime lesson as one complete Guide application', () => {
    const introductionEntries = EXAMPLES.filter((entry) => entry.id.startsWith('guides/introduction'));

    expect(
      introductionEntries.map(({ id, kind, sourcePath }) => ({
        id,
        kind,
        sourcePath,
      })),
    ).toEqual([
      {
        id: EXAMPLE_ID,
        kind: 'app',
        sourcePath: 'examples/guides/introduction-runtime.ts',
      },
    ]);
  });
});

describe('Introduction Runtime Lab', () => {
  test('should open as a compact centered Classic lesson with the complete runtime pipeline', async () => {
    const definition = await loadRuntimeExample();

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(EXAMPLE_ID, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      const rendered = frameText(app);

      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(rendered).toContain('Application');
      expect(rendered).toContain('Host runtime');
      expect(rendered).toContain('Terminal frame');
      expect(rendered).toContain('Stage 1 of 3');
      dispose();
    });
  });

  test('should advance and reset the highlighted runtime stage through keyboard actions', async () => {
    const definition = await loadRuntimeExample();

    createRoot((dispose) => {
      const { app } = buildLabExample(EXAMPLE_ID, definition);

      app.loop.dispatch(key('n', { alt: true }));
      expect(frameText(app)).toContain('Stage 2 of 3');
      expect(frameText(app)).toMatch(/Host runtime[\s\S]*CURRENT/u);

      app.loop.dispatch(key('n', { alt: true }));
      expect(frameText(app)).toContain('Stage 3 of 3');
      expect(frameText(app)).toMatch(/Terminal frame[\s\S]*CURRENT/u);

      app.loop.dispatch(key('r', { alt: true }));
      expect(frameText(app)).toContain('Stage 1 of 3');
      dispose();
    });
  });

  test('should preserve the complete Classic lesson through resize, maximize, and restore', async () => {
    const definition = await loadRuntimeExample();

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(EXAMPLE_ID, definition);
      const labels = viewsIn(dialog)
        .filter((view): view is Button => view instanceof Button)
        .map((button) => button.activation.label);
      const requiredContent = ['Application', 'Host runtime', 'Terminal frame', 'Next stage', 'Reset', 'Alt+N next'];

      expect(labels).toEqual(['Next stage', 'Reset']);

      app.loop.resize({ width: 100, height: 32 });
      const authored = { ...dialog.bounds };
      const origin = absoluteOrigin(dialog);
      const resizeFrom = {
        x: origin.x + dialog.bounds.width - 1,
        y: origin.y + dialog.bounds.height - 1,
      };
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'drag',
        at: resizeFrom,
        to: { x: resizeFrom.x + 12, y: resizeFrom.y + 4 },
      });
      const resized = collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      const compact = { ...dialog.bounds };
      for (const text of requiredContent) expect(frameText(app)).toContain(text);
      expect(resized.dialogRect.width).toBeGreaterThan(authored.width);
      expect(resized.dialogRect.height).toBeGreaterThan(authored.height);
      expect(resized.dialogRect.width).toBeLessThan(resized.viewport.width);
      expect(resized.dialogRect.height).toBeLessThan(resized.viewport.height - 2);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      for (const text of requiredContent) expect(frameText(app)).toContain(text);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(compact);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      for (const text of requiredContent) expect(frameText(app)).toContain(text);
      dispose();
    });
  });

  test('should release the stage-panel reactive binding when its application is disposed', () => {
    const active = signal(true);
    let reads = 0;
    const panel = new RuntimeStagePanel('Application', 'views + commands', () => {
      reads += 1;
      return active();
    });
    const app = createApplication({ content: panel });

    app.loop.resize({ width: 80, height: 24 });
    const mountedReads = reads;
    active.set(false);
    expect(reads).toBeGreaterThan(mountedReads);

    app.loop.dispose();
    const disposedReads = reads;
    active.set(true);
    expect(reads).toBe(disposedReads);
  });
});
