import { describe, expect, test, vi } from 'vitest';
import { CodeEditor } from '@jsvision/code-editor';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot } from '@jsvision/ui';

import { codeEditorStory } from '../kitchen-sink/stories/code-editor.story.js';
import { CODE_EDITOR_SCENARIOS } from './scenarios.js';

const capabilities = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Concrete fixture characteristics required for honest standalone coverage. */
const REQUIRED_FIXTURE_TRAITS = Object.freeze([
  'language-from-extension',
  'language-explicit-selection',
  'adapter-postgresql',
  'adapter-javascript',
  'adapter-typescript',
  'adapter-plain',
  'adapter-missing',
  'source-incomplete',
  'source-invalid',
  'line-ending-lf',
  'line-ending-crlf',
  'line-ending-cr',
  'unicode-invisible',
  'unicode-hostile',
  'folding-commands',
  'lifecycle-decisions',
  'theme-live-change',
  'degradation-and-recovery',
  'terminal-resize',
  'document-full-tier',
  'document-large-tier',
  'document-confirmation-tier',
]);

/** Safely reads an own data property without executing a hostile getter. */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

/** Reads the fixture's bounded, declarative demonstration tags. */
function fixtureTraits(fixture: object): readonly string[] {
  const candidate = ownValue(fixture, 'demonstrates');
  if (!Array.isArray(candidate) || candidate.length > 64) return [];
  return candidate.filter((entry): entry is string => typeof entry === 'string');
}

describe('standalone fixture coverage', () => {
  test('provides real fixtures for every required language, source, lifecycle, and size condition', () => {
    // Each required condition must be attached to a resettable fixture, not merely mentioned in
    // scenario prose or in an inventory label.
    const owners = new Map<string, string[]>();
    for (const scenario of CODE_EDITOR_SCENARIOS) {
      const fixture = scenario.fixture();
      for (const trait of fixtureTraits(fixture)) {
        const current = owners.get(trait) ?? [];
        current.push(scenario.id);
        owners.set(trait, current);
      }
    }

    for (const trait of REQUIRED_FIXTURE_TRAITS) {
      expect(owners.get(trait), `missing fixture for "${trait}"`).toEqual(expect.arrayContaining([expect.any(String)]));
    }
  });

  test('uses source bytes and mounted public state to substantiate sensitive fixture claims', () => {
    // Line endings, hostile Unicode, explicit language selection, missing adapters, and size
    // tiers are easy to mislabel, so their fixtures must expose directly inspectable evidence.
    const scenariosByTrait = new Map(
      CODE_EDITOR_SCENARIOS.flatMap((scenario) =>
        fixtureTraits(scenario.fixture()).map((trait) => [trait, scenario] as const),
      ),
    );

    expect(scenariosByTrait.get('line-ending-lf')?.fixture().text).toMatch(/(?<!\r)\n/u);
    expect(scenariosByTrait.get('line-ending-crlf')?.fixture().text).toContain('\r\n');
    expect(scenariosByTrait.get('line-ending-cr')?.fixture().text).toMatch(/\r(?!\n)/u);
    expect(scenariosByTrait.get('unicode-invisible')?.fixture().text).toMatch(/[\u200B\u200C\u200D\u2060]/u);
    expect(scenariosByTrait.get('unicode-hostile')?.fixture().text).toMatch(/[\u001B\u202A-\u202E\u2066-\u2069]/u);

    for (const trait of [
      'language-from-extension',
      'language-explicit-selection',
      'adapter-missing',
      'document-full-tier',
      'document-large-tier',
      'document-confirmation-tier',
    ]) {
      const scenario = scenariosByTrait.get(trait);
      expect(scenario, `missing inspectable "${trait}" scenario`).toBeDefined();
      if (scenario === undefined) continue;
      const surface = scenario.mount({ capabilities, width: 64, height: 12 });
      const editor = 'editor' in surface ? surface.editor : surface;
      const fixture = scenario.fixture();
      expect(ownValue(fixture, 'expectedPublicState'), `${trait} lacks expected public evidence`).toMatchObject(
        editor.controller.publicState,
      );
      editor.dispose();
    }
  });
});

describe('repository kitchen-sink Code Editor story', () => {
  test('enables every capability named in its blurb on the mounted editor', async () => {
    // The concise repository story may advertise only capabilities that are enabled on its real
    // editor instance; line numbers are part of that promise.
    let editor: CodeEditor | undefined;
    const dispose = createRoot((disposeRoot) => {
      const view = codeEditorStory.build({ caps: capabilities, width: 72, height: 16 });
      editor = view.children.find((child) => child instanceof CodeEditor);
      return disposeRoot;
    });

    expect(editor).toBeInstanceOf(CodeEditor);
    if (editor === undefined) {
      dispose();
      return;
    }
    expect(editor.lineNumbers).toBe(true);
    expect(editor.controller.document.readOnly).toBe(false);
    editor.controller.document.setSelection({ anchor: 0, head: 8 });
    expect(editor.controller.publicState.selectionSize).toBe(8);
    editor.controller.document.setSelection({
      anchor: editor.controller.document.text.length,
      head: editor.controller.document.text.length,
    });
    editor.setSearchQuery('greet');
    editor.execute('search.next');
    expect(editor.controller.publicState.selectionSize).toBe('greet'.length);

    await vi.waitFor(() => {
      expect(editor?.controller.languageResult?.syntax.length).toBeGreaterThan(0);
      expect(editor?.controller.folds.length).toBeGreaterThan(0);
      expect(editor?.controller.diagnostics.length).toBeGreaterThan(0);
      expect(editor?.retainedState.completionItems).toBeGreaterThan(0);
    });
    dispose();
  });
});
