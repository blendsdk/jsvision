/**
 * Specification oracle for the permanent standalone Kanban kitchen sink.
 *
 * Every registered story must be discoverable, mount against a real render root, paint useful
 * content, and expose a live board. The application shell must start on a story and remain usable
 * after both story navigation and a compact terminal resize.
 */
import { createRoot, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { afterEach, expect, test } from 'vitest';

import { createKanbanShowcase } from '../kanban-showcase/shell.js';
import { KANBAN_STORIES } from '../kanban-showcase/stories/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const WIDTH = 72;
const HEIGHT = 20;
const disposeApps: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposeApps.splice(0)) dispose();
});

/** Counts visible non-space terminal cells in one detached render buffer. */
function paintedCells(rows: readonly { readonly char: string }[][]): number {
  let count = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') count += 1;
  return count;
}

// A permanent kitchen sink must always contain at least one real, uniquely addressable story.
test('the registry should expose uniquely identified Phase B stories', () => {
  expect(KANBAN_STORIES.length).toBeGreaterThanOrEqual(4);
  expect(new Set(KANBAN_STORIES.map(({ id }) => id)).size).toBe(KANBAN_STORIES.length);
  for (const story of KANBAN_STORIES) {
    expect(story.id).toMatch(/^kanban\//u);
    expect(story.category).toBeTruthy();
    expect(story.title).toBeTruthy();
    expect(story.blurb).toBeTruthy();
  }
});

// Dense localized fixtures must expose bounded detail rather than silently dropping every optional section.
test('the localized density story should show truncation, summaries, labels, and omitted checklist evidence', () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/localized-density');
  expect(storyIndex).toBeGreaterThanOrEqual(0);
  showcase.selectStory(storyIndex);
  showcase.app.loop.renderRoot.flush();

  const cards = showcase
    .activeBoard()
    .inspection()
    .visibleCards.filter(({ cardKey }) => cardKey === 401 || cardKey === 402);
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    const sectionKinds = card.descriptor.sections.map(({ kind }) => kind);
    const text = card.descriptor.rows.flatMap(({ spans }) => spans.map(({ text: value }) => value)).join(' ');
    expect(sectionKinds).toContain('labels');
    expect(sectionKinds).toContain('summary');
    expect(sectionKinds).toContain('checklist-preview');
    expect(text).toContain('…');
    expect(text).toMatch(/\+\d+/u);
  }
});

// Each story must prove real package composition rather than painting a static imitation.
for (const story of KANBAN_STORIES) {
  test(`story "${story.id}" should mount a visible live board`, () => {
    createRoot((dispose) => {
      const built = story.build({ caps: CAPS });
      built.view.setLayout({ rect: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
      const root = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps: CAPS });
      root.mount(built.view);
      root.flush();
      expect(paintedCells(root.buffer().rows())).toBeGreaterThan(20);
      expect(built.board.inspection().visibleCards.length).toBeGreaterThan(0);
      dispose();
    });
  });
}

// The shell opens immediately on a useful board and keeps that contract through compact reflow.
test('the shell should open the first story and remain responsive while stories change', () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  showcase.app.loop.renderRoot.flush();
  expect(showcase.activeStoryId()).toBe(KANBAN_STORIES[0]?.id);
  expect(showcase.activeBoard().inspection().visibleCards.length).toBeGreaterThan(0);

  showcase.selectStory(1);
  showcase.app.loop.resize({ width: 48, height: 16 });
  showcase.app.loop.renderRoot.flush();
  expect(showcase.activeStoryId()).toBe(KANBAN_STORIES[1]?.id);
  expect(showcase.activeBoard().viewport.metrics().mode).not.toBe('minimum-size');
  expect(showcase.disposedStoryCount()).toBe(1);

  showcase.app.loop.resize({ width: 36, height: 18 });
  showcase.app.loop.renderRoot.flush();
  expect(showcase.activeBoard().viewport.metrics().mode).not.toBe('minimum-size');
});

// Keyboard and mouse activation remain semantic application intents; the showcase reports without faking mutation.
test('the interaction story should report real keyboard and mouse activation', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/interaction-lab');
  if (storyIndex < 0) throw new Error('Expected the interaction story.');
  showcase.selectStory(storyIndex);
  showcase.app.loop.focusView(showcase.activeBoard().viewport);
  showcase.app.loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
  showcase.app.loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
  for (let attempt = 0; attempt < 10; attempt += 1) await Promise.resolve();

  expect(showcase.activeBoard().interaction().snapshot().selectedCardKeys.length).toBe(1);
  expect(showcase.activeActivity()).toMatch(/open-card.*keyboard/u);

  const board = showcase.activeBoard();
  const target = board.inspection().actionTargets.find(({ kind }) => kind === 'card');
  const origin = showcase.app.loop.renderRoot.originOf(board.viewport);
  if (target === undefined || origin === null) throw new Error('Expected a mounted card pointer target.');
  const point = { x: origin.x + target.x + 1, y: origin.y + target.y + 1 };
  for (let click = 0; click < 2; click += 1) {
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point });
    showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...point });
    for (let attempt = 0; attempt < 10; attempt += 1) await Promise.resolve();
  }
  expect(showcase.activeActivity()).toMatch(/open-card.*pointer/u);
});
