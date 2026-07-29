/**
 * Specification coverage for the Install & packages orientation course.
 *
 * A beginner must be able to select the smallest supported package set, configure a Node 22+
 * NodeNext project, import only published entry points, and diagnose installation or resolution
 * failures. Installation happens outside the documentation terminal, so the course proves the
 * workflow with authentic manifest, compiler, export-map, and doctor evidence instead of a live
 * example.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { formatFindings, lintText } from '../../../scripts/jsvision-doctor.mjs';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOCS_ROOT = join(REPOSITORY_ROOT, 'packages', 'docs-site');
const GUIDE = readFileSync(join(DOCS_ROOT, 'guide', 'install-and-packages.md'), 'utf8');
const CATALOG = JSON.parse(readFileSync(join(DOCS_ROOT, 'guides.json'), 'utf8')) as GuideCatalog;
const TYPESCRIPT_CLI = join(REPOSITORY_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const PUBLIC_PACKAGES = [
  '@jsvision/core',
  '@jsvision/ui',
  '@jsvision/i18n',
  '@jsvision/forms',
  '@jsvision/files',
  '@jsvision/datagrid',
  '@jsvision/code-editor',
] as const;

interface GuideCatalog {
  readonly entries: readonly GuideCatalogEntry[];
}

interface GuideCatalogEntry {
  readonly id: string;
  readonly profile: string;
  readonly prerequisites: readonly string[];
  readonly requiredLiveExamples: number;
  readonly liveExampleException: string | null;
  readonly examples: readonly string[];
}

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  readonly publishConfig?: { readonly access?: string };
  readonly engines?: { readonly node?: string };
  readonly exports?: Readonly<Record<string, unknown>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

/** Read a workspace package manifest by its unscoped directory name. */
function readManifest(directory: string): PackageManifest {
  return JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'packages', directory, 'package.json'), 'utf8'),
  ) as PackageManifest;
}

/** Return true when the Guide contains an install command with exactly the requested runtime packages. */
function hasExactInstallCommand(expected: readonly string[]): boolean {
  const wanted = [...expected].sort();
  return GUIDE.split('\n').some((line) => {
    const match = line.trim().match(/^(?:npm install|yarn add|pnpm add)\s+(.+)$/u);
    if (match?.[1] === undefined || match[1].includes('--save-dev')) return false;
    return match[1].split(/\s+/u).sort().join('\0') === wanted.join('\0');
  });
}

/** Extract package import specifiers from the Guide's JavaScript and TypeScript teaching snippets. */
function packageImports(): readonly string[] {
  return [
    ...GUIDE.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^;'"]+\s+from\s+)?['"](@jsvision\/[^'"]+)['"]/gu),
  ].map((match) => match[1]!);
}

/** Compile a bounded local consumer using the same NodeNext settings taught by the course. */
function compileConsumer(mainSource: string): { readonly status: number | null; readonly output: string } {
  const fixture = mkdtempSync(join(REPOSITORY_ROOT, '.install-guide-consumer-'));
  try {
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({ name: 'install-guide-consumer', private: true, type: 'module' }),
    );
    writeFileSync(
      join(fixture, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['*.ts'],
      }),
    );
    writeFileSync(join(fixture, 'helper.ts'), 'export const helper = 1;\n');
    writeFileSync(join(fixture, 'main.ts'), mainSource);
    const result = spawnSync(process.execPath, [TYPESCRIPT_CLI, '--project', fixture], {
      cwd: fixture,
      encoding: 'utf8',
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

/** Probe the real Node 22 CommonJS failure at the published package-root boundary. */
function requireUiPackage(): { readonly status: number | null; readonly output: string } {
  const result = spawnSync(process.execPath, ['--input-type=commonjs', '--eval', "require('@jsvision/ui')"], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('Install & packages course contract', () => {
  test('should present the zero-lab orientation contract to a beginner', () => {
    const entry = CATALOG.entries.find((candidate) => candidate.id === 'install-and-packages');

    expect(entry).toMatchObject({
      profile: 'orientation',
      prerequisites: ['introduction'],
      requiredLiveExamples: 0,
      examples: [],
    });
    expect(entry?.liveExampleException).toMatch(/installation[\s\S]*module resolution[\s\S]*build-time/iu);
    expect(GUIDE).toMatch(/^description:\s*.+Node 22.+ESM.+packages/im);
    expect(GUIDE).toMatch(/\b(?:for|who).*(?:beginner|new|first).*(?:JSVision|project)/iu);
    expect(GUIDE).toContain('](/guide/)');
    expect(GUIDE).not.toContain('<PlayExample');
  });

  test('should choose the smallest supported package set for each application goal', () => {
    expect(hasExactInstallCommand(['@jsvision/ui'])).toBe(true);
    expect(hasExactInstallCommand(['@jsvision/ui', '@jsvision/forms', 'zod'])).toBe(true);
    expect(hasExactInstallCommand(['@jsvision/ui', '@jsvision/files'])).toBe(true);
    expect(hasExactInstallCommand(['@jsvision/ui', '@jsvision/datagrid'])).toBe(true);
    expect(hasExactInstallCommand(['@jsvision/ui', '@jsvision/code-editor'])).toBe(true);

    for (const packageName of PUBLIC_PACKAGES) expect(GUIDE).toContain(`\`${packageName}\``);
    expect(GUIDE).toMatch(
      /@jsvision\/core[\s\S]*(?:engine|rendering layer)[\s\S]*(?:without|instead of).*(?:widgets|@jsvision\/ui)/iu,
    );
    expect(GUIDE).toMatch(
      /@jsvision\/web[\s\S]*(?:private|internal)[\s\S]*(?:not published|cannot install|unsupported)/iu,
    );
    expect(GUIDE).not.toMatch(/(?:npm install|yarn add|pnpm add)\s+@jsvision\/web/u);
  });

  test('should configure a strict Node 22 or newer ESM TypeScript project', () => {
    expect(GUIDE).toMatch(/```json[\s\S]*"type"\s*:\s*"module"[\s\S]*```/u);
    expect(GUIDE).toMatch(/"node"\s*:\s*">=22"/u);
    expect(GUIDE).toMatch(/"module"\s*:\s*"NodeNext"/u);
    expect(GUIDE).toMatch(/"moduleResolution"\s*:\s*"NodeNext"/u);
    expect(GUIDE).toMatch(/"strict"\s*:\s*true/u);
    expect(GUIDE).toMatch(/relative import[\s\S]*\.js/iu);
    expect(GUIDE).toContain("import { createApplication } from '@jsvision/ui';");
  });

  test('should use only entry points exported by published package manifests', () => {
    const manifests = new Map(
      PUBLIC_PACKAGES.map((packageName) => {
        const directory = packageName.slice('@jsvision/'.length);
        return [packageName, readManifest(directory)] as const;
      }),
    );
    const imports = packageImports();

    expect(imports).toContain('@jsvision/ui');
    for (const specifier of imports) {
      const packageName = specifier.split('/').slice(0, 2).join('/');
      const manifest = manifests.get(packageName as (typeof PUBLIC_PACKAGES)[number]);
      expect(manifest, `${specifier}: package must be public`).toBeDefined();
      const subpath = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
      expect(manifest?.exports, `${specifier}: missing exports map`).toHaveProperty(subpath);
    }
  });

  test('should ground package and version guidance in the shipped manifests', () => {
    const manifests = PUBLIC_PACKAGES.map((packageName) => readManifest(packageName.slice('@jsvision/'.length)));
    const versions = new Set(manifests.map((manifest) => manifest.version));
    const web = readManifest('web');
    const forms = readManifest('forms');

    expect(versions.size).toBe(1);
    for (const manifest of manifests) {
      expect(manifest.publishConfig?.access, manifest.name).toBe('public');
      expect(manifest.engines?.node, manifest.name).toBe('>=22');
      expect(manifest.exports, manifest.name).toHaveProperty('.');
    }
    expect(forms.peerDependencies?.zod).toBe('^4');
    expect(web.private).toBe(true);

    expect(GUIDE).toMatch(/(?:same|matching|aligned).*(?:version|release)/iu);
    expect(GUIDE).toMatch(/@jsvision\/forms[\s\S]*(?:peer dependency|peer)[\s\S]*Zod\s+4/iu);
    expect(GUIDE).toMatch(/exports map[\s\S]*(?:public|supported).*(?:entry point|subpath)/iu);
  });

  test('should replace a live lab with authentic compiler, export-map, and doctor evidence', () => {
    const cleanDoctorOutput = formatFindings(
      lintText(
        "import { createApplication } from '@jsvision/ui';\nimport { helper } from './helper.js';\nvoid createApplication;\nvoid helper;",
        'src/main.ts',
      ),
    );
    const brokenDoctorOutput = formatFindings(
      lintText("import { helper } from './helper';\nvoid helper;", 'src/main.ts'),
    );
    const validConsumer = compileConsumer(`
import { createApplication } from '@jsvision/ui';
import { createI18n } from '@jsvision/i18n';
import { createForm } from '@jsvision/forms';
import { FileDialog } from '@jsvision/files';
import { EditableDataGrid } from '@jsvision/datagrid';
import { CodeEditor } from '@jsvision/code-editor';
import { typescriptLanguageId } from '@jsvision/code-editor/languages/typescript';
import { helper } from './helper.js';
void [createApplication, createI18n, createForm, FileDialog, EditableDataGrid, CodeEditor];
void typescriptLanguageId;
void helper;
`);
    const invalidSubpath = compileConsumer("import { missing } from '@jsvision/ui/src/missing.js';\nvoid missing;\n");
    const missingExtension = compileConsumer("import { helper } from './helper';\nvoid helper;\n");

    expect(cleanDoctorOutput).toBe('jsvision-doctor: no issues found ✓');
    expect(brokenDoctorOutput).toContain('[missing-js-extension]');
    expect(validConsumer).toEqual({ status: 0, output: '' });
    expect(invalidSubpath.status).not.toBe(0);
    expect(invalidSubpath.output).toMatch(/Cannot find module '@jsvision\/ui\/src\/missing\.js'/u);
    expect(missingExtension.status).not.toBe(0);
    expect(missingExtension.output).toMatch(/explicit file extensions[\s\S]*\.\/helper\.js/iu);
    expect(GUIDE).toMatch(/(?:verify|evidence).*(?:without|instead of).*(?:live|embedded).*(?:lab|example)/iu);
    expect(GUIDE).toContain('npx tsc --noEmit');
    expect(GUIDE).toMatch(/(?:npx tsc --noEmit)[\s\S]*(?:exit(?:s| code)?\s*0|no (?:errors|output))/iu);
    expect(GUIDE).toContain(cleanDoctorOutput);
    expect(GUIDE).toContain('[missing-js-extension]');
    expect(GUIDE).toMatch(/"exports"\s*:/u);
    expect(GUIDE).toMatch(/"types"\s*:\s*"\.\/dist\//u);
    expect(GUIDE).toMatch(/"import"\s*:\s*"\.\/dist\//u);
  });

  test('should diagnose setup, module-resolution, export, peer, and version failures', () => {
    const commonJsProbe = requireUiPackage();

    expect(GUIDE).toMatch(/## (?:Setup failures|Failure modes|Diagnos(?:e|ing))/iu);
    expect(GUIDE).toMatch(/symptom[\s\S]*cause[\s\S]*(?:correction|fix)[\s\S]*(?:evidence|verify)/iu);
    expect(commonJsProbe.status).not.toBe(0);
    expect(commonJsProbe.output).toMatch(/ERR_PACKAGE_PATH_NOT_EXPORTED[\s\S]*No "exports" main defined/u);

    const requiredEvidence = [
      /Node[\s\S]*(?:22|engine)/iu,
      /Cannot find module[\s\S]*NodeNext/iu,
      /No "exports" main defined[\s\S]*(?:import condition|static import|ESM)/iu,
      /ERR_PACKAGE_PATH_NOT_EXPORTED[\s\S]*(?:exports map|public entry point|subpath)/iu,
      /(?:missing peer|peer dependency)[\s\S]*(?:zod|Zod)[\s\S]*\^?4/iu,
      /(?:mixed|mismatched|stale)[\s\S]*(?:@jsvision\/|versions?|lockfile)/iu,
    ];

    for (const evidence of requiredEvidence) expect(GUIDE).toMatch(evidence);
  });

  test('should finish with practice and task-specific next courses', () => {
    expect(GUIDE).toMatch(/## (?:Practice|Try it yourself)/iu);
    expect(GUIDE).toMatch(/## (?:Where to next|Next steps|Related)/iu);
    expect(GUIDE).toContain('](/guide/layout)');
    expect(GUIDE).toContain('](/guide/running-in-the-browser)');
    expect(GUIDE).toContain('](/components/data-grid/)');
    expect(GUIDE).toContain('](/components/code-editor/)');
    expect(GUIDE).toContain('](/api/)');
  });
});
