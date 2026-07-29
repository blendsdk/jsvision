/**
 * Specification coverage for the shared template1 example dialog foundation.
 */
import { Group, at, createApplication, createRoot } from '@jsvision/ui';
import { expect, test } from 'vitest';
import { Template1Dialog } from '../src/template1-dialog.js';
import { EXAMPLE_CAPS } from './example-lab-harness.js';

/** Mount one template dialog in a real desktop and return its owned application. */
function mountTemplateDialog(dialog: Template1Dialog) {
  const app = createApplication({
    caps: EXAMPLE_CAPS,
    viewport: { width: 80, height: 24 },
  });
  app.desktop.addWindow(dialog);
  app.loop.renderRoot.flush();
  return app;
}

// Template dialogs always expose the affordances, but maximized startup requires explicit approval.
test('opens centered by default while remaining resizable and maximizable', () => {
  createRoot((dispose) => {
    const dialog = new Template1Dialog({ title: 'Default', width: 40, height: 12 });
    const app = mountTemplateDialog(dialog);
    try {
      expect(dialog.resizable).toBe(true);
      expect(dialog.zoomable).toBe(true);
      expect(dialog.closable).toBe(false);
      expect(dialog.isZoomed()).toBe(false);
      expect(dialog.centered).toBe(true);
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('starts maximized only when the individual example opts in', () => {
  createRoot((dispose) => {
    const dialog = new Template1Dialog({
      title: 'Reviewed workspace',
      width: 40,
      height: 12,
      startMaximized: true,
    });
    const app = mountTemplateDialog(dialog);
    try {
      expect(dialog.isZoomed()).toBe(true);
      expect(dialog.bounds).toEqual({
        x: 0,
        y: 0,
        width: app.desktop.bounds.width,
        height: app.desktop.bounds.height,
      });
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('stretches a standard padded content group across maximize and restore', () => {
  createRoot((dispose) => {
    const dialog = new Template1Dialog({ title: 'Responsive default', width: 40, height: 12 });
    const content = new Group();
    const specimen = new Group();
    content.add(at(specimen, 2, 2, 10, 2));
    dialog.add(at(content, 1, 1, 36, 8));
    const app = mountTemplateDialog(dialog);
    try {
      const compactBounds = { ...content.bounds };
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(content.bounds).toEqual({ x: 2, y: 2, width: dialog.bounds.width - 4, height: dialog.bounds.height - 4 });
      expect(specimen.bounds.width).toBeGreaterThan(10);
      expect(specimen.bounds.height).toBeGreaterThan(2);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(content.bounds).toEqual(compactBounds);
      expect(specimen.bounds).toEqual({ x: 2, y: 2, width: 10, height: 2 });
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});

test('can preserve authored child heights while positions and widths remain responsive', () => {
  createRoot((dispose) => {
    const dialog = new Template1Dialog({
      title: 'Fixed-height controls',
      width: 40,
      height: 12,
      preserveChildHeights: true,
    });
    const content = new Group();
    const specimen = new Group();
    content.add(at(specimen, 2, 2, 10, 2));
    dialog.add(at(content, 1, 1, 36, 8));
    const app = mountTemplateDialog(dialog);
    try {
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(specimen.bounds.width).toBeGreaterThan(10);
      expect(specimen.bounds.height).toBe(2);

      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(specimen.bounds).toEqual({ x: 2, y: 2, width: 10, height: 2 });
    } finally {
      app.loop.dispose();
      dispose();
    }
  });
});
