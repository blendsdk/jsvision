/**
 * Specification oracle for terminal responsiveness after a kitchen-sink card drop.
 *
 * A successful application-owned publication must settle the deferred render queue within a finite
 * number of frames. Otherwise the queue can monopolize a real terminal and prevent later keyboard or
 * quit input even though the card appears to have moved correctly.
 */
import { resolveCapabilities } from '@jsvision/ui';
import { afterEach, expect, test } from 'vitest';

import { createKanbanShowcase } from '../kanban-showcase/shell.js';
import { KANBAN_STORIES } from '../kanban-showcase/stories/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const disposeApps: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposeApps.splice(0)) dispose();
});

/** Drains captured deferred paint callbacks while retaining a hard bound against a busy loop. */
async function drainDeferredPaints(callbacks: Array<() => void>, limit: number): Promise<number> {
  let frames = 0;
  let idleRounds = 0;
  while (frames < limit && idleRounds < 4) {
    await Promise.resolve();
    const callback = callbacks.shift();
    if (callback === undefined) {
      idleRounds += 1;
      continue;
    }
    idleRounds = 0;
    callback();
    frames += 1;
  }
  return frames;
}

test('the kitchen sink should become idle and accept later input after a card drop', async () => {
  const scheduled: Array<() => void> = [];
  const nativeQueueMicrotask = globalThis.queueMicrotask;
  globalThis.queueMicrotask = (callback): void => {
    scheduled.push(callback);
  };
  try {
    const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
    disposeApps.push(() => showcase.app.loop.dispose());
    const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/delivery-board');
    if (storyIndex < 0) throw new Error('Expected the delivery story.');
    showcase.selectStory(storyIndex);
    await drainDeferredPaints(scheduled, 32);
    expect(scheduled).toHaveLength(0);

    const board = showcase.activeBoard();
    const origin = showcase.app.loop.renderRoot.originOf(board.viewport);
    const source = board.inspection().actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 101);
    const destination = board
      .inspection()
      .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 102);
    if (origin === null || source === undefined || destination === undefined) {
      throw new Error('Expected mounted source and destination cards.');
    }
    const down = { x: origin.x + source.x + 1, y: origin.y + source.y + 1 };
    const target = { x: origin.x + destination.x + 1, y: origin.y + destination.y + 1 };
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: down.x + 2, y: down.y });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...target });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });

    const frames = await drainDeferredPaints(scheduled, 32);
    expect(scheduled, 'accepted publication must not retain an endless deferred paint').toHaveLength(0);
    expect(frames).toBeLessThan(32);
    expect(board.inspection().visibleCards.find(({ cardKey }) => cardKey === 101)?.address.columnId).toBe('active');

    const revision = board.inspection().interaction.revision;
    showcase.app.loop.dispatch({ type: 'key', key: 'left', ctrl: false, alt: false, shift: false });
    expect(board.inspection().interaction.revision).toBeGreaterThan(revision);

    const secondSource = board
      .inspection()
      .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 101);
    const secondDestination = board
      .inspection()
      .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 104);
    const secondOrigin = showcase.app.loop.renderRoot.originOf(board.viewport);
    if (secondOrigin === null || secondSource === undefined || secondDestination === undefined) {
      throw new Error('Expected the moved card and final destination to remain interactive.');
    }
    const secondDown = {
      x: secondOrigin.x + secondSource.x + 1,
      y: secondOrigin.y + secondSource.y + 1,
    };
    const secondTarget = {
      x: secondOrigin.x + secondDestination.x + 1,
      y: secondOrigin.y + secondDestination.y + Math.max(1, secondDestination.height - 2),
    };
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...secondDown });
    showcase.app.loop.dispatch({
      type: 'mouse',
      kind: 'drag',
      button: 0,
      x: secondDown.x + 2,
      y: secondDown.y,
    });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...secondTarget });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...secondTarget });

    const secondFrames = await drainDeferredPaints(scheduled, 32);
    expect(scheduled, 'a repeated bottom-gap drop must also release the deferred painter').toHaveLength(0);
    expect(secondFrames).toBeLessThan(32);
    expect(board.inspection().visibleCards.find(({ cardKey }) => cardKey === 101)?.address.columnId).toBe('done');

    showcase.app.loop.dispose();
    await drainDeferredPaints(scheduled, 8);
    expect(scheduled, 'teardown must not revive a settled anchor correction').toHaveLength(0);
  } finally {
    globalThis.queueMicrotask = nativeQueueMicrotask;
  }
});
