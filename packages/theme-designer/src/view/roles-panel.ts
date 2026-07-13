/**
 * The left rail — a scrollable list of the 18 semantic aliases followed by the 63 concrete roles.
 * Moving the highlight selects that edit target (the app wires the `focused` signal to
 * `model.select`), which loads it into the inspector. Editing an alias re-derives the theme; editing a
 * role overrides it.
 */
import { Group, Text, ListBox, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DesignerModel, EditTarget } from '../model/index.js';

/**
 * Aliases that remain in the vocabulary for app content but drive no built-in role, so editing them
 * changes no widget. The rail flags them so the user is not surprised by an edit that "does nothing".
 */
const RESERVED_ALIASES: ReadonlySet<string> = new Set(['danger', 'warning']);

/**
 * The rail label for an alias key — `α name`, suffixed `(reserved)` for an app-reserved alias (one
 * that drives no built-in role). The suffix is display-only; the underlying selection target keeps the
 * raw alias name.
 *
 * @param name The alias key (e.g. `'accent'`, `'danger'`).
 * @returns The display label for that alias's rail row.
 * @example
 * aliasRailLabel('accent');  // 'α accent'
 * aliasRailLabel('danger');  // 'α danger (reserved)'
 */
export function aliasRailLabel(name: string): string {
  return RESERVED_ALIASES.has(name) ? `α ${name} (reserved)` : `α ${name}`;
}

/** The rail's parts the app wires up: the framed view, the highlight index, and the parallel targets. */
export interface RolesPanel {
  /** The framed panel to place in the workspace. */
  view: Group;
  /** The highlighted row index — drive `model.select(targets[focused()])` from an effect. */
  focused: Signal<number>;
  /** The edit target for each row, in list order (18 aliases, then 63 roles). */
  targets: readonly EditTarget[];
  /** The focus leaf to hand to `loop.focusView`. */
  rows: ListBox['rows'];
}

/**
 * Build the roles rail for a model.
 *
 * @param model The designer model (its alias/role key sets drive the rows).
 * @returns The {@link RolesPanel} — view + the `focused` index + the parallel `targets` + the focus leaf.
 * @example
 * import { buildRolesPanel } from './view/roles-panel.js';
 * const rail = buildRolesPanel(model);
 * effect(() => model.select(rail.targets[rail.focused()]));
 * loop.focusView(rail.rows);
 */
export function buildRolesPanel(model: DesignerModel): RolesPanel {
  const aliasKeys = Object.keys(model.resolvedAliases()) as (keyof ReturnType<DesignerModel['resolvedAliases']>)[];
  const roleKeys = Object.keys(model.theme()) as (keyof ReturnType<DesignerModel['theme']>)[];
  const targets: EditTarget[] = [
    ...aliasKeys.map((name): EditTarget => ({ kind: 'alias', name })),
    ...roleKeys.map((name): EditTarget => ({ kind: 'role', name })),
  ];
  const labels = [...aliasKeys.map((k) => aliasRailLabel(String(k))), ...roleKeys.map((k) => `▸ ${String(k)}`)];

  const focused = signal(0);
  const list = new ListBox({ items: signal(labels), focused, selected: signal(0), typeAhead: true });

  // A column [title, list-fills]; the app sizes the panel's width and sets `direction: 'col'`.
  const view = new Group();
  view.background = 'dialog';
  const title = new Text('Roles');
  title.layout = { size: { kind: 'fixed', cells: 1 } };
  list.layout = { size: { kind: 'fr', weight: 1 } };
  view.add(title);
  view.add(list);

  return { view, focused, targets, rows: list.rows };
}
