import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { KANBAN_THEME_ROLES } from '../card/theme.js';
import type { KanbanStructureStyle, KanbanWipPolicy } from '../source/types.js';
import { snapshotKanbanDefinitionOfDone } from '../workflow/definition-of-done.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type {
  KanbanConfigurationColumnSnapshot,
  KanbanConfigurationOccupancy,
  KanbanConfigurationSnapshot,
  KanbanConfigurationSwimlaneSnapshot,
  KanbanDuplicateConfigurationName,
  KanbanNormalizedConfigurationName,
} from './types.js';

/** Exact keys accepted by a complete configuration snapshot. */
const SNAPSHOT_KEYS = new Set(['revision', 'columns', 'swimlanes']);
/** Exact keys accepted by one column snapshot. */
const COLUMN_KEYS = new Set([
  'columnId',
  'label',
  'disambiguator',
  'revision',
  'definitionOfDone',
  'wip',
  'style',
  'data',
]);
/** Exact keys accepted by one swimlane snapshot. */
const SWIMLANE_KEYS = new Set(['swimlaneId', 'label', 'disambiguator', 'revision', 'mode', 'style', 'data']);
/** Exact keys accepted by one workflow count policy. */
const WIP_KEYS = new Set(['minimum', 'maximum', 'mode', 'countDone']);
/** Exact keys accepted by one semantic style. */
const STYLE_KEYS = new Set(['role']);
/** Exact keys accepted by authoritative occupancy evidence. */
const OCCUPANCY_KEYS = new Set(['quality', 'count']);
/** Exact keys accepted by explicit duplicate-name permission. */
const DUPLICATE_NAME_KEYS = new Set(['disambiguator']);
/** ANSI control sequences removed as a unit so their parameter bytes never become visible text. */
const ANSI_CONTROL_SEQUENCE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)?|.)/gu;
/** Bidirectional controls removed before application text reaches terminal layout. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Raises the package's payload-free configuration validation failure. */
function invalidConfiguration(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Returns a string value without coercing application objects. */
function requiredString(value: unknown): string {
  if (typeof value !== 'string') return invalidConfiguration();
  return value;
}

/** Returns true when a normalized label remains within the safe semantic UTF-8 limit. */
function hasSafeEncodedSize(value: string): boolean {
  return new TextEncoder().encode(value).byteLength <= KANBAN_LIMITS.semanticStringBytes.safe;
}

/**
 * Sanitizes one visible configuration name and derives a deterministic duplicate key.
 *
 * @example
 * ```ts
 * normalizeKanbanConfigurationName('  ＲＥＶＩＥＷ  ');
 * // { label: 'REVIEW', collisionKey: 'review' }
 * ```
 */
export function normalizeKanbanConfigurationName(value: unknown): KanbanNormalizedConfigurationName {
  try {
    const source = requiredString(value);
    if (source.length > KANBAN_LIMITS.semanticStringBytes.safe * 2) return invalidConfiguration();
    const label = sanitizeContractText(
      source.replace(ANSI_CONTROL_SEQUENCE, '').replace(BIDI_CONTROLS, ''),
      KANBAN_LIMITS.semanticStringBytes.safe,
    )
      .replace(/[\t\n]+/gu, ' ')
      .normalize('NFKC')
      .trim();
    if (label.length === 0 || !hasSafeEncodedSize(label)) return invalidConfiguration();
    return Object.freeze({ label, collisionKey: label.toLocaleLowerCase('en-US') });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidConfiguration();
  }
}

/** Snapshots one optional visible duplicate disambiguator. */
export function snapshotKanbanDuplicateConfigurationName(value: unknown): KanbanDuplicateConfigurationName {
  try {
    const properties = snapshotKanbanDataProperties(value, DUPLICATE_NAME_KEYS.size);
    validateKanbanDataKeys(properties, DUPLICATE_NAME_KEYS);
    if (Object.keys(properties).length !== DUPLICATE_NAME_KEYS.size) return invalidConfiguration();
    return Object.freeze({ disambiguator: normalizeKanbanConfigurationName(properties.disambiguator).label });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidConfiguration();
  }
}

/** Validates and detaches one workflow count policy used by configuration drafts. */
export function snapshotKanbanConfigurationWipPolicy(value: unknown): KanbanWipPolicy {
  const properties = snapshotKanbanDataProperties(value, WIP_KEYS.size);
  validateKanbanDataKeys(properties, WIP_KEYS);
  const minimum = properties.minimum;
  const maximum = properties.maximum;
  if (
    (minimum !== undefined && (typeof minimum !== 'number' || !Number.isSafeInteger(minimum) || minimum < 0)) ||
    (maximum !== undefined && (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0)) ||
    (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) ||
    (properties.mode !== 'informational' && properties.mode !== 'advisory' && properties.mode !== 'blocking') ||
    (properties.countDone !== 'include' && properties.countDone !== 'exclude')
  )
    return invalidConfiguration();
  return Object.freeze({
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    mode: properties.mode,
    countDone: properties.countDone,
  });
}

/** Validates one semantic style against the closed Kanban theme-role inventory. */
export function snapshotKanbanConfigurationStyle(value: unknown): KanbanStructureStyle {
  const properties = snapshotKanbanDataProperties(value, STYLE_KEYS.size);
  validateKanbanDataKeys(properties, STYLE_KEYS);
  const role = KANBAN_THEME_ROLES.find((candidate) => candidate === properties.role);
  if (role === undefined || Object.keys(properties).length !== STYLE_KEYS.size) return invalidConfiguration();
  return Object.freeze({ role });
}

/** Snapshots one exact immutable column structure record. */
function columnSnapshot(value: unknown): KanbanConfigurationColumnSnapshot {
  const properties = snapshotKanbanDataProperties(value, COLUMN_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_KEYS);
  if (properties.columnId === undefined || properties.label === undefined || properties.revision === undefined) {
    return invalidConfiguration();
  }
  const name = normalizeKanbanConfigurationName(properties.label);
  return Object.freeze({
    columnId: createKanbanColumnId(requiredString(properties.columnId)),
    label: name.label,
    ...(properties.disambiguator === undefined
      ? {}
      : { disambiguator: normalizeKanbanConfigurationName(properties.disambiguator).label }),
    revision: snapshotKanbanRevision(properties.revision),
    ...(properties.definitionOfDone === undefined
      ? {}
      : { definitionOfDone: snapshotKanbanDefinitionOfDone(properties.definitionOfDone) }),
    ...(properties.wip === undefined ? {} : { wip: snapshotKanbanConfigurationWipPolicy(properties.wip) }),
    ...(properties.style === undefined ? {} : { style: snapshotKanbanConfigurationStyle(properties.style) }),
    ...(properties.data === undefined ? {} : { data: snapshotKanbanSemanticValue(properties.data) }),
  });
}

/** Snapshots one exact immutable swimlane structure record. */
function swimlaneSnapshot(value: unknown): KanbanConfigurationSwimlaneSnapshot {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_KEYS);
  if (properties.swimlaneId === undefined || properties.label === undefined || properties.revision === undefined) {
    return invalidConfiguration();
  }
  if (properties.mode !== undefined && properties.mode !== 'explicit' && properties.mode !== 'derived') {
    return invalidConfiguration();
  }
  const name = normalizeKanbanConfigurationName(properties.label);
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(requiredString(properties.swimlaneId)),
    label: name.label,
    ...(properties.disambiguator === undefined
      ? {}
      : { disambiguator: normalizeKanbanConfigurationName(properties.disambiguator).label }),
    revision: snapshotKanbanRevision(properties.revision),
    mode: properties.mode ?? 'explicit',
    ...(properties.style === undefined ? {} : { style: snapshotKanbanConfigurationStyle(properties.style) }),
    ...(properties.data === undefined ? {} : { data: snapshotKanbanSemanticValue(properties.data) }),
  });
}

/** Rejects duplicate structural identities without exposing the rejected values. */
function requireUnique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) return invalidConfiguration();
}

/** Rejects visually ambiguous normalized names while allowing explicit distinct disambiguators. */
function requireUnambiguousNames(values: readonly { readonly label: string; readonly disambiguator?: string }[]): void {
  const keys = values.map((value) => {
    const label = normalizeKanbanConfigurationName(value.label).collisionKey;
    const disambiguator =
      value.disambiguator === undefined ? '' : normalizeKanbanConfigurationName(value.disambiguator).collisionKey;
    return `${label.length}:${label}:${disambiguator.length}:${disambiguator}`;
  });
  requireUnique(keys);
}

/**
 * Validates, detaches, and deeply freezes one authoritative board-configuration snapshot.
 *
 * Visual personalization such as visibility and collapse state is deliberately rejected because it
 * belongs to saved views rather than application-owned structure.
 *
 * @example
 * ```ts
 * const snapshot = createKanbanConfigurationSnapshot({
 *   revision: 'board-1',
 *   columns: [{ columnId: 'todo', label: 'To do', revision: 'column-1' }],
 *   swimlanes: [],
 * });
 * ```
 */
export function createKanbanConfigurationSnapshot(value: unknown): KanbanConfigurationSnapshot {
  try {
    const properties = snapshotKanbanDataProperties(value, SNAPSHOT_KEYS.size);
    validateKanbanDataKeys(properties, SNAPSHOT_KEYS);
    if (Object.keys(properties).length !== SNAPSHOT_KEYS.size) return invalidConfiguration();
    const columns = snapshotKanbanDataArray(properties.columns, KANBAN_LIMITS.columns.safe).map(columnSnapshot);
    const swimlanes = snapshotKanbanDataArray(properties.swimlanes, KANBAN_LIMITS.swimlanes.safe).map(swimlaneSnapshot);
    requireUnique(columns.map((column) => column.columnId));
    requireUnique(swimlanes.map((swimlane) => swimlane.swimlaneId));
    requireUnambiguousNames(columns);
    requireUnambiguousNames(swimlanes);
    return Object.freeze({
      revision: snapshotKanbanRevision(properties.revision),
      columns: Object.freeze(columns),
      swimlanes: Object.freeze(swimlanes),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidConfiguration();
  }
}

/** Validates authoritative occupancy evidence without accepting estimates or loaded-only counts. */
export function snapshotKanbanConfigurationOccupancy(value: unknown): KanbanConfigurationOccupancy {
  try {
    const properties = snapshotKanbanDataProperties(value, OCCUPANCY_KEYS.size);
    validateKanbanDataKeys(properties, OCCUPANCY_KEYS);
    if (properties.quality === 'unknown' && Object.keys(properties).length === 1) {
      return Object.freeze({ quality: 'unknown' });
    }
    if (
      properties.quality !== 'exact' ||
      Object.keys(properties).length !== OCCUPANCY_KEYS.size ||
      typeof properties.count !== 'number' ||
      !Number.isSafeInteger(properties.count) ||
      properties.count < 0
    ) {
      return invalidConfiguration();
    }
    return Object.freeze({ quality: 'exact', count: properties.count });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidConfiguration();
  }
}
