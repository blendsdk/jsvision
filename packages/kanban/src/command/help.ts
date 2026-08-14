import type { I18n } from '@jsvision/i18n';

import { snapshotKanbanLabel } from '../contract/capability.js';
import type { KanbanActionInvocation, KanbanActionRegistry, KanbanActionRouter } from './types.js';
import type { KanbanActionKeymap } from './keymap.js';

/** Localized presentation for one action in help, menus, status, or a command palette. */
export interface KanbanActionHelpItem {
  /** Stable package or application action identity. */
  readonly actionId: string;
  /** Sanitized concise localized label. */
  readonly label: string;
  /** Sanitized localized explanation. */
  readonly help: string;
  /** Host-resolved visible key chord, when currently bound. */
  readonly key?: string;
  /** Whether the action should be presented for this invocation context. */
  readonly visible: boolean;
  /** Whether the presented action is currently invocable. */
  readonly enabled: boolean;
}

/** Services used to resolve action presentation through current routing policy. */
export interface KanbanActionHelpOptions {
  /** Stable action metadata inventory. */
  readonly registry: KanbanActionRegistry;
  /** Current reactive host-resolved keymap. */
  readonly keymap: KanbanActionKeymap;
  /** Shared router used to resolve exact capability affordance state. */
  readonly router: KanbanActionRouter;
  /** Application or package locale service. */
  readonly i18n: I18n;
}

/** Uses a safe fallback when a locale returns empty or control-only text. */
function localizedLabel(i18n: I18n, messageId: string, fallback: string): string {
  try {
    return snapshotKanbanLabel(i18n.t(messageId)) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resolves one localized action presentation from the same registry, keymap, and capability route.
 *
 * @example
 * ```ts
 * const item = resolveKanbanActionHelp({ registry, keymap, router, i18n }, invocation);
 * if (item?.enabled) showStatus(item.label, item.key);
 * ```
 */
export function resolveKanbanActionHelp(
  options: KanbanActionHelpOptions,
  invocation: KanbanActionInvocation,
): KanbanActionHelpItem | undefined {
  const definition = options.registry.action(invocation.actionId);
  if (definition === undefined) return undefined;
  const affordance = options.router.affordance(invocation);
  const key = options.keymap.help(definition.id);
  return Object.freeze({
    actionId: definition.id,
    label: localizedLabel(options.i18n, definition.labelMessageId, definition.id),
    help: localizedLabel(options.i18n, definition.helpMessageId, definition.id),
    ...(key === undefined ? {} : { key }),
    visible: affordance.visible,
    enabled: affordance.enabled,
  });
}
