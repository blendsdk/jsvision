import type { CapabilityProfile, InputEvent } from '@jsvision/core';
import type { Application, Group, Point } from '@jsvision/ui';
import type { KanbanBoard } from '@jsvision/kanban';

import type { ShowcaseCard } from './work-items.js';

/** Runtime services available to every standalone Kanban showcase story. */
export interface KanbanStoryContext {
  /** Resolved terminal capabilities used by the application render root. */
  readonly caps: CapabilityProfile;
  /** Owning application used by stories that open package-provided modal workflows. */
  readonly app?: Application;
  /** Shell-owned lifetime aborted before the story view is detached during navigation. */
  readonly signal?: AbortSignal;
}

/** Modern interaction scenarios exercised by the permanent kitchen-sink verification driver. */
export type KanbanPhaseCScenario =
  'warning' | 'blocked' | 'unavailable' | 'pending' | 'rejected' | 'publication' | 'bulk' | 'autoscroll';

/** Sanitized evidence returned after one real mounted interaction scenario. */
export interface KanbanPhaseCScenarioEvidence {
  /** Input channel that initiated the move. */
  readonly inputOrigin: 'pointer';
  /** Policy state demonstrated by warning and blocked scenarios. */
  readonly targetState?: 'warning' | 'blocked' | 'unavailable';
  /** Application dispatcher calls made by this scenario. */
  readonly dispatcherCalls: number;
  /** Application confirmation calls made by this scenario. */
  readonly confirmationCalls: number;
  /** Ordered operation lifecycle states observed during this scenario. */
  readonly lifecycleStates: readonly string[];
  /** Stable card keys submitted as one atomic move. */
  readonly movedCardKeys: readonly (string | number)[];
  /** Whether application-owned records changed before an authoritative publication. */
  readonly sourceChangedBeforePublication: boolean;
  /** Whether application-owned records changed after an authoritative publication. */
  readonly sourceChangedAfterPublication: boolean;
  /** Board scroll offsets before the pointer gesture. */
  readonly scrollBefore: Readonly<Point>;
  /** Board scroll offsets after the pointer gesture. */
  readonly scrollAfter: Readonly<Point>;
  /** Visible bounded feedback describing the outcome. */
  readonly activity: string;
}

/** Mounted application services required to drive genuine event-loop pointer input. */
export interface KanbanPhaseCPointerHost {
  /** Sends one decoded event through the real application event loop. */
  dispatch(event: InputEvent): void;
  /** Returns the absolute terminal origin for the active board viewport. */
  origin(): Readonly<Point> | null;
  /** Flushes pending visual work after reactive changes. */
  flush(): void;
}

/** Story-owned Phase C driver whose lifetime is the story owner lifetime. */
export interface KanbanPhaseCStoryDriver {
  /** Binds the mounted application loop used by visible keyboard and mouse controls. */
  bind(host: KanbanPhaseCPointerHost): void;
  /** Exercises one modern interaction scenario against the mounted board. */
  exercise(scenario: KanbanPhaseCScenario, host: KanbanPhaseCPointerHost): Promise<KanbanPhaseCScenarioEvidence>;
  /** Reports bounded teardown-sensitive resource counts. */
  snapshot(): {
    readonly disposed: boolean;
    readonly timers: number;
    readonly captureLeases: number;
    readonly subscriptions: number;
  };
}

/** Mounted objects returned by a story for shell composition and focused verification. */
export interface KanbanStoryBuild {
  /** Responsive story content; the shell assigns all available content-pane space. */
  readonly view: Group;
  /** Real public Kanban board rendered by the story. */
  readonly board: KanbanBoard<ShowcaseCard>;
  /** Current human-readable result of the last meaningful story interaction. */
  readonly activity: () => string;
  /** Optional deterministic driver supplied only by the modern interaction story. */
  readonly phaseC?: KanbanPhaseCStoryDriver;
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
