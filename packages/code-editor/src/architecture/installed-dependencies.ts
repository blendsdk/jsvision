import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, parse, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ShippedDependencyClosureResult, ShippedDependencyEvidence } from './feasibility.js';

const MIT_COMPATIBLE_LICENSES = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
]);
const APPROVED_RUNTIME_PACKAGES = new Set([
  '@codemirror/state',
  '@jsvision/core',
  '@jsvision/ui',
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/javascript',
  '@lezer/lr',
  '@marijn/find-cluster-break',
  'commander',
  'discontinuous-range',
  'moo',
  'nearley',
  'pgsql-ast-parser',
  'railroad-diagrams',
  'randexp',
  'ret',
  'vscode-jsonrpc',
  'vscode-languageserver-protocol',
  'vscode-languageserver-types',
]);
const DOM_RUNTIME_PACKAGES = new Set(['@codemirror/view']);
const BROWSER_RUNTIME_PACKAGES = new Set(['electron']);
const IDE_RUNTIME_PACKAGES = new Set(['monaco-editor', 'vscode', 'vscode-languageclient']);

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
}

interface PendingDependency {
  readonly name: string;
  readonly searchFrom: string;
  readonly optional: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') result[key] = entry;
  }
  return result;
}

async function readManifest(path: string): Promise<PackageManifest> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'string' ||
    typeof value.license !== 'string'
  ) {
    throw new Error(`Package manifest lacks a string name, version, or license: ${path}`);
  }

  return {
    name: value.name,
    version: value.version,
    license: value.license,
    dependencies: stringRecord(value.dependencies),
    optionalDependencies: stringRecord(value.optionalDependencies),
  };
}

async function findInstalledManifest(startDirectory: string, expectedName: string): Promise<string | undefined> {
  let directory = startDirectory;
  const root = parse(directory).root;

  while (true) {
    const candidate = join(directory, 'node_modules', ...expectedName.split('/'), 'package.json');
    try {
      const canonicalPath = await realpath(candidate);
      const manifest = await readManifest(canonicalPath);
      if (manifest.name === expectedName) return canonicalPath;
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (directory === root) return undefined;
    directory = dirname(directory);
  }
}

function childDependencies(manifest: PackageManifest, manifestPath: string): readonly PendingDependency[] {
  const searchFrom = dirname(manifestPath);
  return [
    ...Object.keys(manifest.dependencies).map((name) => ({
      name,
      searchFrom,
      optional: false,
    })),
    ...Object.keys(manifest.optionalDependencies).map((name) => ({
      name,
      searchFrom,
      optional: true,
    })),
  ];
}

/**
 * Walks every installed production dependency instance from this package.
 */
export async function inspectInstalledDependencyClosure(): Promise<ShippedDependencyClosureResult> {
  const packageManifestPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  return inspectDependencyClosureFrom(packageManifestPath);
}

/**
 * Inspects a package manifest's installed production closure.
 *
 * The explicit root supports isolated dependency-graph verification.
 */
export async function inspectDependencyClosureFrom(
  packageManifestPath: string,
): Promise<ShippedDependencyClosureResult> {
  const rootManifest = await readManifest(packageManifestPath);
  const pending: PendingDependency[] = [...childDependencies(rootManifest, packageManifestPath)];
  const visitedPaths = new Set<string>();
  const packages: ShippedDependencyEvidence[] = [];

  while (pending.length > 0) {
    const dependency = pending.pop();
    if (dependency === undefined) continue;

    const manifestPath = await findInstalledManifest(dependency.searchFrom, dependency.name);
    if (manifestPath === undefined) {
      if (dependency.optional) continue;
      throw new Error(`Required dependency is not installed: ${dependency.name}`);
    }
    if (visitedPaths.has(manifestPath)) continue;
    visitedPaths.add(manifestPath);

    const manifest = await readManifest(manifestPath);
    packages.push({
      name: manifest.name,
      version: manifest.version,
      license: manifest.license,
      manifestPath: relative(dirname(packageManifestPath), manifestPath),
    });
    pending.push(...childDependencies(manifest, manifestPath));
  }

  packages.sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version) ||
      left.manifestPath.localeCompare(right.manifestPath),
  );
  const packageNames = packages.map((entry) => entry.name);
  const incompatibleLicenses = packages
    .filter((entry) => !MIT_COMPATIBLE_LICENSES.has(entry.license))
    .map((entry) => `${entry.name}@${entry.version}: ${entry.license}`);

  return {
    packages,
    unapprovedRuntimePackages: packages
      .filter((entry) => !APPROVED_RUNTIME_PACKAGES.has(entry.name))
      .map((entry) => `${entry.name}@${entry.version}`),
    domRuntimePackages: packageNames.filter((name) => DOM_RUNTIME_PACKAGES.has(name)),
    browserRuntimePackages: packageNames.filter((name) => BROWSER_RUNTIME_PACKAGES.has(name)),
    ideRuntimePackages: packageNames.filter((name) => IDE_RUNTIME_PACKAGES.has(name)),
    incompatibleLicenses,
    allLicensesMitCompatible: incompatibleLicenses.length === 0,
  };
}
