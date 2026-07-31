/**
 * Implementation hardening for the Introduction route and runtime teaching fixture.
 *
 * These checks protect catalog/registry parity, remove the superseded generic hello binding, and
 * exercise stage-cycle edges that are intentionally more detailed than the learner-facing oracle.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { createRoot } from '@jsvision/ui';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { RuntimeStagePanel } from '../src/example-fixtures/introduction/runtime-stage-panel.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import { buildLabExample, frameText, key } from './example-lab-harness.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = readFileSync(join(PACKAGE_ROOT, 'guide', 'index.md'), 'utf8');
const GUIDE_CATALOG = parseGuideCatalog(readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8'));
const EXAMPLE_ID = 'guides/introduction-runtime';

/** Resolve the real lazy-loaded runtime example or fail with a focused registry diagnostic. */
async function loadRuntimeExample(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === EXAMPLE_ID);
  if (entry === undefined) throw new Error(`the ${EXAMPLE_ID} laboratory is not registered`);
  return (await entry.load()).default;
}

describe('Introduction implementation hardening', () => {
  test('should bind the course to its Guide-owned example without retaining the generic hello demo', () => {
    const entry = GUIDE_CATALOG.entries.find((candidate) => candidate.id === 'introduction');

    expect(entry?.examples).toEqual([EXAMPLE_ID]);
    expect(GUIDE).toContain(`<PlayExample id="${EXAMPLE_ID}"`);
    expect(GUIDE).not.toContain('<PlayExample id="apps/hello"');
  });

  test('should report a stable three-row natural size for every runtime stage', () => {
    const panel = new RuntimeStagePanel('Host runtime', 'input + resize', () => true);

    expect(panel.measure()).toEqual({ width: 14, height: 3 });
  });

  test('should keep exactly one explicit current marker while cycling through every stage', async () => {
    const definition = await loadRuntimeExample();

    createRoot((dispose) => {
      const { app } = buildLabExample(EXAMPLE_ID, definition);
      const currentMarkers = (): number => frameText(app).match(/CURRENT/gu)?.length ?? 0;

      expect(currentMarkers()).toBe(1);
      app.loop.dispatch(key('n', { alt: true }));
      expect(currentMarkers()).toBe(1);
      app.loop.dispatch(key('n', { alt: true }));
      expect(currentMarkers()).toBe(1);
      dispose();
    });
  });

  test('should wrap from the terminal frame to the application and reset from any stage', async () => {
    const definition = await loadRuntimeExample();

    createRoot((dispose) => {
      const { app } = buildLabExample(EXAMPLE_ID, definition);

      app.loop.dispatch(key('n', { alt: true }));
      app.loop.dispatch(key('n', { alt: true }));
      app.loop.dispatch(key('n', { alt: true }));
      expect(frameText(app)).toContain('Stage 1 of 3');

      app.loop.dispatch(key('n', { alt: true }));
      app.loop.dispatch(key('r', { alt: true }));
      expect(frameText(app)).toContain('Stage 1 of 3');
      dispose();
    });
  });
});
