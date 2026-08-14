import type {
  KanbanActionCategory,
  KanbanActionDefinition,
  KanbanActionHandler,
  KanbanActionTargetKind,
} from './types.js';

/** Stable package action IDs in help and registry order. */
export const KANBAN_ACTION_IDS = Object.freeze([
  'kanban.navigation.left',
  'kanban.navigation.right',
  'kanban.navigation.up',
  'kanban.navigation.down',
  'kanban.navigation.cell-first',
  'kanban.navigation.cell-last',
  'kanban.navigation.page-up',
  'kanban.navigation.page-down',
  'kanban.navigation.board-first',
  'kanban.navigation.board-last',
  'kanban.selection.toggle',
  'kanban.selection.extend-left',
  'kanban.selection.extend-right',
  'kanban.selection.extend-up',
  'kanban.selection.extend-down',
  'kanban.selection.select-all',
  'kanban.selection.clear',
  'kanban.card.open',
  'kanban.card.activate',
  'kanban.card.create',
  'kanban.card.edit',
  'kanban.card.duplicate',
  'kanban.card.archive',
  'kanban.card.delete',
  'kanban.card.grab',
  'kanban.card.drop',
  'kanban.card.move',
  'kanban.card.cancel-move',
  'kanban.transient.cancel',
  'kanban.column.configure',
  'kanban.column.add',
  'kanban.column.reorder',
  'kanban.column.delete',
  'kanban.swimlane.configure',
  'kanban.swimlane.add',
  'kanban.swimlane.reorder',
  'kanban.swimlane.delete',
  'kanban.search.focus',
  'kanban.filter.clear',
  'kanban.sort.configure',
  'kanban.view.apply',
  'kanban.view.save',
  'kanban.context.open',
  'kanban.help.open',
  'kanban.source.retry',
  'kanban.history.undo',
  'kanban.history.redo',
] as const);

/** Stable package action identity. */
export type KanbanPackageActionId = (typeof KANBAN_ACTION_IDS)[number];

/** Internal metadata completed with the registry's one package handler seam. */
interface PackageActionMetadata {
  readonly id: KanbanPackageActionId;
  readonly category: KanbanActionCategory;
  readonly target: KanbanActionTargetKind;
  readonly bindings: readonly string[];
  readonly mutation?: boolean;
}

/** Returns concise metadata for one action ID without maintaining a second hand-authored inventory. */
function metadata(id: KanbanPackageActionId): PackageActionMetadata {
  const parts = id.split('.');
  const area = parts[1] ?? '';
  const action = parts.at(-1) ?? '';
  const category: KanbanActionCategory =
    area === 'navigation'
      ? 'navigation'
      : area === 'selection'
        ? 'selection'
        : area === 'card' || area === 'transient'
          ? 'card'
          : area === 'column' || area === 'swimlane'
            ? 'structure'
            : area === 'help' || area === 'context' || area === 'source'
              ? 'help'
              : area === 'history'
                ? 'history'
                : 'view';
  const target: KanbanActionTargetKind =
    area === 'column'
      ? action === 'add'
        ? 'board'
        : 'column'
      : area === 'swimlane'
        ? action === 'add'
          ? 'board'
          : 'swimlane'
        : area === 'card'
          ? action === 'create'
            ? 'cell'
            : 'card'
          : area === 'selection'
            ? action === 'toggle'
              ? 'card'
              : 'selection'
            : 'board';
  const bindings = DEFAULT_BINDINGS.get(id) ?? Object.freeze([]);
  return Object.freeze({
    id,
    category,
    target,
    bindings,
    ...(MUTATION_ACTIONS.has(id) ? { mutation: true } : {}),
  });
}

/** Conservative conflict-free default chord table. */
const DEFAULT_BINDINGS = new Map<KanbanPackageActionId, readonly string[]>([
  ['kanban.navigation.left', Object.freeze(['left'])],
  ['kanban.navigation.right', Object.freeze(['right'])],
  ['kanban.navigation.up', Object.freeze(['up'])],
  ['kanban.navigation.down', Object.freeze(['down'])],
  ['kanban.navigation.cell-first', Object.freeze(['home'])],
  ['kanban.navigation.cell-last', Object.freeze(['end'])],
  ['kanban.navigation.page-up', Object.freeze(['pageup'])],
  ['kanban.navigation.page-down', Object.freeze(['pagedown'])],
  ['kanban.navigation.board-first', Object.freeze(['primary+home'])],
  ['kanban.navigation.board-last', Object.freeze(['primary+end'])],
  ['kanban.selection.toggle', Object.freeze(['space'])],
  ['kanban.selection.extend-left', Object.freeze(['shift+left'])],
  ['kanban.selection.extend-right', Object.freeze(['shift+right'])],
  ['kanban.selection.extend-up', Object.freeze(['shift+up'])],
  ['kanban.selection.extend-down', Object.freeze(['shift+down'])],
  ['kanban.selection.select-all', Object.freeze(['primary+a'])],
  ['kanban.card.activate', Object.freeze(['enter'])],
  ['kanban.card.create', Object.freeze(['insert'])],
  ['kanban.card.grab', Object.freeze(['alt+m'])],
  ['kanban.transient.cancel', Object.freeze(['escape'])],
  ['kanban.search.focus', Object.freeze(['primary+f'])],
  ['kanban.context.open', Object.freeze(['shift+f10'])],
  ['kanban.help.open', Object.freeze(['f1'])],
  ['kanban.history.undo', Object.freeze(['primary+z'])],
  ['kanban.history.redo', Object.freeze(['primary+y'])],
]);

/** Package actions denied by the standard read-only capability preset. */
const MUTATION_ACTIONS = new Set<KanbanPackageActionId>([
  'kanban.card.create',
  'kanban.card.edit',
  'kanban.card.duplicate',
  'kanban.card.archive',
  'kanban.card.delete',
  'kanban.card.grab',
  'kanban.card.drop',
  'kanban.card.move',
  'kanban.card.cancel-move',
  'kanban.column.configure',
  'kanban.column.add',
  'kanban.column.reorder',
  'kanban.column.delete',
  'kanban.swimlane.configure',
  'kanban.swimlane.add',
  'kanban.swimlane.reorder',
  'kanban.swimlane.delete',
  'kanban.view.save',
  'kanban.history.undo',
  'kanban.history.redo',
]);

/**
 * Completes the stable package inventory with one board-owned execution seam.
 *
 * @example
 * ```ts
 * const actions = createKanbanPackageActions((invocation) => route(invocation));
 * ```
 */
export function createKanbanPackageActions(execute: KanbanActionHandler): readonly KanbanActionDefinition[] {
  return Object.freeze(
    KANBAN_ACTION_IDS.map((id) => {
      const entry = metadata(id);
      const messageStem = id.replace(/^kanban\./u, 'kanban.action.');
      return Object.freeze({
        ...entry,
        labelMessageId: `${messageStem}.label`,
        helpMessageId: `${messageStem}.help`,
        capability: id,
        handler: execute,
      });
    }),
  );
}
