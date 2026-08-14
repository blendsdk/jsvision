import type { I18n } from '@jsvision/i18n';
import {
  Button,
  Commands,
  Dialog,
  Label,
  Scroller,
  Text,
  at,
  buttonGroup,
  cancelButton,
  col,
  cover,
  fixed,
  grow,
  measureButtonGroup,
  okButton,
  row,
  stringWidth,
} from '@jsvision/ui';
import type { Desktop, DispatchEvent, EventLoop, Group, View } from '@jsvision/ui';

import type { CardKey } from '../contract/identity.js';
import type { KanbanRequestResult } from '../contract/request.js';
import { createKanbanEditorControlBinding } from './controls.js';
import type { KanbanEditorControlBinding } from './controls.js';
import { confirmAndReloadKanbanEditor, confirmKanbanEditorAction } from './confirmation.js';
import type { KanbanEditorConfirm, KanbanEditorConfirmedReloadResult } from './confirmation.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorAlreadyOpen,
  KanbanEditorAuthority,
  KanbanEditorCoordinator,
  KanbanEditorFieldState,
  KanbanEditorRecordResolver,
  KanbanEditorResult,
  KanbanEditorSession,
  KanbanEditorSubmitResult,
} from './types.js';

/** Smallest dialog geometry that keeps a field and both actions usable. */
const MINIMUM_DIALOG = Object.freeze({ width: 32, height: 10 });
/** Preferred compact geometry leaves the patterned desktop visible at the standard viewport. */
const PREFERRED_DIALOG = Object.freeze({ width: 68, height: 20 });
/** One-cell content inset in addition to the dialog frame's own inset. */
const BODY_PADDING = 1;
/** Vertical separation between logical form rows. */
const FIELD_GAP = 1;
/** Gap between adjacent action buttons. */
const ACTION_GAP = 2;

/** Desktop extent required to choose a compact responsive editor size. */
export interface KanbanEditorDialogViewport {
  /** Available terminal columns. */
  readonly width: number;
  /** Available terminal rows. */
  readonly height: number;
}

/** Callbacks used by the shell without granting it completion or persistence authority. */
export interface KanbanEditorDialogHandlers {
  /** Handles the package submit command. */
  readonly submit: () => void;
  /** Handles Cancel, Escape, and the frame close action. */
  readonly cancel: () => void;
}

/** Construction options for the reusable responsive editor shell. */
export interface KanbanEditorDialogOptions<TCard, TDraft> {
  /** Application translation service inherited from the modal host. */
  readonly i18n: I18n;
  /** Hard desktop boundary used only to choose initial compact geometry. */
  readonly viewport: KanbanEditorDialogViewport;
  /** Adapter whose validated schema determines the complete field tree. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Session that owns draft, focus, validation, and record state. */
  readonly session: KanbanEditorSession<TDraft>;
  /** Command handlers supplied by the dialog lifecycle engine. */
  readonly handlers: KanbanEditorDialogHandlers;
}

/** Returns a positive terminal-cell dimension clamped to the current desktop. */
function compactDimension(preferred: number, minimum: number, available: number): number {
  const safeAvailable = Number.isSafeInteger(available) && available > 0 ? available : 1;
  const withMargin = Math.max(1, safeAvailable - 4);
  return Math.min(safeAvailable, Math.max(Math.min(minimum, safeAvailable), Math.min(preferred, withMargin)));
}

/** Resolves a schema message ID through the host service with a readable fallback. */
function translated(i18n: I18n, messageId: string, fallback = messageId): string {
  return i18n.t(messageId, { defaultMessage: fallback });
}

/** Creates one section caption with deterministic one-row geometry. */
function sectionCaption(i18n: I18n, labelId: string): View {
  return fixed(new Text(translated(i18n, labelId)), 1);
}

/** Creates a measured button band and preserves stable button traversal order. */
function actionBand(buttons: readonly Button[], availableWidth: number): View {
  const unwrapped = measureButtonGroup(buttons, { minimumButtonWidth: 10, gap: ACTION_GAP });
  const maxColumns = unwrapped.width <= availableWidth ? buttons.length : 1;
  const metrics = measureButtonGroup(buttons, {
    minimumButtonWidth: 10,
    gap: ACTION_GAP,
    rowGap: FIELD_GAP,
    maxColumns,
  });
  const group = fixed(
    buttonGroup(buttons, { minimumButtonWidth: 10, gap: ACTION_GAP, rowGap: FIELD_GAP, maxColumns }),
    metrics.width,
  );
  return fixed(row({ justify: 'center' }, group), metrics.height);
}

/** Complete form-content composition retained behind one vertical scroller. */
interface EditorContent {
  readonly content: Group;
  readonly extentHeight: number;
  readonly minimumWidth: number;
  readonly bindings: readonly KanbanEditorControlBinding[];
}

/** Builds every configured field once; resize only reflows this retained tree. */
function editorContent<TCard, TDraft>(options: KanbanEditorDialogOptions<TCard, TDraft>): EditorContent {
  const sectionRows: View[] = [];
  const bindings: KanbanEditorControlBinding[] = [];
  let extentHeight = 0;
  let minimumWidth = MINIMUM_DIALOG.width - 2 * (BODY_PADDING + 1);
  for (const section of options.adapter.schema.sections) {
    sectionRows.push(sectionCaption(options.i18n, section.labelId));
    extentHeight += 1;
    const fields = options.adapter.schema.fields.filter((field) => field.sectionId === section.sectionId);
    for (const field of fields) {
      const binding =
        options.session.snapshot().mode === 'view'
          ? readOnlyBinding(options.session, field.fieldId)
          : createKanbanEditorControlBinding({
              field,
              session: options.session,
              controls: options.adapter.schema.controls,
              i18n: options.i18n,
            });
      bindings.push(binding);
      const measurement = binding.measure(Math.max(1, options.viewport.width - 2 * (BODY_PADDING + 1)));
      const label = new Label(translated(options.i18n, field.labelId), binding.view);
      const fieldRows = 1 + measurement.rows;
      sectionRows.push(fixed(col(fixed(label, 1), fixed(binding.view, measurement.rows)), fieldRows));
      extentHeight += fieldRows;
      minimumWidth = Math.max(
        minimumWidth,
        measurement.minimumWidth,
        stringWidth(translated(options.i18n, field.labelId)),
      );
    }
  }
  const gaps = Math.max(0, sectionRows.length - 1) * FIELD_GAP;
  extentHeight += gaps;
  return {
    content: col({ gap: FIELD_GAP }, ...sectionRows),
    extentHeight: Math.max(1, extentHeight),
    minimumWidth,
    bindings: Object.freeze(bindings),
  };
}

/** Creates a non-focusable live text binding for view-only mode. */
function readOnlyBinding<TDraft>(
  session: KanbanEditorSession<TDraft>,
  fieldId: KanbanEditorFieldState['fieldId'],
): KanbanEditorControlBinding {
  const view = new Text(() => session.fieldState(fieldId).displayValue);
  const unsubscribe = session.subscribe(() => view.invalidate());
  let disposed = false;
  return Object.freeze({
    fieldId,
    view,
    measure: () => Object.freeze({ minimumWidth: 8, preferredWidth: 32, rows: 1 }),
    diagnostics: () => Object.freeze([]),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  });
}

/**
 * Responsive, resizable shell used by the default Kanban create, view, and edit presentations.
 *
 * The shell constructs the field tree once, retains it inside a vertical scroller, and lets the DSL
 * reflow only geometry during resize or zoom. Completion and persistence stay in the invoker.
 */
export class KanbanEditorDialog<TCard, TDraft> extends Dialog {
  /** All field bindings owned by this mounted presentation. */
  readonly bindings: readonly KanbanEditorControlBinding[];
  /** Scroller kept public for focus/reveal integration and application inspection. */
  readonly fieldScroller: Scroller;
  /** First editable control in schema order, when one exists. */
  readonly firstControl?: View;
  /** Command callbacks kept separate from the session's mutation authority. */
  protected readonly handlers: KanbanEditorDialogHandlers;
  /** Ensures explicit disposal and unmount cleanup cannot double-release custom controls. */
  protected bindingsDisposed = false;

  /** Creates a centered compact dialog bounded by the current terminal viewport. */
  constructor(options: KanbanEditorDialogOptions<TCard, TDraft>) {
    const width = compactDimension(PREFERRED_DIALOG.width, MINIMUM_DIALOG.width, options.viewport.width);
    const height = compactDimension(PREFERRED_DIALOG.height, MINIMUM_DIALOG.height, options.viewport.height);
    const mode = options.session.snapshot().mode;
    super({
      title: translated(
        options.i18n,
        `kanban.editor.${mode}.title`,
        mode === 'create' ? 'New card' : mode === 'view' ? 'Card details' : 'Edit card',
      ),
      width,
      height,
    });
    this.handlers = options.handlers;
    this.resizable = true;
    this.zoomable = true;
    this.minWidth = MINIMUM_DIALOG.width;
    this.minHeight = MINIMUM_DIALOG.height;

    const built = editorContent(options);
    this.bindings = built.bindings;
    this.firstControl = built.bindings.find((binding) => binding.view.focusable && !binding.view.state.disabled)?.view;
    const scroller = new Scroller({
      content: at(built.content, 0, 0, Math.max(1, width - 2 * (BODY_PADDING + 1)), built.extentHeight),
      extent: () => ({
        width: Math.max(built.minimumWidth, (built.content.parent?.bounds.width ?? width) - 1),
        height: built.extentHeight,
      }),
      scrollbars: 'vertical',
    });
    this.fieldScroller = scroller;

    const buttons =
      mode === 'view' ? [cancelButton(options.i18n)] : [okButton(options.i18n), cancelButton(options.i18n)];
    const actions = actionBand(buttons, Math.max(1, width - 2 * (BODY_PADDING + 1)));
    this.add(cover(col({ padding: BODY_PADDING, gap: FIELD_GAP }, grow(scroller, 1, { min: 1 }), actions)));
    this.onMount(() => this.onCleanup(() => this.disposeBindings()));
  }

  /** Releases all field-level subscriptions and application custom controls idempotently. */
  disposeBindings(): void {
    if (this.bindingsDisposed) return;
    this.bindingsDisposed = true;
    for (const binding of this.bindings) binding.dispose();
  }

  /** Moves UI focus to the control representing the supplied stable field identity. */
  focusField(fieldId: KanbanEditorFieldState['fieldId'], focus: (view: View) => void): boolean {
    const binding = this.bindings.find((candidate) => candidate.fieldId === fieldId);
    if (
      binding === undefined ||
      !binding.view.focusable ||
      binding.view.state.disabled ||
      !binding.view.state.visible
    ) {
      return false;
    }
    focus(binding.view);
    return true;
  }

  /** Routes standard commands to the lifecycle engine without closing before async work completes. */
  override onEvent(event: DispatchEvent): void {
    const inner = event.event;
    if (inner.type === 'command' && inner.command === Commands.ok) {
      event.handled = true;
      this.handlers.submit();
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
        this.closable)
    ) {
      event.handled = true;
      this.handlers.cancel();
      return;
    }
    super.onEvent(event);
  }

  /** Ends the host modal after the lifecycle engine has accepted a terminal outcome. */
  finish(command: string): void {
    this.modalHost?.endModal(command);
  }
}

/** Minimal application host required by the package editor dialogs. */
export interface KanbanEditorDialogHost {
  /** Application translation service used by package and standard UI controls. */
  readonly i18n: I18n;
  /** Event-loop operations required to execute and focus the modal. */
  readonly loop: Pick<EventLoop, 'execView' | 'focusView' | 'endModal'>;
  /** Desktop operations and hard viewport extent required by the modal lifecycle. */
  readonly desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}

/** Application-owned typed result detachment used when no request should be dispatched. */
export interface KanbanEditorResultOnlyCompletion<TDraft, TResult> {
  /** Result-only completion discriminator. */
  readonly kind: 'result-only';
  /** Copies the validated typed draft into application-owned result data. */
  readonly detach: (result: KanbanEditorResult<TDraft>) => TResult;
}

/** Normal completion routed through the application request authority. */
export interface KanbanEditorAuthorityCompletion {
  /** Authority completion discriminator. */
  readonly kind: 'authority';
  /** Application-owned request admission seam. */
  readonly authority: KanbanEditorAuthority;
}

/** Completion policies supported by create and edit dialogs. */
export type KanbanEditorDialogCompletion<TDraft, TResult> =
  KanbanEditorAuthorityCompletion | KanbanEditorResultOnlyCompletion<TDraft, TResult>;

/** Terminal outcomes produced by one package editor dialog. */
export type KanbanEditorDialogResult<TResult = never> =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'result'; readonly value: TResult }
  | Extract<KanbanEditorSubmitResult, { readonly kind: 'committed' }>
  | KanbanEditorAlreadyOpen
  | { readonly kind: 'disposed' }
  | { readonly kind: 'failed' };

/** Submit outcomes returned to a complete application replacement. */
export type KanbanEditorDialogSubmitResult<TResult = never> =
  KanbanEditorSubmitResult | { readonly kind: 'result'; readonly value: TResult };

/** Bounded lifecycle actions supplied to a complete application dialog replacement. */
export interface KanbanEditorDialogActions<TResult = never> {
  /** Validates and completes through the configured authority or result-only policy. */
  readonly submit: () => Promise<KanbanEditorDialogSubmitResult<TResult>>;
  /** Applies dirty confirmation and closes as cancelled when accepted. */
  readonly cancel: () => Promise<void>;
  /** Confirms and reloads one stale draft through the same session. */
  readonly reload: () => Promise<KanbanEditorConfirmedReloadResult>;
  /** Closes a view/deleted presentation without attempting submission. */
  readonly close: () => void;
}

/** Session and lifecycle actions received by a complete application dialog replacement. */
export interface KanbanEditorDialogContext<TDraft, TResult = never> {
  /** Exact coordinator-owned session shared with default and inspector presentations. */
  readonly session: KanbanEditorSession<TDraft>;
  /** Bounded actions that preserve package validation, confirmation, and completion policy. */
  readonly actions: KanbanEditorDialogActions<TResult>;
}

/** Factory for a complete application-owned modal presentation. */
export type KanbanEditorDialogReplacement<TDraft, TResult = never> = (
  context: KanbanEditorDialogContext<TDraft, TResult>,
) => Dialog;

/** Common options shared by create and edit dialog invokers. */
interface KanbanEditorMutableDialogOptions<TCard, TDraft, TResult> {
  /** Adapter that owns the typed application record and draft mapping. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Identity coordinator shared by every editor presentation in the application. */
  readonly coordinator: KanbanEditorCoordinator;
  /** Authority or explicitly request-free result completion. */
  readonly completion: KanbanEditorDialogCompletion<TDraft, TResult>;
  /** Optional application replacement for localized dirty and stale confirmations. */
  readonly confirm?: KanbanEditorConfirm;
  /** Optional complete presentation replacement over the same package-owned session. */
  readonly replacement?: KanbanEditorDialogReplacement<TDraft, TResult>;
  /** Optional caller cancellation used while initial record resolution is pending. */
  readonly signal?: AbortSignal;
}

/** Options for opening a new-card editor without an application record resolver. */
export interface OpenKanbanCardCreateDialogOptions<TCard, TDraft, TResult> extends KanbanEditorMutableDialogOptions<
  TCard,
  TDraft,
  TResult
> {
  /** Bounded provisional identity used only for editor exclusivity before persistence assigns a card key. */
  readonly claimId: string;
}

/** Options for opening an existing-card edit dialog. */
export interface OpenKanbanCardEditDialogOptions<TCard, TDraft, TResult> extends KanbanEditorMutableDialogOptions<
  TCard,
  TDraft,
  TResult
> {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Authoritative application record source. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
}

/** Options for opening an existing card in read-only view mode. */
export interface OpenKanbanCardViewDialogOptions<TCard, TDraft> {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Adapter used to format the detached record through its validated schema. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Authoritative application record source. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  /** Identity coordinator shared by every editor presentation in the application. */
  readonly coordinator: KanbanEditorCoordinator;
  /** Optional caller cancellation used while initial record resolution is pending. */
  readonly signal?: AbortSignal;
}

/** Internal resolved dialog inputs after mode-specific options have been normalized. */
interface ResolvedDialogOptions<TCard, TDraft, TResult> {
  readonly mode: 'create' | 'view' | 'edit';
  readonly cardKey: CardKey;
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  readonly coordinator: KanbanEditorCoordinator;
  readonly completion?: KanbanEditorDialogCompletion<TDraft, TResult>;
  readonly confirm?: KanbanEditorConfirm;
  readonly replacement?: KanbanEditorDialogReplacement<TDraft, TResult>;
  readonly signal?: AbortSignal;
}

/** Creates a resolver-free new-card source that never retains a listener or application record. */
function emptyCreateResolver<TCard>(): KanbanEditorRecordResolver<TCard> {
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

/** Runs one default or application-replaced modal and releases its exact session claim on every exit. */
async function runDefaultDialog<TCard, TDraft, TResult>(
  host: KanbanEditorDialogHost,
  options: ResolvedDialogOptions<TCard, TDraft, TResult>,
): Promise<KanbanEditorDialogResult<TResult>> {
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
  let outcome: KanbanEditorDialogResult<TResult> =
    options.mode === 'view' ? Object.freeze({ kind: 'closed' }) : Object.freeze({ kind: 'cancelled' });
  let submitting = false;
  let cancelling = false;
  let standardDialog: KanbanEditorDialog<TCard, TDraft> | undefined;

  const focusInvalid = (fieldId: KanbanEditorFieldState['fieldId']): void => {
    standardDialog?.focusField(fieldId, (view) => host.loop.focusView(view));
  };
  const submit = async (): Promise<KanbanEditorDialogSubmitResult<TResult>> => {
    if (submitting) return Object.freeze({ kind: 'sealed' });
    if (options.mode === 'view' || options.completion === undefined) return Object.freeze({ kind: 'read-only' });
    submitting = true;
    try {
      if (options.completion.kind === 'result-only') {
        const prepared = await session.prepare();
        if (prepared.kind === 'invalid') focusInvalid(prepared.fieldId);
        if (prepared.kind !== 'prepared') return prepared;
        try {
          outcome = Object.freeze({ kind: 'result', value: options.completion.detach(prepared.result) });
        } catch {
          outcome = Object.freeze({ kind: 'failed' });
        }
        host.loop.endModal('result');
        return outcome;
      }
      const result = await session.submit();
      if (result.kind === 'invalid') focusInvalid(result.fieldId);
      if (result.kind === 'committed') {
        outcome = result;
        host.loop.endModal('committed');
      }
      return result;
    } finally {
      submitting = false;
    }
  };
  const cancel = async (): Promise<void> => {
    if (cancelling) return;
    cancelling = true;
    try {
      if (
        options.mode !== 'view' &&
        session.snapshot().dirty &&
        !(await confirmKanbanEditorAction(host, { kind: 'discard-draft', mode: options.mode }, options.confirm))
      ) {
        return;
      }
      outcome = options.mode === 'view' ? Object.freeze({ kind: 'closed' }) : Object.freeze({ kind: 'cancelled' });
      host.loop.endModal('cancel');
    } finally {
      cancelling = false;
    }
  };
  const reload = async (): Promise<KanbanEditorConfirmedReloadResult> => {
    const result = await confirmAndReloadKanbanEditor(host, session, options.confirm);
    const focusedFieldId = session.snapshot().focusedFieldId;
    if (result.kind === 'reloaded' && focusedFieldId !== undefined) focusInvalid(focusedFieldId);
    return result;
  };
  const close = (): void => {
    outcome = Object.freeze({ kind: 'closed' });
    host.loop.endModal('close');
  };
  const actions: KanbanEditorDialogActions<TResult> = Object.freeze({ submit, cancel, reload, close });

  let dialog: Dialog;
  try {
    if (options.replacement === undefined) {
      standardDialog = new KanbanEditorDialog({
        i18n: host.i18n,
        viewport: host.desktop.bounds,
        adapter: options.adapter,
        session,
        handlers: { submit: () => void submit(), cancel: () => void cancel() },
      });
      dialog = standardDialog;
    } else {
      dialog = options.replacement(Object.freeze({ session, actions }));
      if (!(dialog instanceof Dialog)) throw new TypeError('Invalid Kanban editor replacement.');
    }
  } catch {
    session.dispose();
    return Object.freeze({ kind: 'failed' });
  }
  const unsubscribe = session.subscribe((snapshot) => {
    if (snapshot.submission.kind === 'committed') {
      outcome = Object.freeze({ kind: 'committed', operationId: snapshot.submission.operationId });
      host.loop.endModal('committed');
    }
  });
  host.desktop.addWindow(dialog);
  try {
    const pending = host.loop.execView<string>(dialog);
    if (standardDialog?.firstControl !== undefined) host.loop.focusView(standardDialog.firstControl);
    await pending;
    return outcome;
  } finally {
    unsubscribe();
    host.desktop.removeWindow(dialog);
    standardDialog?.disposeBindings();
    session.dispose();
  }
}

/**
 * Opens a centered create dialog using a provisional coordinator claim and no application resolver.
 *
 * @example
 * ```ts
 * const result = await openKanbanCardCreateDialog(app, {
 *   claimId: 'new-card-1', adapter, coordinator,
 *   completion: { kind: 'result-only', detach: ({ draft }) => ({ ...draft }) },
 * });
 * ```
 */
export function openKanbanCardCreateDialog<TCard, TDraft, TResult = never>(
  host: KanbanEditorDialogHost,
  options: OpenKanbanCardCreateDialogOptions<TCard, TDraft, TResult>,
): Promise<KanbanEditorDialogResult<TResult>> {
  return runDefaultDialog(host, {
    mode: 'create',
    cardKey: options.claimId,
    adapter: options.adapter,
    resolver: emptyCreateResolver(),
    coordinator: options.coordinator,
    completion: options.completion,
    confirm: options.confirm,
    replacement: options.replacement,
    signal: options.signal,
  });
}

/**
 * Opens a centered edit dialog over one application-owned record and request authority.
 *
 * @example
 * ```ts
 * const result = await openKanbanCardEditDialog(app, {
 *   cardKey, adapter, resolver, coordinator,
 *   completion: { kind: 'authority', authority },
 * });
 * ```
 */
export function openKanbanCardEditDialog<TCard, TDraft, TResult = never>(
  host: KanbanEditorDialogHost,
  options: OpenKanbanCardEditDialogOptions<TCard, TDraft, TResult>,
): Promise<KanbanEditorDialogResult<TResult>> {
  return runDefaultDialog(host, { mode: 'edit', ...options });
}

/**
 * Opens a centered read-only card dialog with static field values and one Close path.
 *
 * @example
 * ```ts
 * await openKanbanCardViewDialog(app, { cardKey, adapter, resolver, coordinator });
 * ```
 */
export function openKanbanCardViewDialog<TCard, TDraft>(
  host: KanbanEditorDialogHost,
  options: OpenKanbanCardViewDialogOptions<TCard, TDraft>,
): Promise<KanbanEditorDialogResult> {
  return runDefaultDialog(host, { mode: 'view', ...options });
}
