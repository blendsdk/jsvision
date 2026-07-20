/**
 * The left rail — a scrollable list of the 18 semantic aliases followed by the 68 concrete roles.
 * Moving the highlight selects that edit target (the app wires the `focused` signal to
 * `model.select`), which loads it into the inspector. Editing an alias re-derives the theme; editing a
 * role overrides it.
 */
import { Group, Text, ListBox, col, fixed, grow, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { DesignerModel, EditTarget } from '../model/index.js';

/**
 * Aliases kept in the vocabulary that drive no built-in role, so editing one changes no widget — the
 * rail flags them `(reserved)` so the edit is not mistaken for a no-op. Empty now that `danger`/`warning`
 * drive the `dangerText`/`warningText` roles; the mechanism stays for any alias reserved in future.
 */
const RESERVED_ALIASES: ReadonlySet<string> = new Set<string>();

/**
 * The rail label for an alias key — `α name`, suffixed `(reserved)` for an app-reserved alias (one
 * that drives no built-in role). The suffix is display-only; the underlying selection target keeps the
 * raw alias name. No alias is reserved today, so every label is the plain `α name` form.
 *
 * @param name The alias key (e.g. `'accent'`, `'danger'`).
 * @returns The display label for that alias's rail row.
 * @example
 * aliasRailLabel('accent'); // 'α accent'
 * aliasRailLabel('danger'); // 'α danger' — danger now drives the dangerText role, so it is not reserved
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
  /** The edit target for each row, in list order (18 aliases, then 70 roles). */
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

  // A column [title, list-fills]. The panel owns its own stacking; the app only sizes its width.
  const view = col({ background: 'dialog' }, fixed(new Text('Roles'), 1), grow(list));

  return { view, focused, targets, rows: list.rows };
}
