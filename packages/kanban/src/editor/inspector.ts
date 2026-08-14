import type { CardKey } from '../contract/identity.js';
import type { KanbanRequestResult } from '../contract/request.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorAlreadyOpen,
  KanbanEditorAuthority,
  KanbanEditorCoordinator,
  KanbanEditorOpened,
  KanbanEditorRecordResolver,
  KanbanEditorSession,
} from './types.js';

/** Callback helper that keeps application session handlers usable across heterogeneous coordinators. */
type KanbanInspectorCallback<TResult> = {
  bivarianceHack(session: KanbanEditorSession): TResult;
}['bivarianceHack'];

/** Application-owned modeless presentation operations for one inspector identity. */
export interface KanbanEditorInspectorPresentation {
  /** Mounts the first acquired session in an application-owned surface. */
  readonly mount: KanbanInspectorCallback<void | Promise<void>>;
  /** Reveals the existing application-owned surface for a repeated open. */
  readonly reveal: KanbanInspectorCallback<void | Promise<void>>;
}

/** Options for acquiring or revealing one application-owned modeless card inspector. */
export interface OpenKanbanCardInspectorOptions<TCard, TDraft> {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Adapter that owns the inspector's typed detached draft. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Authoritative application record source. */
  readonly resolver: KanbanEditorRecordResolver<TCard>;
  /** Identity coordinator shared with package dialogs and other inspectors. */
  readonly coordinator: KanbanEditorCoordinator;
  /** Application-owned mount and reveal operations; the package owns no inspector window. */
  readonly presentation: KanbanEditorInspectorPresentation;
  /** Optional request authority when the application inspector exposes editing actions. */
  readonly authority?: KanbanEditorAuthority;
  /** Optional caller cancellation used while initial resolution is pending. */
  readonly signal?: AbortSignal;
}

/** Successful inspector acquisition or reveal result. */
export type KanbanEditorInspectorResult<TDraft = unknown> = KanbanEditorOpened<TDraft> | KanbanEditorAlreadyOpen;

/** Creates an authority that fails closed if a view-only inspector attempts submission. */
function inertInspectorAuthority(): KanbanEditorAuthority {
  return Object.freeze({
    request: (): KanbanRequestResult => {
      throw new TypeError('This Kanban inspector has no request authority.');
    },
  });
}

/**
 * Acquires or reveals one modeless inspector without mounting any package-owned window.
 *
 * @example
 * ```ts
 * const opened = await openKanbanCardInspector({
 *   cardKey, adapter, resolver, coordinator,
 *   presentation: { mount: showInspector, reveal: revealInspector },
 * });
 * ```
 */
export async function openKanbanCardInspector<TCard, TDraft>(
  options: OpenKanbanCardInspectorOptions<TCard, TDraft>,
): Promise<KanbanEditorInspectorResult<TDraft>> {
  const opened = await options.coordinator.open({
    mode: 'edit',
    cardKey: options.cardKey,
    adapter: options.adapter,
    resolver: options.resolver,
    authority: options.authority ?? inertInspectorAuthority(),
    signal: options.signal,
    editorKind: 'custom',
  });
  if (opened.kind === 'disposed') throw new TypeError('Kanban editor coordinator is disposed.');
  try {
    if (opened.kind === 'opened') await options.presentation.mount(opened.session);
    else await options.presentation.reveal(opened.session);
    return opened;
  } catch {
    if (opened.kind === 'opened') opened.session.dispose();
    throw new TypeError('Kanban inspector presentation failed.');
  }
}
