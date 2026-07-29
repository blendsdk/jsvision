/**
 * Specification coverage for primitive galleries whose controls have authored row heights.
 *
 * These examples may expand horizontally and redistribute their teaching regions vertically, but
 * maximizing the dialog must not turn single-line controls or fixed-height text samples into tall
 * panels.
 */
import { Group, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import inputExample from '../examples/controls/input.js';
import labelExample from '../examples/controls/label.js';
import textExample from '../examples/controls/text.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample } from './example-lab-harness.js';

/** Primitive examples whose direct content regions have deliberate, fixed row heights. */
const FIXED_HEIGHT_EXAMPLES: readonly [exampleId: string, definition: ExampleDefinition][] = [
  ['controls/input', inputExample],
  ['controls/text', textExample],
  ['controls/label', labelExample],
];

test.each(FIXED_HEIGHT_EXAMPLES)('%s preserves authored child heights when maximized', (exampleId, definition) => {
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
