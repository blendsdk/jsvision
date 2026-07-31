import { Button, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import anatomyDefinition from '../examples/guides/widget-anatomy.js';
import compositionDefinition from '../examples/guides/widget-composition.js';
import { WidgetAnatomyPanel } from '../src/example-fixtures/writing-your-own-widget/widget-anatomy-panel.js';
import { WidgetCompositionPanel } from '../src/example-fixtures/writing-your-own-widget/widget-composition-panel.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

/** Find one fixture view by its exported class and fail with an actionable test error. */
function fixtureIn<T>(dialog: Parameters<typeof viewsIn>[0], fixture: abstract new (...args: never[]) => T): T {
  const view = viewsIn(dialog).find(
    (candidate): candidate is T & Parameters<typeof viewsIn>[0] => candidate instanceof fixture,
  );
  if (view === undefined) throw new Error(`Missing ${fixture.name} in the widget laboratory`);
  return view;
}

/** Read the rendered style at a view's first absolute cell. */
function styleAt(
  app: ReturnType<typeof buildLabExample>['app'],
  view: Parameters<typeof absoluteOrigin>[0],
): { readonly fg: unknown; readonly bg: unknown; readonly attrs: unknown } {
  const origin = absoluteOrigin(view);
  const cell = app.loop.renderRoot.buffer().rows()[origin.y]?.[origin.x];
  if (cell === undefined) throw new Error('The tested view has no rendered origin cell');
  return { fg: cell.fg, bg: cell.bg, attrs: cell.attrs };
}

describe('Writing your own widget laboratory hardening', () => {
  test('should return zero intrinsic size when no cells are available', () => {
    const panel = new WidgetAnatomyPanel();
    expect(panel.meter.measure({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 });
  });

  test('should distinguish repaint, reflow, focus theme state, and Unicode evidence', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/widget-anatomy', anatomyDefinition);
      const panel = fixtureIn(dialog, WidgetAnatomyPanel);
      const increment = viewsIn(dialog).find(
        (view): view is Button => view instanceof Button && view.activation.label === 'Increment',
      );
      if (increment === undefined) throw new Error('Missing Increment action');

      const draws = panel.draws;
      panel.meter.invalidate();
      app.loop.renderRoot.flush();
      expect(panel.draws).toBeGreaterThan(draws);

      const measurements = panel.measurements;
      panel.meter.invalidateLayout();
      app.loop.renderRoot.flush();
      expect(panel.measurements).toBeGreaterThan(measurements);

      const focusedStyle = styleAt(app, panel.meter);
      app.loop.focusView(increment);
      const restingStyle = styleAt(app, panel.meter);
      expect(restingStyle).not.toEqual(focusedStyle);
      app.loop.focusView(panel.meter);
      expect(styleAt(app, panel.meter)).toEqual(focusedStyle);
      expect(frameText(app)).toMatch(/[█#]\s+value/iu);

      const incrementOrigin = absoluteOrigin(increment);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: incrementOrigin.x + 1, y: incrementOrigin.y },
      });
      expect(panel.mouseActions).toBe(1);
      expect(panel.lastMouseLocal).toBe('0,0');
      expect(frameText(app)).toMatch(/Action source:\s*mouse[\s\S]*Local:\s*0,0/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should keep capability, headless, and disposal evidence deterministic across repeats', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/widget-composition', compositionDefinition);
      const panel = fixtureIn(dialog, WidgetCompositionPanel);
      for (let index = 0; index < 3; index += 1) {
        panel.checkCapabilities('keyboard');
        panel.checkClipping('keyboard');
        panel.checkHeadless('keyboard');
        app.loop.renderRoot.flush();
      }
      expect(panel.capabilityChecks).toBe(3);
      expect(panel.clippingChecks).toBe(3);
      expect(frameText(app)).toMatch(/Clipping:\s*pass[\s\S]*Overflow:\s*none/iu);
      expect(frameText(app)).toMatch(/Unicode:\s*█[\s\S]*ASCII:\s*#[\s\S]*Meaning:\s*same/iu);
      expect(frameText(app)).toMatch(/Headless:\s*pass/iu);
      app.loop.dispose();
      expect(panel.cleanupCount).toBe(2);
      app.loop.dispose();
      expect(panel.cleanupCount).toBe(2);
      dispose();
    });
  });

  test.each([
    ['guides/widget-anatomy', anatomyDefinition],
    ['guides/widget-composition', compositionDefinition],
  ] as const)('should preserve %s through resize, maximize, and restore', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      const origin = absoluteOrigin(dialog);
      const corner = {
        x: origin.x + dialog.bounds.width - 1,
        y: origin.y + dialog.bounds.height - 1,
      };
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'drag',
        at: corner,
        to: { x: corner.x + 8, y: corner.y + 3 },
      });
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      const resized = { ...dialog.bounds };
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      app.loop.dispose();
      dispose();
    });
  });
});
