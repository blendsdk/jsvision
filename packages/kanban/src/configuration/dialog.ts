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
import { confirmKanbanConfigurationAction } from './confirmation.js';
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
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';

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
  /** Optional caller lifetime for modal, source, and authority work. */
  readonly signal?: AbortSignal;
  /** Optional application bridge that applies a committed deletion's stable board focus target. */
  readonly focus?: (target: KanbanConfigurationFocusTarget) => void;
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

/** Localizes one stable destination while preserving application-owned neighbor labels. */
function reorderDestinationLabel(
  host: KanbanConfigurationDialogHost,
  destination: ReturnType<KanbanConfigurationSession['reorderDestinations']>[number],
): string {
  const position = destination.position;
  if (position.kind === 'start') return translated(host, 'kanban.configuration.reorder.start', 'Start');
  if (position.kind === 'end') return translated(host, 'kanban.configuration.reorder.end', 'End');
  if (position.kind === 'between') {
    return `${translated(host, 'kanban.configuration.reorder.between', 'Between')} ${destination.label}`;
  }
  return `${translated(
    host,
    position.kind === 'before' ? 'kanban.configuration.reorder.before' : 'kanban.configuration.reorder.after',
    position.kind === 'before' ? 'Before' : 'After',
  )} ${destination.label}`;
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
  const diagnostic = state.diagnostics?.[0]?.label ?? state.diagnostics?.[0]?.code ?? state.code;
  if (diagnostic !== undefined) return diagnostic;
  if (state.submission === 'awaiting-publication') {
    return translated(host, 'kanban.configuration.status.awaiting-publication', 'Waiting for board update…');
  }
  if (state.submission === 'committed') return translated(host, 'kanban.configuration.status.applied', 'Applied');
  if (state.deletion?.kind === 'disabled') {
    const fallback =
      state.deletion.code === 'occupancy-unknown'
        ? 'Affected-card count is unavailable'
        : state.deletion.code === 'non-empty-policy-required'
          ? 'Choose a destination for affected cards'
          : 'Derived groups are read-only';
    return translated(host, `kanban.configuration.delete.${state.deletion.code}`, fallback);
  }
  return state.dirty
    ? translated(host, 'kanban.configuration.status.unsaved', 'Unsaved changes')
    : translated(host, 'kanban.configuration.status.ready', 'Ready');
}

/** Responsive retained presentation for one column or swimlane configuration session. */
class KanbanConfigurationDialog extends Dialog {
  /** First text input retained for focus preservation across resize and rejection. */
  readonly input: Input;
  /** First reachable control for the selected operation. */
  readonly initialFocus: View;
  /** Session presentation subscription released with the mounted dialog. */
  protected readonly unsubscribe: () => void;
  /** Prevents explicit and unmount cleanup from releasing twice. */
  protected presentationDisposed = false;

  /** Creates a compact centered dialog whose retained controls reflow without reconstruction. */
  constructor(
    host: KanbanConfigurationDialogHost,
    session: KanbanConfigurationSession,
    operation: KanbanConfigurationDialogOptions['operation'],
    handlers: {
      readonly apply: () => void;
      readonly cancel: () => void;
      readonly reload: () => void;
      readonly committed: (operationId: string) => void;
      readonly focus: (target: KanbanConfigurationFocusTarget) => void;
    },
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
    const initial = session.snapshot();
    const disambiguator = signal(initial.disambiguator ?? '');
    const definitionSummary = signal(initial.definitionOfDone?.summary ?? '');
    const definitionDetails = signal(initial.definitionOfDone?.details ?? '');
    const wipMinimum = signal(initial.wip?.minimum?.toString() ?? '');
    const wipMaximum = signal(initial.wip?.maximum?.toString() ?? '');
    const wipMode = signal(initial.wip?.mode ?? '');
    const wipCountDone = signal(initial.wip?.countDone ?? '');
    const styleRole = signal(initial.style?.role ?? '');
    const applicationData = signal(initial.data === undefined ? '' : (JSON.stringify(initial.data) ?? ''));
    const deletionPolicyStatus = signal('');
    const status = signal(statusText(host, session.snapshot()));
    const input = new Input({ value: name, maxLength: 16_384 });
    const editableInputs: Input[] = [input];
    input.state.disabled = operation.kind === 'reorder' || operation.kind === 'delete';
    this.input = input;
    const label = new Label(translated(host, 'kanban.configuration.field.name', '~N~ame'), input);
    const field = row({ gap: 1 }, fixed(label, 10), grow(input, 1, { min: 8 }));
    const instructions = new Text(
      operation.kind === 'reorder'
        ? translated(host, 'kanban.configuration.reorder.help', 'Choose a stable neighbor, then Apply.')
        : translated(host, 'kanban.configuration.edit.help', 'Edit the isolated draft, then Apply or Cancel.'),
    );
    const contentRows: View[] = operation.kind === 'reorder' ? [] : [field];
    let firstDestination: Button | undefined;
    if (operation.kind === 'add' || operation.kind === 'update') {
      const disambiguatorInput = new Input({ value: disambiguator, maxLength: 16_384 });
      editableInputs.push(disambiguatorInput);
      contentRows.push(
        row(
          { gap: 1 },
          fixed(
            new Label(translated(host, 'kanban.configuration.field.disambiguator', '~Q~ualifier'), disambiguatorInput),
            10,
          ),
          grow(disambiguatorInput, 1, { min: 8 }),
        ),
      );
      if ('columnId' in operation) {
        const summaryInput = new Input({ value: definitionSummary, maxLength: 16_384 });
        const detailsInput = new Input({ value: definitionDetails, maxLength: 16_384 });
        editableInputs.push(summaryInput, detailsInput);
        contentRows.push(
          row(
            { gap: 1 },
            fixed(
              new Label(translated(host, 'kanban.configuration.field.done-summary', 'Done ~s~ummary'), summaryInput),
              10,
            ),
            grow(summaryInput, 1, { min: 8 }),
          ),
          row(
            { gap: 1 },
            fixed(
              new Label(translated(host, 'kanban.configuration.field.done-details', 'Done de~t~ails'), detailsInput),
              10,
            ),
            grow(detailsInput, 1, { min: 8 }),
          ),
        );
        const minimumInput = new Input({ value: wipMinimum, maxLength: 16 });
        const maximumInput = new Input({ value: wipMaximum, maxLength: 16 });
        const modeInput = new Input({ value: wipMode, maxLength: 16 });
        const countDoneInput = new Input({ value: wipCountDone, maxLength: 8 });
        editableInputs.push(minimumInput, maximumInput, modeInput, countDoneInput);
        contentRows.push(
          row(
            { gap: 1 },
            fixed(new Label(translated(host, 'kanban.configuration.field.wip-minimum', 'WIP mi~n~'), minimumInput), 10),
            grow(minimumInput, 1, { min: 8 }),
          ),
          row(
            { gap: 1 },
            fixed(new Label(translated(host, 'kanban.configuration.field.wip-maximum', 'WIP ma~x~'), maximumInput), 10),
            grow(maximumInput, 1, { min: 8 }),
          ),
          row(
            { gap: 1 },
            fixed(new Label(translated(host, 'kanban.configuration.field.wip-mode', 'WIP m~o~de'), modeInput), 10),
            grow(modeInput, 1, { min: 8 }),
          ),
          row(
            { gap: 1 },
            fixed(
              new Label(translated(host, 'kanban.configuration.field.wip-count-done', 'Count ~d~one'), countDoneInput),
              10,
            ),
            grow(countDoneInput, 1, { min: 8 }),
          ),
        );
      }
      const styleInput = new Input({ value: styleRole, maxLength: 128 });
      editableInputs.push(styleInput);
      contentRows.push(
        row(
          { gap: 1 },
          fixed(new Label(translated(host, 'kanban.configuration.field.style', 'Style ~r~ole'), styleInput), 10),
          grow(styleInput, 1, { min: 8 }),
        ),
      );
      const dataInput = new Input({ value: applicationData, maxLength: 16_384 });
      editableInputs.push(dataInput);
      contentRows.push(
        row(
          { gap: 1 },
          fixed(new Label(translated(host, 'kanban.configuration.field.data', 'App ~m~etadata'), dataInput), 10),
          grow(dataInput, 1, { min: 8 }),
        ),
      );
      this.onMount(() => {
        const applyWip = (): void => {
          if (!('columnId' in operation)) return;
          const minimumText = wipMinimum().trim();
          const maximumText = wipMaximum().trim();
          const modeText = wipMode().trim();
          const countDoneText = wipCountDone().trim();
          if (minimumText === '' && maximumText === '' && modeText === '' && countDoneText === '') {
            session.setWip(undefined);
            return;
          }
          session.setWip({
            ...(minimumText === '' ? {} : { minimum: Number(minimumText) }),
            ...(maximumText === '' ? {} : { maximum: Number(maximumText) }),
            mode: modeText === '' ? 'informational' : modeText,
            countDone: countDoneText === '' ? 'exclude' : countDoneText,
          });
        };
        this.bind(disambiguator, (value) => session.setDisambiguator(value));
        this.bind(definitionSummary, (value) => session.setDefinitionOfDone(value, definitionDetails()));
        this.bind(definitionDetails, (value) => session.setDefinitionOfDone(definitionSummary(), value));
        this.bind(wipMinimum, applyWip);
        this.bind(wipMaximum, applyWip);
        this.bind(wipMode, applyWip);
        this.bind(wipCountDone, applyWip);
        this.bind(styleRole, (value) => session.setStyle(value.trim() === '' ? undefined : { role: value }));
        this.bind(applicationData, (value) => {
          if (value.trim() === '') {
            session.setData(undefined);
            return;
          }
          try {
            session.setData(JSON.parse(value));
          } catch {
            session.setData(Symbol('invalid-json'));
          }
        });
      });
    }
    if (operation.kind === 'reorder') {
      const destinationButtons = session.reorderDestinations().map(
        (destination) =>
          new Button(reorderDestinationLabel(host, destination), {
            onClick: () => session.setPosition(destination.position),
          }),
      );
      firstDestination = destinationButtons[0];
      contentRows.push(
        new Text(translated(host, 'kanban.configuration.reorder.destinations', 'Choose destination:')),
        ...destinationButtons,
      );
    }
    if (operation.kind === 'delete') {
      const occupancy =
        operation.occupancy.quality === 'unknown'
          ? translated(host, 'kanban.configuration.delete.occupancy-unknown', 'Affected cards: unknown')
          : `${translated(host, 'kanban.configuration.delete.affected', 'Affected cards')}: ${operation.occupancy.count}`;
      const policy =
        operation.policy === undefined
          ? translated(host, 'kanban.configuration.delete.no-policy', 'No reassignment policy')
          : translated(host, 'kanban.configuration.delete.policy-ready', 'Atomic policy configured');
      deletionPolicyStatus.set(policy);
      contentRows.push(new Text(occupancy), new Text(deletionPolicyStatus));
      if (operation.occupancy.quality === 'exact' && operation.occupancy.count > 0) {
        contentRows.push(
          new Text(translated(host, 'kanban.configuration.delete.destination', 'Move affected cards to:')),
          ...session.deletionDestinations().map(
            (destination) =>
              new Button(destination.label, {
                onClick: () => session.setDeletionDestination(destination.destinationId),
              }),
          ),
        );
      }
    }
    contentRows.push(instructions);
    const contentHeight =
      contentRows.reduce((height, view) => height + (view instanceof Button ? 2 : 1), 0) + contentRows.length - 1;
    const content = col({ gap: 1 }, ...contentRows.map((view) => fixed(view, view instanceof Button ? 2 : 1)));
    this.initialFocus = firstDestination ?? input;
    const scroller = new Scroller({
      content,
      extent: () => ({ width: Math.max(24, this.bounds.width - 4), height: contentHeight }),
      scrollbars: 'both',
    });
    const apply = new Button(translated(host, 'kanban.configuration.action.apply', '~A~pply'), {
      default: true,
      onClick: handlers.apply,
    });
    apply.state.disabled = session.snapshot().deletion?.kind === 'disabled';
    const reload = new Button(translated(host, 'kanban.configuration.action.reload', '~R~eload'), {
      onClick: handlers.reload,
    });
    reload.state.disabled = session.snapshot().record !== 'stale';
    const cancel = new Button(translated(host, 'kanban.configuration.action.cancel', '~C~ancel'), {
      onClick: handlers.cancel,
    });
    const buttons = [apply, reload, cancel];
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
      if (operation.kind === 'delete' && state.deletion?.kind === 'ready') {
        deletionPolicyStatus.set(
          translated(host, 'kanban.configuration.delete.policy-ready', 'Atomic policy configured'),
        );
      }
      const busy = state.submission === 'dispatching' || state.submission === 'awaiting-publication';
      const applyDisabled = busy || state.record !== 'ready' || state.deletion?.kind === 'disabled';
      if (apply.state.disabled !== applyDisabled) {
        apply.state.disabled = applyDisabled;
        apply.invalidate();
      }
      const reloadDisabled = busy || state.record !== 'stale';
      if (reload.state.disabled !== reloadDisabled) {
        reload.state.disabled = reloadDisabled;
        reload.invalidate();
      }
      const cancelDisabled = busy || state.submission === 'committed';
      if (cancel.state.disabled !== cancelDisabled) {
        cancel.state.disabled = cancelDisabled;
        cancel.invalidate();
      }
      const inputsDisabled =
        busy || state.submission === 'committed' || operation.kind === 'reorder' || operation.kind === 'delete';
      for (const editableInput of editableInputs) {
        if (editableInput.state.disabled === inputsDisabled) continue;
        editableInput.state.disabled = inputsDisabled;
        editableInput.invalidate();
      }
      if (state.submission === 'committed' && state.focusTarget !== undefined) handlers.focus(state.focusTarget);
      if (state.submission === 'committed' && state.operationId !== undefined) handlers.committed(state.operationId);
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
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch {
    return Object.freeze({ kind: 'failed' });
  }
  let outcome: KanbanConfigurationDialogResult = Object.freeze({ kind: 'cancelled' });
  let terminal = false;
  let applying = false;
  const mounted: { dialog?: KanbanConfigurationDialog } = {};
  const lifetime = new AbortController();
  const operation = session.operation();
  const drainTerminal = (): void => {
    if (terminal) mounted.dialog?.finishModal(outcome.kind);
  };
  const finish = (next: KanbanConfigurationDialogResult): void => {
    if (!terminal) {
      terminal = true;
      outcome = next;
      lifetime.abort();
    }
    drainTerminal();
  };
  const abortDialog = (): void => finish(Object.freeze({ kind: 'disposed' }));
  if (options.signal?.aborted === true) abortDialog();
  else options.signal?.addEventListener('abort', abortDialog, { once: true });
  const apply = async (): Promise<void> => {
    if (terminal || applying) return;
    applying = true;
    try {
      if (
        operation.kind === 'delete' &&
        !(await confirmKanbanConfigurationDeletion(host, {
          occupancy: operation.occupancy,
          hasPolicy: operation.policy !== undefined || session.snapshot().deletion?.kind === 'ready',
          signal: lifetime.signal,
          ...(options.confirm === undefined ? {} : { confirm: options.confirm }),
        }))
      ) {
        return;
      }
      const result = await session.apply();
      if (result.kind === 'proposal' || result.kind === 'committed') finish(result);
    } finally {
      applying = false;
      drainTerminal();
    }
  };
  const cancel = async (): Promise<void> => {
    const submission = session.snapshot().submission;
    if (terminal || applying || submission === 'awaiting-publication' || submission === 'committed') return;
    if (session.snapshot().dirty) {
      const discard = await confirmKanbanConfigurationAction(
        host,
        'discard-draft',
        translated(host, 'kanban.configuration.confirm.discard-draft', 'Discard unsaved changes?'),
        lifetime.signal,
        options.confirm,
      );
      drainTerminal();
      if (!discard) return;
    }
    finish(Object.freeze({ kind: 'cancelled' }));
  };
  const reload = async (): Promise<void> => {
    if (terminal || applying || session.snapshot().record !== 'stale') return;
    if (
      !(await confirmKanbanConfigurationAction(
        host,
        'reload-stale',
        translated(host, 'kanban.configuration.confirm.reload-stale', 'Reload and discard local changes?'),
        lifetime.signal,
        options.confirm,
      ))
    )
      return;
    try {
      await session.reload();
    } finally {
      drainTerminal();
    }
  };
  if (terminal) {
    session.dispose();
    options.signal?.removeEventListener('abort', abortDialog);
    return outcome;
  }
  const dialog = new KanbanConfigurationDialog(host, session, operation, {
    apply: () => void apply(),
    cancel: () => void cancel(),
    reload: () => void reload(),
    committed: (operationId) => finish(Object.freeze({ kind: 'committed', operationId })),
    focus: (target) => {
      try {
        options.focus?.(target);
      } catch {
        // Application focus failure cannot roll back an already-authoritative publication.
      }
    },
  });
  mounted.dialog = dialog;
  drainTerminal();
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
      (inner.type === 'key' && inner.key === 'escape') ||
      (inner.type === 'mouse' &&
        inner.kind === 'down' &&
        event.local?.y === 0 &&
        event.local.x >= 2 &&
        event.local.x <= 4 &&
        dialog.closable)
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
    drainTerminal();
    host.loop.focusView(dialog.initialFocus);
    await pending;
    return outcome;
  } catch {
    return Object.freeze({ kind: 'failed' });
  } finally {
    options.signal?.removeEventListener('abort', abortDialog);
    dialog.disposePresentation();
    try {
      host.desktop.removeWindow(dialog);
    } catch {
      // Host removal failure cannot retain the package session.
    }
    session.dispose();
  }
}
