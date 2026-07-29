/**
 * Specification coverage for primitive galleries whose controls have authored row heights.
 *
 * These examples may expand horizontally and redistribute their teaching regions vertically, but
 * maximizing the dialog must not turn single-line controls or fixed-height text samples into tall
 * panels.
 */
import { Group, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { buildLabExample } from './example-lab-harness.js';
import { FIXED_HEIGHT_EXAMPLE_IDS } from './contracts/primitive-resize.js';

test.each(FIXED_HEIGHT_EXAMPLE_IDS)('%s preserves authored child heights when maximized', async (exampleId) => {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`${exampleId} is not registered`);
  const definition = (await entry.load()).default;
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition, { viewport: { width: 120, height: 40 } });
    try {
      const content = dialog.children.find((child): child is Group => child instanceof Group);
      if (content === undefined) throw new Error(`${exampleId} has no inset content group`);
      const compactHeights = content.children.map((child) => child.bounds.height);
      const compactWidths = content.children.map((child) => child.bounds.width);

      dialog.zoom();
      app.loop.renderRoot.flush();

      expect(content.children.map((child) => child.bounds.height)).toEqual(compactHeights);
      expect(content.children.some((child, index) => child.bounds.width > (compactWidths[index] ?? 0))).toBe(true);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
