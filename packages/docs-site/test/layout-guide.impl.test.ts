/**
 * Implementation hardening for the Layout course laboratories.
 *
 * The specification proves the learner contract. These checks stress repeated geometry changes,
 * nested-pane containment, and interaction state that must survive resize/maximize/restore cycles.
 */
import { describe, expect, test } from 'vitest';
import { createRoot } from '@jsvision/ui';
import type { Application, Dialog, View } from '@jsvision/ui';
import flowExample from '../examples/guides/layout-flow.js';
import overlayExample from '../examples/guides/layout-overlays.js';
import { LayoutLessonPanel } from '../src/example-fixtures/layout/lesson-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

/** Find every colored teaching pane inside a Layout laboratory. */
function lessonPanels(dialog: Dialog): readonly LayoutLessonPanel[] {
  return viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
}

/** Grow a dialog through its real south-east resize grip. */
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

/** Assert that a solved child rectangle remains inside its immediate parent. */
function expectInsideParent(view: View): void {
  const parent = view.parent;
  if (parent === null) throw new Error(`${view.constructor.name} has no parent`);
  expect(view.bounds.x).toBeGreaterThanOrEqual(0);
  expect(view.bounds.y).toBeGreaterThanOrEqual(0);
  expect(view.bounds.x + view.bounds.width).toBeLessThanOrEqual(parent.bounds.width);
  expect(view.bounds.y + view.bounds.height).toBeLessThanOrEqual(parent.bounds.height);
}

describe('Layout Flow Workshop implementation', () => {
  test('should preserve interaction state and nested pane containment across every geometry mode', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/layout-flow', flowExample, {
        viewport: { width: 120, height: 40 },
      });
      const panels = lessonPanels(dialog);
      const navigation = panels.find((panel) => panel.lessonName === 'Navigation');
      const workspace = panels.find((panel) => panel.lessonName === 'Workspace');
      const inspector = panels.find((panel) => panel.lessonName === 'Inspector');
      if (navigation === undefined || workspace === undefined || inspector === undefined) {
        throw new Error('the flow lesson is missing a principal pane');
      }

      app.loop.dispatch(key('b', { alt: true }));
      app.loop.dispatch(key('s', { alt: true }));
      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toContain('Weights: 1:1 · Sidebar: 18 cells · Padding: 2');

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedPanels = panels.map((panel) => ({ panel, bounds: { ...panel.bounds } }));
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      for (const panel of panels) expectInsideParent(panel);
      expect(Math.abs(workspace.bounds.width - inspector.bounds.width)).toBeLessThanOrEqual(1);
      expect(navigation.bounds.width).toBe(18);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      for (const panel of panels) expectInsideParent(panel);
      expect(frameText(app)).toContain('Weights: 1:1 · Sidebar: 18 cells · Padding: 2');

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      expect(dialog.bounds).toEqual(resizedDialog);
      for (const { panel, bounds } of resizedPanels) expect(panel.bounds).toEqual(bounds);
      dispose();
    });
  });
});

describe('Layout Overlay Workshop implementation', () => {
  test('should re-anchor every layer and restore exact rectangles after a reader resize', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/layout-overlays', overlayExample, {
        viewport: { width: 120, height: 40 },
      });
      const panels = lessonPanels(dialog);
      const base = panels.find((panel) => panel.lessonName === 'Base layer');
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (base === undefined || card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a layer');
      }

      resizeDialog(app, dialog);
      const resizedDialog = { ...dialog.bounds };
      const resizedBase = { ...base.bounds };
      const resizedCard = { ...card.bounds };
      const resizedBadge = { ...badge.bounds };

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      expect(base.bounds.width).toBeGreaterThan(resizedBase.width);
      expect(base.bounds.height).toBeGreaterThan(resizedBase.height);
      expect(card.bounds).toMatchObject({ width: resizedCard.width, height: resizedCard.height });
      expect(card.bounds.x).toBeGreaterThan(resizedCard.x);
      expect(card.bounds.y).toBeGreaterThan(resizedCard.y);
      expect(badge.bounds.x).toBeGreaterThan(resizedBadge.x);
      expect(badge.bounds.y).toBe(resizedBadge.y);

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resizedDialog);
      expect(base.bounds).toEqual(resizedBase);
      expect(card.bounds).toEqual(resizedCard);
      expect(badge.bounds).toEqual(resizedBadge);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });

  test('should retain hidden-layer state and return visible layers to stable anchors', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/layout-overlays', overlayExample, {
        viewport: { width: 120, height: 40 },
      });
      const panels = lessonPanels(dialog);
      const base = panels.find((panel) => panel.lessonName === 'Base layer');
      const card = panels.find((panel) => panel.lessonName === 'Centered card');
      const badge = panels.find((panel) => panel.lessonName === 'NEW');
      if (base === undefined || card === undefined || badge === undefined) {
        throw new Error('the overlay lesson is missing a layer');
      }
      const compactBase = { ...base.bounds };

      app.loop.dispatch(key('c', { alt: true }));
      app.loop.dispatch(key('n', { alt: true }));
      resizeDialog(app, dialog);
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(card.state.visible).toBe(false);
      expect(badge.state.visible).toBe(false);

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      app.loop.dispatch(key('c', { alt: true }));
      app.loop.dispatch(key('n', { alt: true }));
      expect(card.state.visible).toBe(true);
      expect(badge.state.visible).toBe(true);
      expect(base.bounds).not.toEqual(compactBase);
      expectInsideParent(base);
      expectInsideParent(card);
      expectInsideParent(badge);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dispose();
    });
  });
});
