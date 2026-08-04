import { charWidth, sanitize } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type {
  KanbanCardAction,
  KanbanCardDescriptor,
  KanbanCardMarker,
  KanbanCardRegion,
  KanbanCardRenderContext,
  KanbanCardRenderer,
  KanbanCardRow,
  KanbanCardSection,
} from './descriptor.js';
import { validateKanbanCardDescriptor } from './descriptor.js';

/** Localized bounded labels used when a renderer cannot produce a safe descriptor. */
export interface KanbanCardFallbackLabels {
  /** Title displayed instead of invalid or unavailable application content. */
  readonly invalidCardTitle: string;
  /** Status displayed instead of invalid or unavailable application content. */
  readonly unknownStatus: string;
}

/** Options for isolated renderer execution and redacted diagnostics. */
export interface KanbanSafeRenderOptions {
  /** Localized fallback labels supplied by the board locale resolver. */
  readonly labels: KanbanCardFallbackLabels;
  /** Optional sink for already-redacted package observations. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Sanitizes a fallback label and substitutes package-owned English when it becomes empty. */
function safeFallbackLabel(value: string, fallback: string): string {
  const cleaned = sanitize(value)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Clips fallback text by terminal cells without splitting a Unicode code point. */
function clipFallbackText(value: string, maximumCells: number, widthMode: WidthMode): string {
  let result = '';
  let used = 0;
  for (const character of value) {
    const width = charWidth(character.codePointAt(0) ?? 0, widthMode);
    if (used + width > maximumCells) break;
    result += character;
    used += width;
  }
  return result.length > 0 ? result : '?';
}

/** Creates a detached, deeply frozen copy of a renderer descriptor. */
function snapshotDescriptor(descriptor: KanbanCardDescriptor): KanbanCardDescriptor {
  const marker: KanbanCardMarker = Object.freeze({
    ...descriptor.marker,
    cues: Object.freeze([...descriptor.marker.cues]),
  });
  const rows: readonly KanbanCardRow[] = Object.freeze(
    descriptor.rows.map((row) =>
      Object.freeze({
        ...row,
        spans: Object.freeze(row.spans.map((span) => Object.freeze({ ...span }))),
      }),
    ),
  );
  const sections: readonly KanbanCardSection[] = Object.freeze(
    descriptor.sections.map((section) => Object.freeze({ ...section })),
  );
  const actions: readonly KanbanCardAction[] = Object.freeze(
    descriptor.actions.map((action) => Object.freeze({ ...action })),
  );
  const regions: readonly KanbanCardRegion[] = Object.freeze(
    descriptor.regions.map((region) => Object.freeze({ ...region })),
  );
  return Object.freeze({
    ...descriptor,
    marker,
    rows,
    sections,
    actions,
    regions,
    degradation: Object.freeze({
      ...descriptor.degradation,
      omittedSections: Object.freeze([...descriptor.degradation.omittedSections]),
    }),
  });
}

/**
 * Creates a pure localized descriptor that fits the supplied render budget.
 *
 * The normal supported card budget contains two rows. A one-row emergency context still receives a
 * title and remains structurally valid, while status is recorded as omitted.
 */
export function createFallbackKanbanCardDescriptor(
  context: KanbanCardRenderContext,
  labels: KanbanCardFallbackLabels,
): KanbanCardDescriptor {
  if (!Number.isSafeInteger(context.width) || context.width < 2) throw new KanbanInvalidDescriptorError();
  if (!Number.isSafeInteger(context.rowBudget) || context.rowBudget < 1) throw new KanbanInvalidDescriptorError();
  const title = clipFallbackText(
    safeFallbackLabel(labels.invalidCardTitle, 'Invalid card'),
    context.width - 1,
    context.capabilities.widthMode,
  );
  const status = clipFallbackText(
    safeFallbackLabel(labels.unknownStatus, 'Unknown status'),
    context.width - 1,
    context.capabilities.widthMode,
  );
  const includeStatus = context.rowBudget >= 2;
  const descriptor: KanbanCardDescriptor = {
    cardKey: context.cardKey,
    ...(context.presentationRevision === undefined ? {} : { presentationRevision: context.presentationRevision }),
    width: context.width,
    measuredHeight: includeStatus ? 2 : 1,
    surfaceRole: 'state.error',
    borderRole: 'state.error',
    marker: { row: 0, column: 0, glyph: '!', role: 'state.error', cues: ['rejected'] },
    rows: [
      { section: 'title', spans: [{ column: 1, text: title, role: 'content.title' }] },
      ...(includeStatus
        ? ([{ section: 'status', spans: [{ column: 1, text: status, role: 'content.status' }] }] as const)
        : []),
    ],
    sections: [
      { id: 'title', kind: 'title', startRow: 0, rowCount: 1, priority: 0 },
      ...(includeStatus ? ([{ id: 'status', kind: 'status', startRow: 1, rowCount: 1, priority: 1 }] as const) : []),
    ],
    actions: [],
    regions: [],
    degradation: {
      level: 'fallback',
      omittedSections: includeStatus ? [] : ['status'],
    },
  };
  validateKanbanCardDescriptor(descriptor, context);
  return snapshotDescriptor(descriptor);
}

/**
 * Executes one renderer behind the package's sole catch, validation, observation, and fallback boundary.
 *
 * Raw exceptions and card fields are deliberately discarded. Observer failures are contained so a
 * diagnostic integration cannot break neighboring cards.
 */
export function renderKanbanCardSafely<TCard>(
  card: TCard,
  renderer: KanbanCardRenderer<TCard>,
  context: KanbanCardRenderContext,
  options: KanbanSafeRenderOptions,
): KanbanCardDescriptor {
  try {
    const descriptor = renderer.render(card, context);
    validateKanbanCardDescriptor(descriptor, context);
    return snapshotDescriptor(descriptor);
  } catch {
    try {
      options.observe?.(
        createKanbanObservation({ code: 'card-render-failed', scope: 'renderer', cardKey: context.cardKey }),
      );
    } catch {
      // Observation is optional and must never replace the package-owned card fallback.
    }
    return createFallbackKanbanCardDescriptor(context, options.labels);
  }
}
