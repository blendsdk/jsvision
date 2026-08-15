import { Commands, Dialog } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';

import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { confirmAndReloadKanbanEditor, confirmKanbanEditorAction } from './confirmation.js';
import type { KanbanEditorConfirmedReloadResult } from './confirmation.js';
import { KanbanEditorDialog } from './dialog.js';
import type {
  KanbanEditorCreatePublicationContext,
  KanbanEditorCreatedRecord,
  KanbanEditorDialogHost,
  KanbanEditorDialogResult,
  KanbanEditorDialogSubmitResult,
  KanbanEditorResolvedDialogOptions,
} from './dialog-contract.js';
import { snapshotKanbanEditorAuthorityResult } from './session-boundary.js';
import type { KanbanEditorAuthority, KanbanEditorFieldState, KanbanEditorRecordResolver } from './types.js';

/** Reads cancellation without allowing TypeScript to retain a stale pre-await narrowing. */
function dialogSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Creates a resolver-free new-card source that never retains a listener or application record. */
export function emptyKanbanEditorCreateResolver<TCard>(): KanbanEditorRecordResolver<TCard> {
  return Object.freeze({
    resolve: async () => Object.freeze({ kind: 'unavailable', code: 'provisional-card' }),
    subscribe: () => () => undefined,
  });
}

/** Creates an inert authority for view and result-only paths, where invocation is a package defect. */
function inertAuthority(): KanbanEditorAuthority {
  return Object.freeze({
    request: (): KanbanRequestResult => {
      throw new TypeError('This Kanban editor completion mode does not dispatch requests.');
    },
  });
}

/** Exact members accepted from an application create-publication resolver. */
const CREATED_RECORD_KEYS = new Set(['cardKey', 'card', 'revision']);

/** Validates create-publication metadata while retaining the generic card as application data. */
function snapshotCreatedRecord<TCard>(value: KanbanEditorCreatedRecord<TCard>): KanbanEditorCreatedRecord<TCard> {
  const properties = snapshotKanbanDataProperties(value, CREATED_RECORD_KEYS.size);
  validateKanbanDataKeys(properties, CREATED_RECORD_KEYS);
  if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
    throw new TypeError('Invalid created Kanban card identity.');
  }
  return Object.freeze({
    cardKey: createKanbanCardKey(properties.cardKey),
    card: value.card,
    revision: snapshotKanbanRevision(properties.revision),
  });
}

/** Session-facing authority and publication source for one provisional create claim. */
export interface KanbanEditorCreatePublicationBridge<TCard> {
  /** Resolver that publishes the correlated persisted record to the provisional session. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  /** Authority that waits for correlated publication after application acceptance. */
  readonly authority: KanbanEditorAuthority;
  /** Cancels pending correlation and releases application listeners. */
  readonly dispose: () => void;
}

/** Correlates an accepted create request to one persisted publication before reporting commit. */
export function createKanbanEditorPublicationBridge<TCard>(
  claimId: string,
  authority: KanbanEditorAuthority,
  publication: {
    readonly resolve: (
      operationId: KanbanOperationId,
      context: KanbanEditorCreatePublicationContext,
    ) => Promise<KanbanEditorCreatedRecord<TCard>>;
  },
  callerSignal: AbortSignal | undefined,
): KanbanEditorCreatePublicationBridge<TCard> {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  callerSignal?.addEventListener('abort', abort, { once: true });
  let listener:
    | ((publication: { readonly kind: 'record'; readonly card: TCard; readonly revision: KanbanRevision }) => void)
    | undefined;
  const resolver: KanbanEditorRecordResolver<TCard> = Object.freeze({
    resolve: async () => Object.freeze({ kind: 'unavailable', code: 'provisional-card' }),
    subscribe: (
      _cardKey: CardKey,
      next: (publication: { readonly kind: 'record'; readonly card: TCard; readonly revision: KanbanRevision }) => void,
    ) => {
      listener = next;
      return () => {
        if (listener === next) listener = undefined;
      };
    },
  });
  const bridgedAuthority: KanbanEditorAuthority = Object.freeze({
    request: async (proposal: KanbanRequestProposal) => {
      const requested = snapshotKanbanEditorAuthorityResult(await authority.request(proposal));
      if (requested.kind !== 'accepted') return requested;
      const created = snapshotCreatedRecord(
        await publication.resolve(requested.operationId, Object.freeze({ signal: controller.signal })),
      );
      if (controller.signal.aborted) return Object.freeze({ kind: 'cancelled', operationId: requested.operationId });
      listener?.({ kind: 'record', card: created.card, revision: created.revision });
      return Object.freeze({
        kind: 'accepted',
        operationId: requested.operationId,
        publication: Object.freeze({
          operationId: requested.operationId,
          subjects: Object.freeze([
            Object.freeze({
              kind: 'card' as const,
              cardKey: createKanbanCardKey(claimId),
              baselineRevision: created.revision,
              expectedRevision: created.revision,
            }),
          ]),
        }),
      });
    },
    ...(authority.cancel === undefined
      ? {}
      : { cancel: (operationId: KanbanOperationId) => authority.cancel?.(operationId) === true }),
  });
  return Object.freeze({
    resolver,
    authority: bridgedAuthority,
    dispose: () => {
      controller.abort();
      callerSignal?.removeEventListener('abort', abort);
      listener = undefined;
    },
  });
}

/** Runs one default or application-replaced modal and releases its exact session claim on every exit. */
export async function runKanbanEditorDialog<TCard, TDraft, TResult>(
  host: KanbanEditorDialogHost,
  options: KanbanEditorResolvedDialogOptions<TCard, TDraft, TResult>,
): Promise<KanbanEditorDialogResult<TResult>> {
  if (dialogSignalAborted(options.signal)) return Object.freeze({ kind: 'disposed' });
  const opened = await options.coordinator.open({
    mode: options.mode,
    cardKey: options.cardKey,
    adapter: options.adapter,
    resolver: options.resolver,
    authority: options.completion?.kind === 'authority' ? options.completion.authority : inertAuthority(),
    signal: options.signal,
    editorKind: options.replacement === undefined ? 'standard' : 'custom',
  });
  if (opened.kind !== 'opened') return opened;

  const session = opened.session;
  if (dialogSignalAborted(options.signal)) {
    session.dispose();
    return Object.freeze({ kind: 'disposed' });
  }
  let outcome: KanbanEditorDialogResult<TResult> =
    options.mode === 'view' ? Object.freeze({ kind: 'closed' }) : Object.freeze({ kind: 'cancelled' });
  let submitting = false;
  let cancelling = false;
  let reloading = false;
  let terminal = false;
  let standardDialog: KanbanEditorDialog<TCard, TDraft> | undefined;
  let dialog: Dialog | undefined;

  /** Completes only this editor; a nested confirmation safely defers the close until it returns. */
  const finish = (next: KanbanEditorDialogResult<TResult>, command: string): void => {
    if (!terminal) {
      terminal = true;
      outcome = next;
    }
    dialog?.finishModal(command);
  };
  const drainTerminal = (): void => {
    if (terminal) dialog?.finishModal(outcome.kind);
  };
  const pendingSubmission = (): boolean => {
    const kind = session.snapshot().submission.kind;
    return kind === 'validating' || kind === 'dispatching' || kind === 'awaiting-publication';
  };

  const focusInvalid = (fieldId: KanbanEditorFieldState['fieldId']): void => {
    standardDialog?.focusField(fieldId, (view) => host.loop.focusView(view));
  };
  const submit = async (): Promise<KanbanEditorDialogSubmitResult<TResult>> => {
    if (terminal || submitting) return Object.freeze({ kind: 'sealed' });
    if (options.mode === 'view' || options.completion === undefined) return Object.freeze({ kind: 'read-only' });
    submitting = true;
    try {
      if (options.completion.kind === 'result-only') {
        const prepared = await session.prepare();
        if (prepared.kind === 'invalid') focusInvalid(prepared.fieldId);
        if (prepared.kind !== 'prepared') return prepared;
        try {
          const detached = Object.freeze({
            kind: 'result' as const,
            value: options.completion.detach(prepared.result),
          });
          finish(detached, 'result');
          return detached;
        } catch {
          standardDialog?.reportFailure('kanban.editor.status.result-failed', 'Unable to prepare result');
          return Object.freeze({ kind: 'failed' });
        }
      }
      const result = await session.submit();
      if (result.kind === 'invalid') focusInvalid(result.fieldId);
      if (result.kind === 'committed') finish(result, 'committed');
      return result;
    } finally {
      submitting = false;
    }
  };
  const cancel = async (): Promise<void> => {
    if (terminal || cancelling || submitting || pendingSubmission()) return;
    cancelling = true;
    try {
      if (
        options.mode !== 'view' &&
        session.snapshot().dirty &&
        !(await confirmKanbanEditorAction(host, { kind: 'discard-draft', mode: options.mode }, options.confirm))
      ) {
        drainTerminal();
        return;
      }
      if (terminal || submitting || pendingSubmission()) {
        drainTerminal();
        return;
      }
      finish(
        options.mode === 'view' ? Object.freeze({ kind: 'closed' }) : Object.freeze({ kind: 'cancelled' }),
        'cancel',
      );
    } finally {
      cancelling = false;
      drainTerminal();
    }
  };
  const reload = async (): Promise<KanbanEditorConfirmedReloadResult> => {
    if (terminal || reloading || submitting || pendingSubmission()) return Object.freeze({ kind: 'sealed' });
    reloading = true;
    try {
      const result = await confirmAndReloadKanbanEditor(host, session, options.confirm);
      if (!terminal) {
        const focusedFieldId = session.snapshot().focusedFieldId;
        if (result.kind === 'reloaded' && focusedFieldId !== undefined) focusInvalid(focusedFieldId);
      }
      return result;
    } finally {
      reloading = false;
      drainTerminal();
    }
  };
  const close = async (): Promise<void> => {
    if (options.mode !== 'view' && session.snapshot().record.kind !== 'deleted') {
      await cancel();
      return;
    }
    if (!terminal && !submitting && !pendingSubmission()) finish(Object.freeze({ kind: 'closed' }), 'close');
  };
  try {
    if (options.replacement === undefined) {
      standardDialog = new KanbanEditorDialog({
        i18n: host.i18n,
        viewport: host.desktop.bounds,
        adapter: options.adapter,
        session,
        handlers: {
          submit: () => void submit(),
          cancel: () => void cancel(),
          reload: () => void reload(),
          close: () => void close(),
        },
      });
      dialog = standardDialog;
    } else {
      dialog = options.replacement(
        options.mode === 'create'
          ? Object.freeze({
              mode: 'create' as const,
              session,
              actions: Object.freeze({ submit, cancel }),
              presentation: Object.freeze({ i18n: () => host.i18n, theme: () => host.theme?.() }),
            })
          : options.mode === 'edit'
            ? Object.freeze({
                mode: 'edit' as const,
                session,
                actions: Object.freeze({ submit, cancel, reload, close }),
                presentation: Object.freeze({ i18n: () => host.i18n, theme: () => host.theme?.() }),
              })
            : Object.freeze({
                mode: 'view' as const,
                session,
                actions: Object.freeze({ close }),
                presentation: Object.freeze({ i18n: () => host.i18n, theme: () => host.theme?.() }),
              }),
      );
      if (!(dialog instanceof Dialog)) throw new TypeError('Invalid Kanban editor replacement.');
      const replacement = dialog;
      const delegate = replacement.onEvent.bind(replacement);
      replacement.onEvent = (event: DispatchEvent): void => {
        const inner = event.event;
        if (inner.type === 'command' && inner.command === Commands.ok) {
          event.handled = true;
          void submit();
          return;
        }
        if (
          (inner.type === 'command' && inner.command === Commands.cancel) ||
          (inner.type === 'key' && inner.key === 'escape') ||
          (inner.type === 'mouse' &&
            inner.kind === 'down' &&
            event.local?.y === 0 &&
            event.local.x >= 2 &&
            event.local.x <= 4 &&
            replacement.closable)
        ) {
          event.handled = true;
          void cancel();
          return;
        }
        delegate(event);
      };
    }
  } catch {
    session.dispose();
    return Object.freeze({ kind: 'failed' });
  }
  let unsubscribe: (() => void) | undefined;
  let mountAttempted = false;
  const abortDialog = (): void => finish(Object.freeze({ kind: 'disposed' }), 'disposed');
  try {
    options.signal?.addEventListener('abort', abortDialog, { once: true });
    unsubscribe = session.subscribe((snapshot) => {
      if (snapshot.submission.kind === 'committed') {
        finish(Object.freeze({ kind: 'committed', operationId: snapshot.submission.operationId }), 'committed');
      }
    });
    if (dialogSignalAborted(options.signal)) return Object.freeze({ kind: 'disposed' });
    mountAttempted = true;
    host.desktop.addWindow(dialog);
    const pending = host.loop.execView<string>(dialog);
    if (standardDialog?.firstControl !== undefined) host.loop.focusView(standardDialog.firstControl);
    await pending;
    return outcome;
  } catch {
    return Object.freeze({ kind: 'failed' });
  } finally {
    options.signal?.removeEventListener('abort', abortDialog);
    try {
      unsubscribe?.();
    } catch {
      // Cleanup continues independently when an application-backed subscription throws.
    }
    if (mountAttempted) {
      try {
        host.desktop.removeWindow(dialog);
      } catch {
        // Host removal failure cannot retain the editor session or its custom controls.
      }
    }
    try {
      standardDialog?.disposeBindings();
    } catch {
      // Every remaining owned resource still receives its cleanup attempt.
    }
    session.dispose();
  }
}
