import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidPresentationError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanFieldId, createKanbanSwimlaneId } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { KANBAN_THEME_ROLES } from '../card/theme.js';
import type { KanbanThemeRole } from '../card/theme.js';
import { snapshotKanbanQuery } from '../source/validation.js';
import type { KanbanStructureStyle, KanbanSwimlaneMeta } from '../source/types.js';
import { snapshotKanbanGroupingPolicy } from './policy.js';
import type { KanbanGroupingPolicy } from './policy.js';

/** One application-owned numeric/text summary associated with a semantic swimlane. */
export interface KanbanGroupingSummary {
  /** Non-negative safe aggregate. */
  readonly count: number;
  /** Sanitized compact summary label. */
  readonly label: string;
}

/** Registered pure derived grouping behavior for one field. */
export interface KanbanGroupingRegistryEntry<TCard> {
  /** Field selected by `KanbanQuery.groupBy`. */
  readonly fieldId: KanbanFieldId;
  /** Ordered semantic groups known by the resolver. */
  readonly groups: readonly KanbanSwimlaneMeta[];
  /** Resolves one card to a semantic group, or no value when it is unassigned. */
  readonly resolve: (card: TCard) => string | undefined;
  /** Optional semantic style resolver isolated per group. */
  readonly styleOf?: (group: KanbanSwimlaneMeta) => KanbanStructureStyle | undefined;
  /** Optional numeric summary resolver isolated per group. */
  readonly summaryOf?: (group: KanbanSwimlaneMeta) => KanbanGroupingSummary | undefined;
}

/** One explicit application-published card-to-swimlane membership. */
export interface KanbanExplicitGroupingMembership {
  /** Stable application card identity. */
  readonly cardKey: CardKey;
  /** Semantic group identity; omission means unassigned. */
  readonly swimlaneId?: string;
}

/** Explicit ordered groups and memberships from an authoritative source. */
export interface KanbanExplicitGrouping {
  /** Ordered semantic swimlane metadata. */
  readonly groups: readonly KanbanSwimlaneMeta[];
  /** Card memberships independent of view visibility. */
  readonly memberships: readonly KanbanExplicitGroupingMembership[];
}

/** Resolved card membership in one semantic swimlane address. */
export interface KanbanResolvedGroupingMembership {
  /** Stable application card identity. */
  readonly cardKey: CardKey;
  /** One-dimensional semantic grouping address. */
  readonly address: { readonly swimlaneId: string };
}

/** Semantic swimlane metadata after safe label, style, summary, and view-state projection. */
export interface KanbanResolvedGroupingMeta extends KanbanSwimlaneMeta {
  /** Optional visible duplicate-label distinction. */
  readonly disambiguator?: string;
  /** Whether the group participates in the visible scene. */
  readonly visibility: 'visible' | 'hidden';
  /** Whether retained chrome suppresses ordinary card regions. */
  readonly collapse: 'expanded' | 'collapsed';
  /** Optional allowlisted semantic style. */
  readonly style?: KanbanStructureStyle;
  /** Optional bounded application summary. */
  readonly summary?: KanbanGroupingSummary;
}

/** Normalized result when the query does not select a grouping field. */
export interface KanbanUngroupedResult {
  /** Structural discriminator. */
  readonly kind: 'none';
  /** Explicit absence retained for inspection. */
  readonly activeFieldId: undefined;
  /** No semantic swimlane groups. */
  readonly groups: readonly [];
  /** No swimlane memberships. */
  readonly memberships: readonly [];
}

/** Normalized visible and detached grouping projection. */
export interface KanbanGroupedResult {
  /** Structural discriminator. */
  readonly kind: 'grouped';
  /** Sole field selected by the validated query. */
  readonly activeFieldId: KanbanFieldId;
  /** Ordered groups participating in the visible scene. */
  readonly groups: readonly KanbanResolvedGroupingMeta[];
  /** Visible card memberships. */
  readonly memberships: readonly KanbanResolvedGroupingMembership[];
  /** Complete semantic groups and memberships before visibility projection. */
  readonly detached: {
    readonly groups: readonly KanbanResolvedGroupingMeta[];
    readonly memberships: readonly KanbanResolvedGroupingMembership[];
  };
}

/** Complete pure grouping result. */
export type KanbanGroupingResult = KanbanUngroupedResult | KanbanGroupedResult;

/** Inputs to query-owned explicit or derived grouping normalization. */
export interface ResolveKanbanGroupingInput<TCard> {
  /** Untyped query boundary; validation rejects competing grouping fields atomically. */
  readonly query: unknown;
  /** Application cards read without mutation. */
  readonly cards: readonly TCard[];
  /** Policy that must name the same active query field. */
  readonly policy?: KanbanGroupingPolicy<TCard>;
  /** Registered derived resolvers keyed by field identity. */
  readonly registry?: readonly KanbanGroupingRegistryEntry<TCard>[];
  /** Optional authoritative explicit groups and memberships. */
  readonly explicit?: KanbanExplicitGrouping;
  /** Previous immutable result retained by the caller on rejection. */
  readonly previous?: KanbanGroupingResult;
  /** Optional sink for already-redacted local fallback observations. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Empty frozen arrays shared by the ungrouped result. */
const EMPTY: readonly [] = Object.freeze([]);
/** Canonical deeply frozen no-grouping result. */
const UNGROUPED: KanbanUngroupedResult = Object.freeze({
  kind: 'none',
  activeFieldId: undefined,
  groups: EMPTY,
  memberships: EMPTY,
});
/** Exact registry entry members. */
const REGISTRY_KEYS = new Set(['fieldId', 'groups', 'resolve', 'styleOf', 'summaryOf']);
/** Exact explicit grouping members. */
const EXPLICIT_KEYS = new Set(['groups', 'memberships']);
/** Exact explicit membership members. */
const MEMBERSHIP_KEYS = new Set(['cardKey', 'swimlaneId']);
/** Exact swimlane metadata members. */
const SWIMLANE_KEYS = new Set(['swimlaneId', 'label', 'revision']);
/** Exact style members. */
const STYLE_KEYS = new Set(['role']);
/** Exact summary members. */
const SUMMARY_KEYS = new Set(['count', 'label']);
/** Allowlisted semantic theme roles. */
const THEME_ROLES = new Set<KanbanThemeRole>(KANBAN_THEME_ROLES);
/** ANSI control sequences removed as a unit from structural display text. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;
/** Bidirectional controls removed before structural labels reach terminal layout. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Converts malformed grouping input into one payload-free public error. */
function invalidGrouping(): never {
  throw new KanbanInvalidPresentationError();
}

/** Sanitizes one required structural display label. */
function safeLabel(value: unknown): string {
  if (typeof value !== 'string') return invalidGrouping();
  const label = sanitizeContractText(
    value.replace(ANSI_CONTROL_SEQUENCE, '').replace(BIDI_CONTROLS, ''),
    KANBAN_LIMITS.semanticStringBytes.safe,
  )
    .replace(/[\t\n]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return label.length === 0 ? invalidGrouping() : label;
}

/** Creates the case-insensitive normalized label used only for collision detection. */
function normalizedLabel(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

/** Snapshots one ordered semantic swimlane metadata record. */
function swimlaneMeta(value: unknown): KanbanSwimlaneMeta {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_KEYS);
  if (typeof properties.swimlaneId !== 'string') return invalidGrouping();
  try {
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
      label: safeLabel(properties.label),
      revision: snapshotKanbanRevision(properties.revision),
    });
  } catch {
    return invalidGrouping();
  }
}

/** Snapshots an ordered unique group list. */
function groupList(value: unknown): readonly KanbanSwimlaneMeta[] {
  const groups = snapshotKanbanDataArray(value, KANBAN_LIMITS.swimlanes.safe).map(swimlaneMeta);
  if (new Set(groups.map((group) => group.swimlaneId)).size !== groups.length) return invalidGrouping();
  return Object.freeze(groups);
}

/** Resolves a card identity through policy or its conventional own `id` data property. */
function cardKeyOf<TCard>(card: TCard, policy: KanbanGroupingPolicy<TCard>): CardKey {
  if (policy.cardKeyOf !== undefined) return policy.cardKeyOf(card);
  if (typeof card !== 'object' || card === null) return invalidGrouping();
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(card, 'id');
  } catch {
    return invalidGrouping();
  }
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) return invalidGrouping();
  const value: unknown = descriptor?.value;
  if (typeof value !== 'string' && typeof value !== 'number') return invalidGrouping();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidGrouping();
  }
}

/** Snapshots explicit membership records keyed by card identity. */
function explicitMemberships(value: unknown): ReadonlyMap<CardKey, string | undefined> {
  const result = new Map<CardKey, string | undefined>();
  for (const entry of snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.safe)) {
    const properties = snapshotKanbanDataProperties(entry, MEMBERSHIP_KEYS.size);
    validateKanbanDataKeys(properties, MEMBERSHIP_KEYS);
    if (
      (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') ||
      (properties.swimlaneId !== undefined && typeof properties.swimlaneId !== 'string')
    ) {
      return invalidGrouping();
    }
    let cardKey: CardKey;
    let swimlaneId: string | undefined;
    try {
      cardKey = createKanbanCardKey(properties.cardKey);
      swimlaneId = properties.swimlaneId === undefined ? undefined : createKanbanSwimlaneId(properties.swimlaneId);
    } catch {
      return invalidGrouping();
    }
    if (result.has(cardKey)) return invalidGrouping();
    result.set(cardKey, swimlaneId);
  }
  return result;
}

/** Snapshots an explicit grouping publication. */
function explicitGrouping(value: unknown): {
  readonly groups: readonly KanbanSwimlaneMeta[];
  readonly memberships: ReadonlyMap<CardKey, string | undefined>;
} {
  const properties = snapshotKanbanDataProperties(value, EXPLICIT_KEYS.size);
  validateKanbanDataKeys(properties, EXPLICIT_KEYS);
  return Object.freeze({
    groups: groupList(properties.groups),
    memberships: explicitMemberships(properties.memberships),
  });
}

/** Snapshots one registry entry while wrapping callbacks through `Reflect.apply`. */
function registryEntry<TCard>(value: unknown): KanbanGroupingRegistryEntry<TCard> {
  const properties = snapshotKanbanDataProperties(value, REGISTRY_KEYS.size);
  validateKanbanDataKeys(properties, REGISTRY_KEYS);
  if (
    typeof properties.fieldId !== 'string' ||
    typeof properties.resolve !== 'function' ||
    (properties.styleOf !== undefined && typeof properties.styleOf !== 'function') ||
    (properties.summaryOf !== undefined && typeof properties.summaryOf !== 'function')
  ) {
    return invalidGrouping();
  }
  const resolveCallback = properties.resolve;
  const styleCallback = properties.styleOf;
  const summaryCallback = properties.summaryOf;
  try {
    return Object.freeze({
      fieldId: createKanbanFieldId(properties.fieldId),
      groups: groupList(properties.groups),
      resolve: (card: TCard): string | undefined => {
        const result: unknown = Reflect.apply(resolveCallback, undefined, [card]);
        if (result !== undefined && typeof result !== 'string') return invalidGrouping();
        return result;
      },
      ...(styleCallback === undefined
        ? {}
        : {
            styleOf: (group: KanbanSwimlaneMeta): KanbanStructureStyle | undefined =>
              Reflect.apply(styleCallback, undefined, [group]),
          }),
      ...(summaryCallback === undefined
        ? {}
        : {
            summaryOf: (group: KanbanSwimlaneMeta): KanbanGroupingSummary | undefined =>
              Reflect.apply(summaryCallback, undefined, [group]),
          }),
    });
  } catch {
    return invalidGrouping();
  }
}

/** Snapshots the registry and rejects duplicate field identities. */
function registry<TCard>(value: unknown): readonly KanbanGroupingRegistryEntry<TCard>[] {
  const entries = snapshotKanbanDataArray(value ?? [], KANBAN_LIMITS.cardFields.safe).map((entry) =>
    registryEntry<TCard>(entry),
  );
  if (new Set(entries.map((entry) => entry.fieldId)).size !== entries.length) return invalidGrouping();
  return Object.freeze(entries);
}

/** Emits one payload-free local-fallback observation without trusting the sink. */
function observeFailure(observe: ResolveKanbanGroupingInput<unknown>['observe'], code: string): void {
  if (observe === undefined) return;
  try {
    observe(createKanbanObservation({ code, scope: 'renderer' }));
  } catch {
    // Diagnostics never affect grouping semantics.
  }
}

/** Validates a style resolver result. */
function resolvedStyle(value: unknown): KanbanStructureStyle | undefined {
  if (value === undefined) return undefined;
  const properties = snapshotKanbanDataProperties(value, STYLE_KEYS.size);
  validateKanbanDataKeys(properties, STYLE_KEYS);
  if (typeof properties.role !== 'string' || !THEME_ROLES.has(properties.role as KanbanThemeRole)) {
    return invalidGrouping();
  }
  return Object.freeze({ role: properties.role as KanbanThemeRole });
}

/** Validates a summary resolver result. */
function resolvedSummary(value: unknown): KanbanGroupingSummary | undefined {
  if (value === undefined) return undefined;
  const properties = snapshotKanbanDataProperties(value, SUMMARY_KEYS.size);
  validateKanbanDataKeys(properties, SUMMARY_KEYS);
  if (typeof properties.count !== 'number' || !Number.isSafeInteger(properties.count) || properties.count < 0) {
    return invalidGrouping();
  }
  return Object.freeze({ count: properties.count, label: safeLabel(properties.label) });
}

/** Applies isolated style and summary callbacks to one semantic group. */
function enrichGroup<TCard>(
  group: KanbanSwimlaneMeta,
  entry: KanbanGroupingRegistryEntry<TCard> | undefined,
  policy: KanbanGroupingPolicy<TCard>,
  observe: ResolveKanbanGroupingInput<TCard>['observe'],
): KanbanResolvedGroupingMeta {
  let style: KanbanStructureStyle | undefined;
  let summary: KanbanGroupingSummary | undefined;
  try {
    style = resolvedStyle(entry?.styleOf?.(group));
  } catch {
    observeFailure(observe, 'group-style-resolver-failed');
  }
  try {
    summary = resolvedSummary(entry?.summaryOf?.(group));
  } catch {
    observeFailure(observe, 'group-summary-resolver-failed');
  }
  const visible = policy.visibleSwimlaneIds === undefined || policy.visibleSwimlaneIds.includes(group.swimlaneId);
  const collapsed = policy.collapsedSwimlaneIds?.includes(group.swimlaneId) === true;
  const disambiguator = policy.disambiguators?.[group.swimlaneId];
  return Object.freeze({
    ...group,
    ...(disambiguator === undefined ? {} : { disambiguator }),
    visibility: visible ? 'visible' : 'hidden',
    collapse: collapsed ? 'collapsed' : 'expanded',
    ...(style === undefined ? {} : { style }),
    ...(summary === undefined ? {} : { summary }),
  });
}

/** Verifies normalized-label collisions and required visible disambiguators. */
function validateDuplicateLabels<TCard>(
  groups: readonly KanbanSwimlaneMeta[],
  policy: KanbanGroupingPolicy<TCard>,
): void {
  const collisions = new Map<string, KanbanSwimlaneMeta[]>();
  for (const group of groups) {
    const key = normalizedLabel(group.label);
    const members = collisions.get(key) ?? [];
    members.push(group);
    collisions.set(key, members);
  }
  for (const members of collisions.values()) {
    if (members.length < 2) continue;
    if (policy.allowDuplicateLabels !== true) invalidGrouping();
    const labels: string[] = [];
    for (const group of members) {
      const label = policy.disambiguators?.[group.swimlaneId];
      if (label === undefined) invalidGrouping();
      labels.push(normalizedLabel(label));
    }
    if (new Set(labels).size !== members.length) invalidGrouping();
  }
}

/** Applies an optional semantic group order while retaining unspecified source order. */
function orderGroups<TCard>(
  groups: readonly KanbanSwimlaneMeta[],
  policy: KanbanGroupingPolicy<TCard>,
): readonly KanbanSwimlaneMeta[] {
  if (policy.order === undefined) return groups;
  const rank = new Map(policy.order.map((id, index) => [id, index]));
  return Object.freeze(
    groups
      .map((group, index) => ({ group, index }))
      .sort(
        (left, right) =>
          (rank.get(left.group.swimlaneId) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(right.group.swimlaneId) ?? Number.MAX_SAFE_INTEGER) || left.index - right.index,
      )
      .map(({ group }) => group),
  );
}

/**
 * Resolves zero-or-one query-owned grouping into visible and detached immutable membership.
 *
 * @example
 * ```ts
 * const result = resolveKanbanGrouping({ query: {}, cards: [] });
 * ```
 */
export function resolveKanbanGrouping<TCard>(input: ResolveKanbanGroupingInput<TCard>): KanbanGroupingResult {
  const query = snapshotKanbanQuery(input.query);
  if (query.groupBy === undefined) return UNGROUPED;
  if (
    !Array.isArray(input.cards) ||
    input.cards.length > KANBAN_LIMITS.selectedKeys.safe ||
    input.policy === undefined
  ) {
    return invalidGrouping();
  }
  const policy = snapshotKanbanGroupingPolicy<TCard>(input.policy);
  if (policy.fieldId !== query.groupBy) return invalidGrouping();
  const entries = registry<TCard>(input.registry ?? []);
  const activeEntry = entries.find((entry) => entry.fieldId === query.groupBy);
  const explicit = input.explicit === undefined ? undefined : explicitGrouping(input.explicit);
  if (explicit === undefined && activeEntry === undefined) return invalidGrouping();
  const baseGroups = explicit?.groups ?? activeEntry?.groups;
  if (baseGroups === undefined) return invalidGrouping();
  const knownGroups = new Map(baseGroups.map((group) => [group.swimlaneId, group]));
  knownGroups.set(policy.unassigned.swimlaneId, policy.unassigned);
  const fallback =
    policy.resolverFallback ??
    Object.freeze({ swimlaneId: 'group-unavailable', label: 'Unavailable', revision: policy.fieldId });
  const membershipMap = explicit?.memberships;
  const memberships: KanbanResolvedGroupingMembership[] = [];
  let fallbackUsed = false;
  for (const card of input.cards) {
    const cardKey = cardKeyOf(card, policy);
    let swimlaneId: string | undefined;
    let resolverFailed = false;
    if (membershipMap !== undefined) {
      swimlaneId = membershipMap.get(cardKey);
    } else {
      try {
        swimlaneId = activeEntry?.resolve(card);
      } catch {
        resolverFailed = true;
        fallbackUsed = true;
        swimlaneId = fallback.swimlaneId;
        observeFailure(input.observe, 'group-resolver-failed');
      }
    }
    if (swimlaneId === undefined || (!resolverFailed && !knownGroups.has(swimlaneId))) {
      swimlaneId = policy.unassigned.swimlaneId;
    }
    memberships.push(Object.freeze({ cardKey, address: Object.freeze({ swimlaneId }) }));
  }
  if (fallbackUsed) knownGroups.set(fallback.swimlaneId, fallback);
  const orderedGroups = orderGroups(Object.freeze([...knownGroups.values()]), policy);
  validateDuplicateLabels(orderedGroups, policy);
  const detachedGroups = Object.freeze(
    orderedGroups.map((group) => enrichGroup(group, activeEntry, policy, input.observe)),
  );
  const visibleIds = new Set(
    detachedGroups.filter((group) => group.visibility === 'visible').map((group) => group.swimlaneId),
  );
  const detachedMemberships = Object.freeze(memberships);
  const visibleGroups = Object.freeze(detachedGroups.filter((group) => group.visibility === 'visible'));
  const visibleMemberships = Object.freeze(
    detachedMemberships.filter((entry) => visibleIds.has(entry.address.swimlaneId)),
  );
  return Object.freeze({
    kind: 'grouped',
    activeFieldId: query.groupBy,
    groups: visibleGroups,
    memberships: visibleMemberships,
    detached: Object.freeze({ groups: detachedGroups, memberships: detachedMemberships }),
  });
}
