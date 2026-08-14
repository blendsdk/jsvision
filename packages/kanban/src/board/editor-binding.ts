import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_OPEN_CARD_EDITOR_ACTION_ID } from '../card/checklist-renderer.js';
import { openKanbanCardEditDialog } from '../editor/dialog.js';
import type {
  KanbanEditorDialogHost,
  KanbanEditorDialogReplacement,
  KanbanEditorDialogResult,
} from '../editor/dialog.js';
import type { KanbanEditorConfirm } from '../editor/confirmation.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorAuthority,
  KanbanEditorCoordinator,
  KanbanEditorRecordResolver,
} from '../editor/types.js';
import type { KanbanInteractionHandler, KanbanInteractionIntent, KanbanOpenCardIntent } from '../interaction/intent.js';

/**
 * Board-facing card editor operation that deliberately erases application record and draft types.
 *
 * A board passes only the stable card identity and its narrow request authority. Applications may
 * implement this interface directly when they need a different presentation or result policy.
 * Implementations should return promptly; the board does not await editor completion from its input queue.
 *
 * @example
 * ```ts
 * const editor: KanbanBoardEditorBinding = {
 *   open: (cardKey, authority) => openApplicationCardEditor(cardKey, authority),
 * };
 * ```
 */
export interface KanbanBoardEditorBinding {
  /** Opens or reveals the editor for one card through the board's current operation authority. */
  open(cardKey: CardKey, authority: KanbanEditorAuthority): unknown | PromiseLike<unknown>;
}

/** Typed application services captured by {@link createKanbanBoardEditorBinding}. */
export interface CreateKanbanBoardEditorBindingOptions<TCard, TDraft> {
  /** Modal host that owns desktop placement, focus, i18n, and event-loop execution. */
  readonly host: KanbanEditorDialogHost;
  /** Typed adapter between the application record, draft, schema, and update proposal. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Application-owned authoritative record and revision resolver. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  /** Identity coordinator shared by every editor presentation in the application. */
  readonly coordinator: KanbanEditorCoordinator;
  /** Optional application confirmation replacement for dirty and stale editor actions. */
  readonly confirm?: KanbanEditorConfirm;
  /** Optional complete application presentation over the package-owned editor session. */
  readonly replacement?: KanbanEditorDialogReplacement<TDraft>;
  /** Optional application cancellation signal used while initial record resolution is pending. */
  readonly signal?: AbortSignal;
}

/**
 * Creates a board binding that opens the standard or replaced edit dialog for activated cards.
 *
 * The returned binding closes over typed record services while the board sees only `CardKey`. Submit
 * always uses the authority supplied by the activating board, so editor updates share its revision,
 * eligibility, confirmation, operation-ID, and publication lifecycle.
 *
 * @example
 * ```ts
 * const board = new KanbanBoard({
 *   source,
 *   query: () => query,
 *   card,
 *   editor: createKanbanBoardEditorBinding({ host: app, adapter, resolver, coordinator }),
 * });
 * ```
 */
export function createKanbanBoardEditorBinding<TCard, TDraft>(
  options: CreateKanbanBoardEditorBindingOptions<TCard, TDraft>,
): KanbanBoardEditorBinding {
  return Object.freeze({
    open: (cardKey: CardKey, authority: KanbanEditorAuthority): Promise<KanbanEditorDialogResult> =>
      openKanbanCardEditDialog(options.host, {
        cardKey,
        adapter: options.adapter,
        resolver: options.resolver,
        coordinator: options.coordinator,
        completion: { kind: 'authority', authority },
        ...(options.confirm === undefined ? {} : { confirm: options.confirm }),
        ...(options.replacement === undefined ? {} : { replacement: options.replacement }),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }),
  });
}

/** Options used internally to compose package editor activation with an application intent handler. */
export interface KanbanBoardEditorInteractionOptions {
  /** Optional package or application card-editor binding. */
  readonly editor?: KanbanBoardEditorBinding;
  /** Narrow board request authority supplied to editor opens. */
  readonly authority: KanbanEditorAuthority;
  /** Existing application interaction handler that must keep receiving every semantic intent. */
  readonly application?: KanbanInteractionHandler;
  /** Optional payload-free board observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Returns whether one open-card intent requests the configured card editor. */
function requestsEditor(intent: KanbanInteractionIntent): intent is KanbanOpenCardIntent {
  return (
    intent.kind === 'open-card' &&
    (intent.actionId === undefined || intent.actionId === KANBAN_OPEN_CARD_EDITOR_ACTION_ID)
  );
}

/** Reports editor startup failure without allowing a diagnostic sink to affect interaction delivery. */
function reportEditorFailure(observe: ((observation: KanbanObservation) => void) | undefined): void {
  try {
    observe?.(createKanbanObservation({ code: 'editor-open-failed', scope: 'board' }));
  } catch {
    // Diagnostics never own input or editor lifecycle.
  }
}

/**
 * Composes automatic editor opening with the existing synchronous application intent boundary.
 *
 * Editor acquisition starts in a microtask and is intentionally not awaited. A modal can remain open
 * for minutes, so awaiting it would serialize and freeze every later board interaction. Application
 * handlers still run synchronously and retain the intent router's existing failure containment.
 */
export function createKanbanBoardEditorInteractionHandler(
  options: KanbanBoardEditorInteractionOptions,
): KanbanInteractionHandler | undefined {
  const editor = options.editor;
  if (editor === undefined) return options.application;
  return (intent): void => {
    if (requestsEditor(intent)) {
      void Promise.resolve()
        .then(() => editor.open(intent.cardKey, options.authority))
        .catch(() => reportEditorFailure(options.observe));
    }
    options.application?.(intent);
  };
}
