import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';

import * as scenarioModule from './scenarios.js';

type CapabilityStatus = 'interactive' | 'automated-only' | 'unsupported';

interface CapabilityEntry {
  readonly id: string;
  readonly title: string;
  readonly status: CapabilityStatus;
  readonly scenarioIds: readonly string[];
  readonly reason?: string;
  readonly evidence?: {
    readonly scenarioId: string;
    readonly interaction: 'scenario-selection' | 'action' | 'native-window';
    readonly action?: string;
    readonly observable: string;
  };
}

/** Capabilities whose distinct behavior must remain discoverable in the standalone showcase. */
const REQUIRED_INTERACTIVE_CAPABILITIES = Object.freeze([
  'surface.direct-editor',
  'surface.windowed-editor',
  'window.move',
  'window.resize',
  'window.maximize-restore',
  'editing.text-input',
  'editing.selection',
  'editing.modern-keyboard',
  'editing.search',
  'editing.history',
  'editing.clipboard',
  'editing.read-only',
  'gutter.line-numbers',
  'language.postgresql',
  'language.javascript',
  'language.typescript',
  'language.plain-text',
  'language.syntax-highlighting',
  'language.brackets',
  'language.folding',
  'language.switching',
  'lsp.completion',
  'lsp.diagnostics',
  'lsp.navigation',
  'lsp.formatting',
  'host.authorization',
  'theme.hybrid',
  'terminal.unicode',
  'terminal.hostile-text',
  'document.full-tier',
  'document.large-tier',
] as const);

/** Reads the optional inventory export without making its absence a module-loading failure. */
function capabilityInventory(): readonly CapabilityEntry[] {
  const descriptor = Object.getOwnPropertyDescriptor(scenarioModule, 'CODE_EDITOR_CAPABILITY_INVENTORY');
  if (descriptor === undefined) return [];
  const value = 'value' in descriptor ? descriptor.value : descriptor.get?.();
  if (!Array.isArray(value)) return [];
  return value.filter(isCapabilityEntry);
}

/** Rejects malformed inventory values before assertions consume their fields. */
function isCapabilityEntry(value: unknown): value is CapabilityEntry {
  if (typeof value !== 'object' || value === null) return false;
  const id = Object.getOwnPropertyDescriptor(value, 'id');
  const title = Object.getOwnPropertyDescriptor(value, 'title');
  const status = Object.getOwnPropertyDescriptor(value, 'status');
  const scenarioIds = Object.getOwnPropertyDescriptor(value, 'scenarioIds');
  const evidence = Object.getOwnPropertyDescriptor(value, 'evidence');
  return (
    id !== undefined &&
    'value' in id &&
    typeof id.value === 'string' &&
    title !== undefined &&
    'value' in title &&
    typeof title.value === 'string' &&
    status !== undefined &&
    'value' in status &&
    (status.value === 'interactive' || status.value === 'automated-only' || status.value === 'unsupported') &&
    scenarioIds !== undefined &&
    'value' in scenarioIds &&
    Array.isArray(scenarioIds.value) &&
    scenarioIds.value.every((item: unknown) => typeof item === 'string') &&
    (evidence === undefined || ('value' in evidence && typeof evidence.value === 'object'))
  );
}

describe('Code Editor capability inventory', () => {
  test('names every required interactive capability at user-visible granularity', () => {
    const inventory = capabilityInventory();
    const byId = new Map(inventory.map((entry) => [entry.id, entry]));

    expect(new Set(inventory.map((entry) => entry.id)).size).toBe(inventory.length);
    for (const id of REQUIRED_INTERACTIVE_CAPABILITIES) {
      expect(byId.get(id), `missing capability inventory entry "${id}"`).toMatchObject({
        id,
        status: 'interactive',
      });
    }
  });

  test('backs every interactive claim with a reachable scenario and records every gap honestly', () => {
    const inventory = capabilityInventory();
    const scenarioIds = new Set(scenarioModule.CODE_EDITOR_SCENARIOS.map((scenario) => scenario.id));

    expect(inventory.length).toBeGreaterThan(REQUIRED_INTERACTIVE_CAPABILITIES.length);
    for (const entry of inventory) {
      expect(entry.title.trim(), `${entry.id} requires a visible title`).not.toBe('');
      if (entry.status === 'interactive') {
        expect(entry.scenarioIds.length, `${entry.id} has no interactive scenario`).toBeGreaterThan(0);
        for (const scenarioId of entry.scenarioIds) {
          expect(scenarioIds.has(scenarioId), `${entry.id} points to missing scenario "${scenarioId}"`).toBe(true);
        }
        expect(entry.evidence, `${entry.id} requires observable evidence`).toBeDefined();
        if (entry.evidence?.interaction === 'action') {
          const scenario = scenarioModule.CODE_EDITOR_SCENARIOS.find(
            (candidate) => candidate.id === entry.evidence?.scenarioId,
          );
          expect(scenario?.actions, `${entry.id} action is not reachable`).toContain(entry.evidence.action);
        }
      } else {
        expect(entry.scenarioIds, `${entry.id} must not claim an interactive scenario`).toEqual([]);
        expect(entry.reason?.trim(), `${entry.id} requires an honest coverage reason`).not.toBe('');
      }
    }
  });

  test('provides dedicated direct-editor and structural-folding scenarios', () => {
    const direct = scenarioModule.CODE_EDITOR_SCENARIOS.find((scenario) => scenario.id === 'direct-editor');
    const folding = scenarioModule.CODE_EDITOR_SCENARIOS.find((scenario) => scenario.id === 'structural-folding');

    expect(direct?.mount).toBeTypeOf('function');
    expect(folding?.actions).toContain('fold');
    expect(folding?.description.toLowerCase()).toContain('fold');
  });

  test('switches the live language and proves PostgreSQL fold round-tripping', async () => {
    const context = {
      capabilities: resolveCapabilities({ env: {}, platform: 'linux' }).profile,
      width: 60,
      height: 12,
    };
    const languageScenario = scenarioModule.CODE_EDITOR_SCENARIOS.find(
      (scenario) => scenario.id === 'language-gallery',
    );
    const postgresScenario = scenarioModule.CODE_EDITOR_SCENARIOS.find(
      (scenario) => scenario.id === 'postgresql-folding',
    );
    expect(languageScenario).toBeDefined();
    expect(postgresScenario).toBeDefined();
    if (languageScenario === undefined || postgresScenario === undefined) return;

    const languageSurface = languageScenario.mount(context);
    const languageEditor = 'editor' in languageSurface ? languageSurface.editor : languageSurface;
    expect(languageEditor.controller.publicState.language).toBe('postgresql');
    await scenarioModule.runCodeEditorScenarioAction(languageSurface, 'language');
    expect(languageEditor.controller.publicState.language).toBe('javascript');

    const postgresSurface = postgresScenario.mount(context);
    const postgresEditor = 'editor' in postgresSurface ? postgresSurface.editor : postgresSurface;
    const original = postgresEditor.controller.document.text;
    await scenarioModule.runCodeEditorScenarioAction(postgresSurface, 'fold');
    expect(postgresEditor.controller.folds.length).toBeGreaterThan(0);
    await scenarioModule.runCodeEditorScenarioAction(postgresSurface, 'fold');
    expect(postgresEditor.controller.folds).toEqual([]);
    expect(postgresEditor.controller.document.text).toBe(original);
  });
});
