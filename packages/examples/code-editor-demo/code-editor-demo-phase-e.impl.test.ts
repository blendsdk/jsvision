import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { CodeEditorWindow } from '@jsvision/code-editor';

import {
  CODE_EDITOR_SCENARIOS,
  disposeCodeEditorScenario,
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  runCodeEditorScenarioJourney,
} from './scenarios.js';
import { createCodeEditorShowcase } from './shell.js';
import { DemoLspSession } from './demo-lsp-session.js';

const terminalProfiles = [
  resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile,
  resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'mono' } }).profile,
  resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
  }).profile,
];

describe('Code Editor executable evidence implementation', () => {
  test('keeps protocol, host, and isolation evidence immutable and bounded', async () => {
    const intelligence = await runCodeEditorScenarioJourney('language-intelligence');
    const shared = await runCodeEditorScenarioJourney('shared-session-editors');

    expect(Object.isFrozen(intelligence.protocolEvidence)).toBe(true);
    expect(Object.isFrozen(intelligence.hostDecisionEvidence)).toBe(true);
    expect(intelligence.protocolEvidence).toHaveLength(5);
    expect(intelligence.hostDecisionEvidence).toHaveLength(3);
    expect(intelligence.protocolEvidence.length).toBeLessThanOrEqual(16);
    expect(intelligence.hostDecisionEvidence.length).toBeLessThanOrEqual(8);
    expect(shared.documents).toHaveLength(2);
    expect(Object.isFrozen(shared.documents)).toBe(true);
  });

  test('bounds live transport retention without storing request content', async () => {
    const session = new DemoLspSession();
    for (let index = 0; index < 80; index += 1) {
      await session.notify('textDocument/didChange', { text: `private-${index}` });
    }
    expect(session.inspect().recentMethods).toHaveLength(32);
    expect(JSON.stringify(session.inspect())).not.toContain('private-');

    session.request(100, 'textDocument/hover', { text: 'private-source' }, () => undefined);
    expect(session.inspect().pendingRequests).toBe(1);
    session.cancel(100);
    expect(session.inspect().pendingRequests).toBe(0);

    let diagnosticDeliveries = 0;
    session.subscribeDiagnostics(() => {
      throw new Error('hostile diagnostic listener');
    });
    session.subscribeDiagnostics(() => {
      diagnosticDeliveries += 1;
    });
    session.publishDiagnostic('memory://safe', 0);
    expect(diagnosticDeliveries).toBe(1);

    let disposedResponses = 0;
    session.request(101, 'textDocument/hover', {}, () => {
      throw new Error('hostile response listener');
    });
    session.request(102, 'textDocument/hover', {}, () => {
      disposedResponses += 1;
    });
    session.dispose();
    expect(disposedResponses).toBe(1);
    expect(session.inspect().pendingRequests).toBe(0);
    expect(session.state).toBe('closed');
  });

  test('drives all three host save controls through the live scenario', async () => {
    const scenario = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === 'language-intelligence');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const surface = scenario.mount({ capabilities: terminalProfiles[0], width: 72, height: 16 });

    await runCodeEditorScenarioAction(surface, 'host-accept');
    await runCodeEditorScenarioAction(surface, 'host-reject');
    await runCodeEditorScenarioAction(surface, 'host-conflict');

    expect(inspectCodeEditorScenario(surface).hostEffects).toEqual(
      expect.arrayContaining(['decision:accepted', 'decision:rejected', 'decision:version-conflict']),
    );
    const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
    expect(editor.controller.publicState.modified).toBe(true);
    editor.dispose();
  });

  test('projects hostile and themed fixtures safely across terminal profiles', () => {
    for (const capabilities of terminalProfiles) {
      for (const scenarioId of ['safe-terminal-text', 'themes-and-fallbacks']) {
        const scenario = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === scenarioId);
        expect(scenario).toBeDefined();
        if (scenario === undefined) continue;
        const surface = scenario.mount({ capabilities, width: 36, height: 8 });
        const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
        const frame = editor.project({ caps: capabilities, width: 36, height: 8 });
        expect(frame.cells).toHaveLength(8);
        expect(frame.cells.every((row) => row.length === 36)).toBe(true);
        expect(
          frame.cells.flat().some((cell) => /[\u001B\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(cell.text)),
        ).toBe(false);
        editor.dispose();
      }
    }
  });

  test('keeps all panes and editor chrome fitted through repeated terminal resize', () => {
    const showcase = createCodeEditorShowcase(terminalProfiles[0]);
    for (const size of [
      { width: 100, height: 30 },
      { width: 44, height: 12 },
      { width: 80, height: 24 },
    ]) {
      showcase.app.loop.resize(size);
      showcase.app.loop.renderRoot.flush();
      const editor = showcase.activeEditor();
      const window = editor.parent;
      expect(window).toBeInstanceOf(CodeEditorWindow);
      if (!(window instanceof CodeEditorWindow)) continue;
      expect(window.bounds.x + window.bounds.width).toBeLessThanOrEqual(size.width);
      expect(window.bounds.y + window.bounds.height).toBeLessThanOrEqual(size.height);
      expect(editor.layout.rect?.width).toBe(
        window.layout.rect?.width === undefined ? undefined : window.layout.rect.width - 2,
      );
      expect(editor.layout.rect?.height).toBe(
        window.layout.rect?.height === undefined ? undefined : window.layout.rect.height - 3,
      );
    }
    showcase.activeEditor().dispose();
  });

  test('focuses and edits the secondary shared-session editor from the shell keymap', async () => {
    const showcase = createCodeEditorShowcase(terminalProfiles[0]);
    const index = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'shared-session-editors');
    showcase.select(index);
    const primary = showcase.activeEditor();
    const primaryText = primary.controller.document.text;

    showcase.app.loop.dispatch({ type: 'key', key: 'tab', ctrl: true, alt: false, shift: false });
    const secondary = showcase.activeEditor();
    expect(secondary).not.toBe(primary);
    showcase.app.loop.dispatch({ type: 'key', key: 'x', codepoint: 120, ctrl: false, alt: false, shift: false });
    await secondary.whenIdle();

    expect(secondary.controller.document.text).toContain('x');
    expect(primary.controller.document.text).toBe(primaryText);
    if (primary.parent instanceof CodeEditorWindow) await disposeCodeEditorScenario(primary.parent);
  });
});
