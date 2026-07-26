import type { Cell } from '@jsvision/core';
import { CodeEditorWindow, createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';
import { column, FilterPopup } from '@jsvision/datagrid';
import type { I18n } from '@jsvision/i18n';
import {
  at,
  Button,
  buttonGroup,
  Calendar,
  ComboBox,
  DatePicker,
  Dialog,
  Group,
  measureButtonGroup,
  signal,
  Switch,
  Text,
  View,
} from '@jsvision/ui';
import type { Application, DispatchEvent, Signal } from '@jsvision/ui';
import type {
  ActionArrangement,
  I18nActionSnapshot,
  I18nCellBounds,
  I18nDemoViewport,
  I18nLayoutSnapshot,
  I18nStoryMetadata,
} from './types.js';

/** One localized action before it is materialized as a Button. */
interface ActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly command: string;
}

/** One materialized Button paired with the stable evidence expected by the headless API. */
interface MaterializedAction {
  readonly id: string;
  readonly button: Button;
}

/** Geometry captured from an open application popup before action inspection dismisses it. */
interface OverlayEvidence {
  readonly surfaces: readonly I18nCellBounds[];
  readonly descendants: readonly I18nCellBounds[];
  readonly rows: readonly string[];
  readonly cellChars: readonly (readonly string[])[];
  readonly cellWidths: readonly (readonly number[])[];
}

/** Internal registry entry containing the immutable metadata and its fresh builder. */
export interface I18nStoryDefinition {
  readonly metadata: I18nStoryMetadata;
  build(context: StoryBuildContext): BuiltStory;
}

/** Fresh package state available to a story builder. */
export interface StoryBuildContext {
  readonly application: Application;
  readonly i18n: I18n;
  readonly viewport: I18nDemoViewport;
}

/** Mounted story plus public snapshot construction data. */
export interface BuiltStory {
  readonly root: View;
  readonly state: Signal<unknown>;
  snapshot(): I18nLayoutSnapshot;
  close(): void;
}

/** Optional real component composition mounted inside a story's translated dialog. */
interface StoryDecoration {
  afterMount?(): void;
  close?(): void;
}

/** Synchronous launch result for a public helper that has mounted an actual modal before awaiting. */
interface ModalLaunch {
  readonly completion: Promise<unknown>;
  readonly actions: readonly ActionDefinition[];
  readonly arrangement: ActionArrangement;
}

/** Commands that reconstruct the demo and therefore must escape a currently active story modal. */
const RECONSTRUCTION_COMMANDS = new Set(['i18n-demo:next-locale', 'i18n-demo:next-story']);

/**
 * Re-emits shell reconstruction commands after closing the current modal scope.
 *
 * General application handlers intentionally stay dormant behind a modal. This bridge lives inside
 * the modal subtree, ends that scope, then queues the same command so the application handler can
 * rebuild the locale or story without requiring a manual dialog close first.
 */
class ModalReconstructionBridge extends View {
  override postProcess = true;

  constructor(private readonly application: Application) {
    super();
  }

  override draw(): void {
    // The bridge is command-only and deliberately has no visual footprint.
  }

  override onEvent(event: DispatchEvent): void {
    const inner = event.event;
    if (inner.type !== 'command' || !RECONSTRUCTION_COMMANDS.has(inner.command)) return;
    this.application.loop.endModal(undefined);
    this.application.loop.emitCommand(inner.command);
    event.handled = true;
  }
}

/** Add real package components after the story body has established its available cell rectangle. */
type StoryDecorator = (
  dialog: Dialog,
  context: StoryBuildContext,
  available: I18nDemoViewport,
) => StoryDecoration | undefined;

/** Create immutable per-component viewport boundaries for registry discovery and headless checks. */
function viewports(
  narrowWidth: number,
  narrowHeight: number,
  infeasibleWidth: number,
  infeasibleHeight: number,
): I18nStoryMetadata['viewports'] {
  return Object.freeze({
    standard: Object.freeze({ width: 80, height: 24 }),
    narrow: Object.freeze([Object.freeze({ width: narrowWidth, height: narrowHeight })]),
    infeasible: Object.freeze({ width: infeasibleWidth, height: infeasibleHeight }),
  });
}

/** Default viewport declaration for compact action-only examples. */
export const ACTION_VIEWPORTS = viewports(48, 16, 20, 8);

/** Viewport declaration for stories that compose larger framework components. */
export const COMPONENT_VIEWPORTS = viewports(64, 20, 24, 10);

/** Viewport declaration for the editor, whose useful compact form is wider than a field control. */
export const EDITOR_VIEWPORTS = viewports(56, 18, 28, 10);

/** Personalization needs full height so both translated action bands remain inside its frame. */
export const PERSONALIZATION_VIEWPORTS = viewports(64, 24, 30, 12);

/** Viewport declaration for the five-action vertical rail. */
export const VERTICAL_VIEWPORTS = Object.freeze({
  standard: Object.freeze({ width: 80, height: 24 }),
  narrow: Object.freeze([Object.freeze({ width: 48, height: 20 })]),
  infeasible: Object.freeze({ width: 20, height: 8 }),
}) satisfies I18nStoryMetadata['viewports'];

/** Create immutable public metadata for one registry entry. */
export function metadata(
  id: string,
  category: I18nStoryMetadata['category'],
  title: string,
  coverage: readonly string[],
  declaredViewports: I18nStoryMetadata['viewports'] = ACTION_VIEWPORTS,
): I18nStoryMetadata {
  return Object.freeze({
    id,
    category,
    title,
    coverage: Object.freeze([...coverage]),
    viewports: declaredViewports,
  });
}

/** Translate a framework key while retaining a durable English call-site fallback. */
export function translated(i18n: I18n, key: string, defaultMessage: string): string {
  return i18n.t(key, { defaultMessage });
}

/** Narrow a freshly created demo application to the modal host guaranteed by this shell. */
export function modalHost(application: Application): {
  readonly i18n: I18n;
  readonly loop: Application['loop'];
  readonly desktop: NonNullable<Application['desktop']>;
} {
  if (application.desktop === undefined) throw new Error('The multilingual demo requires a desktop host.');
  return { i18n: application.i18n, loop: application.loop, desktop: application.desktop };
}

/** Convert a mounted view's public origin and bounds into one absolute rectangle. */
function absoluteBounds(application: Application, view: View): I18nCellBounds | null {
  const origin = application.loop.renderRoot.originOf(view);
  if (origin === null) return null;
  return Object.freeze({
    x: origin.x,
    y: origin.y,
    width: view.bounds.width,
    height: view.bounds.height,
  });
}

/** Return every descendant in stable tree order. */
function descendants(view: View): readonly View[] {
  const children = view instanceof Group ? view.children : [];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Render the current terminal buffer as deterministic text rows. */
function renderRows(application: Application): readonly string[] {
  application.loop.renderRoot.flush();
  return Object.freeze(
    application.loop.renderRoot
      .buffer()
      .rows()
      .map((row: readonly Cell[]) => row.map((cell: Cell) => cell.char).join('')),
  );
}

/** Preserve the renderer's display-width metadata for constrained Unicode integrity checks. */
function renderCellWidths(application: Application): readonly (readonly number[])[] {
  application.loop.renderRoot.flush();
  return Object.freeze(
    application.loop.renderRoot
      .buffer()
      .rows()
      .map((row: readonly Cell[]) => Object.freeze(row.map((cell: Cell) => cell.width))),
  );
}

/** Preserve exact per-cell glyph strings so combining sequences can be checked without re-splitting rows. */
function renderCellChars(application: Application): readonly (readonly string[])[] {
  application.loop.renderRoot.flush();
  return Object.freeze(
    application.loop.renderRoot
      .buffer()
      .rows()
      .map((row: readonly Cell[]) => Object.freeze(row.map((cell: Cell) => cell.char))),
  );
}

/** Materialize localized action definitions and retain their public evidence. */
function createActions(definitions: readonly ActionDefinition[]): {
  readonly buttons: readonly Button[];
  readonly snapshots: (application: Application) => readonly I18nActionSnapshot[];
} {
  const entries: readonly MaterializedAction[] = definitions.map((definition) => ({
    id: definition.id,
    button: new Button(definition.label, { command: definition.command }),
  }));
  return {
    buttons: entries.map(({ button }) => button),
    snapshots: (application) => actionSnapshots(application, entries),
  };
}

/**
 * Observe focus traversal plus non-mutating activation and pointer evidence for materialized actions.
 *
 * Every claimed face cell is resolved through the EventLoop's production hit-test traversal. Actual
 * command/callback metadata comes from the Button's immutable descriptor, so inspecting a Save,
 * Delete, or modal-close action never invokes application code.
 */
function actionSnapshots(
  application: Application,
  entries: readonly MaterializedAction[],
): readonly I18nActionSnapshot[] {
  const initialFocus = application.loop.getFocused();
  const focusIndices = new Map<Button, number>();
  for (let step = 0; step < 64 && focusIndices.size < entries.length; step += 1) {
    const focused = application.loop.getFocused();
    const entry = entries.find(({ button }) => button === focused);
    if (entry !== undefined && !focusIndices.has(entry.button)) {
      focusIndices.set(entry.button, focusIndices.size);
    }
    application.loop.focusNext();
    if (application.loop.getFocused() === initialFocus && step > 0) break;
  }

  const snapshots = entries.map(({ button, id }) => {
    const bounds = absoluteBounds(application, button) ?? { x: 0, y: 0, width: 0, height: 0 };
    const candidateHitBounds = {
      x: bounds.x + 1,
      y: bounds.y,
      width: Math.max(0, bounds.width - 2),
      height: Math.max(0, bounds.height - 1),
    };
    let allFaceCellsReachButton = candidateHitBounds.width > 0 && candidateHitBounds.height > 0;
    for (let y = candidateHitBounds.y; y < candidateHitBounds.y + candidateHitBounds.height; y += 1) {
      for (let x = candidateHitBounds.x; x < candidateHitBounds.x + candidateHitBounds.width; x += 1) {
        if (application.loop.viewAt({ x, y }) !== button) allFaceCellsReachButton = false;
      }
    }
    const hitBounds = allFaceCellsReachButton ? candidateHitBounds : { x: 0, y: 0, width: 0, height: 0 };
    const { command, hasCallback } = button.activation;
    const activation =
      command !== null && hasCallback
        ? 'command-and-callback'
        : command !== null
          ? 'command'
          : hasCallback
            ? 'callback'
            : 'none';
    return Object.freeze({
      id,
      label: button.activation.label,
      naturalWidth: button.measure().width,
      bounds,
      hitBounds,
      focusIndex: focusIndices.get(button) ?? -1,
      command,
      hasCallback,
      activation,
    });
  });
  if (initialFocus !== null) application.loop.focusView(initialFocus);
  return snapshots;
}

/** Capture a visible popup overlay and every mounted child in stable z-order. */
function captureOverlayEvidence(application: Application): OverlayEvidence {
  const overlay = application.loop.popupHost?.overlay;
  if (overlay === undefined || !overlay.state.visible || overlay.children.length === 0) {
    return Object.freeze({
      surfaces: Object.freeze([]),
      descendants: Object.freeze([]),
      rows: Object.freeze([]),
      cellChars: Object.freeze([]),
      cellWidths: Object.freeze([]),
    });
  }
  const surface = absoluteBounds(application, overlay);
  const childBounds = descendants(overlay)
    .map((view) => absoluteBounds(application, view))
    .filter((bounds): bounds is I18nCellBounds => bounds !== null && bounds.width > 0 && bounds.height > 0);
  return Object.freeze({
    surfaces: Object.freeze(surface === null ? [] : [surface]),
    descendants: Object.freeze(childBounds),
    rows: renderRows(application),
    cellChars: renderCellChars(application),
    cellWidths: renderCellWidths(application),
  });
}

/**
 * Build one adaptive framed surface using the public Button-group geometry contract.
 *
 * Feasible viewports allocate the complete natural action group. At an explicitly infeasible bound,
 * normal render-root clipping remains deterministic and cell-safe.
 */
function buildSurface(
  context: StoryBuildContext,
  title: string,
  body: string,
  definitions: readonly ActionDefinition[],
  arrangement: ActionArrangement,
  decorate?: StoryDecorator,
): BuiltStory {
  const { application, viewport } = context;
  const actions = createActions(definitions);
  const preferredColumns =
    arrangement === 'vertical' || arrangement === 'wrapped' ? 1 : arrangement === 'single' ? 1 : definitions.length;
  const width = Math.max(3, Math.min(78, viewport.width));
  const height = Math.max(3, Math.min(18, viewport.height - 1));
  const innerWidth = Math.max(1, width - 2);
  const innerHeight = Math.max(1, height - 2);
  const preferredMetrics = measureButtonGroup(actions.buttons, {
    gap: 1,
    rowGap: 1,
    maxColumns: preferredColumns,
  });
  const maxColumns = preferredMetrics.width <= innerWidth ? preferredColumns : 1;
  const metrics = measureButtonGroup(actions.buttons, { gap: 1, rowGap: 1, maxColumns });
  const dialog = new Dialog({ title, width, height });
  const bodyHeight = Math.max(1, innerHeight - metrics.height - 1);
  dialog.add(at(new Text(body), 0, 0, innerWidth, bodyHeight));
  const decoration = decorate?.(dialog, context, { width: innerWidth, height: bodyHeight });
  const actionView = buttonGroup(actions.buttons, { gap: 1, rowGap: 1, maxColumns });
  dialog.add(at(actionView, 0, Math.max(0, innerHeight - metrics.height), metrics.width, metrics.height));
  application.desktop?.addWindow(dialog);
  application.loop.renderRoot.flush();
  decoration?.afterMount?.();
  application.loop.renderRoot.flush();
  const overlayEvidence = captureOverlayEvidence(application);
  if (overlayEvidence.surfaces.length > 0) {
    application.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
  }
  const state = signal<unknown>({ title, arrangement });
  const unregisterActions = definitions.map((definition) =>
    application.onCommand(definition.command, () => {
      state.set({ title, arrangement, lastAction: definition.id });
    }),
  );
  let closed = false;

  return {
    root: dialog,
    state,
    snapshot: () => {
      application.loop.renderRoot.flush();
      const surface = absoluteBounds(application, dialog);
      const childBounds = descendants(dialog)
        .map((view) => absoluteBounds(application, view))
        .filter((bounds): bounds is I18nCellBounds => bounds !== null && bounds.width > 0 && bounds.height > 0);
      return Object.freeze({
        viewport: Object.freeze({ ...viewport }),
        surfaces: Object.freeze([...(surface === null ? [] : [surface]), ...overlayEvidence.surfaces]),
        descendants: Object.freeze([...childBounds, ...overlayEvidence.descendants]),
        overlaySurfaces: overlayEvidence.surfaces,
        overlayDescendants: overlayEvidence.descendants,
        actions: Object.freeze(actions.snapshots(application)),
        rows: overlayEvidence.surfaces.length > 0 ? overlayEvidence.rows : renderRows(application),
        cellChars: overlayEvidence.surfaces.length > 0 ? overlayEvidence.cellChars : renderCellChars(application),
        cellWidths: overlayEvidence.surfaces.length > 0 ? overlayEvidence.cellWidths : renderCellWidths(application),
        arrangement,
      });
    },
    close: () => {
      if (closed) return;
      closed = true;
      for (const unregister of unregisterActions) unregister();
      decoration?.close?.();
      application.desktop?.removeWindow(dialog);
    },
  };
}

/** Produce a registry entry whose localized content is rebuilt for every session. */
export function story(
  info: I18nStoryMetadata,
  content: (i18n: I18n) => {
    readonly title: string;
    readonly body: string;
    readonly actions: readonly ActionDefinition[];
    readonly arrangement: ActionArrangement;
  },
  decorate?: StoryDecorator,
): I18nStoryDefinition {
  return Object.freeze({
    metadata: info,
    build: (context: StoryBuildContext) => {
      const built = content(context.i18n);
      return buildSurface(context, built.title, built.body, built.actions, built.arrangement, decorate);
    },
  });
}

/** Build a registry entry around a real framework modal opened through its public helper. */
export function modalStory(
  info: I18nStoryMetadata,
  launch: (context: StoryBuildContext) => ModalLaunch,
): I18nStoryDefinition {
  return Object.freeze({
    metadata: info,
    build: (context: StoryBuildContext): BuiltStory => {
      const launched = launch(context);
      const surface = context.application.desktop?.activeWindow();
      if (surface === null || surface === undefined) {
        void launched.completion.catch(() => undefined);
        throw new Error(`The ${info.id} helper did not mount a modal surface.`);
      }
      if (surface instanceof Group) surface.add(new ModalReconstructionBridge(context.application));
      const buttons = descendants(surface).filter((view): view is Button => view instanceof Button);
      if (launched.actions.length > buttons.length) {
        context.application.loop.endModal(undefined);
        void launched.completion.catch(() => undefined);
        throw new Error(`The ${info.id} modal action count does not match its declared contract.`);
      }
      const entries = buttons.map((button, index): MaterializedAction => {
        const definition = launched.actions[index];
        const id = definition?.id ?? `modal-action-${index + 1}`;
        return { id, button };
      });
      const state = signal<unknown>({ storyId: info.id });
      let closed = false;
      return {
        root: surface,
        state,
        snapshot: () => {
          context.application.loop.renderRoot.flush();
          const bounds = absoluteBounds(context.application, surface);
          const childBounds = descendants(surface)
            .map((view) => absoluteBounds(context.application, view))
            .filter((entry): entry is I18nCellBounds => entry !== null && entry.width > 0 && entry.height > 0);
          return Object.freeze({
            viewport: Object.freeze({ ...context.viewport }),
            surfaces: Object.freeze(bounds === null ? [] : [bounds]),
            descendants: Object.freeze(childBounds),
            overlaySurfaces: Object.freeze([]),
            overlayDescendants: Object.freeze([]),
            actions: Object.freeze(actionSnapshots(context.application, entries)),
            rows: renderRows(context.application),
            cellChars: renderCellChars(context.application),
            cellWidths: renderCellWidths(context.application),
            arrangement: launched.arrangement,
          });
        },
        close: () => {
          if (closed) return;
          closed = true;
          context.application.loop.endModal(undefined);
          context.application.desktop?.removeWindow(surface);
          void launched.completion.catch(() => undefined);
        },
      };
    },
  });
}

/** Create one command action with a stable inspection ID. */
export function action(id: string, label: string): ActionDefinition {
  return Object.freeze({ id, label, command: `i18n-story:${id}` });
}

/** Mount translated UI controls whose own layout changes with locale text. */
export function decorateUi(dialog: Dialog, context: StoryBuildContext, available: I18nDemoViewport): StoryDecoration {
  const today = Object.freeze({ year: 2026, month: 7, day: 26 });
  const calendar = new Calendar({
    i18n: context.i18n,
    value: signal(null),
    today,
    density: 'compact',
  });
  const calendarSize = calendar.measure();
  const rightX = Math.min(calendarSize.width + 2, Math.max(0, available.width - 18));
  dialog.add(at(new Switch({ i18n: context.i18n, value: signal(false), label: '~M~ode' }), 0, 1, 20, 1));
  dialog.add(at(calendar, 0, 2, calendarSize.width, calendarSize.height));
  dialog.add(
    at(
      new DatePicker({ i18n: context.i18n, value: signal(null), today, density: 'compact' }),
      rightX,
      2,
      Math.max(1, available.width - rightX),
      1,
    ),
  );
  const combo = new ComboBox({
    items: signal(['Caller option A', 'Caller option B']),
    getText: (item) => item,
    value: signal<string | null>(null),
    placeholder: 'Dropdown',
  });
  dialog.add(at(combo, rightX, 4, Math.max(1, available.width - rightX), 1));
  return {
    afterMount: () => {
      context.application.loop.focusView(combo.input);
      context.application.loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: true, shift: false });
    },
  };
}

/** Mount the real translated filter popup used by a data-grid column. */
export function decorateDatagrid(dialog: Dialog, context: StoryBuildContext, available: I18nDemoViewport): undefined {
  interface DemoRow {
    readonly value: string;
  }
  const valueColumn = column<DemoRow, string>({
    id: 'value',
    title: 'Caller value',
    value: (row) => row.value,
  });
  const popup = new FilterPopup<DemoRow>({
    column: valueColumn,
    columnId: valueColumn.id,
    filterType: 'text',
    i18n: context.i18n,
    distinct: async () => ({ values: ['caller-owned', 'translated-value'], truncated: true }),
    availableWidth: available.width,
    onApply: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
  });
  dialog.add(at(popup, 0, 1, available.width, Math.max(1, available.height - 1)));
  return undefined;
}

/** Mount a real Code Editor with locale-bound presentation and deterministic caller-owned text. */
export function decorateCodeEditor(
  dialog: Dialog,
  context: StoryBuildContext,
  available: I18nDemoViewport,
): StoryDecoration {
  const document = createDocumentModel({
    text: ['const greeting = "caller-owned";', 'console.log(greeting);', '// invisible \u202E marker'].join('\n'),
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document });
  controller.degradation.fail('languageService');
  controller.openCompletion([
    { label: 'callerCompletion', insertText: 'callerCompletion', detail: 'Caller-owned assistance' },
  ]);
  const window = new CodeEditorWindow({ controller, i18n: context.i18n, lineNumbers: true });
  dialog.add(at(window, 0, 1, available.width, Math.max(1, available.height - 1)));
  return {
    afterMount: () => {
      context.application.loop.focusView(window.editor);
      window.editor.setSearchQuery('caller-owned');
      window.editor.execute('search.replaceOpen');
    },
    close: () => {
      window.editor.dispose();
      controller.dispose();
    },
  };
}
