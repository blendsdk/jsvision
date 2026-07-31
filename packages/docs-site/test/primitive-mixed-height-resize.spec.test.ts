/**
 * Specification coverage for primitive workspaces that combine fixed chrome with one growing pane.
 */
import { Group, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { buildLabExample } from './example-lab-harness.js';
import { MIXED_HEIGHT_EXAMPLES } from './contracts/primitive-resize.js';

test.each(MIXED_HEIGHT_EXAMPLES)('%s grows only its %s pane when maximized', async (exampleId, expectedGrowingType) => {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`${exampleId} is not registered`);
  const definition = (await entry.load()).default;

  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition, { viewport: { width: 120, height: 40 } });
    try {
      const content = dialog.children.find((child): child is Group => child instanceof Group);
      if (content === undefined) throw new Error(`${exampleId} has no inset content group`);
      const compactBounds = content.children.map((child) => ({ ...child.bounds }));

      dialog.zoom();
      app.loop.renderRoot.flush();

      const growingChildren = content.children.filter(
        (child, index) => child.bounds.height > (compactBounds[index]?.height ?? 0),
      );
      expect(growingChildren.map((child) => child.constructor.name)).toEqual([expectedGrowingType]);
      content.children.forEach((child, index) => {
        if (child === growingChildren[0]) return;
        expect(child.bounds.height).toBe(compactBounds[index]?.height);
      });

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(content.children.map((child) => child.bounds)).toEqual(compactBounds);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
