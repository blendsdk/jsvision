/**
 * Implementation coverage for the responsive overlay lesson.
 *
 * The specification proves the lesson and its actions. This file checks the stack's concrete resize
 * mechanics: fill layers grow, fixed overlays keep their authored size, anchors move, and restore
 * returns every layer to its compact rectangle.
 */
import { expect, test } from 'vitest';
import { createRoot } from '@jsvision/ui';
import overlayExample from '../examples/guides/layout-overlays.js';
import { LayoutLessonPanel } from '../src/example-fixtures/layout/lesson-panel.js';
import { buildLabExample, viewsIn } from './example-lab-harness.js';

test('overlay layers resize, re-anchor, and restore without changing their intended sizing mode', () => {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample('guides/layout-overlays', overlayExample, {
      viewport: { width: 120, height: 40 },
    });
    const panels = viewsIn(dialog).filter((view): view is LayoutLessonPanel => view instanceof LayoutLessonPanel);
    const base = panels.find((panel) => panel.lessonName === 'Base layer');
    const card = panels.find((panel) => panel.lessonName === 'Centered card');
    const badge = panels.find((panel) => panel.lessonName === 'NEW');
    if (base === undefined || card === undefined || badge === undefined) {
      throw new Error('the overlay lesson is missing a layer');
    }
    const compactBase = { ...base.bounds };
    const compactCard = { ...card.bounds };
    const compactBadge = { ...badge.bounds };

    dialog.zoom();
    app.loop.renderRoot.flush();
    app.loop.renderRoot.flush();

    expect(base.bounds.width).toBeGreaterThan(compactBase.width);
    expect(base.bounds.height).toBeGreaterThan(compactBase.height);
    expect(card.bounds.width).toBe(compactCard.width);
    expect(card.bounds.height).toBe(compactCard.height);
    expect(card.bounds.x).toBeGreaterThan(compactCard.x);
    expect(card.bounds.y).toBeGreaterThan(compactCard.y);
    expect(badge.bounds.x).toBeGreaterThan(compactBadge.x);
    expect(badge.bounds.y).toBe(compactBadge.y);

    dialog.zoom();
    app.loop.renderRoot.flush();
    app.loop.renderRoot.flush();

    expect(base.bounds).toEqual(compactBase);
    expect(card.bounds).toEqual(compactCard);
    expect(badge.bounds).toEqual(compactBadge);
    dispose();
  });
});
