import { constants, type Stats } from 'node:fs';
import { open, readdir, realpath, stat, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { I18nError } from '../errors.js';
import { copyDenseArray } from '../input.js';
import { MAX_CATALOG_MESSAGES } from '../limits.js';
import { isSafeText } from '../messages.js';
import { runAfterOpenTestHook } from './test-seam.js';

const PORTABLE_INVALID_SEGMENT = /[<>:"|?*[\]{}!\u0000-\u001F\u007F]/u;

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
  /** Canonical absolute path used for the checked open. */
  readonly canonicalPath: string;
  /** Canonical root-relative slash-separated path used for deterministic ordering. */
  readonly relativePath: string;
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

/** Canonicalize one candidate and enforce root containment. */
async function canonicalContained(root: string, candidate: string): Promise<ResolvedCatalogPath> {
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(candidate);
  } catch {
    throw invalidPath();
  }
  if (!isContained(root, canonicalPath)) throw invalidPath();
  return Object.freeze({
    canonicalPath,
    relativePath: portableRelative(root, canonicalPath),
  });
}

/** Expand one validated literal or immediate glob. */
async function expandPattern(root: string, pattern: CatalogPathPattern): Promise<readonly ResolvedCatalogPath[]> {
  if (pattern.kind === 'literal') {
    return Object.freeze([await canonicalContained(root, resolve(root, pattern.relativePath))]);
  }

  const directory = await canonicalContained(root, resolve(root, pattern.directory ?? ''));
  let entries;
  try {
    entries = await readdir(directory.canonicalPath, { withFileTypes: true });
  } catch {
    throw invalidPath();
  }
  const candidates: ResolvedCatalogPath[] = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.json') || !isSafeText(entry.name)) continue;
    const candidate = await canonicalContained(root, resolve(directory.canonicalPath, entry.name));
    candidates.push(candidate);
  }
  candidates.sort((left, right) =>
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0,
  );
  return Object.freeze(candidates);
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
export async function resolveCatalogPaths(root: unknown, paths: unknown): Promise<readonly ResolvedCatalogPath[]> {
  if (typeof root !== 'string' || root.length === 0) throw invalidPath();
  const pathValues = copyDenseArray(paths, MAX_CATALOG_MESSAGES);
  if (pathValues === undefined) throw invalidPath();

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(resolve(root));
    const rootStats = await stat(canonicalRoot);
    if (!rootStats.isDirectory()) throw invalidPath();
  } catch (error) {
    if (error instanceof I18nError) throw error;
    throw invalidPath();
  }

  const resolved: ResolvedCatalogPath[] = [];
  for (const value of pathValues) {
    const pattern = validateCatalogPath(value);
    resolved.push(...(await expandPattern(canonicalRoot, pattern)));
  }
  return Object.freeze(resolved);
}

/** Compare stable device/inode identity where the runtime exposes meaningful values. */
function sameIdentity(pathStats: Stats, handleStats: Stats): boolean {
  if (pathStats.dev === 0 || pathStats.ino === 0 || handleStats.dev === 0 || handleStats.ino === 0) {
    return true;
  }
  return pathStats.dev === handleStats.dev && pathStats.ino === handleStats.ino;
}

/**
 * Open one canonical candidate and verify the resulting handle is the checked regular file.
 *
 * Non-regular inputs are rejected before opening so FIFO paths cannot block. On platforms with
 * device/inode identity, the opened handle must match the pre-open canonical path metadata.
 *
 * @param candidate Canonical contained path returned by {@link resolveCatalogPaths}.
 * @returns Checked handle, size, and canonical path.
 * @throws {@link I18nError} with `INVALID_PATH` when the target is missing, non-regular, replaced,
 * or cannot be opened safely.
 */
export async function openCheckedCatalogFile(candidate: ResolvedCatalogPath): Promise<CheckedCatalogFile> {
  const pathStats = await stat(candidate.canonicalPath).catch((): never => {
    throw invalidPath();
  });
  if (!pathStats.isFile()) throw invalidPath();

  let handle: FileHandle | undefined;
  try {
    const flags = process.platform === 'win32' ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW;
    handle = await open(candidate.canonicalPath, flags);
    const handleStats = await handle.stat();
    if (!handleStats.isFile() || !sameIdentity(pathStats, handleStats)) throw invalidPath();
    await runAfterOpenTestHook(candidate.canonicalPath);
    return Object.freeze({
      canonicalPath: candidate.canonicalPath,
      handle,
      size: handleStats.size,
    });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof I18nError) throw error;
    throw invalidPath();
  }
}
