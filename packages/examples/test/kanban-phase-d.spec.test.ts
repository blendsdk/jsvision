/** Specification oracle for the four permanent Phase D Kanban showcase stories. */
import { resolveCapabilities } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { createKanbanShowcase } from '../kanban-showcase/shell.js';
import { KANBAN_STORIES } from '../kanban-showcase/stories/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const PHASE_D_STORIES = Object.freeze([
  'kanban/productivity',
  'kanban/editing',
  'kanban/configuration',
  'kanban/actions-history',
]);
const disposeApps: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposeApps.splice(0)) dispose();
});

/** Returns the complete visible terminal text for one selected story. */
function screen(showcase: ReturnType<typeof createKanbanShowcase>): string {
  showcase.app.loop.renderRoot.flush();
  return showcase.app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

describe('Phase D permanent Kanban stories', () => {
  it('registers the four distinct productivity workflows in stable order', () => {
    const ids = KANBAN_STORIES.map(({ id }) => id);
    expect(ids.filter((id) => PHASE_D_STORIES.includes(id))).toEqual(PHASE_D_STORIES);
    for (const id of PHASE_D_STORIES) {
      const story = KANBAN_STORIES.find((entry) => entry.id === id);
      expect(story?.blurb).toMatch(/try|edit|filter|configure|action|history/iu);
    }
  });

  it.each(PHASE_D_STORIES)('mounts %s at 80x24 with a live action surface and visible feedback', (id) => {
    const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
    disposeApps.push(() => showcase.app.loop.dispose());
    const index = KANBAN_STORIES.findIndex((story) => story.id === id);
    expect(index).toBeGreaterThanOrEqual(0);
    showcase.selectStory(index);
    const board = showcase.activeBoard();
    const getter: unknown = Reflect.get(board, 'actions');

    expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
    expect(screen(showcase)).toMatch(/Alt-X|Tab|Mouse/u);
    expect(getter).toBeTypeOf('function');
    if (typeof getter !== 'function') throw new Error('Missing Phase D story action surface.');
    expect(Reflect.apply(getter, board, [])).toBeDefined();
    expect(showcase.activeActivity()).toBeTruthy();
  });
});
