import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import { createRoot } from '@jsvision/ui';
import { codeEditorStory } from '../kitchen-sink/stories/code-editor.story.js';
import {
  CODE_EDITOR_DEMO_FACETS,
  CODE_EDITOR_SCENARIOS,
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  runCodeEditorScenarioJourney,
} from './scenarios.js';
import { createCodeEditorDemoSession } from './session.js';
import { createCodeEditorShowcase } from './shell.js';

const profiles = [
  resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile,
  resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'mono' } }).profile,
  resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'mono', unicode: { utf8: false } },
  }).profile,
];

describe('Code Editor showcase implementation', () => {
  test('mounts every scenario at normal and narrow dimensions across terminal profiles', () => {
    for (const capabilities of profiles) {
      for (const size of [
        { width: 80, height: 24 },
        { width: 32, height: 8 },
      ]) {
        for (const scenario of CODE_EDITOR_SCENARIOS) {
          const surface = scenario.mount({ capabilities, ...size });
          expect(surface instanceof CodeEditor || surface instanceof CodeEditorWindow).toBe(true);
          const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
          const frame = editor.project({ ...size, caps: capabilities });
          expect(frame.cells.length).toBeLessThanOrEqual(size.height);
          expect(frame.cells.every((row) => row.length <= size.width)).toBe(true);
          editor.dispose();
        }
      }
    }
  });

  test('maps every stable facet exactly once in the manifest and at least once in scenarios', () => {
    expect(new Set(CODE_EDITOR_DEMO_FACETS).size).toBe(CODE_EDITOR_DEMO_FACETS.length);
    const coverage = new Set(CODE_EDITOR_SCENARIOS.flatMap((scenario) => scenario.capabilities));
    expect([...coverage].sort()).toEqual([...CODE_EDITOR_DEMO_FACETS].sort());
  });

  test('bounds invalid dimensions and ignores interactions after exit', () => {
    const session = createCodeEditorDemoSession({
      capabilities: profiles[0],
      width: Number.NaN,
      height: Number.POSITIVE_INFINITY,
    });
    session.start();
    session.exit();
    session.interact({ kind: 'insert', text: 'ignored' });
    expect(session.snapshot()).toEqual({
      phase: 'exited',
      scenarioId: 'typescript-window',
      width: 1,
      height: 1,
      narration: ['demo started', 'demo exited'],
    });
  });

  test('executes observable local, protocol, host, hostile-text, and size-tier behavior', async () => {
    const language = await runCodeEditorScenarioJourney('language-gallery');
    expect(language.syntaxSpans).toBeGreaterThan(0);
    expect(language.actions).toEqual(
      expect.arrayContaining(['analyzed-postgresql', 'analyzed-javascript', 'analyzed-typescript']),
    );

    const intelligence = await runCodeEditorScenarioJourney('language-intelligence');
    expect(intelligence.completions).toBe(1);
    expect(intelligence.diagnostics).toBe(1);
    expect(intelligence.hostEffects).toContain('navigate');
    expect(intelligence.actions).toEqual(expect.arrayContaining(['reconnect', 'resynchronize']));

    expect((await runCodeEditorScenarioJourney('safe-terminal-text')).terminalSafe).toBe(true);
    expect((await runCodeEditorScenarioJourney('large-document-tier')).documentMode).toBe('large');
    expect(await runCodeEditorScenarioJourney('confirmation-document-tier')).toMatchObject({
      documentMode: 'reduced',
      confirmationRequired: true,
    });
  });

  test('disposes global-story editor resources and ignores late language-service continuations', async () => {
    let editor: CodeEditor | undefined;
    createRoot((dispose) => {
      const view = codeEditorStory.build({ caps: profiles[0], width: 72, height: 16 });
      editor = view.children.find((child) => child instanceof CodeEditor);
      expect(editor).toBeInstanceOf(CodeEditor);
      dispose();
    });
    await new Promise<void>((resolvePromise) => queueMicrotask(resolvePromise));
    expect(editor?.retainedState).toEqual({
      completionItems: 0,
      popupRows: 0,
      snippetPlaceholders: 0,
      pendingHostEffects: 0,
    });
    expect(editor?.controller.retainedState.requests).toBe(0);
  });

  test('drives live shell actions, host inspection, focus, and resize through public seams', async () => {
    const showcase = createCodeEditorShowcase(profiles[0]);
    const index = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'language-intelligence');
    showcase.select(index);
    const editor = showcase.activeEditor();
    const surface = editor.parent instanceof CodeEditorWindow ? editor.parent : editor;
    await runCodeEditorScenarioAction(surface, 'navigate');
    await runCodeEditorScenarioAction(surface, 'completion');
    showcase.app.loop.resize({ width: 44, height: 12 });
    showcase.app.loop.renderRoot.flush();

    expect(showcase.app.loop.getFocused()).toBe(editor);
    expect(inspectCodeEditorScenario(surface).hostEffects).toContain('navigate');
    expect(editor.controller.metrics.assistanceRequests).toBeGreaterThan(0);
    expect(showcase.app.loop.renderRoot.buffer().rows()).toHaveLength(12);
    editor.dispose();
  });
});
