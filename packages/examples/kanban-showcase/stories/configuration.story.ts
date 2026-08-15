import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnDeleteProposal,
  buildKanbanColumnReorderProposal,
  buildKanbanColumnUpdateProposal,
  buildKanbanSwimlaneAddProposal,
  buildKanbanSwimlaneDeleteProposal,
  buildKanbanSwimlaneReorderProposal,
  buildKanbanSwimlaneUpdateProposal,
  createKanbanConfigurationSnapshot,
  openKanbanColumnConfigurationDialog,
  openKanbanSwimlaneConfigurationDialog,
} from '@jsvision/kanban';
import type { KanbanConfigurationSnapshot } from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { SHOWCASE_COLUMNS, SHOWCASE_TEAMS, createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Small structural snapshot remains detached from the rendered board until application acceptance. */
const CONFIGURATION_SNAPSHOT: KanbanConfigurationSnapshot = createKanbanConfigurationSnapshot({
  revision: 'showcase-structure-v1',
  columns: SHOWCASE_COLUMNS,
  swimlanes: SHOWCASE_TEAMS,
});

/** Cards keep the configuration proposal beside a meaningful live board. */
const CONFIGURATION_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({
    key: 701,
    columnId: 'backlog',
    title: 'Define review policy',
    status: 'Ready',
    custom: { team: 'platform' },
  }),
  Object.freeze({
    key: 702,
    columnId: 'active',
    title: 'Preview lane configuration',
    status: 'In progress',
    custom: { team: 'experience' },
  }),
  Object.freeze({
    key: 703,
    columnId: 'done',
    title: 'Approve workflow names',
    status: 'Done',
    custom: { team: 'unassigned' },
  }),
]);

/** Permanent story for pure proposal builders and optional package-owned configuration UI. */
export const CONFIGURATION_STORY: KanbanStory = {
  id: 'kanban/configuration',
  category: 'Configuration',
  title: 'Lane configuration',
  blurb: 'Configure a proposed lane in the package dialog or build the same validated request programmatically.',
  build: ({ app, signal: storySignal }) => {
    const lifetime = new AbortController();
    const abortLifetime = (): void => lifetime.abort();
    storySignal?.addEventListener('abort', abortLifetime, { once: true });
    onCleanup(() => {
      lifetime.abort();
      storySignal?.removeEventListener('abort', abortLifetime);
    });
    const { board, activity, setActivity } = createShowcaseBoard({
      cards: CONFIGURATION_CARDS,
      swimlanes: 'hybrid',
      initialActivity: 'Try: open the lane dialog or build a lifecycle-free proposal',
    });
    const source = Object.freeze({
      resolve: async () => CONFIGURATION_SNAPSHOT,
      subscribe: () => () => undefined,
    });
    const dialog = new Button('~C~onfigure lane', {
      onClick: () => {
        if (app?.desktop === undefined) {
          setActivity('Configuration host is unavailable outside the mounted showcase');
          return;
        }
        void openKanbanColumnConfigurationDialog(
          { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
          {
            source,
            operation: { kind: 'add', columnId: 'verify', position: { kind: 'end' } },
            completion: { kind: 'result-only' },
            signal: lifetime.signal,
          },
        ).then((outcome) => {
          if (lifetime.signal.aborted) return;
          setActivity(
            outcome.kind === 'proposal'
              ? `Dialog built proposal · ${outcome.proposal.kind}`
              : `Configuration dialog · ${outcome.kind}`,
          );
        });
      },
    });
    const programmatic = new Button('~B~uild proposal', {
      onClick: () => {
        const builders = [
          () =>
            buildKanbanColumnAddProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              draft: { columnId: 'verify', label: 'Verification' },
              position: { kind: 'end' },
            }),
          () =>
            buildKanbanColumnUpdateProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              columnId: 'backlog',
              changes: { label: 'Ready queue' },
            }),
          () =>
            buildKanbanColumnReorderProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              columnId: 'done',
              position: { kind: 'start' },
            }),
          () =>
            buildKanbanColumnDeleteProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              columnId: 'active',
              occupancy: { quality: 'exact', count: 2 },
              policy: { kind: 'reassign', destinationId: 'backlog' },
            }),
          () =>
            buildKanbanSwimlaneAddProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              draft: { swimlaneId: 'release', label: 'Release team' },
              position: { kind: 'end' },
            }),
          () =>
            buildKanbanSwimlaneUpdateProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              swimlaneId: 'platform',
              changes: { label: 'Platform group' },
            }),
          () =>
            buildKanbanSwimlaneReorderProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              swimlaneId: 'experience',
              position: { kind: 'start' },
            }),
          () =>
            buildKanbanSwimlaneDeleteProposal({
              snapshot: CONFIGURATION_SNAPSHOT,
              swimlaneId: 'platform',
              occupancy: { quality: 'exact', count: 1 },
              policy: { kind: 'reassign', destinationId: 'experience' },
            }),
        ] as const;
        const build = builders[proposalIndex % builders.length]!;
        proposalIndex += 1;
        const proposal = build();
        setActivity(`Programmatic proposal · ${proposal.kind} · application decides whether to persist`);
      },
    });
    let proposalIndex = 0;
    const swimlaneDialog = new Button('~S~wimlane dialog', {
      onClick: () => {
        if (app?.desktop === undefined) return;
        void openKanbanSwimlaneConfigurationDialog(
          { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
          {
            source,
            operation: { kind: 'update', swimlaneId: 'platform' },
            completion: { kind: 'result-only' },
            signal: lifetime.signal,
          },
        ).then((outcome) => {
          if (!lifetime.signal.aborted) setActivity(`Swimlane dialog · ${outcome.kind}`);
        });
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Dialogs collect intent; pure builders and application authority remain separate.'), 1),
      fixed(row({ gap: 1 }, grow(dialog), grow(swimlaneDialog)), 2),
      fixed(row({ gap: 1 }, grow(programmatic), grow(new Text('Cycles add/update/reorder/delete + reassign.'))), 2),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 1),
    );
    return { view, board, activity };
  },
};
