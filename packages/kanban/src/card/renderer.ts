import { charWidth, sanitize } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
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

/** Bidirectional formatting controls removed from localized fallback labels. */
const BIDI_CONTROL_CHARACTERS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Sanitizes a bounded fallback label and substitutes package-owned English when it becomes empty. */
function safeFallbackLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const encoder = new TextEncoder();
  let bounded = '';
  let encodedBytes = 0;
  for (const character of value.slice(0, KANBAN_LIMITS.semanticStringBytes.safe)) {
    const characterBytes = encoder.encode(character).byteLength;
    if (encodedBytes + characterBytes > KANBAN_LIMITS.semanticStringBytes.safe) break;
    bounded += character;
    encodedBytes += characterBytes;
  }
  const cleaned = sanitize(bounded)
    .replace(BIDI_CONTROL_CHARACTERS, '')
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Reads one fallback label without invoking caller accessors. */
function readFallbackLabel(
  labels: KanbanCardFallbackLabels,
  key: keyof KanbanCardFallbackLabels,
  fallback: string,
): string {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(labels, key);
    return descriptor !== undefined && 'value' in descriptor ? safeFallbackLabel(descriptor.value, fallback) : fallback;
  } catch {
    return fallback;
  }
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
  return result.length > 0 && used > 0 ? result : '?';
}

/** Copies a caller-owned array by numeric index without invoking its replaceable iterator or methods. */
function copyBoundedArray<TInput, TOutput>(
  source: readonly TInput[],
  maximum: number,
  copy: (value: TInput) => TOutput,
): readonly TOutput[] {
  if (!Array.isArray(source)) throw new KanbanInvalidDescriptorError();
  const length = source.length;
  if (length > maximum) throw new KanbanInvalidDescriptorError();
  const result: TOutput[] = [];
  for (let index = 0; index < length; index += 1) result.push(copy(source[index]!));
  return Object.freeze(result);
}

/** Creates a detached, deeply frozen copy of a renderer descriptor. */
function snapshotDescriptor(descriptor: KanbanCardDescriptor): KanbanCardDescriptor {
  const sourceMarker = descriptor.marker;
  const sourceCues = sourceMarker.cues;
  const cues = copyBoundedArray(sourceCues, 6, (cue) => cue);
  const marker: KanbanCardMarker = Object.freeze({
    row: sourceMarker.row,
    column: sourceMarker.column,
    glyph: sourceMarker.glyph,
    role: sourceMarker.role,
    cues,
  });
  const sourceRows = descriptor.rows;
  const rows: readonly KanbanCardRow[] = copyBoundedArray(sourceRows, KANBAN_LIMITS.descriptorRows.absolute, (row) => {
    const sourceSpans = row.spans;
    return Object.freeze({
      section: row.section,
      spans: copyBoundedArray(sourceSpans, KANBAN_LIMITS.cardFields.safe, (span) =>
        Object.freeze({ column: span.column, text: span.text, role: span.role }),
      ),
    });
  });
  const sourceSections = descriptor.sections;
  const sections: readonly KanbanCardSection[] = copyBoundedArray(
    sourceSections,
    KANBAN_LIMITS.descriptorRows.absolute,
    (section) =>
      Object.freeze({
        id: section.id,
        kind: section.kind,
        startRow: section.startRow,
        rowCount: section.rowCount,
        priority: section.priority,
      }),
  );
  const sourceActions = descriptor.actions;
  const actions: readonly KanbanCardAction[] = copyBoundedArray(
    sourceActions,
    KANBAN_LIMITS.cardFields.safe,
    (action) => Object.freeze({ actionId: action.actionId, label: action.label, enabled: action.enabled }),
  );
  const sourceRegions = descriptor.regions;
  const regions: readonly KanbanCardRegion[] = copyBoundedArray(
    sourceRegions,
    KANBAN_LIMITS.cardFields.safe,
    (region) => {
      const actionId = region.actionId;
      return Object.freeze({
        regionId: region.regionId,
        kind: region.kind,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        ...(actionId === undefined ? {} : { actionId }),
      });
    },
  );
  const sourceDegradation = descriptor.degradation;
  const sourceOmittedSections = sourceDegradation.omittedSections;
  const omittedSections = copyBoundedArray(sourceOmittedSections, 9, (section) => section);
  const presentationRevision = descriptor.presentationRevision;
  return Object.freeze({
    cardKey: descriptor.cardKey,
    ...(presentationRevision === undefined ? {} : { presentationRevision }),
    width: descriptor.width,
    measuredHeight: descriptor.measuredHeight,
    surfaceRole: descriptor.surfaceRole,
    borderRole: descriptor.borderRole,
    marker,
    rows,
    sections,
    actions,
    regions,
    degradation: Object.freeze({
      level: sourceDegradation.level,
      omittedSections,
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
    readFallbackLabel(labels, 'invalidCardTitle', 'Invalid card'),
    context.width - 1,
    context.capabilities.widthMode,
  );
  const status = clipFallbackText(
    readFallbackLabel(labels, 'unknownStatus', 'Unknown status'),
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
    const descriptor = snapshotDescriptor(renderer.render(card, context));
    validateKanbanCardDescriptor(descriptor, context);
    return descriptor;
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
