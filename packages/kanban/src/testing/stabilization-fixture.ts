import type { StandardCard } from '../card/standard-card.js';
import type { KanbanColumnMeta } from '../source/types.js';

/** GitHub status colors represented by the deterministic stabilization fixture. */
export type KanbanStabilizationStatusColor =
  'GRAY' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PINK' | 'PURPLE';

/** Application-owned metadata that makes the fixture resemble imported GitHub project items. */
export interface KanbanStabilizationCardData {
  /** Repository that owns the simulated issue or pull request. */
  readonly repository: string;
  /** Compact source-system item reference. */
  readonly reference: string;
  /** GitHub status color retained for application-level presentation tests. */
  readonly statusColor: KanbanStabilizationStatusColor;
}

/** Card shape shared by stabilization geometry, interaction, and performance specifications. */
export type KanbanStabilizationCard = StandardCard<string, KanbanStabilizationCardData>;

/** Stable identities for deliberately adversarial cards within the larger fixture. */
export interface KanbanStabilizationNamedCards {
  /** Small card used as the normal estimated-height control. */
  readonly short: string;
  /** Checklist-heavy card expected to occupy substantially more rows. */
  readonly tall: string;
  /** Metadata-heavy card used to exercise bounded optional presentation. */
  readonly dense: string;
  /** Card containing terminal controls and bidirectional formatting controls. */
  readonly hostile: string;
  /** Card containing wide and combining Unicode sequences. */
  readonly unicode: string;
  /** Card containing a deliberately long Dutch presentation string. */
  readonly longestLocale: string;
}

/** Complete deterministic source data for the Kanban stabilization test matrix. */
export interface KanbanStabilizationFixture {
  /** Five ordered workflow columns, including one deliberately empty column. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Exactly 84 GitHub-shaped cards in deterministic source order. */
  readonly cards: readonly KanbanStabilizationCard[];
  /** Named identities for cases that tests need to target directly. */
  readonly named: KanbanStabilizationNamedCards;
}

const STATUS_COLORS: readonly KanbanStabilizationStatusColor[] = Object.freeze([
  'GRAY',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PINK',
  'PURPLE',
]);

const COLUMN_DEFINITIONS = Object.freeze([
  { columnId: 'backlog', label: 'Backlog', revision: 1 },
  { columnId: 'ready', label: 'Ready', revision: 1 },
  { columnId: 'in-progress', label: 'In progress', revision: 1 },
  { columnId: 'review', label: 'Review · deliberately empty', revision: 1 },
  { columnId: 'done', label: 'Done', revision: 1 },
] satisfies readonly KanbanColumnMeta[]);

const POPULATED_COLUMN_IDS = Object.freeze(['backlog', 'ready', 'in-progress', 'done'] as const);

const NAMED_CARDS: KanbanStabilizationNamedCards = Object.freeze({
  short: 'github-item-001',
  tall: 'github-item-002',
  dense: 'github-item-003',
  hostile: 'github-item-004',
  unicode: 'github-item-005',
  longestLocale: 'github-item-006',
});

/** Creates the common metadata attached to every simulated GitHub work item. */
function cardData(index: number): KanbanStabilizationCardData {
  return Object.freeze({
    repository: index % 3 === 0 ? 'nodejs/node' : index % 3 === 1 ? 'nodejs/node-api' : 'nodejs/undici',
    reference: `#${10_000 + index}`,
    statusColor: STATUS_COLORS[(index - 1) % STATUS_COLORS.length] ?? 'GRAY',
  });
}

/** Creates the compact default card used for all non-special fixture positions. */
function ordinaryCard(index: number): KanbanStabilizationCard {
  const columnId = POPULATED_COLUMN_IDS[(index - 1) % POPULATED_COLUMN_IDS.length] ?? 'backlog';
  const custom = cardData(index);
  return Object.freeze({
    key: `github-item-${String(index).padStart(3, '0')}`,
    columnId,
    rank: index,
    presentationRevision: 1,
    title: `Stabilization work item ${index}`,
    status: COLUMN_DEFINITIONS.find((column) => column.columnId === columnId)?.label ?? 'Backlog',
    type: index % 5 === 0 ? 'Pull request' : 'Issue',
    labels: Object.freeze([{ id: `label-${index}-1`, label: index % 2 === 0 ? 'performance' : 'kanban' }]),
    summaries: Object.freeze([
      { fieldId: `repository-${index}`, label: 'Repo', value: custom.repository },
      { fieldId: `reference-${index}`, label: 'Item', value: custom.reference },
    ]),
    custom,
  });
}

/** Replaces one generated card while retaining its deterministic identity and source position. */
function replaceCard(
  cards: KanbanStabilizationCard[],
  index: number,
  replacement: Partial<KanbanStabilizationCard>,
): void {
  const position = index - 1;
  const current = cards[position];
  if (current === undefined) throw new Error(`Missing stabilization fixture card ${index}.`);
  cards[position] = Object.freeze({ ...current, ...replacement });
}

/**
 * Creates the canonical 84-card mixed-height fixture used by stabilization tests and benchmarks.
 *
 * The source is intentionally deterministic and network-free. Special cards cover dense optional
 * metadata, long localized text, Unicode display-width edge cases, and untrusted terminal text so every
 * viewport test can reuse one realistic geometry oracle.
 *
 * @returns Fresh frozen column and card arrays with stable identities.
 * @example
 * ```ts
 * const fixture = createKanbanStabilizationFixture();
 * const tallCard = fixture.cards.find((card) => card.key === fixture.named.tall);
 * ```
 */
export function createKanbanStabilizationFixture(): KanbanStabilizationFixture {
  const cards = Array.from({ length: 84 }, (_, offset) => ordinaryCard(offset + 1));

  replaceCard(cards, 1, {
    title: 'Small source-range control',
    labels: undefined,
    summaries: undefined,
  });
  replaceCard(cards, 2, {
    title: 'Complete the cross-host release checklist without losing pointer capture',
    checklists: Object.freeze([
      {
        checklistId: 'release-checks',
        title: 'Release checks',
        items: Object.freeze([
          { itemId: 'unit', text: 'Run the package unit specifications', completed: true },
          { itemId: 'pty', text: 'Verify the Unix pseudo-terminal trace', completed: false },
          { itemId: 'browser', text: 'Verify the browser and xterm trace', completed: false },
          { itemId: 'manual', text: 'Complete the native terminal review', completed: false },
        ]),
      },
    ]),
  });
  replaceCard(cards, 3, {
    title: 'Dense imported issue with every bounded optional presentation section',
    priority: 'P1 · high',
    estimate: '13 points',
    assignees: Object.freeze([
      { id: 'alice', label: 'alice-maintainer' },
      { id: 'bob', label: 'bob-reviewer' },
      { id: 'carol', label: 'carol-release' },
    ]),
    labels: Object.freeze([
      { id: 'performance', label: 'performance' },
      { id: 'terminal', label: 'terminal-ui' },
      { id: 'regression', label: 'regression' },
      { id: 'needs-review', label: 'needs-review' },
    ]),
    summaries: Object.freeze([
      { fieldId: 'repository', label: 'Repo', value: 'nodejs/node' },
      { fieldId: 'reference', label: 'Item', value: '#10003' },
      { fieldId: 'milestone', label: 'Milestone', value: 'Next major release' },
      { fieldId: 'team', label: 'Team', value: 'Node-API maintainers' },
    ]),
  });
  replaceCard(cards, 4, {
    title: 'Unsafe\u001b[31m terminal title \u202Etxt.exe\u202C must remain bounded',
    labels: Object.freeze([{ id: 'hostile', label: 'label\u0007with\u009bcontrols' }]),
  });
  replaceCard(cards, 5, {
    title: 'Unicode 実装の確認 · 👩🏽‍💻 · cafe\u0301 · Z͑ͫ̓a̴l̡g̢o̶',
    assignees: Object.freeze([{ id: 'wide', label: '開発チーム' }]),
  });
  replaceCard(cards, 6, {
    title:
      'Controleer de gebruikersinteractie bij vensterverkleining en herstel zonder onverwachte kaartverschuivingen',
    labels: Object.freeze([
      { id: 'lang-nl', label: 'Nederlandstalige gebruikersinterface' },
      { id: 'responsive', label: 'responsieve-terminalindeling' },
    ]),
  });

  return Object.freeze({
    columns: COLUMN_DEFINITIONS,
    cards: Object.freeze(cards),
    named: NAMED_CARDS,
  });
}
