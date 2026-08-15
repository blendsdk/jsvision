import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { AcceleratorManifest, Catalog, I18n, Message, PlaceholderManifest } from '@jsvision/i18n';
import type { KanbanPackageActionId } from '../command/actions.js';

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

/** Exact placeholders accepted by first-use Phase B messages. */
export const KANBAN_PHASE_B_PLACEHOLDER_MANIFEST: PlaceholderManifest = Object.freeze({
  'kanban.state.descriptor-limit': Object.freeze(['count']),
  'kanban.interaction.selected-count': Object.freeze(['count']),
});

/** Exact placeholders accepted by Phase C drag and operation overlay messages. */
export const KANBAN_PHASE_C_PLACEHOLDER_MANIFEST: PlaceholderManifest = Object.freeze({
  'kanban.drag.cards': Object.freeze(['count']),
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
  /** Partial-state evidence that names the number of descriptors omitted by the finite viewport budget. */
  readonly 'kanban.state.descriptor-limit': Message;
  /** Read-only card action that asks the application to open its card editor. */
  readonly 'kanban.action.open-card-editor': Message;
  /** Compact feedback shown while a card operation is pending. */
  readonly 'kanban.card.feedback.pending': Message;
  /** Compact feedback shown when card validation is invalid. */
  readonly 'kanban.card.feedback.invalid': Message;
  /** Compact feedback shown when a card operation is rejected. */
  readonly 'kanban.card.feedback.rejected': Message;
  /** Empty-result state used when active filters exclude every card. */
  readonly 'kanban.state.filtered-empty': Message;
  /** Non-color cue for a collapsed structural region. */
  readonly 'kanban.state.collapsed': Message;
  /** Action that asks the application to remove active filters. */
  readonly 'kanban.action.clear-filters': Message;
  /** Compact heading for application-supplied definition-of-done text. */
  readonly 'kanban.workflow.definition-of-done': Message;
  /** Feedback for a proposed count below the configured WIP minimum. */
  readonly 'kanban.workflow.wip-minimum-not-met': Message;
  /** Feedback for a proposed count above the configured WIP maximum. */
  readonly 'kanban.workflow.wip-maximum-exceeded': Message;
  /** Feedback when blocking WIP authority is unavailable. */
  readonly 'kanban.workflow.wip-count-unavailable': Message;
  /** Payload-free feedback when the application transition resolver fails. */
  readonly 'kanban.reason.transition-unavailable': Message;
  /** Safe package-owned label for a derived-group resolver failure. */
  readonly 'kanban.swimlane.unavailable': Message;
  /** Feedback while bounded navigation is awaiting source work. */
  readonly 'kanban.interaction.navigation-pending': Message;
  /** Feedback when a navigation destination cannot be acquired. */
  readonly 'kanban.interaction.navigation-unavailable': Message;
  /** Payload-free feedback when navigation fails unexpectedly. */
  readonly 'kanban.interaction.navigation-error': Message;
  /** Feedback when a selection operation exceeds the configured finite limit. */
  readonly 'kanban.interaction.selection-limit-exceeded': Message;
  /** Feedback after ineligible selected cards are pruned. */
  readonly 'kanban.interaction.selection-pruned': Message;
  /** Compact count shown while multiple loaded cards are selected. */
  readonly 'kanban.interaction.selected-count': Message;
  /** Fallback label for an application-owned server selection without its own label. */
  readonly 'kanban.interaction.server-selection-active': Message;
  /** Payload-free feedback when the interaction owner is unavailable. */
  readonly 'kanban.interaction.unavailable': Message;
}

/** Canonical English messages introduced by the Phase B board surface. */
export const KANBAN_PHASE_B_ENGLISH_MESSAGES = Object.freeze({
  'kanban.state.descriptor-limit': '${count} cards are outside the display limit',
  'kanban.action.open-card-editor': 'Open card editor',
  'kanban.card.feedback.pending': 'Pending',
  'kanban.card.feedback.invalid': 'Invalid',
  'kanban.card.feedback.rejected': 'Rejected',
  'kanban.state.filtered-empty': 'No cards match the active filters',
  'kanban.state.collapsed': 'Collapsed',
  'kanban.action.clear-filters': 'Clear filters',
  'kanban.workflow.definition-of-done': 'Definition of done',
  'kanban.workflow.wip-minimum-not-met': 'WIP minimum not met',
  'kanban.workflow.wip-maximum-exceeded': 'WIP limit exceeded',
  'kanban.workflow.wip-count-unavailable': 'WIP count unavailable',
  'kanban.reason.transition-unavailable': 'Transition unavailable',
  'kanban.swimlane.unavailable': 'Unavailable',
  'kanban.interaction.navigation-pending': 'Moving focus…',
  'kanban.interaction.navigation-unavailable': 'Destination unavailable',
  'kanban.interaction.navigation-error': 'Could not move focus',
  'kanban.interaction.selection-limit-exceeded': 'Selection limit reached',
  'kanban.interaction.selection-pruned': 'Selection updated',
  'kanban.interaction.selected-count': '${count} selected',
  'kanban.interaction.server-selection-active': 'Server selection active',
  'kanban.interaction.unavailable': 'Interaction unavailable',
} satisfies KanbanPhaseBMessageMap);

/** Exact modern drag, target, and operation overlay inventory required from every official locale. */
export interface KanbanPhaseCMessageMap {
  readonly 'kanban.drag.card': Message;
  readonly 'kanban.drag.cards': Message;
  readonly 'kanban.drop.allowed': Message;
  readonly 'kanban.drop.warning': Message;
  readonly 'kanban.drop.blocked': Message;
  readonly 'kanban.drop.unavailable': Message;
  readonly 'kanban.operation.pending': Message;
  readonly 'kanban.operation.accepted': Message;
  readonly 'kanban.operation.rejected': Message;
  readonly 'kanban.operation.cancelled': Message;
  readonly 'kanban.operation.superseded': Message;
  readonly 'kanban.operation.conflict': Message;
  readonly 'kanban.operation.stale-placement': Message;
  readonly 'kanban.operation.sorted-placement': Message;
  readonly 'kanban.operation.filtered-placement': Message;
  readonly 'kanban.operation.transition-blocked': Message;
  readonly 'kanban.operation.wip-blocked': Message;
  readonly 'kanban.operation.definition-of-done': Message;
  readonly 'kanban.operation.reorder': Message;
}

/** Canonical English messages for modern pointer-drag and operation overlays. */
export const KANBAN_PHASE_C_ENGLISH_MESSAGES = Object.freeze({
  'kanban.drag.card': 'Moving card',
  'kanban.drag.cards': '${count} cards',
  'kanban.drop.allowed': 'Move here',
  'kanban.drop.warning': 'Move with warning',
  'kanban.drop.blocked': 'Move blocked',
  'kanban.drop.unavailable': 'Target unavailable',
  'kanban.operation.pending': 'Move pending',
  'kanban.operation.accepted': 'Awaiting board update',
  'kanban.operation.rejected': 'Move rejected',
  'kanban.operation.cancelled': 'Move cancelled',
  'kanban.operation.superseded': 'Board changed',
  'kanban.operation.conflict': 'Conflicting action unavailable',
  'kanban.operation.stale-placement': 'Placement changed',
  'kanban.operation.sorted-placement': 'Placed by current sort',
  'kanban.operation.filtered-placement': 'Card may be filtered',
  'kanban.operation.transition-blocked': 'Transition blocked',
  'kanban.operation.wip-blocked': 'WIP limit blocks this move',
  'kanban.operation.definition-of-done': 'Definition of done not met',
  'kanban.operation.reorder': 'Reordering',
} satisfies KanbanPhaseCMessageMap);

/** Stable action label/help message identities derived from the complete package action inventory. */
export type KanbanPhaseDActionMessageId = KanbanPackageActionId extends `kanban.${infer TStem}`
  ? `kanban.action.${TStem}.${'label' | 'help'}`
  : never;

/** Canonical English label/help messages for every package action. */
export const KANBAN_PHASE_D_ACTION_ENGLISH_MESSAGES = Object.freeze({
  'kanban.action.navigation.left.label': 'Move left',
  'kanban.action.navigation.left.help': 'Move left using the current board layout.',
  'kanban.action.navigation.right.label': 'Move right',
  'kanban.action.navigation.right.help': 'Move right using the current board layout.',
  'kanban.action.navigation.up.label': 'Move up',
  'kanban.action.navigation.up.help': 'Move up using the current board layout.',
  'kanban.action.navigation.down.label': 'Move down',
  'kanban.action.navigation.down.help': 'Move down using the current board layout.',
  'kanban.action.navigation.cell-first.label': 'First card',
  'kanban.action.navigation.cell-first.help': 'First card using the current board layout.',
  'kanban.action.navigation.cell-last.label': 'Last card',
  'kanban.action.navigation.cell-last.help': 'Last card using the current board layout.',
  'kanban.action.navigation.page-up.label': 'Previous page',
  'kanban.action.navigation.page-up.help': 'Previous page using the current board layout.',
  'kanban.action.navigation.page-down.label': 'Next page',
  'kanban.action.navigation.page-down.help': 'Next page using the current board layout.',
  'kanban.action.navigation.board-first.label': 'Start of board',
  'kanban.action.navigation.board-first.help': 'Start of board using the current board layout.',
  'kanban.action.navigation.board-last.label': 'End of board',
  'kanban.action.navigation.board-last.help': 'End of board using the current board layout.',
  'kanban.action.selection.toggle.label': 'Toggle selection',
  'kanban.action.selection.toggle.help': 'Toggle selection without changing application data.',
  'kanban.action.selection.extend-left.label': 'Extend selection left',
  'kanban.action.selection.extend-left.help': 'Extend selection left without changing application data.',
  'kanban.action.selection.extend-right.label': 'Extend selection right',
  'kanban.action.selection.extend-right.help': 'Extend selection right without changing application data.',
  'kanban.action.selection.extend-up.label': 'Extend selection up',
  'kanban.action.selection.extend-up.help': 'Extend selection up without changing application data.',
  'kanban.action.selection.extend-down.label': 'Extend selection down',
  'kanban.action.selection.extend-down.help': 'Extend selection down without changing application data.',
  'kanban.action.selection.select-all.label': 'Select visible cards',
  'kanban.action.selection.select-all.help': 'Select visible cards without changing application data.',
  'kanban.action.selection.clear.label': 'Clear selection',
  'kanban.action.selection.clear.help': 'Clear selection without changing application data.',
  'kanban.action.card.open.label': 'Open card',
  'kanban.action.card.open.help': "Open card through the board's shared action policy.",
  'kanban.action.card.activate.label': 'Activate card',
  'kanban.action.card.activate.help': "Activate card through the board's shared action policy.",
  'kanban.action.card.create.label': 'Create card',
  'kanban.action.card.create.help': "Create card through the board's shared action policy.",
  'kanban.action.card.edit.label': 'Edit card',
  'kanban.action.card.edit.help': "Edit card through the board's shared action policy.",
  'kanban.action.card.duplicate.label': 'Duplicate card',
  'kanban.action.card.duplicate.help': "Duplicate card through the board's shared action policy.",
  'kanban.action.card.archive.label': 'Archive card',
  'kanban.action.card.archive.help': "Archive card through the board's shared action policy.",
  'kanban.action.card.delete.label': 'Delete card',
  'kanban.action.card.delete.help': "Delete card through the board's shared action policy.",
  'kanban.action.card.grab.label': 'Grab card',
  'kanban.action.card.grab.help': "Grab card through the board's shared action policy.",
  'kanban.action.card.drop.label': 'Drop card',
  'kanban.action.card.drop.help': "Drop card through the board's shared action policy.",
  'kanban.action.card.move.label': 'Move card',
  'kanban.action.card.move.help': "Move card through the board's shared action policy.",
  'kanban.action.card.cancel-move.label': 'Cancel card move',
  'kanban.action.card.cancel-move.help': "Cancel card move through the board's shared action policy.",
  'kanban.action.transient.cancel.label': 'Cancel current action',
  'kanban.action.transient.cancel.help': "Cancel current action through the board's shared action policy.",
  'kanban.action.column.configure.label': 'Configure column',
  'kanban.action.column.configure.help': 'Configure column through application-owned configuration.',
  'kanban.action.column.add.label': 'Add column',
  'kanban.action.column.add.help': 'Add column through application-owned configuration.',
  'kanban.action.column.reorder.label': 'Reorder column',
  'kanban.action.column.reorder.help': 'Reorder column through application-owned configuration.',
  'kanban.action.column.delete.label': 'Delete column',
  'kanban.action.column.delete.help': 'Delete column through application-owned configuration.',
  'kanban.action.swimlane.configure.label': 'Configure swimlane',
  'kanban.action.swimlane.configure.help': 'Configure swimlane through application-owned configuration.',
  'kanban.action.swimlane.add.label': 'Add swimlane',
  'kanban.action.swimlane.add.help': 'Add swimlane through application-owned configuration.',
  'kanban.action.swimlane.reorder.label': 'Reorder swimlane',
  'kanban.action.swimlane.reorder.help': 'Reorder swimlane through application-owned configuration.',
  'kanban.action.swimlane.delete.label': 'Delete swimlane',
  'kanban.action.swimlane.delete.help': 'Delete swimlane through application-owned configuration.',
  'kanban.action.search.focus.label': 'Focus search',
  'kanban.action.search.focus.help': "Focus search through the board's shared action policy.",
  'kanban.action.filter.clear.label': 'Clear filters',
  'kanban.action.filter.clear.help': "Clear filters through the board's shared action policy.",
  'kanban.action.sort.configure.label': 'Configure sorting',
  'kanban.action.sort.configure.help': "Configure sorting through the board's shared action policy.",
  'kanban.action.view.apply.label': 'Apply view',
  'kanban.action.view.apply.help': "Apply view through the board's shared action policy.",
  'kanban.action.view.save.label': 'Save view',
  'kanban.action.view.save.help': "Save view through the board's shared action policy.",
  'kanban.action.context.open.label': 'Open context menu',
  'kanban.action.context.open.help': "Open context menu through the board's shared action policy.",
  'kanban.action.help.open.label': 'Open Kanban help',
  'kanban.action.help.open.help': "Open Kanban help through the board's shared action policy.",
  'kanban.action.source.retry.label': 'Retry loading',
  'kanban.action.source.retry.help': "Retry loading through the board's shared action policy.",
  'kanban.action.history.undo.label': 'Undo',
  'kanban.action.history.undo.help': 'Undo through application-owned history.',
  'kanban.action.history.redo.label': 'Redo',
  'kanban.action.history.redo.help': 'Redo through application-owned history.',
} satisfies Readonly<Record<KanbanPhaseDActionMessageId, Message>>);

/** Canonical English messages for standard Phase D view, editor, and configuration surfaces. */
export const KANBAN_PHASE_D_UI_ENGLISH_MESSAGES = Object.freeze({
  'kanban.view.search.label': 'Search',
  'kanban.view.search.placeholder': 'Find cards',
  'kanban.view.quick-filters': 'Quick filters',
  'kanban.view.sort': 'Sort',
  'kanban.view.saved-views': 'Views',
  'kanban.view.clear': 'Clear',
  'kanban.view.overflow': 'More',
  'kanban.view.visible-count': 'Visible cards',
  'kanban.view.matching-count': 'Matching cards',
  'kanban.editor.create.title': 'Create card',
  'kanban.editor.view.title': 'View card',
  'kanban.editor.edit.title': 'Edit card',
  'kanban.editor.action.save': '~S~ave',
  'kanban.editor.action.reload': '~R~eload',
  'kanban.editor.action.cancel': '~C~ancel',
  'kanban.editor.action.close': '~C~lose',
  'kanban.editor.confirm.discard-draft': 'Discard unsaved changes?',
  'kanban.editor.confirm.reload-stale': 'Reload and discard local changes?',
  'kanban.editor.status.stale': 'Card changed · Reload',
  'kanban.editor.status.deleted': 'Card was deleted',
  'kanban.editor.status.unavailable': 'Card is unavailable',
  'kanban.editor.status.validating': 'Validating…',
  'kanban.editor.status.saving': 'Saving…',
  'kanban.editor.status.awaiting': 'Waiting for board update…',
  'kanban.editor.status.rejected': 'Change rejected',
  'kanban.editor.status.saved': 'Saved',
  'kanban.editor.status.unsaved': 'Unsaved changes',
  'kanban.editor.status.ready': 'Ready',
  'kanban.editor.status.result-failed': 'Unable to prepare result',
  'kanban.editor.control-unavailable': 'Control unavailable',
  'kanban.editor.validation.invalid-standard-field': 'Invalid value',
  'kanban.editor.section.main': 'Main',
  'kanban.editor.section.details': 'Details',
  'kanban.editor.section.people': 'People',
  'kanban.editor.section.checklists': 'Checklists',
  'kanban.editor.field.title': 'Title',
  'kanban.editor.field.status': 'Status',
  'kanban.editor.field.description': 'Description',
  'kanban.editor.field.type': 'Type',
  'kanban.editor.field.priority': 'Priority',
  'kanban.editor.field.assignees': 'Assignees',
  'kanban.editor.field.labels': 'Labels',
  'kanban.editor.field.start-date': 'Start date',
  'kanban.editor.field.due-date': 'Due date',
  'kanban.editor.field.estimate': 'Estimate',
  'kanban.editor.field.checklists': 'Checklists',
  'kanban.configuration.column.add.title': 'Add column',
  'kanban.configuration.column.update.title': 'Edit column',
  'kanban.configuration.column.reorder.title': 'Reorder column',
  'kanban.configuration.column.delete.title': 'Delete column',
  'kanban.configuration.swimlane.add.title': 'Add swimlane',
  'kanban.configuration.swimlane.update.title': 'Edit swimlane',
  'kanban.configuration.swimlane.reorder.title': 'Reorder swimlane',
  'kanban.configuration.swimlane.delete.title': 'Delete swimlane',
  'kanban.configuration.action.apply': '~A~pply',
  'kanban.configuration.action.reload': '~R~eload',
  'kanban.configuration.action.cancel': '~C~ancel',
  'kanban.configuration.confirm.delete': 'Delete this structure?',
  'kanban.configuration.confirm.discard-draft': 'Discard unsaved changes?',
  'kanban.configuration.confirm.reload-stale': 'Reload and discard local changes?',
  'kanban.configuration.status.stale': 'Structure changed · Reload',
  'kanban.configuration.status.unavailable': 'Structure unavailable',
  'kanban.configuration.status.saving': 'Applying…',
  'kanban.configuration.status.awaiting-publication': 'Waiting for board update…',
  'kanban.configuration.status.applied': 'Applied',
  'kanban.configuration.status.unsaved': 'Unsaved changes',
  'kanban.configuration.status.ready': 'Ready',
  'kanban.configuration.edit.help': 'Edit the isolated draft, then Apply or Cancel.',
  'kanban.configuration.reorder.help': 'Choose a stable neighbor, then Apply.',
  'kanban.configuration.reorder.start': 'Start',
  'kanban.configuration.reorder.end': 'End',
  'kanban.configuration.reorder.between': 'Between',
  'kanban.configuration.reorder.before': 'Before',
  'kanban.configuration.reorder.after': 'After',
  'kanban.configuration.reorder.destinations': 'Choose destination:',
  'kanban.configuration.field.name': '~N~ame',
  'kanban.configuration.field.disambiguator': '~Q~ualifier',
  'kanban.configuration.field.done-summary': 'Done ~s~ummary',
  'kanban.configuration.field.done-details': 'Done de~t~ails',
  'kanban.configuration.field.wip-minimum': 'WIP m~i~n',
  'kanban.configuration.field.wip-maximum': 'WIP ma~x~',
  'kanban.configuration.field.wip-mode': 'WIP m~o~de',
  'kanban.configuration.field.wip-count-done': 'Count ~d~one',
  'kanban.configuration.field.style': 'Style ~r~ole',
  'kanban.configuration.field.data': 'App ~m~etadata',
  'kanban.configuration.delete.occupancy-unknown': 'Affected cards: unknown',
  'kanban.configuration.delete.affected': 'Affected cards',
  'kanban.configuration.delete.no-policy': 'No reassignment policy',
  'kanban.configuration.delete.policy-ready': 'Atomic policy configured',
  'kanban.configuration.delete.destination': 'Move affected cards to:',
});

/** Complete typed English message contract introduced by Phase D productivity workflows. */
export type KanbanPhaseDMessageMap = Readonly<Record<KanbanPhaseDActionMessageId, Message>> & {
  readonly [TKey in keyof typeof KANBAN_PHASE_D_UI_ENGLISH_MESSAGES]: Message;
};

/** Complete canonical English Phase D overlay used by action help and standard package dialogs. */
export const KANBAN_PHASE_D_ENGLISH_MESSAGES = Object.freeze({
  ...KANBAN_PHASE_D_ACTION_ENGLISH_MESSAGES,
  ...KANBAN_PHASE_D_UI_ENGLISH_MESSAGES,
} satisfies KanbanPhaseDMessageMap);

/** Co-visible Phase D mnemonic scopes shared by English and fallback locale overlays. */
export const KANBAN_PHASE_D_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([
    Object.freeze({
      name: 'kanban-editor-actions',
      keys: Object.freeze(['kanban.editor.action.save', 'kanban.editor.action.reload', 'kanban.editor.action.cancel']),
    }),
    Object.freeze({
      name: 'kanban-configuration-actions',
      keys: Object.freeze([
        'kanban.configuration.action.apply',
        'kanban.configuration.action.reload',
        'kanban.configuration.action.cancel',
      ]),
    }),
    Object.freeze({
      name: 'kanban-configuration-fields',
      keys: Object.freeze([
        'kanban.configuration.field.name',
        'kanban.configuration.field.disambiguator',
        'kanban.configuration.field.done-summary',
        'kanban.configuration.field.done-details',
        'kanban.configuration.field.wip-minimum',
        'kanban.configuration.field.wip-maximum',
        'kanban.configuration.field.wip-mode',
        'kanban.configuration.field.wip-count-done',
        'kanban.configuration.field.style',
        'kanban.configuration.field.data',
      ]),
    }),
  ]),
});

/** Immutable English overlay for Phase D productivity, editing, configuration, and action help. */
export const KANBAN_PHASE_D_ENGLISH_CATALOG: Catalog = defineCatalog(
  { schema: 1, locale: 'en', messages: KANBAN_PHASE_D_ENGLISH_MESSAGES },
  { acceleratorManifest: KANBAN_PHASE_D_ACCELERATOR_MANIFEST },
);

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
    placeholderManifest: KANBAN_PHASE_B_PLACEHOLDER_MANIFEST,
    acceleratorManifest: KANBAN_ACCELERATOR_MANIFEST,
  },
);

/** Immutable English overlay for Phase C drag, drop, pending, and outcome feedback. */
export const KANBAN_PHASE_C_ENGLISH_CATALOG: Catalog = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: KANBAN_PHASE_C_ENGLISH_MESSAGES,
  },
  {
    placeholderManifest: KANBAN_PHASE_C_PLACEHOLDER_MANIFEST,
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
  return createI18n({
    locale: 'en',
    catalogs: [
      KANBAN_ENGLISH_CATALOG,
      KANBAN_PHASE_B_ENGLISH_CATALOG,
      KANBAN_PHASE_C_ENGLISH_CATALOG,
      KANBAN_PHASE_D_ENGLISH_CATALOG,
    ],
  });
}
