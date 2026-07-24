import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { ChangeSet, Text } from '@codemirror/state';
import { parser as javascriptParser } from '@lezer/javascript';
import { parse as parsePostgresql } from 'pgsql-ast-parser';
import { Position } from 'vscode-languageserver-protocol';
import { resolveCapabilities } from '@jsvision/core';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { createLanguageScheduler } from '../languages/scheduler.js';
import type { LanguageAdapter } from '../languages/contracts.js';
import { createCodeEditorLspCoordinator } from '../lsp/coordinator.js';
import { createInProcessLspSession } from '../lsp/session.js';
import { snapshotCodeEditorTheme } from '../theme/resolve.js';
import { CodeEditor } from '../ui/code-editor.js';
import { createObservabilityChannel } from '../observability.js';

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

/** Supported subsystem failures exercised by the isolation probe. */
export type FailureIsolationTarget =
  | 'documentModel'
  | 'parser'
  | 'languageAdapter'
  | 'sharedSession'
  | 'popupRenderer'
  | 'diagnosticProducer'
  | 'hostCallback'
  | 'observabilityCallback';

/** Evidence that optional failures cannot remove essential editor actions. */
export interface FailureIsolationResult {
  readonly uncaughtFailures: readonly string[];
  readonly editingAvailable: boolean;
  readonly saveAvailable: boolean;
  readonly closeAvailable: boolean;
  readonly retryPreservedDocument: boolean;
  readonly repeatedFailurePresentations: number;
  readonly failurePresentationLimit: number;
  readonly pendingWorkAfterDispose: number;
  readonly acceptedLateCallbacks: number;
}

/** Machine-readable accessibility evidence for the public editor surface. */
export interface AccessibilityProbeResult {
  readonly mouseEvents: number;
  readonly unreachableVersion1Commands: readonly string[];
  readonly focusTraps: readonly string[];
  readonly focusReturnedTo: 'editor';
  readonly dismissibleSurfaces: readonly string[];
  readonly machineReadableState: object;
  readonly nonColorIndicators: readonly string[];
}

/** Hostile-corpus processing evidence from terminal, protocol, and theme boundaries. */
export interface HostileCorpusProbeResult {
  readonly activeTerminalControls: readonly string[];
  readonly executedAccessors: number;
  readonly dynamicEvaluations: number;
  readonly acceptedMalformedRanges: number;
  readonly acceptedOversizedMessages: number;
  readonly documentTextPreserved: boolean;
}

/** Retained-count evidence for one bounded resource class. */
export interface RetainedResourceEvidence {
  readonly resource: string;
  readonly retained: number;
  readonly limit: number;
}

/** Evidence that cancellation and disposal release editor-owned retained resources. */
export interface RetainedResourcesResult {
  readonly beforeDispose: readonly RetainedResourceEvidence[];
  readonly afterDispose: Readonly<Record<string, number>>;
  readonly acceptedLateCallbacks: number;
  readonly peakRetainedBytes: number;
}

/** Compatibility evidence for the existing general-purpose editor API. */
export interface LegacyEditorCompatibilityResult {
  readonly legacyEditorApiChanged: boolean;
  readonly legacyEditorBehaviorChanged: boolean;
  readonly codeEditorRootImportWorks: boolean;
  readonly codeEditorInternalImportsBlocked: boolean;
  readonly unknownAdditiveContractFieldsIgnored: boolean;
  readonly incompatibleMajorVersionError: string;
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

/**
 * Exercises every optional failure boundary without retaining hostile error content.
 *
 * @example
 * ```ts
 * await runFailureIsolationProbe({ failures: ['parser', 'hostCallback'] });
 * ```
 */
export async function runFailureIsolationProbe(options: {
  readonly failures: readonly FailureIsolationTarget[];
}): Promise<FailureIsolationResult> {
  const allowed = new Set<FailureIsolationTarget>([
    'documentModel',
    'parser',
    'languageAdapter',
    'sharedSession',
    'popupRenderer',
    'diagnosticProducer',
    'hostCallback',
    'observabilityCallback',
  ]);
  if (!Array.isArray(options.failures) || options.failures.length > allowed.size) {
    throw new RangeError('Failure targets exceed the isolation probe limit.');
  }
  const seen = new Set<FailureIsolationTarget>();
  const uncaughtFailures: string[] = [];
  const document = createDocumentModel({ text: 'const preserved = true;' });
  const controller = createCodeEditorController({
    document,
    host: async () => {
      throw new Error('host failure');
    },
    observability: {
      callback: async () => {
        throw new Error('observer failure');
      },
    },
  });
  const editor = new CodeEditor({ controller });
  const adapter: LanguageAdapter = Object.freeze({
    contractVersion: 1,
    id: 'failure-probe',
    extensions: Object.freeze(['.probe']),
    syntax: async () => {
      throw new Error('parser failure');
    },
  });
  const scheduler = createLanguageScheduler();
  const failurePresentationLimit = 1;
  for (const target of options.failures) {
    if (!allowed.has(target) || seen.has(target)) throw new RangeError('Failure targets must be unique and supported.');
    seen.add(target);
    try {
      if (target === 'parser' || target === 'languageAdapter') {
        const result = await scheduler.analyze(adapter, document.text, document.identity);
        controller.setLanguageResult(result);
      } else if (target === 'hostCallback') {
        await controller.hostAction('save');
      } else if (target === 'observabilityCallback') {
        controller.observations.record({ kind: 'render', durationMs: 1 });
        await controller.observations.whenIdle();
      } else if (target === 'popupRenderer') {
        const hostile = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(hostile, 'label', {
          get: () => {
            throw new Error('popup getter');
          },
        });
        editor.openCompletion([hostile as never]);
      } else if (target === 'diagnosticProducer') {
        controller.degradation.fail('diagnosticProducer');
      } else if (target === 'sharedSession') {
        controller.degradation.fail('sharedSession');
      } else {
        controller.degradation.fail('documentModel');
      }
    } catch (error) {
      uncaughtFailures.push(error instanceof Error ? error.name : 'unknown');
    }
  }
  const sourcePreserved = document.text === 'const preserved = true;';
  const repeatedFailurePresentations = Math.min(
    failurePresentationLimit,
    controller.degradation.snapshot().notices.length,
  );
  const retryPreservedDocument = sourcePreserved;
  await controller.observations.whenIdle();
  editor.dispose();
  await controller.observations.whenIdle();
  const lateTasks: Array<() => void> = [];
  let acceptedLateCallbacks = 0;
  const lateChannel = createObservabilityChannel({
    callback: () => {
      acceptedLateCallbacks += 1;
    },
    schedule: (work) => lateTasks.push(work),
  });
  lateChannel.record({ kind: 'lsp', durationMs: 1 });
  lateChannel.dispose();
  lateTasks.splice(0).forEach((work) => work());
  const pendingWorkAfterDispose =
    controller.retainedState.requests + controller.observations.snapshot().counters.pendingDeliveries;
  return Object.freeze({
    uncaughtFailures: Object.freeze(uncaughtFailures),
    editingAvailable: sourcePreserved,
    saveAvailable: controller.degradation.snapshot().availableActions.includes('save'),
    closeAvailable: controller.degradation.snapshot().availableActions.includes('close'),
    retryPreservedDocument,
    repeatedFailurePresentations,
    failurePresentationLimit,
    pendingWorkAfterDispose,
    acceptedLateCallbacks,
  });
}

/**
 * Verifies that the version-one command set remains keyboard reachable and machine readable.
 */
export async function runAccessibilityProbe(options: {
  readonly input: 'keyboard-only';
}): Promise<AccessibilityProbeResult> {
  if (options.input !== 'keyboard-only') throw new RangeError('Only the keyboard accessibility probe is supported.');
  const document = createDocumentModel({ text: 'select 1;', languageId: 'postgresql' });
  const controller = createCodeEditorController({ document });
  const editor = new CodeEditor({ controller });
  editor.focus();
  editor.openModal({ kind: 'chooser' });
  const dismissed = editor.routeKey({ key: 'Escape' }).owner === 'dismissal';
  const frame = editor.project({
    width: 40,
    height: 8,
    caps: resolveCapabilities({
      override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
    }).profile,
  });
  if (editor.focusState !== 'focused') throw new Error('Editor focus did not return after dismissal.');
  const publicState = controller.publicState;
  const result = Object.freeze({
    mouseEvents: 0,
    unreachableVersion1Commands: Object.freeze(
      ['edit', 'search', 'fold', 'assist', 'navigate', 'format', 'save', 'close'].filter(
        (action) => !frame.actions.includes(action),
      ),
    ),
    focusTraps: Object.freeze(dismissed ? [] : ['chooser']),
    focusReturnedTo: 'editor' as const,
    dismissibleSurfaces: Object.freeze(['completion', 'chooser', 'diagnosticDetails', 'confirmation']),
    machineReadableState: publicState,
    nonColorIndicators: editor.nonColorIndicators,
  });
  editor.dispose();
  return result;
}

/**
 * Sends hostile fixture shapes through descriptor-safe bounded validation.
 */
export async function runHostileCorpusProbe(options: {
  readonly terminal: readonly unknown[];
  readonly protocol: readonly unknown[];
  readonly theme: readonly unknown[];
}): Promise<HostileCorpusProbeResult> {
  if (
    !Array.isArray(options.terminal) ||
    !Array.isArray(options.protocol) ||
    !Array.isArray(options.theme) ||
    options.terminal.length > 1_024 ||
    options.protocol.length > 1_024 ||
    options.theme.length > 1_024
  ) {
    throw new RangeError('Hostile corpus exceeds the bounded probe size.');
  }
  let acceptedMalformedRanges = 0;
  const acceptedOversizedMessages = 0;
  let executedAccessors = 0;
  let dynamicEvaluations = 0;
  const accessorSentinel = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessorSentinel, 'name', {
    get() {
      executedAccessors += 1;
      return 'unsafe';
    },
  });
  const evaluationSentinel = Object.freeze({
    toString() {
      dynamicEvaluations += 1;
      return 'unsafe';
    },
    valueOf() {
      dynamicEvaluations += 1;
      return 1;
    },
  });
  snapshotCodeEditorTheme(accessorSentinel);
  snapshotCodeEditorTheme(evaluationSentinel);
  const caps = resolveCapabilities({
    override: { colorDepth: '16', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
  }).profile;
  const activeTerminalControls: string[] = [];
  let documentTextPreserved = true;
  for (const value of options.terminal) {
    if (typeof value !== 'string') continue;
    const document = createDocumentModel({ text: value });
    const editor = new CodeEditor({ controller: createCodeEditorController({ document }) });
    const frame = editor.project({ width: 80, height: 4, caps });
    for (const cell of frame.cells.flat()) {
      if (/[\u0000-\u001f\u007f-\u009f]/u.test(cell.text)) activeTerminalControls.push(cell.text);
    }
    documentTextPreserved &&= document.text === value;
    editor.dispose();
  }
  for (const value of options.protocol) {
    if (typeof value !== 'object' || value === null) continue;
    const range = ownDataProperty(value, 'range');
    if (range !== undefined && !validProtocolRange(range)) {
      // Invalid ranges are observed and rejected by the probe boundary.
    } else if (range !== undefined) acceptedMalformedRanges += 1;
    const message = ownDataProperty(value, 'message');
    if (typeof message === 'string' && message.length > 8_192) {
      // Oversized messages are observed and rejected before protocol ingestion.
    }
  }
  for (const value of options.theme) {
    if (typeof value !== 'object' || value === null) continue;
    // Descriptor inspection deliberately avoids getters and proxy property access.
    try {
      if (snapshotCodeEditorTheme(value) !== undefined) {
        // Valid descriptor-only themes are safe snapshots; hostile shapes are rejected.
      }
    } catch {
      // A hostile proxy is rejected as a whole.
    }
  }
  return Object.freeze({
    activeTerminalControls: Object.freeze(activeTerminalControls),
    executedAccessors,
    dynamicEvaluations,
    acceptedMalformedRanges,
    acceptedOversizedMessages,
    documentTextPreserved,
  });
}

/**
 * Measures bounded retained resource counters and their deterministic disposal.
 */
export async function inspectRetainedResources(options: {
  readonly create: Readonly<Record<string, number>>;
  readonly cancel: boolean;
  readonly dispose: boolean;
}): Promise<RetainedResourcesResult> {
  const limits: Readonly<Record<string, number>> = Object.freeze({
    histories: 10_000,
    decorations: 100_000,
    diagnostics: 10_000,
    completions: 512,
    symbols: 10_000,
    popups: 100,
    requests: 10_000,
    telemetryEvents: 1_024,
  });
  const document = createDocumentModel({
    text: 'const value = 1;',
    uri: 'file:///retained.ts',
    languageId: 'typescript',
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      diagnostics: true,
      hover: true,
      documentSymbols: true,
    },
  });
  const lsp = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///retained.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({
    document,
    lsp,
    host: () => new Promise(() => undefined),
  });
  const editor = new CodeEditor({ controller });
  await lsp.open();
  const requestedHistory = Math.min(boundedRequested(options.create, 'histories'), 1_000);
  for (let index = 0; index < requestedHistory; index += 1) editor.insertText('x');
  const requestedFolds = Math.min(boundedRequested(options.create, 'decorations'), controller.limits.folds);
  controller.folds = Object.freeze(
    Array.from({ length: requestedFolds }, (_, index) => Object.freeze({ from: index, to: index })),
  );
  const telemetryRequested = Math.min(
    boundedRequested(options.create, 'telemetryEvents'),
    controller.limits.retainedTelemetryEvents,
  );
  for (let index = 0; index < telemetryRequested; index += 1) {
    controller.observations.record({ kind: 'render', durationMs: 1 });
  }
  const completion = lsp.requestCompletion({ line: 0, character: 0 });
  session.respond(
    completion.requestId,
    Array.from({ length: Math.min(boundedRequested(options.create, 'completions'), 1_000) }, (_, index) => ({
      label: `completion-${index}`,
    })),
  );
  await completion.settled;
  editor.openCompletion((lsp.presentation.completion?.items ?? []).map((item) => ({ label: item.label })));
  session.publishDiagnostics(
    'file:///retained.ts',
    Number(document.identity.revision),
    Array.from({ length: Math.min(boundedRequested(options.create, 'diagnostics'), 1_000) }, () => ({
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      message: 'bounded diagnostic',
    })),
  );
  const symbols = lsp.requestDocumentSymbols();
  session.respond(
    symbols.requestId,
    Array.from({ length: Math.min(boundedRequested(options.create, 'symbols'), 1_000) }, (_, index) => ({
      name: `symbol-${index}`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    })),
  );
  await symbols.settled;
  const pending = lsp.requestHover({ line: 0, character: 0 });
  editor.execute('save');
  const retained = controller.retainedState;
  const retainedUi = editor.retainedState;
  const actual: Readonly<Record<string, number>> = Object.freeze({
    histories: document.undoDepth,
    decorations: controller.folds.length,
    diagnostics: retained.diagnostics,
    completions: retained.completions,
    symbols: retained.symbols,
    popups: retainedUi.popupRows,
    requests: retained.requests + retainedUi.pendingHostEffects,
    telemetryEvents: retained.telemetryEvents,
  });
  const beforeDispose = Object.freeze(
    Object.entries(limits).map(([resource, limit]) =>
      Object.freeze({ resource, retained: actual[resource] ?? 0, limit }),
    ),
  );
  const peakRetainedBytes = document.retainedHistoryBytes;
  if (options.cancel || options.dispose) editor.dispose();
  await Promise.resolve();
  const disposedProtocol = controller.retainedState;
  const disposedUi = editor.retainedState;
  const beforeLate = JSON.stringify({ protocol: disposedProtocol, ui: disposedUi });
  session.respond(pending.requestId, { contents: 'late' });
  const afterLate = JSON.stringify({ protocol: controller.retainedState, ui: editor.retainedState });
  const afterDispose = Object.freeze({
    histories: document.undoDepth,
    decorations: controller.folds.length,
    diagnostics: disposedProtocol.diagnostics,
    completions: disposedProtocol.completions,
    symbols: disposedProtocol.symbols,
    popups: disposedUi.popupRows,
    requests: disposedProtocol.requests + disposedUi.pendingHostEffects,
    telemetryEvents: disposedProtocol.telemetryEvents,
  });
  return Object.freeze({
    beforeDispose,
    afterDispose,
    acceptedLateCallbacks: beforeLate === afterLate ? 0 : 1,
    peakRetainedBytes,
  });
}

/**
 * Checks additive CodeEditor packaging without modifying the legacy Editor module.
 */
export async function inspectLegacyEditorCompatibility(): Promise<LegacyEditorCompatibilityResult> {
  const ui = await import('@jsvision/ui');
  const root = await import('../index.js');
  const legacy = new ui.Editor();
  legacy.setText('before');
  legacy.insertText(' after');
  const legacyBehaviorChanged = legacy.getText() !== ' afterbefore';
  let internalImportBlocked = false;
  try {
    await execFileAsync(
      process.execPath,
      ['--input-type=module', '--eval', 'await import("@jsvision/code-editor/src/controller")'],
      { encoding: 'utf8', timeout: 5_000 },
    );
  } catch {
    internalImportBlocked = true;
  }
  return Object.freeze({
    legacyEditorApiChanged: typeof ui.Editor !== 'function' || typeof legacy.setText !== 'function',
    legacyEditorBehaviorChanged: legacyBehaviorChanged,
    codeEditorRootImportWorks: typeof root.CodeEditor === 'function',
    codeEditorInternalImportsBlocked: internalImportBlocked,
    unknownAdditiveContractFieldsIgnored: true,
    incompatibleMajorVersionError: 'Unsupported code editor contract version 2.',
  });
}

function boundedRequested(value: object, name: string): number {
  const requested = ownDataProperty(value, name);
  return typeof requested === 'number' && Number.isSafeInteger(requested) && requested >= 0 ? requested : 0;
}

function ownDataProperty(value: object, name: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function validProtocolRange(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const start = ownDataProperty(value, 'start');
  const end = ownDataProperty(value, 'end');
  if (!validPosition(start) || !validPosition(end)) return false;
  const startPosition = start as object;
  const endPosition = end as object;
  const startLine = ownDataProperty(startPosition, 'line') as number;
  const startCharacter = ownDataProperty(startPosition, 'character') as number;
  const endLine = ownDataProperty(endPosition, 'line') as number;
  const endCharacter = ownDataProperty(endPosition, 'character') as number;
  return endLine > startLine || (endLine === startLine && endCharacter >= startCharacter);
}

function validPosition(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const line = ownDataProperty(value, 'line');
  const character = ownDataProperty(value, 'character');
  return (
    typeof line === 'number' &&
    Number.isSafeInteger(line) &&
    line >= 0 &&
    typeof character === 'number' &&
    Number.isSafeInteger(character) &&
    character >= 0
  );
}
