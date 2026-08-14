import type { Theme } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import type { Desktop, Dialog, EventLoop } from '@jsvision/ui';

import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanEditorConfirm, KanbanEditorConfirmedReloadResult } from './confirmation.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorAlreadyOpen,
  KanbanEditorAuthority,
  KanbanEditorCoordinator,
  KanbanEditorRecordResolver,
  KanbanEditorResult,
  KanbanEditorSession,
  KanbanEditorSubmitResult,
} from './types.js';

/** Minimal application host required by the package editor dialogs. */
export interface KanbanEditorDialogHost {
  /** Application translation service used by package and standard UI controls. */
  readonly i18n: I18n;
  /** Event-loop operations required to execute and focus the modal. */
  readonly loop: Pick<EventLoop, 'execView' | 'focusView'>;
  /** Desktop operations and hard viewport extent required by the modal lifecycle. */
  readonly desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
  /** Optional live theme getter exposed to application replacement presentations. */
  readonly theme?: () => Theme;
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

/** Mutable actions exposed only while a replacement owns a create-mode session. */
export interface KanbanEditorCreateDialogActions<TResult = never> {
  /** Validates and completes through the configured authority or result-only policy. */
  readonly submit: () => Promise<KanbanEditorDialogSubmitResult<TResult>>;
  /** Applies dirty confirmation and closes as cancelled when accepted. */
  readonly cancel: () => Promise<void>;
}

/** Mutable actions exposed while a replacement owns an existing-card edit session. */
export interface KanbanEditorEditDialogActions<TResult = never> extends KanbanEditorCreateDialogActions<TResult> {
  /** Confirms and reloads one stale draft through the same session. */
  readonly reload: () => Promise<KanbanEditorConfirmedReloadResult>;
  /** Closes a deleted-card presentation without attempting submission. */
  readonly close: () => Promise<void>;
}

/** Sole lifecycle action exposed to a read-only view replacement. */
export interface KanbanEditorViewDialogActions {
  /** Closes the read-only presentation without attempting mutation. */
  readonly close: () => Promise<void>;
}

/** Mode-correct replacement actions; callers narrow through the context's `mode` discriminator. */
export type KanbanEditorDialogActions<TResult = never> =
  KanbanEditorCreateDialogActions<TResult> | KanbanEditorEditDialogActions<TResult> | KanbanEditorViewDialogActions;

/** Live presentation services exposed without freezing the host's current locale or theme. */
export interface KanbanEditorDialogPresentation {
  /** Returns the translation service currently owned by the application. */
  readonly i18n: () => I18n;
  /** Returns the current theme when the host exposes one. */
  readonly theme: () => Theme | undefined;
}

/** State and live presentation services shared by every mode-correct replacement context. */
interface KanbanEditorDialogContextBase<TDraft> {
  /** Exact coordinator-owned session shared with default and inspector presentations. */
  readonly session: KanbanEditorSession<TDraft>;
  /** Live presentation getters for replacement surfaces that react to locale or theme changes. */
  readonly presentation: KanbanEditorDialogPresentation;
}

/** Complete mode-correct application replacement context. */
export type KanbanEditorDialogContext<TDraft, TResult = never> =
  | (KanbanEditorDialogContextBase<TDraft> & {
      /** Create-mode discriminator. */
      readonly mode: 'create';
      /** Create exposes submit and cancel only. */
      readonly actions: KanbanEditorCreateDialogActions<TResult>;
    })
  | (KanbanEditorDialogContextBase<TDraft> & {
      /** Edit-mode discriminator. */
      readonly mode: 'edit';
      /** Edit additionally exposes stale reload and deleted-card close. */
      readonly actions: KanbanEditorEditDialogActions<TResult>;
    })
  | (KanbanEditorDialogContextBase<TDraft> & {
      /** Read-only mode discriminator. */
      readonly mode: 'view';
      /** View exposes close only. */
      readonly actions: KanbanEditorViewDialogActions;
    });

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
  /** Required application mapping from an accepted create operation to its persisted publication. */
  readonly publication?: KanbanEditorCreatePublicationResolver<TCard>;
  /** Optional complete create-mode presentation replacement. */
  readonly replacement?: KanbanEditorDialogReplacement<TDraft, TResult>;
}

/** Persisted card evidence returned after an accepted create operation publishes. */
export interface KanbanEditorCreatedRecord<TCard> {
  /** Application-owned identity assigned to the created card. */
  readonly cardKey: CardKey;
  /** Detached persisted card used to rebase the create session before it closes. */
  readonly card: TCard;
  /** Authoritative revision published for the created card. */
  readonly revision: KanbanRevision;
}

/** Context supplied while resolving one accepted create publication. */
export interface KanbanEditorCreatePublicationContext {
  /** Aborts when the create dialog loses ownership before publication correlation completes. */
  readonly signal: AbortSignal;
}

/** Application-owned seam that maps a provisional create claim to its persisted card publication. */
export interface KanbanEditorCreatePublicationResolver<TCard> {
  /** Waits for and returns the persisted card created by one accepted operation. */
  readonly resolve: (
    operationId: KanbanOperationId,
    context: KanbanEditorCreatePublicationContext,
  ) => Promise<KanbanEditorCreatedRecord<TCard>>;
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
  /** Optional complete edit-mode presentation replacement. */
  readonly replacement?: KanbanEditorDialogReplacement<TDraft, TResult>;
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
  /** Optional complete read-only presentation replacement over the shared session. */
  readonly replacement?: KanbanEditorDialogReplacement<TDraft>;
}

/** Internal resolved dialog inputs after mode-specific options have been normalized. */
/** Normalized inputs consumed by the package-owned dialog lifecycle runtime. */
export interface KanbanEditorResolvedDialogOptions<TCard, TDraft, TResult> {
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
