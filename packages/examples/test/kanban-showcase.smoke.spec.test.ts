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

type PhaseCScenario =
  'warning' | 'blocked' | 'unavailable' | 'pending' | 'rejected' | 'publication' | 'bulk' | 'autoscroll';

interface PhaseCScenarioEvidence {
  readonly inputOrigin: 'pointer';
  readonly targetState?: 'warning' | 'blocked' | 'unavailable';
  readonly dispatcherCalls: number;
  readonly confirmationCalls: number;
  readonly lifecycleStates: readonly string[];
  readonly movedCardKeys: readonly (string | number)[];
  readonly sourceChangedBeforePublication: boolean;
  readonly sourceChangedAfterPublication: boolean;
  readonly scrollBefore: { readonly x: number; readonly y: number };
  readonly scrollAfter: { readonly x: number; readonly y: number };
  readonly activity: string;
}

interface PhaseCShowcaseDriver {
  exercise(scenario: PhaseCScenario): Promise<PhaseCScenarioEvidence>;
  snapshot(): {
    readonly disposed: boolean;
    readonly timers: number;
    readonly captureLeases: number;
    readonly subscriptions: number;
  };
}

/** Reads the deterministic driver that performs real pointer input against the active showcase board. */
function phaseCDriver(showcase: ReturnType<typeof createKanbanShowcase>): PhaseCShowcaseDriver {
  const value: unknown = Reflect.get(showcase, 'phaseC');
  expect(value, 'the real showcase must expose its bounded Phase C verification driver').toBeTypeOf('function');
  if (typeof value !== 'function') throw new Error('Missing Phase C showcase verification driver.');
  const driver: unknown = Reflect.apply(value, showcase, []);
  if (typeof driver !== 'object' || driver === null) throw new Error('Invalid Phase C showcase driver.');
  const exercise: unknown = Reflect.get(driver, 'exercise');
  const snapshot: unknown = Reflect.get(driver, 'snapshot');
  if (typeof exercise !== 'function' || typeof snapshot !== 'function') {
    throw new Error('Incomplete Phase C showcase driver.');
  }
  return {
    exercise: (scenario) => Promise.resolve(Reflect.apply(exercise, driver, [scenario]) as PhaseCScenarioEvidence),
    snapshot: () => Reflect.apply(snapshot, driver, []) as ReturnType<PhaseCShowcaseDriver['snapshot']>,
  };
}

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
test('the registry should expose uniquely identified shipped-capability stories', () => {
  expect(KANBAN_STORIES.length).toBeGreaterThanOrEqual(4);
  expect(new Set(KANBAN_STORIES.map(({ id }) => id)).size).toBe(KANBAN_STORIES.length);
  for (const story of KANBAN_STORIES) {
    expect(story.id).toMatch(/^kanban\//u);
    expect(story.category).toBeTruthy();
    expect(story.title).toBeTruthy();
    expect(story.blurb).toBeTruthy();
  }
});

test('the registry should include one truthful modern interaction story', () => {
  const story = KANBAN_STORIES.find(({ id }) => id === 'kanban/modern-interaction');
  expect(story).toBeDefined();
  expect(story?.title).toMatch(/drag|interaction|operation/iu);
  expect(story?.blurb).toMatch(/warning|blocked/iu);
  expect(story?.blurb).toMatch(/unavailable/iu);
  expect(story?.blurb).toMatch(/pending|publication/iu);
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

test('the modern interaction story drives warning and blocked targets through real pointer input', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  expect(storyIndex).toBeGreaterThanOrEqual(0);
  showcase.selectStory(storyIndex);
  const driver = phaseCDriver(showcase);

  const warning = await driver.exercise('warning');
  expect(warning).toMatchObject({
    inputOrigin: 'pointer',
    targetState: 'warning',
    dispatcherCalls: 1,
    confirmationCalls: 1,
  });
  expect(warning.lifecycleStates).toContain('pending');

  const blocked = await driver.exercise('blocked');
  expect(blocked).toMatchObject({
    inputOrigin: 'pointer',
    targetState: 'blocked',
    dispatcherCalls: 0,
    confirmationCalls: 0,
  });
  expect(blocked.lifecycleStates).toEqual([]);

  const unavailable = await driver.exercise('unavailable');
  expect(unavailable).toMatchObject({
    inputOrigin: 'pointer',
    targetState: 'unavailable',
    dispatcherCalls: 0,
    confirmationCalls: 0,
  });
  expect(unavailable.activity).toMatch(/unavailable/iu);
});

test('the modern interaction story exposes a keyboard-reachable visible scenario action', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  if (storyIndex < 0) throw new Error('Expected the modern interaction story.');
  showcase.selectStory(storyIndex);

  showcase.app.loop.dispatch({ type: 'key', key: 'r', ctrl: false, alt: true, shift: false });
  for (let attempt = 0; attempt < 40; attempt += 1) await Promise.resolve();

  expect(showcase.activeActivity()).toMatch(/warning confirmed/iu);
});

test('the modern interaction story shows pending, rejection, and authoritative publication honestly', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  if (storyIndex < 0) throw new Error('Expected the modern interaction story.');
  showcase.selectStory(storyIndex);
  const driver = phaseCDriver(showcase);

  const pending = await driver.exercise('pending');
  expect(pending.lifecycleStates).toEqual(['proposed', 'pending']);
  expect(pending.sourceChangedBeforePublication).toBe(false);
  expect(
    showcase
      .activeBoard()
      .operationSnapshot()
      .some(({ state }) => state === 'pending'),
  ).toBe(true);

  const rejected = await driver.exercise('rejected');
  expect(rejected.lifecycleStates).toEqual(['proposed', 'pending', 'rejected']);
  expect(rejected.sourceChangedAfterPublication).toBe(false);
  expect(rejected.activity).toMatch(/rejected/iu);

  const publication = await driver.exercise('publication');
  expect(publication.lifecycleStates).toEqual(['proposed', 'pending', 'accepted', 'committed']);
  expect(publication.sourceChangedBeforePublication).toBe(false);
  expect(publication.sourceChangedAfterPublication).toBe(true);
  expect(publication.activity).toMatch(/published|committed/iu);
});

test('the modern interaction story demonstrates atomic bulk drag and deterministic edge autoscroll', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  if (storyIndex < 0) throw new Error('Expected the modern interaction story.');
  showcase.selectStory(storyIndex);
  const driver = phaseCDriver(showcase);

  const bulk = await driver.exercise('bulk');
  expect(bulk.inputOrigin).toBe('pointer');
  expect(bulk.movedCardKeys.length).toBeGreaterThan(1);
  expect(new Set(bulk.movedCardKeys).size).toBe(bulk.movedCardKeys.length);
  expect(bulk.dispatcherCalls).toBe(1);

  const autoscroll = await driver.exercise('autoscroll');
  expect(autoscroll.inputOrigin).toBe('pointer');
  expect(autoscroll.scrollAfter.x + autoscroll.scrollAfter.y).toBeGreaterThan(
    autoscroll.scrollBefore.x + autoscroll.scrollBefore.y,
  );
});

test('the modern interaction story remains responsive and releases drag resources on story teardown', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  if (storyIndex < 0) throw new Error('Expected the modern interaction story.');
  showcase.selectStory(storyIndex);
  const driver = phaseCDriver(showcase);
  await driver.exercise('pending');

  showcase.app.loop.resize({ width: 48, height: 16 });
  showcase.app.loop.renderRoot.flush();
  expect(showcase.activeBoard().viewport.metrics().mode).not.toBe('minimum-size');
  showcase.app.loop.resize({ width: 80, height: 24 });
  showcase.app.loop.renderRoot.flush();
  expect(showcase.activeBoard().inspection().visibleCards.length).toBeGreaterThan(0);

  showcase.selectStory(storyIndex === 0 ? 1 : 0);
  expect(driver.snapshot()).toEqual({ disposed: true, timers: 0, captureLeases: 0, subscriptions: 0 });
});

test('the modern interaction story cancels an in-flight autoscroll delay when its owner is replaced', async () => {
  const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
  disposeApps.push(() => showcase.app.loop.dispose());
  const storyIndex = KANBAN_STORIES.findIndex(({ id }) => id === 'kanban/modern-interaction');
  if (storyIndex < 0) throw new Error('Expected the modern interaction story.');
  showcase.selectStory(storyIndex);
  const driver = phaseCDriver(showcase);
  const exercise = driver.exercise('autoscroll');
  for (let attempt = 0; attempt < 60 && driver.snapshot().timers === 0; attempt += 1) await Promise.resolve();
  expect(driver.snapshot().timers).toBe(1);

  showcase.selectStory(storyIndex === 0 ? 1 : 0);

  await expect(exercise).rejects.toThrow(/cancelled|teardown/iu);
  expect(driver.snapshot()).toEqual({ disposed: true, timers: 0, captureLeases: 0, subscriptions: 0 });
});
