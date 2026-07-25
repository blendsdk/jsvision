import { constants, type Stats } from 'node:fs';
import { open, opendir, realpath, stat, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isSignalAborted } from '../abort.js';
import { I18nError } from '../errors.js';
import { copyDenseArray } from '../input.js';
import { MAX_CATALOG_MESSAGES } from '../limits.js';
import { isSafeText } from '../messages.js';
import { createLoadResourceBudget, type LoadResourceBudget } from '../source-budget.js';
import { runAfterOpenTestHook, runAfterRealpathTestHook, runBeforeOpenTestHook } from './test-seam.js';

const PORTABLE_INVALID_SEGMENT = /[<>:"|?*[\]{}!\u0000-\u001F\u007F]/u;
const MAX_EXPANDED_FILES = 10_000;

/** Parsed portable relative path accepted by the Node catalog loader. */
export interface CatalogPathPattern {
  /** Literal JSON file or immediate JSON glob. */
  readonly kind: 'literal' | 'glob';
  /** Original slash-separated portable relative path. */
  readonly relativePath: string;
  /** Directory portion for a glob, or `undefined` for a literal. */
  readonly directory?: string;
}

/** Canonical contained JSON file selected for loading. */
export interface ResolvedCatalogPath {
  /** Canonical root against which the opened handle must still prove containment. */
  readonly canonicalRoot: string;
  /** Canonical absolute path used for the checked open. */
  readonly canonicalPath: string;
  /** Canonical root-relative slash-separated path used for deterministic ordering. */
  readonly relativePath: string;
  /** Device identifier captured when canonical containment was established. */
  readonly device: number;
  /** Inode identifier captured when canonical containment was established. */
  readonly inode: number;
}

/** Open regular file plus metadata checked against its canonical path. */
export interface CheckedCatalogFile {
  /** Open handle that must be closed by the caller. */
  readonly handle: FileHandle;
  /** Byte size observed from the checked handle. */
  readonly size: number;
  /** Canonical path associated with the handle. */
  readonly canonicalPath: string;
}

/** Create one value-free path failure. */
function invalidPath(): I18nError {
  return new I18nError('INVALID_PATH', 'Catalog path is outside the supported rooted JSON path grammar.');
}

/**
 * Validate one platform-neutral relative JSON file or immediate glob.
 *
 * @param input Untrusted slash-separated relative path.
 * @returns Frozen parsed literal or glob description.
 * @throws {@link I18nError} with `INVALID_PATH` for absolute, traversal, empty, unsafe, unsupported
 * glob, or non-JSON paths.
 */
export function validateCatalogPath(input: unknown): CatalogPathPattern {
  if (
    typeof input !== 'string' ||
    input.length === 0 ||
    input.includes('\\') ||
    input.startsWith('/') ||
    !isSafeText(input)
  ) {
    throw invalidPath();
  }
  const segments = input.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        (segment !== '*.json' && PORTABLE_INVALID_SEGMENT.test(segment)),
    )
  ) {
    throw invalidPath();
  }

  const globIndexes = segments
    .map((segment, index) => (segment === '*.json' ? index : -1))
    .filter((index) => index >= 0);
  if (globIndexes.length > 1 || (globIndexes.length === 1 && globIndexes[0] !== segments.length - 1)) {
    throw invalidPath();
  }
  if (!input.endsWith('.json')) throw invalidPath();
  if (globIndexes.length === 0) {
    return Object.freeze({ kind: 'literal', relativePath: input });
  }
  return Object.freeze({
    directory: segments.slice(0, -1).join('/'),
    kind: 'glob',
    relativePath: input,
  });
}

/** Report whether one canonical path is equal to or below the canonical root. */
function isContained(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return fromRoot === '' || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
}

/** Convert a canonical contained path into the portable ordering representation. */
function portableRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/');
}

/** Throw promptly between filesystem operations when the shared load is cancelled. */
function assertNotAborted(signal?: AbortSignal): void {
  if (signal !== undefined && isSignalAborted(signal)) {
    throw new I18nError('ABORTED', 'Catalog path resolution was aborted.');
  }
}

/** Require meaningful stable identity before trusting a canonicalized file path across an open. */
function hasStableIdentity(stats: Pick<Stats, 'dev' | 'ino'>): boolean {
  return stats.dev !== 0 && stats.ino !== 0;
}

/** Canonicalize one candidate and enforce root containment. */
async function canonicalContained(
  root: string,
  candidate: string,
  signal?: AbortSignal,
  requireStableIdentity = false,
): Promise<ResolvedCatalogPath> {
  assertNotAborted(signal);
  let canonicalPath: string;
  let pathStats: Stats;
  try {
    canonicalPath = await realpath(candidate);
    await runAfterRealpathTestHook(canonicalPath);
    assertNotAborted(signal);
    pathStats = await stat(canonicalPath);
  } catch (error) {
    if (error instanceof I18nError) throw error;
    assertNotAborted(signal);
    throw invalidPath();
  }
  if (!isContained(root, canonicalPath)) throw invalidPath();
  if (requireStableIdentity && !hasStableIdentity(pathStats)) throw invalidPath();
  return Object.freeze({
    canonicalRoot: root,
    canonicalPath,
    device: pathStats.dev,
    inode: pathStats.ino,
    relativePath: portableRelative(root, canonicalPath),
  });
}

/** Require a canonical file result to obey the same portable literal grammar as declarations. */
function validateResolvedFile(path: ResolvedCatalogPath): ResolvedCatalogPath {
  const pattern = validateCatalogPath(path.relativePath);
  if (pattern.kind !== 'literal') throw invalidPath();
  return path;
}

/** Expand one validated literal or immediate glob. */
async function expandPattern(
  root: string,
  pattern: CatalogPathPattern,
  maximumFiles: number,
  globCache: Map<string, readonly ResolvedCatalogPath[]>,
  budget: LoadResourceBudget,
  signal?: AbortSignal,
): Promise<readonly ResolvedCatalogPath[]> {
  if (pattern.kind === 'literal') {
    const candidate = await canonicalContained(root, resolve(root, pattern.relativePath), signal, true);
    return Object.freeze([validateResolvedFile(candidate)]);
  }

  const directory = await canonicalContained(root, resolve(root, pattern.directory ?? ''), signal);
  const cached = globCache.get(directory.canonicalPath);
  if (cached !== undefined) return cached;
  assertNotAborted(signal);
  let entries;
  try {
    entries = await opendir(directory.canonicalPath);
  } catch {
    assertNotAborted(signal);
    throw invalidPath();
  }
  const candidates: ResolvedCatalogPath[] = [];
  try {
    for await (const entry of entries) {
      assertNotAborted(signal);
      budget.consumeDirectoryEntry();
      if (!entry.name.endsWith('.json')) continue;
      const entryPattern = validateCatalogPath(entry.name);
      if (entryPattern.kind !== 'literal' || !isSafeText(entry.name)) throw invalidPath();
      if (candidates.length >= maximumFiles) {
        throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog source expands beyond its file limit.');
      }
      const candidate = await canonicalContained(root, resolve(directory.canonicalPath, entry.name), signal, true);
      candidates.push(validateResolvedFile(candidate));
    }
  } catch (error) {
    if (error instanceof I18nError) throw error;
    assertNotAborted(signal);
    throw invalidPath();
  }
  candidates.sort((left, right) =>
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0,
  );
  const published = Object.freeze(candidates);
  globCache.set(directory.canonicalPath, published);
  return published;
}

/**
 * Resolve ordered portable path declarations below one mandatory canonical root.
 *
 * Literal paths retain declaration order. Every immediate glob expands in place and sorts its
 * canonical root-relative matches lexically. Canonical containment is checked after following
 * symlinks so a sibling-prefix or nested-link escape cannot pass a textual prefix test.
 *
 * @param root Mandatory filesystem root.
 * @param paths Dense ordered literal and immediate-glob declarations.
 * @returns Frozen ordered canonical file paths.
 * @throws {@link I18nError} with `INVALID_PATH` for invalid roots, declarations, or containment.
 */
export async function resolveCatalogPaths(
  root: unknown,
  paths: unknown,
  signal?: AbortSignal,
  budget: LoadResourceBudget = createLoadResourceBudget(),
): Promise<readonly ResolvedCatalogPath[]> {
  if (typeof root !== 'string' || root.length === 0) throw invalidPath();
  const pathValues = copyDenseArray(paths, MAX_CATALOG_MESSAGES);
  if (pathValues === undefined) throw invalidPath();

  assertNotAborted(signal);
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(resolve(root));
    assertNotAborted(signal);
    const rootStats = await stat(canonicalRoot);
    if (!rootStats.isDirectory()) throw invalidPath();
  } catch (error) {
    if (error instanceof I18nError) throw error;
    assertNotAborted(signal);
    throw invalidPath();
  }

  const resolved: ResolvedCatalogPath[] = [];
  const expansionCache = new Map<string, readonly ResolvedCatalogPath[]>();
  const globCache = new Map<string, readonly ResolvedCatalogPath[]>();
  for (const value of pathValues) {
    assertNotAborted(signal);
    const pattern = validateCatalogPath(value);
    let expansion = expansionCache.get(pattern.relativePath);
    if (expansion === undefined) {
      expansion = await expandPattern(canonicalRoot, pattern, MAX_EXPANDED_FILES, globCache, budget, signal);
      expansionCache.set(pattern.relativePath, expansion);
    }
    if (resolved.length + expansion.length > MAX_EXPANDED_FILES) {
      throw new I18nError('CATALOG_LIMIT_EXCEEDED', 'Catalog source expands beyond its file limit.');
    }
    for (let index = 0; index < expansion.length; index += 1) budget.consumeFile();
    resolved.push(...expansion);
  }
  assertNotAborted(signal);
  return Object.freeze(resolved);
}

/** Compare stable device/inode identity where the runtime exposes meaningful values. */
function sameIdentity(expected: Pick<ResolvedCatalogPath, 'device' | 'inode'>, actual: Stats): boolean {
  return (
    expected.device !== 0 &&
    expected.inode !== 0 &&
    actual.dev !== 0 &&
    actual.ino !== 0 &&
    expected.device === actual.dev &&
    expected.inode === actual.ino
  );
}

/** Tie containment to the opened object instead of another pre-open pathname snapshot. */
async function verifyOpenedContainment(
  candidate: ResolvedCatalogPath,
  handle: FileHandle,
  handleStats: Stats,
  signal?: AbortSignal,
): Promise<void> {
  assertNotAborted(signal);
  if (process.platform === 'linux') {
    let openedPath: string;
    try {
      openedPath = await realpath(`/proc/self/fd/${handle.fd}`);
    } catch {
      throw invalidPath();
    }
    assertNotAborted(signal);
    if (!isContained(candidate.canonicalRoot, openedPath)) throw invalidPath();
    return;
  }

  // Node does not expose a portable handle-to-path query outside Linux. Re-canonicalize after the
  // handle is open and require both containment and the same stable identity. This is the strongest
  // portable check available without a native openat-style dependency.
  let openedPath: string;
  let openedPathStats: Stats;
  try {
    openedPath = await realpath(candidate.canonicalPath);
    assertNotAborted(signal);
    openedPathStats = await stat(openedPath);
  } catch (error) {
    if (error instanceof I18nError) throw error;
    throw invalidPath();
  }
  if (!isContained(candidate.canonicalRoot, openedPath) || !sameIdentity(candidate, openedPathStats)) {
    throw invalidPath();
  }
  if (!sameIdentity(candidate, handleStats)) throw invalidPath();
}

/**
 * Open one canonical candidate and verify the resulting handle is the checked regular file.
 *
 * Non-regular inputs are rejected before opening. POSIX opens are also non-blocking so a FIFO
 * swapped into the final path cannot stall before handle validation. The opened handle must match
 * the stable device/inode identity captured when canonical containment was established.
 *
 * @param candidate Canonical contained path returned by {@link resolveCatalogPaths}.
 * @returns Checked handle, size, and canonical path.
 * @throws {@link I18nError} with `INVALID_PATH` when the target is missing, non-regular, replaced,
 * or cannot be opened safely.
 */
export async function openCheckedCatalogFile(
  candidate: ResolvedCatalogPath,
  signal?: AbortSignal,
): Promise<CheckedCatalogFile> {
  assertNotAborted(signal);
  const pathStats = await stat(candidate.canonicalPath).catch((): never => {
    assertNotAborted(signal);
    throw invalidPath();
  });
  assertNotAborted(signal);
  if (!pathStats.isFile() || !sameIdentity(candidate, pathStats)) throw invalidPath();

  let handle: FileHandle | undefined;
  try {
    await runBeforeOpenTestHook(candidate.canonicalPath);
    assertNotAborted(signal);
    const flags =
      process.platform === 'win32'
        ? constants.O_RDONLY
        : constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
    handle = await open(candidate.canonicalPath, flags);
    const handleStats = await handle.stat();
    if (!handleStats.isFile() || !sameIdentity(candidate, handleStats)) throw invalidPath();
    await verifyOpenedContainment(candidate, handle, handleStats, signal);
    assertNotAborted(signal);
    await runAfterOpenTestHook(candidate.canonicalPath);
    return Object.freeze({
      canonicalPath: candidate.canonicalPath,
      handle,
      size: handleStats.size,
    });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof I18nError) throw error;
    assertNotAborted(signal);
    throw invalidPath();
  }
}
