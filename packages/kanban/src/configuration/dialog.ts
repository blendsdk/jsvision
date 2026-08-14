import {
  Button,
  Commands,
  Dialog,
  Input,
  Label,
  Scroller,
  Text,
  col,
  cover,
  fixed,
  grow,
  row,
  signal,
} from '@jsvision/ui';
import type { DispatchEvent, View } from '@jsvision/ui';

import { createKanbanEditorActionBand } from '../editor/dialog-action-band.js';
import { resolveKanbanEditorMessage } from '../editor/presentation-text.js';
import { createKanbanConfigurationSession } from './session.js';
import { confirmKanbanConfigurationDeletion } from './delete-dialog.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationConfirm,
  KanbanConfigurationDialogCompletion,
  KanbanConfigurationDialogHost,
  KanbanConfigurationDialogResult,
  KanbanConfigurationSession,
  KanbanConfigurationSessionSnapshot,
  KanbanConfigurationSource,
  KanbanSwimlaneConfigurationOperation,
} from './types.js';

/** Smallest geometry that preserves one field, status, and wrapped actions. */
const MINIMUM_DIALOG = Object.freeze({ width: 32, height: 10 });
/** Preferred compact geometry that leaves visible desktop around an 80×24 host. */
const PREFERRED_DIALOG = Object.freeze({ width: 62, height: 16 });
/** Content inset in addition to the dialog frame. */
const BODY_PADDING = 1;

/** Internal options shared by column and swimlane dialog invokers. */
export interface KanbanConfigurationDialogOptions {
  /** Authoritative application structure source. */
  readonly source: KanbanConfigurationSource;
  /** Exact structural operation presented by this dialog. */
  readonly operation: KanbanColumnConfigurationOperation | KanbanSwimlaneConfigurationOperation;
  /** Result-only or application-authority completion. */
  readonly completion: KanbanConfigurationDialogCompletion;
  /** Optional application confirmation policy for dirty cancellation and stale reload. */
  readonly confirm?: KanbanConfigurationConfirm;
}

/** Returns a positive responsive dimension clamped to the current terminal. */
function compactDimension(preferred: number, minimum: number, available: number): number {
  const safe = Number.isSafeInteger(available) && available > 0 ? available : 1;
  return Math.min(safe, Math.max(Math.min(minimum, safe), Math.min(preferred, Math.max(1, safe - 4))));
}

/** Returns a safe localized configuration label with a deterministic English fallback. */
function translated(host: KanbanConfigurationDialogHost, messageId: string, fallback: string): string {
  return resolveKanbanEditorMessage(host.i18n, messageId, fallback);
}

/** Returns a short payload-free lifecycle summary. */
function statusText(host: KanbanConfigurationDialogHost, state: KanbanConfigurationSessionSnapshot): string {
  if (state.record === 'stale')
    return translated(host, 'kanban.configuration.status.stale', 'Structure changed · Reload');
  if (state.record === 'unavailable') {
    return translated(host, 'kanban.configuration.status.unavailable', 'Structure unavailable');
  }
  if (state.submission === 'dispatching') {
    return translated(host, 'kanban.configuration.status.saving', 'Applying…');
  }
  if (state.submission === 'rejected') return state.code ?? 'rejected';
  if (state.submission === 'accepted') return translated(host, 'kanban.configuration.status.applied', 'Applied');
  return state.dirty
    ? translated(host, 'kanban.configuration.status.unsaved', 'Unsaved changes')
    : translated(host, 'kanban.configuration.status.ready', 'Ready');
}

/** Responsive retained presentation for one column or swimlane configuration session. */
class KanbanConfigurationDialog extends Dialog {
  /** First text input retained for focus preservation across resize and rejection. */
  readonly input: Input;
  /** Session presentation subscription released with the mounted dialog. */
  protected readonly unsubscribe: () => void;
  /** Prevents explicit and unmount cleanup from releasing twice. */
  protected presentationDisposed = false;

  /** Creates a compact centered dialog whose retained controls reflow without reconstruction. */
  constructor(
    host: KanbanConfigurationDialogHost,
    session: KanbanConfigurationSession,
    operation: KanbanConfigurationDialogOptions['operation'],
    handlers: { readonly apply: () => void; readonly cancel: () => void; readonly reload: () => void },
  ) {
    const width = compactDimension(PREFERRED_DIALOG.width, MINIMUM_DIALOG.width, host.desktop.bounds.width);
    const height = compactDimension(PREFERRED_DIALOG.height, MINIMUM_DIALOG.height, host.desktop.bounds.height);
    const structure = 'columnId' in operation ? 'column' : 'swimlane';
    super({
      title: translated(
        host,
        `kanban.configuration.${structure}.${operation.kind}.title`,
        `${operation.kind === 'add' ? 'Add' : operation.kind === 'update' ? 'Edit' : operation.kind === 'reorder' ? 'Reorder' : 'Delete'} ${structure}`,
      ),
      width,
      height,
    });
    this.resizable = true;
    this.zoomable = true;
    this.minWidth = MINIMUM_DIALOG.width;
    this.minHeight = MINIMUM_DIALOG.height;

    const name = signal(session.snapshot().label);
    const status = signal(statusText(host, session.snapshot()));
    const input = new Input({ value: name, maxLength: 16_384 });
    this.input = input;
    const label = new Label(translated(host, 'kanban.configuration.field.name', '~N~ame'), input);
    const field = row({ gap: 1 }, fixed(label, 10), grow(input, 1, { min: 8 }));
    const instructions = new Text(
      operation.kind === 'reorder'
        ? translated(host, 'kanban.configuration.reorder.help', 'Choose a stable neighbor, then Apply.')
        : translated(host, 'kanban.configuration.edit.help', 'Edit the isolated draft, then Apply or Cancel.'),
    );
    const content = col({ gap: 1 }, fixed(field, 1), fixed(instructions, 1));
    const scroller = new Scroller({
      content,
      extent: () => ({ width: Math.max(24, width - 4), height: 3 }),
      scrollbars: 'both',
    });
    const apply = new Button(translated(host, 'kanban.configuration.action.apply', '~A~pply'), {
      default: true,
      onClick: handlers.apply,
    });
    const reload = new Button(translated(host, 'kanban.configuration.action.reload', '~R~eload'), {
      onClick: handlers.reload,
    });
    const moveAfter = new Button(translated(host, 'kanban.configuration.action.move-after', 'Move ~a~fter'), {
      onClick: () => {
        session.setPosition({ kind: 'end' });
      },
    });
    const cancel = new Button(translated(host, 'kanban.configuration.action.cancel', '~C~ancel'), {
      onClick: handlers.cancel,
    });
    const buttons = operation.kind === 'reorder' ? [apply, moveAfter, reload, cancel] : [apply, reload, cancel];
    const actions: View = createKanbanEditorActionBand(buttons, Math.max(1, width - 4));
    this.add(
      cover(col({ padding: BODY_PADDING, gap: 1 }, grow(scroller, 1, { min: 2 }), fixed(new Text(status), 1), actions)),
    );
    this.onMount(() => {
      this.bind(name, (value) => session.setLabel(value));
      this.onCleanup(() => this.disposePresentation());
    });
    this.unsubscribe = session.subscribe((state) => {
      if (name() !== state.label && !state.dirty) name.set(state.label);
      status.set(statusText(host, state));
      const busy = state.submission === 'dispatching' || state.submission === 'accepted';
      apply.state.disabled = busy || state.record !== 'ready';
      reload.state.disabled = busy || state.record !== 'stale';
      cancel.state.disabled = busy;
      moveAfter.state.disabled = busy || state.record !== 'ready';
    });
  }

  /** Releases the state subscription idempotently. */
  disposePresentation(): void {
    if (this.presentationDisposed) return;
    this.presentationDisposed = true;
    try {
      this.unsubscribe();
    } catch {
      // A hostile application observer disposer cannot retain the modal session.
    }
  }
}

/** Opens one package-owned configuration modal and owns all session/mount cleanup. */
export async function openKanbanConfigurationDialog(
  host: KanbanConfigurationDialogHost,
  options: KanbanConfigurationDialogOptions,
): Promise<KanbanConfigurationDialogResult> {
  let session: KanbanConfigurationSession;
  try {
    session = await createKanbanConfigurationSession({
      source: options.source,
      operation: options.operation,
      ...(options.completion.kind === 'authority' ? { authority: options.completion.authority } : {}),
    });
  } catch {
    return Object.freeze({ kind: 'failed' });
  }
  let outcome: KanbanConfigurationDialogResult = Object.freeze({ kind: 'cancelled' });
  let terminal = false;
  let applying = false;
  const mounted: { dialog?: KanbanConfigurationDialog } = {};
  const finish = (next: KanbanConfigurationDialogResult): void => {
    if (terminal) return;
    terminal = true;
    outcome = next;
    mounted.dialog?.finishModal(next.kind);
  };
  const apply = async (): Promise<void> => {
    if (terminal || applying) return;
    applying = true;
    try {
      if (
        options.operation.kind === 'delete' &&
        !(await confirmKanbanConfigurationDeletion(host, {
          occupancy: options.operation.occupancy,
          hasPolicy: options.operation.policy !== undefined,
          ...(options.confirm === undefined ? {} : { confirm: options.confirm }),
        }))
      ) {
        return;
      }
      const result = await session.apply();
      if (result.kind === 'proposal' || result.kind === 'accepted') finish(result);
    } finally {
      applying = false;
    }
  };
  const cancel = async (): Promise<void> => {
    if (terminal || applying) return;
    if (session.snapshot().dirty && options.confirm !== undefined) {
      try {
        if (!(await options.confirm({ kind: 'discard-draft' }))) return;
      } catch {
        return;
      }
    }
    finish(Object.freeze({ kind: 'cancelled' }));
  };
  const reload = async (): Promise<void> => {
    if (terminal || applying || session.snapshot().record !== 'stale') return;
    if (options.confirm !== undefined) {
      try {
        if (!(await options.confirm({ kind: 'reload-stale' }))) return;
      } catch {
        return;
      }
    }
    await session.reload();
  };
  const dialog = new KanbanConfigurationDialog(host, session, options.operation, {
    apply: () => void apply(),
    cancel: () => void cancel(),
    reload: () => void reload(),
  });
  mounted.dialog = dialog;
  const delegate = dialog.onEvent.bind(dialog);
  dialog.onEvent = (event: DispatchEvent): void => {
    const inner = event.event;
    if (inner.type === 'command' && inner.command === Commands.ok) {
      event.handled = true;
      void apply();
      return;
    }
    if (
      (inner.type === 'command' && inner.command === Commands.cancel) ||
      (inner.type === 'key' && inner.key === 'escape')
    ) {
      event.handled = true;
      void cancel();
      return;
    }
    if (inner.type === 'command' && inner.command === 'kanban.configuration.move-after') {
      event.handled = true;
      session.setPosition({ kind: 'end' });
      return;
    }
    delegate(event);
  };
  try {
    host.desktop.addWindow(dialog);
    const pending = host.loop.execView<string>(dialog);
    host.loop.focusView(dialog.input);
    await pending;
    return outcome;
  } catch {
    return Object.freeze({ kind: 'failed' });
  } finally {
    dialog.disposePresentation();
    try {
      host.desktop.removeWindow(dialog);
    } catch {
      // Host removal failure cannot retain the package session.
    }
    session.dispose();
  }
}
