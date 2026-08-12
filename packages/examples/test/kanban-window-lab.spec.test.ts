/**
 * Specification oracle for the focused Kanban-in-a-window interaction laboratory.
 *
 * The laboratory deliberately removes loading, large fixtures, and showcase layout so a real
 * desktop-managed Window is the only meaningful difference from a directly hosted board.
 */
import { resolveCapabilities } from '@jsvision/core';
import { afterEach, expect, test } from 'vitest';

import { createKanbanWindowLab } from '../kanban-window-lab/app.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;

const disposeApps: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposeApps.splice(0)) dispose();
});

// A desktop-managed window must not prevent its Kanban child from receiving click and drag input.
test('should keep click and repeated drag responsive inside a translated window', async () => {
  const lab = createKanbanWindowLab(CAPS, { width: 80, height: 24 });
  disposeApps.push(lab.dispose);
  lab.app.loop.renderRoot.flush();

  const origin = lab.app.loop.renderRoot.originOf(lab.board.viewport);
  const first = lab.board.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 1);
  const active = lab.board.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 2);
  if (origin === null || first === undefined || active === undefined) {
    throw new Error('Expected the window-hosted board to expose translated card targets.');
  }
  expect(origin.x).toBeGreaterThan(0);
  expect(origin.y).toBeGreaterThan(0);

  const firstPoint = { x: origin.x + first.x + 1, y: origin.y + first.y + 1 };
  lab.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...firstPoint });
  lab.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...firstPoint });
  expect(lab.board.inspection().interaction.focused).toMatchObject({ kind: 'card', cardKey: 1 });

  lab.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...firstPoint });
  lab.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: firstPoint.x + 2, y: firstPoint.y });
  lab.app.loop.dispatch({
    type: 'mouse',
    kind: 'drag',
    button: 0,
    x: origin.x + active.x + 1,
    y: origin.y + active.y + 1,
  });
  lab.app.loop.dispatch({
    type: 'mouse',
    kind: 'up',
    button: 0,
    x: origin.x + active.x + 1,
    y: origin.y + active.y + 1,
  });
  for (let attempt = 0; attempt < 12; attempt += 1) await Promise.resolve();
  lab.app.loop.renderRoot.flush();

  expect(lab.board.inspection().visibleCards.find(({ cardKey }) => cardKey === 1)?.address.columnId).toBe('active');

  const secondOrigin = lab.app.loop.renderRoot.originOf(lab.board.viewport);
  const secondSource = lab.board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 1);
  const done = lab.board.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 4);
  if (secondOrigin === null || secondSource === undefined || done === undefined) {
    throw new Error('Expected the first accepted drop to remain draggable inside the window.');
  }
  const secondPoint = {
    x: secondOrigin.x + secondSource.x + 1,
    y: secondOrigin.y + secondSource.y + 1,
  };
  const donePoint = { x: secondOrigin.x + done.x + 1, y: secondOrigin.y + done.y + 1 };
  lab.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...secondPoint });
  lab.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: secondPoint.x + 2, y: secondPoint.y });
  lab.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...donePoint });
  lab.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...donePoint });
  for (let attempt = 0; attempt < 12; attempt += 1) await Promise.resolve();
  lab.app.loop.renderRoot.flush();

  expect(lab.board.inspection().visibleCards.find(({ cardKey }) => cardKey === 1)?.address.columnId).toBe('done');
  const revision = lab.board.inspection().interaction.revision;
  lab.app.loop.dispatch({ type: 'key', key: 'right', ctrl: false, alt: false, shift: false });
  expect(lab.board.inspection().interaction.revision).toBeGreaterThan(revision);
});
