import { createKeymap } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import {
  Commands,
  ListBox,
  Text,
  col,
  createApplication,
  createRoot,
  fixed,
  grow,
  item,
  menuBar,
  row,
  signal,
  statusItem,
  statusLine,
  subMenu,
} from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import type { KanbanBoard } from '@jsvision/kanban';

import type {
  KanbanPhaseCScenario,
  KanbanPhaseCScenarioEvidence,
  KanbanPhaseCStoryDriver,
  KanbanStoryBuild,
} from './story.js';
import type { ShowcaseCard } from './work-items.js';
import { KANBAN_STORIES } from './stories/index.js';

const NEXT_STORY_COMMAND = 'kanban-showcase.next';
const PREVIOUS_STORY_COMMAND = 'kanban-showcase.previous';

/** Optional deterministic viewport used by headless tests and embedding tools. */
export interface KanbanShowcaseViewport {
  /** Terminal width in cells. */
  readonly width: number;
  /** Terminal height in cells. */
  readonly height: number;
}

/** Public seams shared by the interactive command and focused headless specifications. */
export interface KanbanShowcase {
  /** Fully composed desktop application. */
  readonly app: Application;
  /** Runs the application until its quit command is handled. */
  run(): Promise<number>;
  /** Selects and freshly mounts one registered story by index. */
  selectStory(index: number): void;
  /** Returns the stable identity of the currently mounted story. */
  activeStoryId(): string;
  /** Returns the real public board owned by the active story. */
  activeBoard(): KanbanBoard<ShowcaseCard>;
  /** Returns current visible story feedback. */
  activeActivity(): string;
  /** Counts story owners released while navigating between scenarios. */
  disposedStoryCount(): number;
  /** Returns the modern story driver bound to the real application event loop. */
  phaseC(): {
    exercise(scenario: KanbanPhaseCScenario): Promise<KanbanPhaseCScenarioEvidence>;
    snapshot(): ReturnType<KanbanPhaseCStoryDriver['snapshot']>;
  };
}

/** Builds the compact application menu from the same explicit registry as the sidebar. */
function buildMenu() {
  return menuBar([
    subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt-X')]),
    subMenu(
      '~S~tories',
      KANBAN_STORIES.map((story) => item(story.title, story.id)),
    ),
    subMenu('~N~avigate', [
      item('~N~ext story', NEXT_STORY_COMMAND, 'Ctrl-Right'),
      item('~P~revious story', PREVIOUS_STORY_COMMAND, 'Ctrl-Left'),
    ]),
  ]);
}

/**
 * Creates the permanent Kanban kitchen sink with a persistent navigator and responsive story pane.
 *
 * The story pane is rebuilt inside a disposable reactive owner on every navigation. This keeps later
 * live-data, dialog, filtering, and drag stories isolated without accumulating subscriptions.
 */
export function createKanbanShowcase(caps: CapabilityProfile, viewport?: KanbanShowcaseViewport): KanbanShowcase {
  let activeIndex = -1;
  let activeBuild: KanbanStoryBuild | undefined;
  let disposeStory: (() => void) | undefined;
  let disposedStories = 0;
  let focusActiveStory = (): void => {};
  const focusedStory = signal(0);
  const activeStory = signal(0);
  const storyItems = signal(
    KANBAN_STORIES.map((story, index) => `${index === 0 ? '>' : ' '} ${story.category} · ${story.title}`),
  );
  const storyHost = col({ padding: 0 });

  /** Changes story through a single seam shared by the list, menus, keys, and tests. */
  function selectStory(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= KANBAN_STORIES.length) {
      throw new RangeError('Kanban showcase story index is outside the registered inventory.');
    }
    const story = KANBAN_STORIES[index];
    if (story === undefined) throw new RangeError('Kanban showcase story is unavailable.');

    for (const child of [...storyHost.children]) storyHost.remove(child);
    if (disposeStory !== undefined) {
      disposeStory();
      disposeStory = undefined;
      disposedStories += 1;
    }
    createRoot((dispose) => {
      disposeStory = dispose;
      activeBuild = story.build({ caps });
    });
    activeIndex = index;
    focusedStory.set(index);
    activeStory.set(index);
    storyItems.set(
      KANBAN_STORIES.map(
        (candidate, candidateIndex) =>
          `${candidateIndex === index ? '>' : ' '} ${candidate.category} · ${candidate.title}`,
      ),
    );
    storyHost.add(grow(activeBuild!.view));
    storyHost.invalidateLayout();
    activeBuild!.phaseC?.bind({
      dispatch: (event) => app.loop.dispatch(event),
      origin: () => app.loop.renderRoot.originOf(activeBuild!.board.viewport),
      flush: () => app.loop.renderRoot.flush(),
    });
  }

  const navigator = new ListBox({
    items: storyItems,
    focused: focusedStory,
    selected: activeStory,
    typeAhead: true,
    onSelect: (index) => {
      selectStory(index);
      focusActiveStory();
    },
  });
  const sidebar = col(
    { padding: 1, gap: 1, background: 'dialog' },
    fixed(new Text('KANBAN LAB'), 1),
    fixed(new Text('Shipped capabilities'), 1),
    grow(navigator),
    fixed(new Text('Enter/click opens\nTab moves focus\nCtrl-←/→ changes story'), 3),
  );
  const content = row({ gap: 1 }, grow(sidebar, 2), grow(storyHost, 5, { min: 18 }));
  const app = createApplication({
    caps,
    content,
    ...(viewport === undefined ? {} : { viewport }),
    menuBar: buildMenu(),
    statusLine: statusLine([
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
      statusItem('~Tab~ Sidebar↔Board'),
      statusItem('~Space~ Select'),
      statusItem('~Enter~ Open'),
      statusItem('~Mouse~ Click/Wheel'),
    ]),
    keymap: createKeymap({
      'ctrl+right': NEXT_STORY_COMMAND,
      'ctrl+left': PREVIOUS_STORY_COMMAND,
    }),
  });

  /** Wraps story navigation while preserving registry order in both directions. */
  const step = (delta: number): void => {
    const next = (Math.max(0, activeIndex) + delta + KANBAN_STORIES.length) % KANBAN_STORIES.length;
    selectStory(next);
    app.loop.focusView(activeBuild!.board.viewport);
  };
  focusActiveStory = () => app.loop.focusView(activeBuild!.board.viewport);
  const handlers: Record<string, () => void> = {
    [NEXT_STORY_COMMAND]: () => step(1),
    [PREVIOUS_STORY_COMMAND]: () => step(-1),
  };
  for (let index = 0; index < KANBAN_STORIES.length; index += 1) {
    const story = KANBAN_STORIES[index];
    if (story !== undefined) {
      handlers[story.id] = () => {
        selectStory(index);
        focusActiveStory();
      };
    }
  }
  for (const [command, handler] of Object.entries(handlers)) app.onCommand(command, handler);

  selectStory(0);
  app.loop.renderRoot.flush();
  focusActiveStory();

  return {
    app,
    run: () => app.run(),
    selectStory,
    activeStoryId: () => KANBAN_STORIES[activeIndex]?.id ?? '',
    activeBoard: () => {
      if (activeBuild === undefined) throw new Error('Kanban showcase has no active board.');
      return activeBuild.board;
    },
    activeActivity: () => activeBuild?.activity() ?? '',
    disposedStoryCount: () => disposedStories,
    phaseC: () => {
      const driver = activeBuild?.phaseC;
      if (driver === undefined) throw new Error('The active Kanban story has no Phase C driver.');
      return Object.freeze({
        exercise: (scenario: KanbanPhaseCScenario) =>
          driver.exercise(scenario, {
            dispatch: (event) => app.loop.dispatch(event),
            origin: () => app.loop.renderRoot.originOf(activeBuild!.board.viewport),
            flush: () => app.loop.renderRoot.flush(),
          }),
        snapshot: () => driver.snapshot(),
      });
    },
  };
}
