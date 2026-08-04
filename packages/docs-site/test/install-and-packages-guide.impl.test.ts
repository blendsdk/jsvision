/**
 * Implementation hardening for the Install & packages course.
 *
 * These checks parse the teaching snippets as data so package-matrix drift, stale sample versions,
 * and unsupported import paths fail with a focused diagnostic before publication.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GUIDE = readFileSync(join(REPOSITORY_ROOT, 'packages', 'docs-site', 'guide', 'install-and-packages.md'), 'utf8');
const PUBLIC_PACKAGE_DIRECTORIES = [
  'core',
  'ui',
  'i18n',
  'forms',
  'files',
  'datagrid',
  'code-editor',
  'kanban',
] as const;

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private: boolean;
  readonly exports: Readonly<Record<string, unknown>>;
}

/** Narrow parsed JSON to the manifest fields used by these documentation checks. */
function isPackageManifest(value: unknown): value is PackageManifest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = Object.getOwnPropertyDescriptors(value);
  return (
    typeof candidate.name?.value === 'string' &&
    typeof candidate.version?.value === 'string' &&
    (candidate.private === undefined || typeof candidate.private.value === 'boolean') &&
    typeof candidate.exports?.value === 'object' &&
    candidate.exports.value !== null
  );
}

/** Read and validate a workspace manifest instead of trusting an unchecked JSON assertion. */
function readManifest(directory: string): PackageManifest {
  const parsed: unknown = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'packages', directory, 'package.json'), 'utf8'),
  );
  if (!isPackageManifest(parsed)) throw new Error(`packages/${directory}/package.json has an unexpected shape`);
  return { ...parsed, private: parsed.private ?? false };
}

/** Extract runtime package sets from the labeled npm command snippets in the package chooser. */
function installMatrix(markdown: string): ReadonlyMap<string, readonly string[]> {
  const matrix = new Map<string, readonly string[]>();
  const pattern = /```sh \[([^\]]+)\]\n(?:[^\n]*\n)*?npm install ([^\n]+)\n```/gu;
  for (const match of markdown.matchAll(pattern)) {
    const label = match[1];
    const packages = match[2]?.trim().split(/\s+/u);
    if (label !== undefined && packages !== undefined) matrix.set(label, packages);
  }
  return matrix;
}

/** Extract the dependency version pinned in the teaching package.json. */
function documentedUiVersion(markdown: string): string {
  const match = markdown.match(/"@jsvision\/ui"\s*:\s*"\^([^"]+)"/u);
  if (match?.[1] === undefined) throw new Error('the package.json example does not pin @jsvision/ui');
  return match[1];
}

/** Report whether a documentation version still matches the release represented by the workspace. */
function versionFinding(documentedVersion: string, currentVersion: string): string | null {
  return documentedVersion === currentVersion
    ? null
    : `documented @jsvision/ui ${documentedVersion} does not match workspace ${currentVersion}`;
}

/** Extract JSVision package specifiers from JavaScript and TypeScript snippets. */
function packageImports(markdown: string): readonly string[] {
  return [
    ...markdown.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^;'"]+\s+from\s+)?['"](@jsvision\/[^'"]+)['"]/gu),
  ].map((match) => match[1]!);
}

/** Validate package imports against public workspace manifests and their explicit export maps. */
function invalidImports(
  specifiers: readonly string[],
  manifests: ReadonlyMap<string, PackageManifest>,
): readonly string[] {
  const findings: string[] = [];
  for (const specifier of specifiers) {
    const packageName = specifier.split('/').slice(0, 2).join('/');
    const manifest = manifests.get(packageName);
    if (manifest === undefined || manifest.private) {
      findings.push(`${specifier}: package is not public`);
      continue;
    }
    const subpath = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
    if (!Object.hasOwn(manifest.exports, subpath)) {
      findings.push(`${specifier}: subpath is not exported`);
    }
  }
  return findings;
}

describe('Install & packages implementation hardening', () => {
  test('should keep every goal mapped to one unique minimal install set', () => {
    const matrix = installMatrix(GUIDE);

    expect(Object.fromEntries(matrix)).toEqual({
      'Terminal app': ['@jsvision/ui'],
      Forms: ['@jsvision/ui', '@jsvision/forms', 'zod'],
      Files: ['@jsvision/ui', '@jsvision/files'],
      'Data Grid': ['@jsvision/ui', '@jsvision/datagrid'],
      'Code Editor': ['@jsvision/ui', '@jsvision/code-editor'],
      Kanban: ['@jsvision/ui', '@jsvision/kanban'],
    });
    for (const packages of matrix.values()) {
      expect(new Set(packages).size).toBe(packages.length);
      expect(packages).not.toContain('@jsvision/web');
    }
  });

  test('should detect when the teaching package version becomes stale', () => {
    const currentVersion = readManifest('ui').version;

    expect(versionFinding(documentedUiVersion(GUIDE), currentVersion)).toBeNull();
    expect(versionFinding('0.0.0', currentVersion)).toBe(
      `documented @jsvision/ui 0.0.0 does not match workspace ${currentVersion}`,
    );
  });

  test('should accept documented exports and reject private or guessed imports', () => {
    const publicManifests = new Map(
      PUBLIC_PACKAGE_DIRECTORIES.map((directory) => {
        const manifest = readManifest(directory);
        return [manifest.name, manifest] as const;
      }),
    );
    const web = readManifest('web');
    const manifests = new Map([...publicManifests, [web.name, web] as const]);

    expect(invalidImports(packageImports(GUIDE), manifests)).toEqual([]);
    expect(
      invalidImports(
        ['@jsvision/ui/src/application.js', '@jsvision/code-editor/languages/missing', '@jsvision/web'],
        manifests,
      ),
    ).toEqual([
      '@jsvision/ui/src/application.js: subpath is not exported',
      '@jsvision/code-editor/languages/missing: subpath is not exported',
      '@jsvision/web: package is not public',
    ]);
  });
});
