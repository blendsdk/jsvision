import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';

import { CODE_EDITOR_SCENARIOS } from './scenarios.js';
import { createCodeEditorShowcase } from './shell.js';

const capabilities = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

const requiredQaScenarios = [
  'qa-lsp-completion',
  'qa-lsp-hover',
  'qa-lsp-signature',
  'qa-lsp-diagnostics',
  'qa-lsp-symbols',
  'qa-lsp-formatting',
  'qa-lsp-navigation',
  'qa-lsp-recovery',
  'qa-host-save-accepted',
  'qa-host-save-rejected',
  'qa-host-save-conflict',
] as const;

describe('Code Editor QA showcase', () => {
  // Each asynchronous capability must have one discoverable, self-contained manual test instead
  // of depending on a generic action whose prerequisites are invisible to the tester.
  test('provides dedicated scenarios with purpose, invocation, and expected-result guidance', () => {
    const scenarios = new Map(CODE_EDITOR_SCENARIOS.map((scenario) => [scenario.id, scenario]));

    for (const id of requiredQaScenarios) {
      const scenario = scenarios.get(id);
      expect(scenario, `missing dedicated QA scenario "${id}"`).toBeDefined();
      expect(scenario?.qa?.purpose.trim()).not.toBe('');
      expect(scenario?.qa?.steps.length).toBeGreaterThan(0);
      expect(scenario?.qa?.expected.trim()).not.toBe('');
      expect(scenario?.qa?.action).toBeDefined();
    }
  });

  // QA must invoke the capability through the same command router used by the live menu and F5
  // keybinding, then receive an inspectable result based on the capability's public outcome.
  test('runs completion through the application command path and reports visible evidence', async () => {
    const showcase = createCodeEditorShowcase(capabilities);
    const index = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'qa-lsp-completion');
    expect(index).toBeGreaterThanOrEqual(0);
    showcase.select(index);

    showcase.app.loop.emitCommand('code-editor.run-check');
    await showcase.whenQaCheckSettled();
    showcase.app.loop.renderRoot.flush();

    expect(showcase.qaResult()).toMatchObject({
      status: 'passed',
      action: 'completion',
    });
    expect(showcase.qaResult().observed).toContain('greet');
    const frame = showcase.app.loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
    expect(frame).toContain('How: F5');
    expect(frame).toContain('PASS');
  });

  // The documented F5 path must use the same command and evidence flow as the menu item.
  test('runs the selected QA check from the real F5 keybinding', async () => {
    const showcase = createCodeEditorShowcase(capabilities);
    const index = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'qa-lsp-completion');
    showcase.select(index);

    showcase.app.loop.dispatch({ type: 'key', key: 'f5', ctrl: false, alt: false, shift: false });
    await showcase.whenQaCheckSettled();

    expect(showcase.qaResult()).toMatchObject({ status: 'passed', action: 'completion' });
  });

  // Every dedicated scenario must produce its own capability-specific evidence. A menu command
  // resolving without an observable result is a failed check, not a pass.
  test('produces passing evidence for every dedicated asynchronous capability', async () => {
    const showcase = createCodeEditorShowcase(capabilities);
    for (const id of requiredQaScenarios) {
      const index = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === id);
      showcase.select(index);
      await showcase.runCurrentQaCheck();
      expect(showcase.qaResult().status, `${id} did not produce its expected evidence`).toBe('passed');
    }
  });

  // Selecting another scenario must reset stale evidence so a previous pass can never make the
  // next capability look verified before its own control is invoked.
  test('resets the QA result when the tester selects another capability', async () => {
    const showcase = createCodeEditorShowcase(capabilities);
    const completion = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'qa-lsp-completion');
    const hover = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'qa-lsp-hover');
    showcase.select(completion);
    await showcase.runCurrentQaCheck();
    expect(showcase.qaResult().status).toBe('passed');

    showcase.select(hover);
    expect(showcase.qaResult()).toMatchObject({ status: 'ready', action: 'hover' });
  });
});
