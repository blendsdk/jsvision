/**
 * Specification tests for the GroupBox teaching page and its real template1 laboratory.
 *
 * The assertions describe the documented user experience independently from the example source:
 * compact Classic geometry, passive framing, live captions, descendant focus, and responsive
 * resize/maximize/restore behavior.
 */
import { Button, GroupBox, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import groupBoxDefinition from '../examples/containers/group-box.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

const EXAMPLE_ID = 'containers/group-box';

describe('GroupBox component laboratory', () => {
  test('renders the approved component-specific states in a compact Classic template1 dialog', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(EXAMPLE_ID, groupBoxDefinition);
      try {
        const evidence = collectTemplate1Evidence(app, dialog);
        const boxes = viewsIn(dialog).filter((view): view is GroupBox => view instanceof GroupBox);
        const text = frameText(app);

        expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
        expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
        expect(boxes).toHaveLength(4);
        expect(boxes.some((box) => box.castsShadow)).toBe(true);
        expect(text).toContain('Application');
        expect(text).toContain('Modules: 2');
        expect(text).toContain('Deployment modules with');
        expect(text).toContain('Nested content');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('updates the reactive caption and leaves focus ownership with the nested action', () => {
    createRoot((dispose) => {
      const { app } = buildLabExample(EXAMPLE_ID, groupBoxDefinition);
      try {
        dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
        expect(app.loop.getFocused()).toBeInstanceOf(Button);

        dispatchExampleAction(app, { kind: 'key', key: 'a', modifiers: ['Alt'] });
        expect(frameText(app)).toContain('Modules: 3');
        expect(frameText(app)).toContain('Status: Added module 3');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('keeps the GroupBox workspace padded and unclipped through resize, maximize, and restore', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(EXAMPLE_ID, groupBoxDefinition, {
        viewport: { width: 120, height: 40 },
      });
      try {
        const workspace = viewsIn(dialog).find((view): view is GroupBox => view instanceof GroupBox);
        if (workspace === undefined) throw new Error('missing GroupBox workspace');
        const compact = { ...dialog.bounds };
        const compactWorkspaceHeight = workspace.bounds.height;
        const origin = absoluteOrigin(dialog);
        const corner = {
          x: origin.x + dialog.bounds.width - 1,
          y: origin.y + dialog.bounds.height - 1,
        };

        dispatchExampleAction(app, {
          kind: 'mouse',
          gesture: 'drag',
          at: corner,
          to: { x: corner.x + 8, y: corner.y + 4 },
        });
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
        const resized = { ...dialog.bounds };
        expect(workspace.bounds.height).toBeGreaterThan(compactWorkspaceHeight);

        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
        dialog.zoom();
        app.loop.renderRoot.flush();

        expect(dialog.bounds).toEqual(resized);
        expect(dialog.bounds.width).toBeGreaterThan(compact.width);
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });
});
