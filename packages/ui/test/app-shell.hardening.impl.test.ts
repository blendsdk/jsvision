/**
 * Implementation tests — app-shell hardening (RD-13, HR-14).
 *
 * Edge coverage beyond ST-3.e: a stale gesture survives TWO successive modal open/close cycles and
 * still never teleports the window.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { Group } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

test('a stale gesture across two successive modals never moves the window', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  w.layout.rect = { x: 2, y: 2, width: 12, height: 6 };
  app.desktop.addWindow(w);

  app.desktop.beginMove(w, { x: 0, y: 0 });
  const rectBefore = { ...w.layout.rect };

  for (let i = 0; i < 2; i += 1) {
    const dialog = new Group();
    app.desktop.add(dialog);
    const modal = app.loop.execView(dialog);
    app.loop.endModal('closed');
    await modal;
    app.loop.dispatch(mouse('move', 25 + i, 12));
    expect(w.layout.rect).toEqual(rectBefore); // never teleports across either cycle
  }
});
