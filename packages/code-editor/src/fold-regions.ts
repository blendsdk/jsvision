import type { CodeEditorDocumentModel } from './document/model.js';
import { offsetToPosition } from './document/positions.js';
import type { LocalLanguageResult } from './languages/contracts.js';

/** One validated fold with source coordinates, logical lines, and a stable structural identity. */
export interface FoldableRegion {
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly from: number;
  readonly to: number;
  readonly key: string;
}

/** One collapsed fold in the immutable nesting index used for target revelation. */
export interface CollapsedFoldNode {
  readonly from: number;
  readonly to: number;
  readonly children: readonly CollapsedFoldNode[];
}

/**
 * Validates adapter fold ranges and assigns identities suitable for conservative reconciliation.
 *
 * Malformed, duplicate, crossing, same-header, and ambiguous ranges are omitted so uncertain
 * structures can never hide source text.
 */
export function validateFoldableRegions(
  document: CodeEditorDocumentModel,
  ranges: LocalLanguageResult['folds'],
  limit: number,
  adapterId: string,
): readonly FoldableRegion[] {
  const snapshot = document.snapshot;
  const candidates: Omit<FoldableRegion, 'key'>[] = [];
  const seen = new Set<string>();
  const inspectionLimit = Math.min(ranges.length, Math.max(limit, Math.min(limit * 4, 200_000)));
  for (let index = 0; index < inspectionLimit; index += 1) {
    const range = ranges[index];
    if (range === undefined) continue;
    if (candidates.length >= limit) break;
    if (
      !Number.isSafeInteger(range.from) ||
      !Number.isSafeInteger(range.to) ||
      range.from < 0 ||
      range.to <= range.from ||
      range.to > snapshot.length
    )
      continue;
    const from = Number(offsetToPosition(snapshot, range.from).line);
    const to = Number(offsetToPosition(snapshot, Math.max(range.from, range.to - 1)).line);
    if (to <= from) continue;
    const identity = `${range.from}:${range.to}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    candidates.push({ sourceFrom: range.from, sourceTo: range.to, from, to });
  }
  candidates.sort((left, right) => left.from - right.from || right.to - left.to);
  const nested: Omit<FoldableRegion, 'key'>[] = [];
  const parents: Omit<FoldableRegion, 'key'>[] = [];
  const claimedHeaders = new Set<number>();
  for (const candidate of candidates) {
    while (parents.length > 0 && candidate.from > (parents.at(-1)?.to ?? -1)) parents.pop();
    const parent = parents.at(-1);
    if (parent !== undefined && candidate.to > parent.to) continue;
    if (claimedHeaders.has(candidate.from)) continue;
    claimedHeaders.add(candidate.from);
    nested.push(candidate);
    parents.push(candidate);
  }
  const keyed: FoldableRegion[] = [];
  const path: FoldableRegion[] = [];
  for (const region of nested) {
    while (path.length > 0 && region.from > (path.at(-1)?.to ?? -1)) path.pop();
    const header = snapshot.line(region.from).text.trim();
    const parentKey = path.at(-1)?.key ?? stableFoldDigest(adapterId);
    const key = stableFoldDigest(`${parentKey}\u0000${header}`);
    const candidate = Object.freeze({ ...region, key });
    keyed.push(candidate);
    path.push(candidate);
  }
  const keyCounts = new Map<string, number>();
  for (const region of keyed) keyCounts.set(region.key, (keyCounts.get(region.key) ?? 0) + 1);
  return Object.freeze(keyed.filter((region) => keyCounts.get(region.key) === 1));
}

/**
 * Builds a compact immutable nesting index from sorted collapsed regions.
 *
 * The controller rebuilds this index only when fold state changes. Subsequent caret and command
 * targets can therefore locate a containing sibling by binary search instead of scanning every
 * collapsed region.
 */
export function buildCollapsedHierarchy(
  regions: readonly { readonly from: number; readonly to: number }[],
): readonly CollapsedFoldNode[] {
  const roots: MutableCollapsedFoldNode[] = [];
  const stack: MutableCollapsedFoldNode[] = [];
  for (const region of regions) {
    while (stack.length > 0 && region.from > (stack.at(-1)?.to ?? -1)) stack.pop();
    const node: MutableCollapsedFoldNode = { from: region.from, to: region.to, children: [] };
    const parent = stack.at(-1);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
    stack.push(node);
  }
  return Object.freeze(roots.map(freezeCollapsedNode));
}

/**
 * Finds every collapsed header whose hidden body contains a logical line.
 *
 * Returning the complete ancestry is important for nested folds: expanding only the innermost
 * region would still leave the target hidden by its collapsed parent.
 */
export function collapsedHeadersContaining(nodes: readonly CollapsedFoldNode[], line: number): readonly number[] {
  const headers: number[] = [];
  let siblings = nodes;
  while (siblings.length > 0) {
    const candidate = lastFoldStartingBefore(siblings, line);
    if (candidate === undefined || line <= candidate.from || line > candidate.to) break;
    headers.push(candidate.from);
    siblings = candidate.children;
  }
  return headers;
}

/** Mutable construction form that is frozen before it leaves this module. */
interface MutableCollapsedFoldNode {
  readonly from: number;
  readonly to: number;
  readonly children: MutableCollapsedFoldNode[];
}

/** Recursively freezes a freshly built collapsed-fold subtree. */
function freezeCollapsedNode(node: MutableCollapsedFoldNode): CollapsedFoldNode {
  return Object.freeze({
    from: node.from,
    to: node.to,
    children: Object.freeze(node.children.map(freezeCollapsedNode)),
  });
}

/** Returns the rightmost sibling whose header precedes the target line. */
function lastFoldStartingBefore(nodes: readonly CollapsedFoldNode[], line: number): CollapsedFoldNode | undefined {
  let low = 0;
  let high = nodes.length - 1;
  let match: CollapsedFoldNode | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = nodes[middle];
    if (candidate !== undefined && candidate.from < line) {
      match = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
}

/**
 * Produces a fixed-size structural identity component without retaining complete ancestor paths.
 *
 * Two independent 32-bit streams make accidental collisions unlikely. Duplicate final identities
 * are still rejected as ambiguous before reconciliation, so a collision expands source rather
 * than choosing between multiple candidate folds.
 */
function stableFoldDigest(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}
