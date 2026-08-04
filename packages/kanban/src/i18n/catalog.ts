import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { AcceleratorManifest, Catalog, I18n, Message, PlaceholderManifest } from '@jsvision/i18n';

/**
 * Exact Phase A message inventory required from every Kanban locale.
 *
 * Keeping the keys explicit turns missing or invented translations into TypeScript errors instead of
 * silently falling back at an arbitrary call site.
 */
export interface KanbanMessageMap {
  /** Accessible board label. */
  readonly 'kanban.board.label': Message;
  /** Empty board state used when no workflow columns exist. */
  readonly 'kanban.board.no-columns': Message;
  /** Initial source-loading state. */
  readonly 'kanban.state.loading': Message;
  /** Background source-refresh state. */
  readonly 'kanban.state.refreshing': Message;
  /** Partial-data state. */
  readonly 'kanban.state.partial': Message;
  /** Empty-card state. */
  readonly 'kanban.state.empty': Message;
  /** Board source-error state. */
  readonly 'kanban.state.error': Message;
  /** Retry action label. */
  readonly 'kanban.action.retry': Message;
  /** Minimum terminal geometry message using `width` and `height`. */
  readonly 'kanban.layout.minimum-size': Message;
  /** Label for an unavailable count. */
  readonly 'kanban.count.unknown': Message;
  /** Lower-bound count using `count`. */
  readonly 'kanban.count.truncated': Message;
  /** Previous-column navigation label. */
  readonly 'kanban.focused-column.previous': Message;
  /** Next-column navigation label. */
  readonly 'kanban.focused-column.next': Message;
  /** Focused-column position using `current` and `total`. */
  readonly 'kanban.focused-column.position': Message;
  /** Safe replacement for an invalid mandatory card title. */
  readonly 'kanban.card.invalid-title': Message;
  /** Safe replacement for an invalid mandatory card status. */
  readonly 'kanban.card.unknown-status': Message;
  /** Payload-free source failure reason. */
  readonly 'kanban.reason.source-unavailable': Message;
  /** Payload-free card renderer failure reason. */
  readonly 'kanban.reason.renderer-unavailable': Message;
}

/** Exact placeholders accepted by parameterized Kanban messages. */
export const KANBAN_PLACEHOLDER_MANIFEST: PlaceholderManifest = Object.freeze({
  'kanban.layout.minimum-size': Object.freeze(['width', 'height']),
  'kanban.count.truncated': Object.freeze(['count']),
  'kanban.focused-column.position': Object.freeze(['current', 'total']),
});

/**
 * Accelerator topology owned by the Phase A Kanban vocabulary.
 *
 * This slice has no translated mnemonic-bearing control group, so it publishes no collision scopes.
 */
export const KANBAN_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([]),
});

/** Canonical English messages used by the package catalog and safe application defaults. */
export const KANBAN_ENGLISH_MESSAGES = Object.freeze({
  'kanban.board.label': 'Kanban board',
  'kanban.board.no-columns': 'No columns',
  'kanban.state.loading': 'Loading…',
  'kanban.state.refreshing': 'Refreshing…',
  'kanban.state.partial': 'Some cards are unavailable',
  'kanban.state.empty': 'No cards',
  'kanban.state.error': 'Could not load the board',
  'kanban.action.retry': 'Retry',
  'kanban.layout.minimum-size': 'Kanban needs at least ${width} × ${height} cells',
  'kanban.count.unknown': 'Count unknown',
  'kanban.count.truncated': '${count} or more',
  'kanban.focused-column.previous': 'Previous column',
  'kanban.focused-column.next': 'Next column',
  'kanban.focused-column.position': 'Column ${current} of ${total}',
  'kanban.card.invalid-title': 'Invalid card',
  'kanban.card.unknown-status': 'Unknown status',
  'kanban.reason.source-unavailable': 'Source unavailable',
  'kanban.reason.renderer-unavailable': 'Card unavailable',
} satisfies KanbanMessageMap);

/** Exact first-use Phase B message inventory required from every Kanban translation overlay. */
export interface KanbanPhaseBMessageMap {
  /** Read-only card action that asks the application to open its card editor. */
  readonly 'kanban.action.open-card-editor': Message;
  /** Compact feedback shown while a card operation is pending. */
  readonly 'kanban.card.feedback.pending': Message;
  /** Compact feedback shown when card validation is invalid. */
  readonly 'kanban.card.feedback.invalid': Message;
  /** Compact feedback shown when a card operation is rejected. */
  readonly 'kanban.card.feedback.rejected': Message;
}

/** Canonical English messages introduced by the Phase B board surface. */
export const KANBAN_PHASE_B_ENGLISH_MESSAGES = Object.freeze({
  'kanban.action.open-card-editor': 'Open card editor',
  'kanban.card.feedback.pending': 'Pending',
  'kanban.card.feedback.invalid': 'Invalid',
  'kanban.card.feedback.rejected': 'Rejected',
} satisfies KanbanPhaseBMessageMap);

/** Complete immutable English fallback catalog for `@jsvision/kanban`. */
export const KANBAN_ENGLISH_CATALOG: Catalog = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: KANBAN_ENGLISH_MESSAGES,
  },
  {
    placeholderManifest: KANBAN_PLACEHOLDER_MANIFEST,
    acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
  },
);

/**
 * Immutable English overlay for labels first consumed by the richer board surface.
 *
 * Keeping the overlay separate preserves the exact original catalog contract for existing consumers.
 *
 * @example
 * ```ts
 * KANBAN_PHASE_B_ENGLISH_CATALOG.messages['kanban.action.open-card-editor'];
 * ```
 */
export const KANBAN_PHASE_B_ENGLISH_CATALOG: Catalog = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: KANBAN_PHASE_B_ENGLISH_MESSAGES,
  },
  {
    placeholderManifest: Object.freeze({}),
    acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
  },
);

/**
 * Creates an isolated English service containing only the Kanban fallback catalog.
 *
 * A fresh service prevents runtime overlays and diagnostics from leaking between independent boards.
 *
 * @example
 * ```ts
 * const i18n = createEnglishKanbanI18n();
 * i18n.t('kanban.board.label');
 * ```
 */
export function createEnglishKanbanI18n(): I18n {
  return createI18n({ locale: 'en', catalogs: [KANBAN_ENGLISH_CATALOG, KANBAN_PHASE_B_ENGLISH_CATALOG] });
}
