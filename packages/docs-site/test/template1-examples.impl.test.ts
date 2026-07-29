/**
 * Implementation tests for template1 diagnostics and headless laboratory isolation.
 */
import { createRoot, Group } from '@jsvision/ui';
import type { Application, Dialog, View } from '@jsvision/ui';
import { beforeAll, describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { demoApp } from '../src/demo-shell.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';
import type { ExampleAction } from './contracts/_contract.js';

const BUTTON_EXAMPLE_ID = 'controls/button';
let buttonDefinition: ExampleDefinition;

/** Load the real Button reference instead of duplicating its geometry in a test fixture. */
beforeAll(async () => {
  const entry = EXAMPLES.find((candidate) => candidate.id === BUTTON_EXAMPLE_ID);
  if (entry === undefined) throw new Error('the Button reference example is not registered');
  buttonDefinition = (await entry.load()).default;
});

/**
 * Build one independently owned application and guarantee both render and reactive teardown.
 *
 * The render loop owns mounted view resources while the reactive root owns signals created during
 * the example build. Both lifetimes must end between cases to keep focus and subscriptions isolated.
 */
function withButtonLab(run: (app: Application, dialog: Dialog) => void, viewport?: { width: number; height: number }) {
  createRoot((disposeRoot) => {
    const { app, dialog } = buildLabExample(BUTTON_EXAMPLE_ID, buttonDefinition, { viewport });
    try {
      run(app, dialog);
    } finally {
      app.loop.dispose();
      disposeRoot();
    }
  });
}

/** Describe the focused view without retaining an object from an application that will be disposed. */
function focusedSignature(dialog: Dialog): string {
  const focused = viewsIn(dialog).find((view) => view.state.focused);
  if (focused === undefined) return 'none';
  return `${focused.constructor.name}:${focused.bounds.x},${focused.bounds.y}`;
}

describe('template1 geometry diagnostics', () => {
  test.each([
    { width: 80, height: 24 },
    { width: 79, height: 23 },
  ])('centers the reference with floor rounding in a $width x $height viewport', (viewport) => {
    withButtonLab((app, dialog) => {
      const evidence = collectTemplate1Evidence(app, dialog);
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error('the Button reference requires a desktop');
      expect(evidence.viewport).toEqual(viewport);
      expect(evidence.dialogRect.x).toBe(Math.floor((desktop.bounds.width - dialog.bounds.width) / 2));
      expect(evidence.dialogRect.y).toBe(Math.floor((desktop.bounds.height - dialog.bounds.height) / 2));
    }, viewport);
  });

  test('rejects content that loses the one-cell inset beyond the dialog border', () => {
    withButtonLab((app, dialog) => {
      const content = dialog.children[0];
      if (content === undefined) throw new Error('the Button reference has no dialog content');
      content.bounds = { ...content.bounds, x: 1 };
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/one cell of padding/);
    });
  });

  test('rejects a visibly broken dialog frame', () => {
    withButtonLab((app, dialog) => {
      const origin = absoluteOrigin(dialog);
      const topLeft = app.loop.renderRoot.buffer().get(origin.x, origin.y);
      if (topLeft === undefined) throw new Error('the dialog corner lies outside the render buffer');
      topLeft.char = ' ';
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/frame must be visibly complete/);
    });
  });

  test('reports an actionable margin diagnostic when the viewport cannot contain the reference', () => {
    withButtonLab(
      (app, dialog) => {
        expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/visible desktop margin/);
      },
      { width: 70, height: 20 },
    );
  });

  test('rejects a full-desktop dialog even when its centered flag remains set', () => {
    withButtonLab((app, dialog) => {
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error('the Button reference requires a desktop');
      dialog.bounds = { x: 0, y: 0, width: desktop.bounds.width, height: desktop.bounds.height };
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/visible desktop margin/);
    });
  });

  test.each([
    ['manual positioning', (dialog: Dialog) => (dialog.centered = false), /automatic centering/],
    ['a close box', (dialog: Dialog) => (dialog.closable = true), /non-closable/],
    ['a custom surface', (dialog: Dialog) => (dialog.background = 'desktop'), /must not override/],
  ])('rejects %s', (_case, mutate, message) => {
    withButtonLab((app, dialog) => {
      mutate(dialog);
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(message);
    });
  });

  test('rejects a custom background on the root content surface', () => {
    withButtonLab((app, dialog) => {
      const content = dialog.children[0];
      if (!(content instanceof Group)) throw new Error('the Button reference has no root content group');
      content.background = 'desktop';
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/content must not override/);
    });
  });

  test('rejects a child that clips outside the padded content area', () => {
    withButtonLab((app, dialog) => {
      const content = dialog.children[0];
      const child = content instanceof Group ? content.children[0] : undefined;
      if (child === undefined) throw new Error('the Button reference has no content child');
      child.bounds = { ...child.bounds, x: -1 };
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/children must stay inside/);
    });
  });

  test('rejects a laboratory that omits visible interaction instructions', () => {
    withButtonLab((app, dialog) => {
      const origin = absoluteOrigin(dialog);
      const buffer = app.loop.renderRoot.buffer();
      for (let y = origin.y + 1; y < origin.y + dialog.bounds.height - 1; y += 1) {
        for (let x = origin.x + 1; x < origin.x + dialog.bounds.width - 1; x += 1) {
          const cell = buffer.get(x, y);
          if (cell !== undefined) cell.char = ' ';
        }
      }
      expect(() => collectTemplate1Evidence(app, dialog)).toThrow(/keyboard or mouse instructions/);
    });
  });

  test('rejects a bare view and an app without a dialog', () => {
    const bareDefinition: ExampleDefinition = {
      title: 'Bare',
      blurb: 'A deliberately invalid bare component fixture.',
      build: () => new Group(),
    };
    const noDialogDefinition: ExampleDefinition = {
      title: 'No dialog',
      blurb: 'A deliberately invalid application fixture without a dialog.',
      build: (ctx) => demoApp(ctx),
    };
    expect(() => buildLabExample(BUTTON_EXAMPLE_ID, bareDefinition)).toThrow(/must build an Application/);
    expect(() => buildLabExample(BUTTON_EXAMPLE_ID, noDialogDefinition)).toThrow(/did not render in a dialog/);
  });

  test('dispatches a typed mouse click through the real application loop', () => {
    withButtonLab((app) => {
      const focused = app.loop.getFocused();
      if (focused === null) throw new Error('the Button reference has no initially focused action');
      const origin = absoluteOrigin(focused);
      const action: ExampleAction = {
        kind: 'mouse',
        gesture: 'click',
        at: { x: origin.x + 1, y: origin.y },
        button: 'left',
      };
      dispatchExampleAction(app, action);
      expect(frameText(app)).toContain('Last action: Preview callback');
    });
  });
});

describe('template1 case isolation', () => {
  test('a fresh build restores the initial focus after a prior interaction', () => {
    let initialFocus = '';
    let interactedFocus = '';
    withButtonLab((app, dialog) => {
      initialFocus = focusedSignature(dialog);
      app.loop.dispatch(key('n', { alt: true }));
      interactedFocus = focusedSignature(dialog);
    });

    expect(interactedFocus).not.toBe(initialFocus);
    withButtonLab((_app, dialog) => {
      expect(focusedSignature(dialog)).toBe(initialFocus);
    });
  });

  test('disposing the loop unmounts every view scope exactly once', () => {
    createRoot((disposeRoot) => {
      const { app, dialog } = buildLabExample(BUTTON_EXAMPLE_ID, buttonDefinition);
      const mountedViews: View[] = viewsIn(dialog);
      expect(mountedViews.every((view) => view.disposeScope !== null)).toBe(true);

      app.loop.dispose();
      expect(mountedViews.every((view) => view.disposeScope === null && !view.mounted)).toBe(true);
      expect(() => app.loop.dispose()).not.toThrow();
      disposeRoot();
    });
  });
});
