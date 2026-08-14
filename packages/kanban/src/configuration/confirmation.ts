import { Button, Dialog, Text, col, cover, fixed, grow } from '@jsvision/ui';

import { awaitEditorWork } from '../editor/session-async.js';
import { createKanbanEditorActionBand } from '../editor/dialog-action-band.js';
import { resolveKanbanEditorMessage } from '../editor/presentation-text.js';
import type { KanbanConfigurationConfirm, KanbanConfigurationDialogHost } from './types.js';

/** Closed set of package-owned configuration decisions. */
export type KanbanConfigurationConfirmationKind = 'reload-stale' | 'discard-draft' | 'delete-structure';

/** Runs a bounded package confirmation that can be closed by the owning dialog lifetime. */
async function packageConfirmation(
  host: KanbanConfigurationDialogHost,
  message: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false;
  const dialog = new Dialog({
    title: resolveKanbanEditorMessage(host.i18n, 'ui.dialog.confirm.title', 'Confirm'),
    width: Math.min(44, Math.max(20, host.desktop.bounds.width - 4)),
    height: Math.min(9, Math.max(7, host.desktop.bounds.height - 2)),
    centered: true,
  });
  const finish = (result: 'yes' | 'no'): void => {
    dialog.finishModal(result);
  };
  const yes = new Button(resolveKanbanEditorMessage(host.i18n, 'ui.dialog.yes', '~Y~es'), {
    default: true,
    onClick: () => finish('yes'),
  });
  const no = new Button(resolveKanbanEditorMessage(host.i18n, 'ui.dialog.no', '~N~o'), {
    onClick: () => finish('no'),
  });
  dialog.add(
    cover(
      col(
        { padding: 1, gap: 1 },
        grow(new Text(message), 1, { min: 1 }),
        fixed(createKanbanEditorActionBand([yes, no], Math.max(1, dialog.bounds.width - 4)), 2),
      ),
    ),
  );
  const abort = (): void => finish('no');
  signal.addEventListener('abort', abort, { once: true });
  try {
    host.desktop.addWindow(dialog);
    const pending = host.loop.execView<string>(dialog);
    host.loop.focusView(yes);
    if (signal.aborted) abort();
    return (await pending) === 'yes';
  } catch {
    return false;
  } finally {
    signal.removeEventListener('abort', abort);
    try {
      host.desktop.removeWindow(dialog);
    } catch {
      // Host cleanup failures do not turn a declined confirmation into approval.
    }
  }
}

/**
 * Resolves an application or package confirmation within one abortable dialog lifetime.
 *
 * Application callbacks receive the same signal and late results are ignored after abort.
 */
export async function confirmKanbanConfigurationAction(
  host: KanbanConfigurationDialogHost,
  kind: KanbanConfigurationConfirmationKind,
  message: string,
  signal: AbortSignal,
  replacement?: KanbanConfigurationConfirm,
): Promise<boolean> {
  if (signal.aborted) return false;
  if (replacement === undefined) return packageConfirmation(host, message, signal);
  try {
    const requested = replacement(Object.freeze({ kind, signal }));
    const pending = requested instanceof Promise ? requested : Promise.resolve(requested);
    const awaited = await awaitEditorWork(pending, signal);
    return awaited.kind === 'value' && awaited.value === true;
  } catch {
    return false;
  }
}
