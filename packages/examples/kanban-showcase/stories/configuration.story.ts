import { Button, Text, col, fixed, grow, row } from '@jsvision/ui';
import {
  buildKanbanColumnAddProposal,
  createKanbanConfigurationSnapshot,
  openKanbanColumnConfigurationDialog,
} from '@jsvision/kanban';
import type { KanbanConfigurationSnapshot } from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { SHOWCASE_COLUMNS, createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Small structural snapshot remains detached from the rendered board until application acceptance. */
const CONFIGURATION_SNAPSHOT: KanbanConfigurationSnapshot = createKanbanConfigurationSnapshot({
  revision: 'showcase-structure-v1',
  columns: SHOWCASE_COLUMNS,
  swimlanes: [],
});

/** Cards keep the configuration proposal beside a meaningful live board. */
const CONFIGURATION_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({ key: 701, columnId: 'backlog', title: 'Define review policy', status: 'Ready' }),
  Object.freeze({ key: 702, columnId: 'active', title: 'Preview lane configuration', status: 'In progress' }),
  Object.freeze({ key: 703, columnId: 'done', title: 'Approve workflow names', status: 'Done' }),
]);

/** Permanent story for pure proposal builders and optional package-owned configuration UI. */
export const CONFIGURATION_STORY: KanbanStory = {
  id: 'kanban/configuration',
  category: 'Configuration',
  title: 'Lane configuration',
  blurb: 'Configure a proposed lane in the package dialog or build the same validated request programmatically.',
  build: ({ app }) => {
    const { board, activity, setActivity } = createShowcaseBoard({
      cards: CONFIGURATION_CARDS,
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
          },
        ).then((outcome) => {
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
        const proposal = buildKanbanColumnAddProposal({
          snapshot: CONFIGURATION_SNAPSHOT,
          draft: { columnId: 'verify', label: 'Verification' },
          position: { kind: 'end' },
        });
        setActivity(`Programmatic proposal · ${proposal.kind} · application decides whether to persist`);
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Dialogs collect intent; pure builders and application authority remain separate.'), 1),
      fixed(row({ gap: 1 }, grow(dialog), grow(programmatic)), 2),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 1),
    );
    return { view, board, activity };
  },
};
