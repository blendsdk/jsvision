import { confirm } from '@jsvision/ui';

import type { KanbanEditorDialogHost } from './dialog.js';
import { resolveKanbanEditorMessage } from './presentation-text.js';
import type { KanbanEditorMode, KanbanEditorReloadResult, KanbanEditorSession } from './types.js';

/** One package-owned decision that requires explicit user confirmation. */
export type KanbanEditorConfirmationRequest =
  | {
      /** Dirty draft discard discriminator. */
      readonly kind: 'discard-draft';
      /** Create or edit context used by application confirmation policy. */
      readonly mode: Exclude<KanbanEditorMode, 'view'>;
    }
  | {
      /** Stale draft reload discriminator. */
      readonly kind: 'reload-stale';
    };

/** Optional application replacement for the package confirmation presentation. */
export type KanbanEditorConfirm = (request: KanbanEditorConfirmationRequest) => boolean | Promise<boolean>;

/** Stale reload result extended with an explicit declined-confirmation outcome. */
export type KanbanEditorConfirmedReloadResult = KanbanEditorReloadResult | { readonly kind: 'cancelled' };

/** Resolves package text for one confirmation request through the host translation service. */
function confirmationText(host: KanbanEditorDialogHost, request: KanbanEditorConfirmationRequest): string {
  if (request.kind === 'reload-stale') {
    return resolveKanbanEditorMessage(
      host.i18n,
      'kanban.editor.confirm.reload-stale',
      'Reload the card and discard your local changes?',
    );
  }
  return resolveKanbanEditorMessage(
    host.i18n,
    'kanban.editor.confirm.discard-draft',
    'Discard your unsaved card changes?',
  );
}

/**
 * Resolves an editor confirmation through an application callback or the localized package dialog.
 *
 * Callback failures fail closed and retain the current draft.
 *
 * @example
 * ```ts
 * const discard = await confirmKanbanEditorAction(app, { kind: 'discard-draft', mode: 'edit' });
 * ```
 */
export async function confirmKanbanEditorAction(
  host: KanbanEditorDialogHost,
  request: KanbanEditorConfirmationRequest,
  replacement?: KanbanEditorConfirm,
): Promise<boolean> {
  if (replacement === undefined) {
    try {
      return await confirm(host, confirmationText(host, request));
    } catch {
      return false;
    }
  }
  try {
    return (await replacement(Object.freeze(request))) === true;
  } catch {
    return false;
  }
}

/**
 * Confirms and performs the only safe stale-draft reload policy.
 *
 * @example
 * ```ts
 * const result = await confirmAndReloadKanbanEditor(app, session);
 * ```
 */
export async function confirmAndReloadKanbanEditor<TDraft>(
  host: KanbanEditorDialogHost,
  session: KanbanEditorSession<TDraft>,
  replacement?: KanbanEditorConfirm,
): Promise<KanbanEditorConfirmedReloadResult> {
  if (!(await confirmKanbanEditorAction(host, { kind: 'reload-stale' }, replacement))) {
    return Object.freeze({ kind: 'cancelled' });
  }
  return session.reload('discard-draft');
}
