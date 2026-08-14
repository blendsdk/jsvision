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
import type { DispatchEvent, Group, View } from '@jsvision/ui';

import { createKanbanEditorControlBinding } from './controls.js';
import type { KanbanEditorControlBinding } from './controls.js';
import type { KanbanCardEditorAdapter, KanbanEditorSession } from './types.js';

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
  readonly session: KanbanEditorSession;
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
      const binding = createKanbanEditorControlBinding({
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

    const buttons = [okButton(options.i18n), cancelButton(options.i18n)];
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
      (inner.type === 'key' && inner.key === 'escape')
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
