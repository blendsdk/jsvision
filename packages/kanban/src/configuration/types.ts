import type { KanbanDefinitionOfDoneSnapshot } from '../workflow/definition-of-done.js';
import type { KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';

/** A terminal-safe visible name and its locale-independent duplicate key. */
export interface KanbanNormalizedConfigurationName {
  /** Sanitized, trimmed, NFKC-normalized text shown to a user. */
  readonly label: string;
  /** Fixed-locale lowercase key used only for duplicate detection. */
  readonly collisionKey: string;
}

/** Immutable structural evidence for one configurable workflow column. */
export interface KanbanConfigurationColumnSnapshot {
  /** Stable application-owned column identity. */
  readonly columnId: KanbanColumnId;
  /** Sanitized visible column name. */
  readonly label: string;
  /** Optional visible text that distinguishes an approved duplicate name. */
  readonly disambiguator?: string;
  /** Equality-only column revision captured from application authority. */
  readonly revision: KanbanRevision;
  /** Optional sanitized completion policy presented by configuration UI. */
  readonly definitionOfDone?: KanbanDefinitionOfDoneSnapshot;
}

/** Whether a swimlane is application-owned structure or a derived grouping projection. */
export type KanbanConfigurationSwimlaneMode = 'explicit' | 'derived';

/** Immutable structural evidence for one configurable or derived swimlane. */
export interface KanbanConfigurationSwimlaneSnapshot {
  /** Stable application-owned or derived swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Sanitized visible swimlane name. */
  readonly label: string;
  /** Optional visible text that distinguishes an approved duplicate name. */
  readonly disambiguator?: string;
  /** Equality-only swimlane revision captured from application authority. */
  readonly revision: KanbanRevision;
  /** Structural mutability classification; omitted input defaults to `explicit`. */
  readonly mode: KanbanConfigurationSwimlaneMode;
}

/** Detached application-authoritative board structure consumed by configuration builders and dialogs. */
export interface KanbanConfigurationSnapshot {
  /** Equality-only revision for the complete structural publication. */
  readonly revision: KanbanRevision;
  /** Ordered workflow columns. */
  readonly columns: readonly KanbanConfigurationColumnSnapshot[];
  /** Ordered explicit or derived swimlanes. */
  readonly swimlanes: readonly KanbanConfigurationSwimlaneSnapshot[];
}

/** Authoritative occupancy evidence required before structural deletion. */
export type KanbanConfigurationOccupancy =
  { readonly quality: 'unknown' } | { readonly quality: 'exact'; readonly count: number };

/** Explicit application opt-in that makes one duplicate visible name unambiguous. */
export interface KanbanDuplicateConfigurationName {
  /** Non-empty terminal-safe text displayed beside the duplicate name. */
  readonly disambiguator: string;
}
