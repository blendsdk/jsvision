import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { ChangeSet, Text } from '@codemirror/state';
import { parser as javascriptParser } from '@lezer/javascript';
import { parse as parsePostgresql } from 'pgsql-ast-parser';
import { Position } from 'vscode-languageserver-protocol';

const execFileAsync = promisify(execFile);
const STATIC_IMPORT_PATTERN = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;
const PARSER_PACKAGES = new Set([
  '@codemirror/lang-javascript',
  '@codemirror/lang-sql',
  '@lezer/javascript',
  'pgsql-ast-parser',
]);

type SupportedEntrypoint = 'root' | 'javascript' | 'typescript' | 'postgresql' | 'node';

interface EntrypointDefinition {
  readonly label: SupportedEntrypoint;
  readonly relativePath: string;
  readonly requiredExport: string;
  readonly allowedParserPackages: ReadonlySet<string>;
}

interface CleanImportObservation {
  readonly domGlobalsDetected: readonly string[];
  readonly exportedNames: readonly string[];
  readonly spawnedProcesses: number;
}

/**
 * Evidence returned by the clean Node compatibility probe.
 */
export interface HeadlessCompatibilityResult {
  readonly compatible: boolean;
  readonly importedEntrypoints: readonly SupportedEntrypoint[];
  readonly domGlobalsDetected: readonly string[];
  readonly initializedUnrelatedParsers: readonly string[];
  readonly spawnedProcesses: number;
}

/**
 * One package in the installed production dependency closure.
 */
export interface ShippedDependencyEvidence {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly manifestPath: string;
}

/**
 * Evidence about the runtime packages distributed with the editor.
 */
export interface ShippedDependencyClosureResult {
  readonly packages: readonly ShippedDependencyEvidence[];
  readonly unapprovedRuntimePackages: readonly string[];
  readonly domRuntimePackages: readonly string[];
  readonly browserRuntimePackages: readonly string[];
  readonly ideRuntimePackages: readonly string[];
  readonly incompatibleLicenses: readonly string[];
  readonly allLicensesMitCompatible: boolean;
}

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

async function runCleanImport(definition: EntrypointDefinition): Promise<CleanImportObservation> {
  const entryUrl = pathToFileURL(join(packageRoot(), 'dist', definition.relativePath)).href;
  const script = `
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    let spawnedProcesses = 0;
    const originalSpawn = childProcess.spawn;
    childProcess.spawn = () => {
      spawnedProcesses += 1;
      throw new Error("Entry point attempted to spawn a process during import");
    };
    syncBuiltinESMExports();
    const imported = await import(${JSON.stringify(entryUrl)});
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
    const domGlobalsDetected = ["window", "document", "HTMLElement"]
      .filter((name) => name in globalThis);
    process.stdout.write(JSON.stringify({
      domGlobalsDetected,
      exportedNames: Object.keys(imported).sort(),
      spawnedProcesses
    }));
  `;
  const { stdout, stderr } = await execFileAsync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
    timeout: 10_000,
  });
  if (stderr.length > 0) {
    throw new Error(`Clean import wrote to stderr: ${stderr.slice(0, 200)}`);
  }

  const value: unknown = JSON.parse(stdout);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('domGlobalsDetected' in value) ||
    !isStringArray(value.domGlobalsDetected) ||
    !('exportedNames' in value) ||
    !isStringArray(value.exportedNames) ||
    !('spawnedProcesses' in value) ||
    typeof value.spawnedProcesses !== 'number'
  ) {
    throw new Error(`Clean import returned invalid evidence for ${definition.label}`);
  }
  if (!value.exportedNames.includes(definition.requiredExport)) {
    throw new Error(`${definition.label} is missing required export "${definition.requiredExport}"`);
  }
  return {
    domGlobalsDetected: value.domGlobalsDetected,
    exportedNames: value.exportedNames,
    spawnedProcesses: value.spawnedProcesses,
  };
}

async function inspectLocalImportClosure(entryPath: string): Promise<ReadonlySet<string>> {
  const pending = [entryPath];
  const visited = new Set<string>();
  const packages = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(current, 'utf8');

    for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      if (specifier.startsWith('.')) {
        pending.push(resolve(dirname(current), specifier));
      } else {
        packages.add(specifier);
      }
    }
  }
  return packages;
}

function exerciseHeadlessDependencies(): void {
  const document = Text.of(['const answer = 42;', '']);
  const changes = ChangeSet.of([{ from: document.length - 1, insert: '// ready' }], document.length);
  const updatedDocument = changes.apply(document);
  if (updatedDocument.length <= document.length) {
    throw new Error('CodeMirror state primitives did not apply the probe edit');
  }

  javascriptParser.parse('const answer = 42;');
  javascriptParser.configure({ dialect: 'ts' }).parse('const answer: number = 42;');
  parsePostgresql('select 42;');

  const position = Position.create(0, 0);
  if (position.line !== 0 || position.character !== 0) {
    throw new Error('LSP protocol position construction failed');
  }
}

/**
 * Imports every supported built entry point in its own clean Node process and
 * inspects its local module closure for disallowed parser or process imports.
 *
 * @example
 * ```ts
 * const result = await runHeadlessCompatibilityProbe();
 * if (!result.compatible) throw new Error('Headless imports are unavailable');
 * ```
 */
export async function runHeadlessCompatibilityProbe(): Promise<HeadlessCompatibilityResult> {
  const definitions: readonly EntrypointDefinition[] = [
    {
      label: 'root',
      relativePath: 'index.js',
      requiredExport: 'plainLanguageId',
      allowedParserPackages: new Set(),
    },
    {
      label: 'javascript',
      relativePath: 'languages/javascript.js',
      requiredExport: 'javascriptLanguageId',
      allowedParserPackages: new Set(['@lezer/javascript']),
    },
    {
      label: 'typescript',
      relativePath: 'languages/typescript.js',
      requiredExport: 'typescriptLanguageId',
      allowedParserPackages: new Set(['@lezer/javascript']),
    },
    {
      label: 'postgresql',
      relativePath: 'languages/postgresql.js',
      requiredExport: 'postgresqlLanguageId',
      allowedParserPackages: new Set(['pgsql-ast-parser']),
    },
    {
      label: 'node',
      relativePath: 'node.js',
      requiredExport: 'createCodeEditorNodeRuntime',
      allowedParserPackages: new Set(),
    },
  ];

  const observations = await Promise.all(definitions.map(runCleanImport));
  const importedPackages = await Promise.all(
    definitions.map((definition) => inspectLocalImportClosure(join(packageRoot(), 'dist', definition.relativePath))),
  );
  exerciseHeadlessDependencies();

  const domGlobalsDetected = [...new Set(observations.flatMap((observation) => observation.domGlobalsDetected))];
  const initializedUnrelatedParsers = [
    ...new Set(
      importedPackages.flatMap((packages, index) => {
        const allowed = definitions[index]?.allowedParserPackages ?? new Set();
        return [...packages].filter((name) => PARSER_PACKAGES.has(name) && !allowed.has(name));
      }),
    ),
  ].sort();
  const spawnedProcesses = observations.reduce((total, observation) => total + observation.spawnedProcesses, 0);

  return {
    compatible: domGlobalsDetected.length === 0 && initializedUnrelatedParsers.length === 0 && spawnedProcesses === 0,
    importedEntrypoints: definitions.map((definition) => definition.label),
    domGlobalsDetected,
    initializedUnrelatedParsers,
    spawnedProcesses,
  };
}

/**
 * Inspects installed production dependencies and their declared licenses.
 *
 * @example
 * ```ts
 * const result = await inspectShippedDependencyClosure();
 * if (!result.allLicensesMitCompatible) throw new Error('Review package licenses');
 * ```
 */
export async function inspectShippedDependencyClosure(): Promise<ShippedDependencyClosureResult> {
  const { inspectInstalledDependencyClosure } = await import('./installed-dependencies.js');
  return inspectInstalledDependencyClosure();
}
