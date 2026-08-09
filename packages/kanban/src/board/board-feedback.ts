import type { I18n } from '@jsvision/i18n';
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

import type { KanbanCardPresentationAdapter } from '../card/adapter.js';
import type { KanbanCardFormattingContext } from '../card/formatting.js';
import { resolveKanbanPresentation } from '../card/presentation-policy.js';
import { snapshotConfiguredKanbanCardPresentation } from '../card/standard-renderer.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanResolvedLimits } from '../contract/limits.js';
import { snapshotKanbanFocusTarget } from '../interaction/reconciliation.js';
import type { KanbanFocusedDetailSnapshot, KanbanInteractionSnapshot } from '../interaction/types.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportSourceSnapshot } from './viewport-source.js';

/** Immutable content painted by the board's conditional one-row interaction surface. */
export interface KanbanBoardFeedbackState {
  /** Sanitized localized feedback text. */
  readonly label: string;
}

/** Inputs required to detach the currently focused target from mounted board state. */
export interface CreateKanbanFocusedDetailOptions<TCard> {
  /** Current immutable controller publication. */
  readonly interaction: KanbanInteractionSnapshot;
  /** Latest mounted source projection, when one exists. */
  readonly source?: KanbanViewportSourceSnapshot<TCard>;
  /** Latest exact visible projection, when one exists. */
  readonly projection?: KanbanViewportProjection;
  /** Application record presentation adapter. */
  readonly card: KanbanCardPresentationAdapter<TCard>;
  /** Active finite resource ceilings. */
  readonly limits: KanbanResolvedLimits;
  /** Current localization service used for default value formatting. */
  readonly i18n: I18n;
  /** Optional application formatting callbacks. */
  readonly formatting?: KanbanCardFormattingContext;
  /** Optional already-redacted observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Creates safe default formatting without retaining the localization getter. */
function defaultFormatting(i18n: I18n): KanbanCardFormattingContext {
  return Object.freeze({
    locale: i18n.locale,
    formatNumber: (value: number | bigint) => i18n.number(value),
    formatDate: (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return i18n.date(value);
      if (typeof value === 'number' && Number.isFinite(value)) return i18n.date(value);
      return undefined;
    },
  });
}

/** Returns a detached selection summary shared by every focused-target branch. */
function selection(interaction: KanbanInteractionSnapshot): KanbanFocusedDetailSnapshot['selection'] {
  return Object.freeze({
    loadedCount: interaction.selectedCardKeys.length,
    scope: interaction.serverSelection === undefined ? 'loaded' : 'server',
  });
}

/** Returns complete safe definition-of-done text for a focused column or card address. */
function definitionOfDone<TCard>(
  source: KanbanViewportSourceSnapshot<TCard> | undefined,
  columnId: string | undefined,
): string | undefined {
  if (columnId === undefined) return undefined;
  const definition = source?.structure.columns.find((column) => column.columnId === columnId)?.definitionOfDone;
  return definition?.details ?? definition?.summary;
}

/** Creates the target-only fallback used when focused application data is not resident or valid. */
function emptyDetail<TCard>(options: CreateKanbanFocusedDetailOptions<TCard>): KanbanFocusedDetailSnapshot {
  const target = snapshotKanbanFocusTarget(options.interaction.focused);
  const columnId =
    target.kind === 'card' ? target.address.columnId : target.kind === 'column-header' ? target.columnId : undefined;
  const done = definitionOfDone(options.source, columnId);
  return Object.freeze({
    target,
    fields: Object.freeze([]),
    checklists: Object.freeze([]),
    ...(done === undefined ? {} : { definitionOfDone: done }),
    actions: Object.freeze([]),
    keyHints: Object.freeze([]),
    selection: selection(options.interaction),
  });
}

/**
 * Creates one bounded, deeply frozen focused-detail projection without retaining an application record.
 *
 * Card fields and checklist values use the same sanitizing snapshot boundary as standard card rendering,
 * but use the active safety ceilings instead of the currently visible card's row budget. A non-resident
 * focused card retains its safe identity and selection summary while exposing no invented values.
 */
export function createKanbanFocusedDetailSnapshot<TCard>(
  options: CreateKanbanFocusedDetailOptions<TCard>,
): KanbanFocusedDetailSnapshot {
  const fallback = emptyDetail(options);
  const target = fallback.target;
  if (target.kind !== 'card' || options.source === undefined || options.projection === undefined) return fallback;
  const projected = options.projection.cards.find(
    (card) =>
      card.descriptor.cardKey === target.cardKey &&
      card.columnId === target.address.columnId &&
      card.swimlaneId === target.address.swimlaneId,
  );
  const cell = options.source.cells.find(
    (candidate) =>
      candidate.address.columnId === target.address.columnId &&
      candidate.address.swimlaneId === target.address.swimlaneId,
  );
  if (projected === undefined) return fallback;
  const record = cell?.cursor.cardAt(projected.index);
  if (record === undefined) return fallback;
  try {
    const budget = resolveKanbanPresentation(
      {
        revision: 'jsvision-kanban-focused-detail-v1',
        cardRows: Math.max(1, options.limits.descriptorRows),
        cardGap: 0,
        metadataFields: options.limits.cardFields,
        labelRows: options.limits.descriptorRows,
        summarySections: 0,
        checklistMode: 'preview',
        checklistPreviewItems: options.limits.checklistItemsPerGroup,
      },
      options.limits,
    );
    const card = snapshotConfiguredKanbanCardPresentation(record, options.card, {
      budget,
      limits: options.limits,
      visualState: {
        focused: true,
        selected: options.interaction.selectedCardKeys.includes(target.cardKey),
        rangeAnchor: options.interaction.rangeAnchor?.cardKey === target.cardKey,
        readOnly: false,
        invalid: false,
        operation: 'idle',
      },
      formatting: options.formatting ?? defaultFormatting(options.i18n),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
    return Object.freeze({
      target,
      title: card.title,
      status: card.status,
      fields: Object.freeze(
        card.fields.map((field) =>
          Object.freeze({ fieldId: field.fieldId, label: field.label, values: Object.freeze([...field.values]) }),
        ),
      ),
      checklists: card.checklists,
      ...(fallback.definitionOfDone === undefined ? {} : { definitionOfDone: fallback.definitionOfDone }),
      actions: Object.freeze(projected.descriptor.actions.map((action) => Object.freeze({ ...action }))),
      keyHints: Object.freeze([]),
      selection: fallback.selection,
    });
  } catch {
    return fallback;
  }
}

/** Converts current controller feedback to the board's conditional one-row state. */
export function createKanbanBoardFeedbackState(
  interaction: KanbanInteractionSnapshot,
  i18n: I18n,
): KanbanBoardFeedbackState | undefined {
  const feedback = interaction.feedback;
  if (feedback === undefined) return undefined;
  const suffix = feedback.count === undefined ? '' : ` (${i18n.number(feedback.count)})`;
  return Object.freeze({ label: `${feedback.label}${suffix}` });
}

/** One-row leaf shown only while controller feedback must remain visible. */
export class KanbanBoardFeedbackView extends View {
  readonly #state: () => KanbanBoardFeedbackState | undefined;

  /** Stores a current-state accessor; the board owns reactive invalidation and lifecycle. */
  constructor(state: () => KanbanBoardFeedbackState | undefined) {
    super();
    this.#state = state;
    this.focusable = false;
  }

  /** Reports one intentional row to the DSL layout engine. */
  override measure(): { readonly width: number; readonly height: number } {
    return { width: 1, height: 1 };
  }

  /** Draws sanitized localized feedback on the theme-controlled status surface. */
  override draw(ctx: DrawContext): void {
    const state = this.#state();
    if (state === undefined) return;
    ctx.fill(' ', ctx.color('statusBar'));
    ctx.text(0, 0, state.label, ctx.color('statusBar'));
  }
}
