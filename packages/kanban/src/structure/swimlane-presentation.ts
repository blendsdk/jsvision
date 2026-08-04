import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanDisposedResourceError, KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanColumnId, createKanbanExtensionId, createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { KANBAN_THEME_ROLES } from '../card/theme.js';
import type { KanbanThemeRole } from '../card/theme.js';
import { KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH } from '../layout/width-solver.js';
import { snapshotKanbanCount } from '../source/counts.js';
import type { KanbanCount } from '../source/counts.js';
import type {
  KanbanCustomSwimlanePresentation,
  KanbanSwimlanePresentationContext,
  KanbanSwimlanePresentationInput,
  KanbanSwimlanePresentationVariant,
} from './policy.js';
import type { KanbanGroupingSummary } from './grouping.js';

/** Semantic content shared unchanged by every swimlane chrome strategy. */
export interface KanbanSwimlanePresentationSemantic {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: string;
  /** Sanitized visible label. */
  readonly label: string;
  /** Equality-only visible presentation revision. */
  readonly revision: KanbanRevision;
  /** Optional honest aggregate count. */
  readonly count?: KanbanCount;
  /** Optional bounded numeric/text summary. */
  readonly summary?: KanbanGroupingSummary;
}

/** One responsive card-column allocation after optional rail reservation. */
export interface KanbanSwimlanePresentationColumn {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Cells remaining for this card column. */
  readonly availableWidth: number;
}

/** Input constraint for one responsive card column. */
export interface KanbanSwimlanePresentationColumnInput {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Effective minimum width that presentation must preserve. */
  readonly minimumWidth: number;
}

/** Bounded custom header region that never creates card or drop targets. */
export interface KanbanSwimlaneChromeRegion {
  /** Left cell relative to the swimlane chrome. */
  readonly x: number;
  /** Top row relative to the swimlane chrome. */
  readonly y: number;
  /** Positive region width. */
  readonly width: number;
  /** Positive region height. */
  readonly height: number;
}

/** One validated application header action. */
export interface KanbanSwimlaneChromeAction {
  /** Dotted application extension identity. */
  readonly actionId: string;
}

/** Complete bounded renderer-neutral custom swimlane chrome descriptor. */
export interface KanbanSwimlaneChromeDescriptor {
  /** Rows occupied by the header/separator region. */
  readonly rows: number;
  /** Optional left label rail width. */
  readonly railWidth: number;
  /** Sanitized bounded display fragments. */
  readonly text: readonly string[];
  /** Allowlisted semantic roles used by the descriptor. */
  readonly roles: readonly KanbanThemeRole[];
  /** Bounded header-only regions. */
  readonly regions: readonly KanbanSwimlaneChromeRegion[];
  /** Bounded application header actions. */
  readonly actions: readonly KanbanSwimlaneChromeAction[];
}

/** Built-in or validated custom chrome selected for one semantic swimlane. */
export type KanbanResolvedSwimlaneChrome =
  | {
      readonly kind: KanbanSwimlanePresentationVariant;
      readonly rows: 1;
      readonly fill: boolean;
      readonly railWidth: number;
    }
  | { readonly kind: 'custom'; readonly descriptor: KanbanSwimlaneChromeDescriptor };

/** Immutable result of one swimlane presentation resolution. */
export interface ResolvedKanbanSwimlanePresentation {
  /** Requested built-in name or `custom`. */
  readonly requestedVariant: KanbanSwimlanePresentationVariant | 'custom';
  /** Effective built-in/custom strategy after responsive or safety fallback. */
  readonly resolvedVariant: KanbanSwimlanePresentationVariant | 'custom';
  /** Whether responsive geometry changed the requested strategy. */
  readonly degraded: boolean;
  /** Local fallback reason for rejected custom chrome. */
  readonly fallback?: 'invalid-custom';
  /** Presentation-independent semantic content. */
  readonly semantic: KanbanSwimlanePresentationSemantic;
  /** Effective renderer-neutral chrome. */
  readonly chrome: KanbanResolvedSwimlaneChrome;
  /** Responsive card-column widths after effective rail reservation. */
  readonly columns: readonly KanbanSwimlanePresentationColumn[];
}

/** Inputs to one built-in or custom swimlane presentation resolution. */
export interface ResolveKanbanSwimlanePresentationInput {
  /** Built-in variant or bounded custom producer. */
  readonly presentation: KanbanSwimlanePresentationInput;
  /** Semantic content shared by every variant. */
  readonly swimlane: KanbanSwimlanePresentationSemantic;
  /** Total horizontal cells assigned to the swimlane region. */
  readonly availableWidth: number;
  /** Visible workflow-column minimums. */
  readonly columns: readonly KanbanSwimlanePresentationColumnInput[];
  /** Requested rail width; defaults to ten cells. */
  readonly railWidth?: number;
}

/** Disposable per-board resolver that caches custom callbacks by visible presentation revision. */
export interface KanbanSwimlanePresentationResolver {
  /** Resolves one immutable presentation snapshot. */
  resolve(input: ResolveKanbanSwimlanePresentationInput): ResolvedKanbanSwimlanePresentation;
  /** Releases cached custom results idempotently. */
  dispose(): void;
}

/** Optional resolver diagnostics. */
export interface KanbanSwimlanePresentationResolverOptions {
  /** Sink for already-redacted custom descriptor failures. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Exact semantic input members. */
const SEMANTIC_KEYS = new Set(['swimlaneId', 'label', 'revision', 'count', 'summary']);
/** Exact summary members. */
const SUMMARY_KEYS = new Set(['count', 'label']);
/** Exact column input members. */
const COLUMN_KEYS = new Set(['columnId', 'minimumWidth']);
/** Exact custom descriptor members; target injection is deliberately absent. */
const DESCRIPTOR_KEYS = new Set(['rows', 'railWidth', 'text', 'roles', 'regions', 'actions']);
/** Exact custom region members. */
const REGION_KEYS = new Set(['x', 'y', 'width', 'height']);
/** Exact custom action members. */
const ACTION_KEYS = new Set(['actionId']);
/** Allowlisted semantic theme roles. */
const THEME_ROLES = new Set<KanbanThemeRole>(KANBAN_THEME_ROLES);
/** ANSI control sequences removed as a unit from custom text. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;
/** Bidirectional controls removed before custom text reaches terminal layout. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Raises the payload-free custom descriptor error used for local fallback. */
function invalidDescriptor(): never {
  throw new KanbanInvalidDescriptorError();
}

/** Returns one non-negative safe integer within a fixed presentation ceiling. */
function boundedInteger(value: unknown, maximum: number, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) {
    return invalidDescriptor();
  }
  return value;
}

/** Sanitizes one non-empty bounded display fragment. */
function safeText(value: unknown): string {
  if (typeof value !== 'string') return invalidDescriptor();
  const text = sanitizeContractText(
    value.replace(ANSI_CONTROL_SEQUENCE, '').replace(BIDI_CONTROLS, ''),
    KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorTextBytes,
  )
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  return text.length === 0 ? invalidDescriptor() : text;
}

/** Snapshots presentation-independent semantic content. */
function semantic(value: unknown): KanbanSwimlanePresentationSemantic {
  const properties = snapshotKanbanDataProperties(value, SEMANTIC_KEYS.size);
  validateKanbanDataKeys(properties, SEMANTIC_KEYS);
  if (typeof properties.swimlaneId !== 'string') return invalidDescriptor();
  let summary: KanbanGroupingSummary | undefined;
  if (properties.summary !== undefined) {
    const summaryProperties = snapshotKanbanDataProperties(properties.summary, SUMMARY_KEYS.size);
    validateKanbanDataKeys(summaryProperties, SUMMARY_KEYS);
    summary = Object.freeze({
      count: boundedInteger(summaryProperties.count, Number.MAX_SAFE_INTEGER),
      label: safeText(summaryProperties.label),
    });
  }
  try {
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
      label: safeText(properties.label),
      revision: snapshotKanbanRevision(properties.revision),
      ...(properties.count === undefined ? {} : { count: snapshotKanbanCount(properties.count) }),
      ...(summary === undefined ? {} : { summary }),
    });
  } catch {
    return invalidDescriptor();
  }
}

/** Snapshots visible column constraints and rejects duplicate identities. */
function columns(value: unknown): readonly KanbanSwimlanePresentationColumnInput[] {
  const result = snapshotKanbanDataArray(value, 1_024).map((entry) => {
    const properties = snapshotKanbanDataProperties(entry, COLUMN_KEYS.size);
    validateKanbanDataKeys(properties, COLUMN_KEYS);
    if (typeof properties.columnId !== 'string') return invalidDescriptor();
    try {
      return Object.freeze({
        columnId: createKanbanColumnId(properties.columnId),
        minimumWidth: boundedInteger(
          properties.minimumWidth,
          KANBAN_STRUCTURE_PRESENTATION_LIMITS.columnWidthCells,
          true,
        ),
      });
    } catch {
      return invalidDescriptor();
    }
  });
  if (result.length === 0 || new Set(result.map((entry) => entry.columnId)).size !== result.length) {
    return invalidDescriptor();
  }
  return Object.freeze(result);
}

/** Allocates equal card-column widths after an optional rail reservation. */
function allocateColumns(
  source: readonly KanbanSwimlanePresentationColumnInput[],
  availableWidth: number,
  railWidth: number,
): readonly KanbanSwimlanePresentationColumn[] {
  const cardWidth = Math.floor((availableWidth - railWidth) / source.length);
  if (cardWidth < 0) return invalidDescriptor();
  return Object.freeze(source.map((column) => Object.freeze({ columnId: column.columnId, availableWidth: cardWidth })));
}

/** Creates one immutable built-in chrome descriptor. */
function builtInChrome(variant: KanbanSwimlanePresentationVariant, railWidth: number): KanbanResolvedSwimlaneChrome {
  return Object.freeze({
    kind: variant,
    rows: 1,
    fill: variant === 'hybrid' || variant === 'band',
    railWidth: variant === 'rail' ? railWidth : 0,
  });
}

/** Snapshots one bounded custom region within the chrome rectangle. */
function region(value: unknown, width: number, rows: number): KanbanSwimlaneChromeRegion {
  const properties = snapshotKanbanDataProperties(value, REGION_KEYS.size);
  validateKanbanDataKeys(properties, REGION_KEYS);
  const x = boundedInteger(properties.x, width);
  const y = boundedInteger(properties.y, rows);
  const regionWidth = boundedInteger(properties.width, width, true);
  const regionHeight = boundedInteger(properties.height, rows, true);
  if (x + regionWidth > width || y + regionHeight > rows) return invalidDescriptor();
  return Object.freeze({ x, y, width: regionWidth, height: regionHeight });
}

/** Snapshots one dotted application header action. */
function action(value: unknown): KanbanSwimlaneChromeAction {
  const properties = snapshotKanbanDataProperties(value, ACTION_KEYS.size);
  validateKanbanDataKeys(properties, ACTION_KEYS);
  if (typeof properties.actionId !== 'string') return invalidDescriptor();
  try {
    return Object.freeze({ actionId: createKanbanExtensionId(properties.actionId) });
  } catch {
    return invalidDescriptor();
  }
}

/** Validates all geometry, text, role, region, and action dimensions of custom chrome. */
function customDescriptor(value: unknown, availableWidth: number): KanbanSwimlaneChromeDescriptor {
  const properties = snapshotKanbanDataProperties(value, DESCRIPTOR_KEYS.size);
  validateKanbanDataKeys(properties, DESCRIPTOR_KEYS);
  if (Object.keys(properties).length !== DESCRIPTOR_KEYS.size) return invalidDescriptor();
  const rows = boundedInteger(properties.rows, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRows, true);
  const railWidth = boundedInteger(properties.railWidth, KANBAN_STRUCTURE_PRESENTATION_LIMITS.railWidth);
  if (railWidth > availableWidth) return invalidDescriptor();
  const text = Object.freeze(
    snapshotKanbanDataArray(properties.text, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRegions).map(safeText),
  );
  if (new TextEncoder().encode(text.join('')).byteLength > KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorTextBytes) {
    return invalidDescriptor();
  }
  const roles = Object.freeze(
    snapshotKanbanDataArray(properties.roles, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRoles).map((entry) => {
      if (typeof entry !== 'string' || !THEME_ROLES.has(entry as KanbanThemeRole)) return invalidDescriptor();
      return entry as KanbanThemeRole;
    }),
  );
  const regions = Object.freeze(
    snapshotKanbanDataArray(properties.regions, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRegions).map((entry) =>
      region(entry, availableWidth, rows),
    ),
  );
  const actions = Object.freeze(
    snapshotKanbanDataArray(properties.actions, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorActions).map(action),
  );
  return Object.freeze({ rows, railWidth, text, roles, regions, actions });
}

/** Creates a collision-safe cache key preserving numeric/string revision distinction. */
function cacheKey(
  presentation: KanbanCustomSwimlanePresentation,
  swimlane: KanbanSwimlanePresentationSemantic,
): string {
  return JSON.stringify([
    'kanban-swimlane-presentation',
    swimlane.swimlaneId,
    typeof swimlane.revision,
    swimlane.revision,
    typeof presentation.revision,
    presentation.revision,
  ]);
}

/** Emits one payload-free custom fallback observation without trusting the sink. */
function observeFallback(observe: KanbanSwimlanePresentationResolverOptions['observe']): void {
  if (observe === undefined) return;
  try {
    observe(createKanbanObservation({ code: 'swimlane-descriptor-invalid', scope: 'renderer' }));
  } catch {
    // Diagnostics cannot alter the deterministic local fallback.
  }
}

/** Creates one standard fallback result for invalid custom chrome. */
function customFallback(
  semanticValue: KanbanSwimlanePresentationSemantic,
  sourceColumns: readonly KanbanSwimlanePresentationColumnInput[],
  availableWidth: number,
): ResolvedKanbanSwimlanePresentation {
  return Object.freeze({
    requestedVariant: 'custom',
    resolvedVariant: 'hybrid',
    degraded: true,
    fallback: 'invalid-custom',
    semantic: semanticValue,
    chrome: builtInChrome('hybrid', 0),
    columns: allocateColumns(sourceColumns, availableWidth, 0),
  });
}

/**
 * Creates a disposable resolver for built-in and bounded custom swimlane presentation.
 *
 * @example
 * ```ts
 * const resolver = createKanbanSwimlanePresentationResolver();
 * ```
 */
export function createKanbanSwimlanePresentationResolver(
  options: KanbanSwimlanePresentationResolverOptions = {},
): KanbanSwimlanePresentationResolver {
  const customCache = new Map<string, ResolvedKanbanSwimlanePresentation>();
  let disposed = false;
  return Object.freeze({
    resolve(input: ResolveKanbanSwimlanePresentationInput): ResolvedKanbanSwimlanePresentation {
      if (disposed) throw new KanbanDisposedResourceError();
      const availableWidth = boundedInteger(input.availableWidth, Number.MAX_SAFE_INTEGER, true);
      const semanticValue = semantic(input.swimlane);
      const sourceColumns = columns(input.columns);
      const railWidth = boundedInteger(input.railWidth ?? 10, KANBAN_STRUCTURE_PRESENTATION_LIMITS.railWidth);
      if (typeof input.presentation === 'string') {
        const requested = input.presentation;
        if (requested !== 'hybrid' && requested !== 'separator' && requested !== 'band' && requested !== 'rail') {
          return invalidDescriptor();
        }
        const railColumns = allocateColumns(sourceColumns, availableWidth, requested === 'rail' ? railWidth : 0);
        const railFits = railColumns.every(
          (column, index) =>
            column.availableWidth >= (sourceColumns[index]?.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH),
        );
        const resolved = requested === 'rail' && !railFits ? 'hybrid' : requested;
        const resolvedRailWidth = resolved === 'rail' ? railWidth : 0;
        return Object.freeze({
          requestedVariant: requested,
          resolvedVariant: resolved,
          degraded: resolved !== requested,
          semantic: semanticValue,
          chrome: builtInChrome(resolved, resolvedRailWidth),
          columns: allocateColumns(sourceColumns, availableWidth, resolvedRailWidth),
        });
      }
      const key = cacheKey(input.presentation, semanticValue);
      const cached = customCache.get(key);
      if (cached !== undefined) return cached;
      let result: ResolvedKanbanSwimlanePresentation;
      try {
        const context: KanbanSwimlanePresentationContext = Object.freeze({
          swimlaneId: semanticValue.swimlaneId,
          label: semanticValue.label,
          revision: semanticValue.revision,
          availableWidth,
        });
        const descriptor = customDescriptor(input.presentation.render(context), availableWidth);
        result = Object.freeze({
          requestedVariant: 'custom',
          resolvedVariant: 'custom',
          degraded: false,
          semantic: semanticValue,
          chrome: Object.freeze({ kind: 'custom', descriptor }),
          columns: allocateColumns(sourceColumns, availableWidth, descriptor.railWidth),
        });
        if (
          result.columns.some(
            (column, index) =>
              column.availableWidth < (sourceColumns[index]?.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH),
          )
        ) {
          throw new KanbanInvalidDescriptorError();
        }
      } catch {
        observeFallback(options.observe);
        result = customFallback(semanticValue, sourceColumns, availableWidth);
      }
      customCache.set(key, result);
      return result;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      customCache.clear();
    },
  });
}
