import { resolveCapabilities, type MouseEvent } from '@jsvision/core';
import { Commands, createApplication } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditorWindow } from './code-editor-window.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Creates a one-based mouse event for a zero-based application coordinate. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** Mounts one real editor window in the standard desktop event path. */
function mountWindow(rect = { x: 5, y: 3, width: 30, height: 10 }) {
  const app = createApplication({ caps, viewport: { width: 60, height: 20 } });
  const controller = createCodeEditorController({
    document: createDocumentModel({
      text: `${'long source line '.repeat(8)}\n${'line\n'.repeat(30)}`,
      languageId: 'typescript',
    }),
  });
  const window = new CodeEditorWindow({ controller, lineNumbers: true });
  window.setLayout({ position: 'absolute', rect });
  window.onResized();
  app.desktop.addWindow(window);
  app.loop.focusView(window.editor);
  app.loop.renderRoot.flush();
  return { app, controller, window };
}

/** Verifies that every piece of window chrome is fitted to the current frame immediately. */
function expectChromeToFit(window: CodeEditorWindow): void {
  const rect = window.layout.rect;
  expect(rect).toBeDefined();
  if (rect === undefined) throw new Error('A mounted CodeEditorWindow must have an absolute frame rectangle.');

  expect(window.editor.layout.rect).toEqual({
    x: 1,
    y: 1,
    width: Math.max(0, rect.width - 2),
    height: Math.max(0, rect.height - 3),
  });
  expect(window.horizontalScrollBar.layout.rect).toEqual({
    x: 1,
    y: Math.max(0, rect.height - 2),
    width: Math.max(0, rect.width - 2),
    height: 1,
  });
  expect(window.verticalScrollBar.layout.rect).toEqual({
    x: Math.max(0, rect.width - 1),
    y: 1,
    width: 1,
    height: Math.max(0, rect.height - 3),
  });
  expect(window.statusView.layout.rect).toEqual({
    x: 1,
    y: Math.max(0, rect.height - 1),
    width: Math.max(0, rect.width - 2),
    height: 1,
  });
  expect(window.editor.viewportMetrics).toMatchObject({
    width: Math.max(0, rect.width - 2),
    height: Math.max(0, rect.height - 3),
  });
  expect(window.editor.desiredCaret()).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
  });
}

describe('CodeEditorWindow managed geometry', () => {
  // Maximize and restore must publish matching frame, chrome, viewport, scrollbar, and caret geometry
  // in the same desktop command tick.
  it('should re-fit editor chrome immediately when maximizing and restoring through the desktop', () => {
    const { app, controller, window } = mountWindow();
    const restored = { ...window.layout.rect };

    app.loop.dispatch({ type: 'command', command: Commands.zoom });
    expect(window.isZoomed()).toBe(true);
    expect(window.layout.rect).toEqual({
      x: 0,
      y: 0,
      width: app.desktop.bounds.width,
      height: app.desktop.bounds.height,
    });
    expectChromeToFit(window);

    app.loop.dispatch({ type: 'command', command: Commands.zoom });
    expect(window.isZoomed()).toBe(false);
    expect(window.layout.rect).toEqual(restored);
    expectChromeToFit(window);
    controller.dispose();
  });

  // A maximized editor follows terminal dimensions, then restores to its saved frame with no stale
  // viewport or scrollbar geometry.
  it('should re-fit a maximized editor across terminal resize and subsequent restore', () => {
    const { app, controller, window } = mountWindow();

    app.loop.dispatch({ type: 'command', command: Commands.zoom });
    app.loop.resize({ width: 44, height: 14 });
    app.loop.renderRoot.flush();

    expect(window.layout.rect).toEqual({ x: 0, y: 0, width: 44, height: 14 });
    expectChromeToFit(window);

    app.loop.dispatch({ type: 'command', command: Commands.zoom });
    expect(window.isZoomed()).toBe(false);
    expectChromeToFit(window);
    controller.dispose();
  });

  // Moving changes only the origin, while corner resize, cascade, and tile immediately re-fit all
  // absolute editor children.
  it('should keep content geometry synchronized for move, corner resize, cascade, and tile', () => {
    const { app, controller, window } = mountWindow();
    const initial = window.layout.rect;
    if (initial === undefined) throw new Error('The mounted editor window requires an initial rectangle.');
    const initialContent = window.editor.layout.rect;

    app.loop.dispatch(mouse('down', initial.x + 10, initial.y));
    app.loop.dispatch(mouse('drag', initial.x + 7, initial.y + 2));
    app.loop.dispatch(mouse('up', initial.x + 7, initial.y + 2));
    expect(window.layout.rect).toEqual({ ...initial, x: initial.x - 3, y: initial.y + 2 });
    expect(window.editor.layout.rect).toEqual(initialContent);

    const moved = window.layout.rect;
    if (moved === undefined) throw new Error('The moved editor window requires an absolute rectangle.');
    app.loop.dispatch(mouse('down', moved.x + moved.width - 1, moved.y + moved.height - 1));
    app.loop.dispatch(mouse('drag', moved.x + moved.width + 5, moved.y + moved.height + 2));
    app.loop.dispatch(mouse('up', moved.x + moved.width + 5, moved.y + moved.height + 2));
    expectChromeToFit(window);

    app.loop.dispatch({ type: 'command', command: Commands.cascade });
    expectChromeToFit(window);
    app.loop.dispatch({ type: 'command', command: Commands.tile });
    expectChromeToFit(window);
    controller.dispose();
  });
});
