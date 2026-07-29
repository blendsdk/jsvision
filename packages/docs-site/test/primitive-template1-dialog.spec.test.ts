/**
 * Specification coverage for the shared dialog behavior of every standard component example.
 */
import { readFileSync } from 'node:fs';
import { Group, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { parseComponentCatalog } from '../src/components/component-catalog.mjs';
import { Template1Dialog } from '../src/template1-dialog.js';
import { buildLabExample, collectTemplate1Evidence } from './example-lab-harness.js';

const catalog = parseComponentCatalog(
  readFileSync(new URL('../components.json', import.meta.url), 'utf8'),
  'components.json',
);

/** Catalog-owned examples for standard components, excluding specialist hub laboratories. */
const STANDARD_COMPONENT_EXAMPLE_IDS = catalog.entries.flatMap((entry) =>
  entry.kind === 'component' && entry.complexity === 'standard' ? entry.examples : [],
);

/** Load one registered standard component example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing standard component example ${exampleId}`);
  return (await entry.load()).default;
}

// Every standard component uses the shared resizable shell, but maximized startup remains reserved
// for individually approved examples such as the Data Grid specialist family.
test.each(STANDARD_COMPONENT_EXAMPLE_IDS)(
  '%s uses Template1Dialog and starts in its compact centered state',
  async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        expect(dialog).toBeInstanceOf(Template1Dialog);
        expect(dialog.resizable).toBe(true);
        expect(dialog.zoomable).toBe(true);
        expect(dialog.isZoomed()).toBe(false);
        const compactBounds = { ...dialog.bounds };
        const content = dialog.children.find((child): child is Group => child instanceof Group);
        if (content === undefined) throw new Error(`${exampleId} is missing its padded content group`);
        const responsiveChildren = content.children.filter(
          (child) => child.bounds.width > 0 && child.bounds.height > 0,
        );
        if (responsiveChildren.length === 0) throw new Error(`${exampleId} has no visible content regions to reflow`);
        const compactChildBounds = responsiveChildren.map((child) => ({ ...child.bounds }));
        collectTemplate1Evidence(app, dialog);

        dialog.zoom();
        app.loop.renderRoot.flush();
        expect(dialog.isZoomed()).toBe(true);
        expect(
          responsiveChildren.some((child, index) => {
            const compact = compactChildBounds[index];
            return (
              compact !== undefined &&
              (child.bounds.x !== compact.x ||
                child.bounds.y !== compact.y ||
                child.bounds.width !== compact.width ||
                child.bounds.height !== compact.height)
            );
          }),
        ).toBe(true);
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });

        dialog.zoom();
        app.loop.renderRoot.flush();
        expect(dialog.isZoomed()).toBe(false);
        expect(dialog.bounds).toEqual(compactBounds);
        expect(responsiveChildren.map((child) => child.bounds)).toEqual(compactChildBounds);
        collectTemplate1Evidence(app, dialog);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  },
);
