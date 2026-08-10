import type { CapabilityProfile } from '@jsvision/core';
import type { Group } from '@jsvision/ui';
import type { KanbanBoard } from '@jsvision/kanban';

import type { ShowcaseCard } from './work-items.js';

/** Runtime services available to every standalone Kanban showcase story. */
export interface KanbanStoryContext {
  /** Resolved terminal capabilities used by the application render root. */
  readonly caps: CapabilityProfile;
}

/** Mounted objects returned by a story for shell composition and focused verification. */
export interface KanbanStoryBuild {
  /** Responsive story content; the shell assigns all available content-pane space. */
  readonly view: Group;
  /** Real public Kanban board rendered by the story. */
  readonly board: KanbanBoard<ShowcaseCard>;
  /** Current human-readable result of the last meaningful story interaction. */
  readonly activity: () => string;
}

/** One independently buildable scenario in the permanent Kanban kitchen sink. */
export interface KanbanStory {
  /** Stable command and registry identity. */
  readonly id: `kanban/${string}`;
  /** Navigator grouping retained as the story inventory grows. */
  readonly category: string;
  /** Short navigator and menu label. */
  readonly title: string;
  /** Concise instruction describing what a visitor can try. */
  readonly blurb: string;
  /** Creates a fresh reactive story graph for one mount. */
  build(context: KanbanStoryContext): KanbanStoryBuild;
}
