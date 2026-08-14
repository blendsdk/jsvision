import type { I18n } from '@jsvision/i18n';
import {
  Button,
  Commands,
  Dialog,
  Group,
  Label,
  Scroller,
  TabView,
  Text,
  col,
  cover,
  fixed,
  grow,
  signal,
  stringWidth,
} from '@jsvision/ui';
import type { DispatchEvent, DrawContext, View } from '@jsvision/ui';

import { createKanbanEditorControlBinding } from './controls.js';
import type { KanbanEditorControlBinding } from './controls.js';
import type {
  KanbanEditorDialogHost,
  KanbanEditorDialogResult,
  OpenKanbanCardCreateDialogOptions,
  OpenKanbanCardEditDialogOptions,
  OpenKanbanCardViewDialogOptions,
} from './dialog-contract.js';
import { createKanbanEditorActionBand } from './dialog-action-band.js';
import {
  createKanbanEditorPublicationBridge,
  emptyKanbanEditorCreateResolver,
  runKanbanEditorDialog,
} from './dialog-runtime.js';
import { resolveKanbanEditorMessage } from './presentation-text.js';
import type { KanbanCardEditorAdapter, KanbanEditorFieldState, KanbanEditorSession } from './types.js';

export type {
  KanbanEditorAuthorityCompletion,
  KanbanEditorCreateDialogActions,
  KanbanEditorCreatePublicationContext,
  KanbanEditorCreatePublicationResolver,
  KanbanEditorCreatedRecord,
  KanbanEditorDialogActions,
  KanbanEditorDialogCompletion,
  KanbanEditorDialogContext,
  KanbanEditorDialogHost,
  KanbanEditorDialogPresentation,
  KanbanEditorDialogReplacement,
  KanbanEditorDialogResult,
  KanbanEditorDialogSubmitResult,
  KanbanEditorEditDialogActions,
  KanbanEditorResolvedDialogOptions,
  KanbanEditorResultOnlyCompletion,
  KanbanEditorViewDialogActions,
  OpenKanbanCardCreateDialogOptions,
  OpenKanbanCardEditDialogOptions,
  OpenKanbanCardViewDialogOptions,
} from './dialog-contract.js';

/** Smallest dialog geometry that keeps a field and both actions usable. */
const MINIMUM_DIALOG = Object.freeze({ width: 32, height: 10 });
/** Preferred compact geometry leaves the patterned desktop visible at the standard viewport. */
const PREFERRED_DIALOG = Object.freeze({ width: 68, height: 20 });
/** One-cell content inset in addition to the dialog frame's own inset. */
const BODY_PADDING = 1;
/** Vertical separation between logical form rows. */
const FIELD_GAP = 1;

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
  /** Handles stale-draft reload through confirmation. */
  readonly reload: () => void;
  /** Handles the guarded view/deleted close action. */
  readonly close: () => void;
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
  return resolveKanbanEditorMessage(i18n, messageId, fallback);
}

/** Creates one section caption with deterministic one-row geometry. */
function sectionCaption(i18n: I18n, labelId: string): View {
  return fixed(new Text(translated(i18n, labelId)), 1);
}

/** Returns one localized payload-free lifecycle summary for the current editor snapshot. */
function editorStatus<TDraft>(i18n: I18n, session: KanbanEditorSession<TDraft>, transient: string): string {
  if (transient !== '') return transient;
  const snapshot = session.snapshot();
  if (snapshot.record.kind === 'stale') return translated(i18n, 'kanban.editor.status.stale', 'Card changed · Reload');
  if (snapshot.record.kind === 'deleted') return translated(i18n, 'kanban.editor.status.deleted', 'Card was deleted');
  if (snapshot.record.kind === 'unavailable') {
    return translated(i18n, 'kanban.editor.status.unavailable', 'Card is unavailable');
  }
  switch (snapshot.submission.kind) {
    case 'validating':
      return translated(i18n, 'kanban.editor.status.validating', 'Validating…');
    case 'dispatching':
      return translated(i18n, 'kanban.editor.status.saving', 'Saving…');
    case 'awaiting-publication':
      return translated(i18n, 'kanban.editor.status.awaiting', 'Waiting for board update…');
    case 'rejected':
      return snapshot.submission.label ?? translated(i18n, 'kanban.editor.status.rejected', 'Change rejected');
    case 'committed':
      return translated(i18n, 'kanban.editor.status.saved', 'Saved');
    case 'idle':
      return snapshot.dirty
        ? translated(i18n, 'kanban.editor.status.unsaved', 'Unsaved changes')
        : translated(i18n, 'kanban.editor.status.ready', 'Ready');
  }
}

/** Complete form-content composition retained behind one vertical scroller. */
interface EditorContent {
  readonly content: Group;
  readonly extentHeight: () => number;
  readonly minimumWidth: () => number;
  readonly bindings: readonly KanbanEditorControlBinding[];
  readonly refresh: (availableWidth: number) => void;
}

/** One retained field row whose complete visibility and height follow session state. */
interface EditorFieldRow {
  readonly view: Group;
  readonly binding: KanbanEditorControlBinding;
  readonly labelWidth: number;
  readonly collapsed: () => boolean;
  /** One-row safe validation summary displayed directly beneath the control. */
  readonly diagnostic: Text;
  height: number;
}

/** Returns the first safe diagnostic label for one field, or an empty string when it is valid. */
function fieldDiagnostic(i18n: I18n, state: KanbanEditorFieldState): string {
  const diagnostic = state.diagnostics[0];
  if (diagnostic === undefined) return '';
  if (diagnostic.label !== undefined) return diagnostic.label;
  return translated(i18n, diagnostic.messageId ?? `kanban.editor.validation.${diagnostic.code}`, diagnostic.code);
}

/** Releases every binding independently when composition fails before dialog ownership is established. */
function disposeEditorBindings(bindings: readonly KanbanEditorControlBinding[]): void {
  for (const binding of bindings) {
    try {
      binding.dispose();
    } catch {
      // One hostile application binding cannot retain its siblings.
    }
  }
}

/** Builds every configured field once and remeasures retained rows against live width. */
function editorContent<TCard, TDraft>(options: KanbanEditorDialogOptions<TCard, TDraft>): EditorContent {
  const sectionRows: View[] = [];
  const fieldRows: EditorFieldRow[] = [];
  const bindings: KanbanEditorControlBinding[] = [];
  const tabs: { readonly title: string; readonly content: Group; readonly height: () => number }[] = [];
  let denseSectionOpen = false;
  for (const section of options.adapter.schema.sections) {
    let collapsed =
      section.presentation === 'collapsible'
        ? section.secondaryDense === true && denseSectionOpen
          ? true
          : (section.initialCollapsed ?? false)
        : false;
    if (section.secondaryDense === true && !collapsed) denseSectionOpen = true;
    const rows: View[] = [];
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
      let measurement: ReturnType<KanbanEditorControlBinding['measure']>;
      try {
        measurement = binding.measure(Math.max(1, options.viewport.width - 2 * (BODY_PADDING + 1)));
      } catch (error) {
        disposeEditorBindings(bindings);
        throw error;
      }
      const label = new Label(translated(options.i18n, field.labelId), binding.view);
      const state = options.session.fieldState(field.fieldId);
      const diagnostic = new Text(() => fieldDiagnostic(options.i18n, options.session.fieldState(field.fieldId)), {
        severity: 'error',
      });
      diagnostic.state.visible = state.diagnostics.length > 0;
      const diagnosticRows = diagnostic.state.visible ? 1 : 0;
      const rowHeight = 1 + measurement.rows + diagnosticRows;
      const view = fixed(
        col(fixed(label, 1), fixed(binding.view, measurement.rows), fixed(diagnostic, diagnosticRows)),
        rowHeight,
      );
      rows.push(view);
      fieldRows.push({
        view,
        binding,
        labelWidth: stringWidth(translated(options.i18n, field.labelId)),
        collapsed: () => collapsed,
        diagnostic,
        height: rowHeight,
      });
    }
    const body = col({ gap: FIELD_GAP }, ...rows);
    const bodyHeight = (): number =>
      fieldRows
        .filter((entry) => rows.includes(entry.view) && entry.view.state.visible)
        .reduce((height, entry, index) => height + entry.height + (index === 0 ? 0 : FIELD_GAP), 0);
    if (section.presentation === 'tab') {
      tabs.push({ title: translated(options.i18n, section.labelId), content: body, height: bodyHeight });
      continue;
    }
    if (section.presentation === 'collapsible') {
      const caption = new Button(translated(options.i18n, section.labelId), {
        onClick: () => {
          collapsed = !collapsed;
          for (const entry of fieldRows) {
            if (rows.includes(entry.view))
              entry.view.state.visible = !collapsed && options.session.fieldState(entry.binding.fieldId).visible;
          }
          body.invalidateLayout();
        },
      });
      sectionRows.push(fixed(caption, 2), body);
    } else {
      sectionRows.push(sectionCaption(options.i18n, section.labelId), body);
    }
  }
  if (tabs.length > 0) {
    const active = signal(0);
    const tabView = new TabView({
      tabs: signal(tabs.map((tab) => ({ title: tab.title, content: tab.content }))),
      active,
    });
    const tabHeight = Math.max(2, ...tabs.map((tab) => tab.height() + 1));
    sectionRows.push(fixed(tabView, tabHeight));
  }
  const content = col({ gap: FIELD_GAP }, ...sectionRows);
  const refresh = (availableWidth: number): void => {
    for (const row of fieldRows) {
      const state = options.session.fieldState(row.binding.fieldId);
      const measurement = row.binding.measure(Math.max(1, availableWidth));
      const diagnosticRows = state.diagnostics.length > 0 ? 1 : 0;
      row.diagnostic.state.visible = diagnosticRows > 0;
      row.height = 1 + measurement.rows + diagnosticRows;
      row.view.state.visible = !row.collapsed() && state.visible;
      fixed(row.binding.view, measurement.rows);
      fixed(row.diagnostic, diagnosticRows);
      fixed(row.view, row.height);
    }
    content.invalidateLayout();
  };
  refresh(Math.max(1, options.viewport.width - 2 * (BODY_PADDING + 1)));
  return {
    content,
    extentHeight: () =>
      Math.max(
        1,
        sectionRows.reduce(
          (height, view, index) =>
            height + (view.state.visible ? view.bounds.height || 1 : 0) + (index === 0 ? 0 : FIELD_GAP),
          0,
        ),
      ),
    minimumWidth: () =>
      Math.max(
        MINIMUM_DIALOG.width - 2 * (BODY_PADDING + 1),
        ...fieldRows.map((row) => Math.max(row.labelWidth, row.binding.measure(10_000).minimumWidth)),
      ),
    bindings: Object.freeze(bindings),
    refresh,
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
  /** Session presentation subscription owned with the mounted field tree. */
  protected readonly presentationUnsubscribe: () => void;
  /** Remeasures retained field rows when the live terminal width changes. */
  protected readonly refreshContent: (availableWidth: number) => void;
  /** Last interior width applied to custom and standard control measurement. */
  protected measuredWidth = -1;
  /** Translation service retained for safe package status feedback. */
  protected readonly i18nForStatus: I18n;
  /** Package-owned transient failure text that does not leak application exception payloads. */
  protected readonly transientStatus = signal('');

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
    this.i18nForStatus = options.i18n;
    this.resizable = true;
    this.zoomable = true;
    this.minWidth = MINIMUM_DIALOG.width;
    this.minHeight = MINIMUM_DIALOG.height;

    const built = editorContent(options);
    this.refreshContent = built.refresh;
    this.bindings = built.bindings;
    this.firstControl = built.bindings.find((binding) => binding.view.focusable && !binding.view.state.disabled)?.view;
    const scroller = new Scroller({
      content: built.content,
      extent: () => ({
        width: Math.max(built.minimumWidth(), this.fieldScroller?.bounds.width ?? width),
        height: built.extentHeight(),
      }),
      scrollbars: 'both',
    });
    this.fieldScroller = scroller;

    const submitButton =
      mode === 'view'
        ? undefined
        : new Button(translated(options.i18n, 'kanban.editor.action.save', '~S~ave'), {
            default: true,
            onClick: options.handlers.submit,
          });
    const reloadButton =
      mode === 'edit'
        ? new Button(translated(options.i18n, 'kanban.editor.action.reload', '~R~eload'), {
            onClick: options.handlers.reload,
          })
        : undefined;
    const cancelOrClose = new Button(
      translated(
        options.i18n,
        mode === 'view' ? 'kanban.editor.action.close' : 'kanban.editor.action.cancel',
        mode === 'view' ? '~C~lose' : '~C~ancel',
      ),
      { onClick: mode === 'view' ? options.handlers.close : options.handlers.cancel },
    );
    const buttons = [submitButton, reloadButton, cancelOrClose].filter(
      (button): button is Button => button !== undefined,
    );
    const actions = createKanbanEditorActionBand(buttons, Math.max(1, width - 2 * (BODY_PADDING + 1)));
    const status = fixed(new Text(() => editorStatus(options.i18n, options.session, this.transientStatus())), 1);
    this.add(cover(col({ padding: BODY_PADDING, gap: FIELD_GAP }, grow(scroller, 1, { min: 1 }), status, actions)));
    this.presentationUnsubscribe = options.session.subscribe((snapshot) => {
      const busy =
        snapshot.submission.kind === 'validating' ||
        snapshot.submission.kind === 'dispatching' ||
        snapshot.submission.kind === 'awaiting-publication' ||
        snapshot.submission.kind === 'committed';
      if (submitButton !== undefined) submitButton.state.disabled = busy || snapshot.record.kind !== 'ready';
      if (reloadButton !== undefined) reloadButton.state.disabled = busy || snapshot.record.kind !== 'stale';
      cancelOrClose.state.disabled = busy;
      built.refresh(Math.max(1, this.fieldScroller.bounds.width - 1));
      status.invalidate();
      actions.invalidateLayout();
    });
    this.onMount(() => this.onCleanup(() => this.disposeBindings()));
  }

  /** Detects live resize and remeasures controls without reconstructing their stateful view tree. */
  override draw(ctx: DrawContext): void {
    super.draw(ctx);
    const availableWidth = Math.max(1, ctx.size.width - 2 * (BODY_PADDING + 1) - 1);
    if (availableWidth === this.measuredWidth) return;
    this.measuredWidth = availableWidth;
    this.refreshContent(availableWidth);
  }

  /** Releases all field-level subscriptions and application custom controls idempotently. */
  disposeBindings(): void {
    if (this.bindingsDisposed) return;
    this.bindingsDisposed = true;
    try {
      this.presentationUnsubscribe();
    } catch {
      // A failing presentation subscriber cannot prevent field-level cleanup.
    }
    for (const binding of this.bindings) {
      try {
        binding.dispose();
      } catch {
        // Each application control receives an independent cleanup attempt.
      }
    }
  }

  /** Shows one safe package failure in the retained status row without closing or mutating the draft. */
  reportFailure(messageId: string, fallback: string): void {
    this.transientStatus.set(translated(this.i18nForStatus, messageId, fallback));
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
  if (options.completion.kind === 'authority' && options.publication === undefined) {
    return Promise.resolve(Object.freeze({ kind: 'failed' }));
  }
  const bridge =
    options.completion.kind === 'authority' && options.publication !== undefined
      ? createKanbanEditorPublicationBridge(
          options.claimId,
          options.completion.authority,
          options.publication,
          options.signal,
        )
      : undefined;
  return runKanbanEditorDialog(host, {
    mode: 'create',
    cardKey: options.claimId,
    adapter: options.adapter,
    resolver: bridge?.resolver ?? emptyKanbanEditorCreateResolver(),
    coordinator: options.coordinator,
    completion: bridge === undefined ? options.completion : { kind: 'authority' as const, authority: bridge.authority },
    confirm: options.confirm,
    replacement: options.replacement,
    signal: options.signal,
  }).finally(() => bridge?.dispose());
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
  return runKanbanEditorDialog(host, { mode: 'edit', ...options });
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
  return runKanbanEditorDialog(host, { mode: 'view', ...options });
}
