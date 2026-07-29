/**
 * Implementation coverage for control-example lifecycle, boundary, and disabled-state details.
 *
 * The family specification owns user-visible objectives. These tests harden the reusable examples
 * against state leakage and exercise edge paths that would make the teaching feedback misleading.
 */
import { createRoot, MultiCheckGroup, signal } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';
import { NEW_CONTROL_EXAMPLE_IDS } from './contracts/controls.js';

/** Load one control example through the same lazy registry path used by the documentation site. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing controls example ${exampleId}`);
  return (await entry.load()).default;
}

/** Run assertions against a mounted example and guarantee owner/loop disposal. */
function withExample(
  exampleId: string,
  definition: ExampleDefinition,
  assertMounted: (app: ReturnType<typeof buildLabExample>['app']) => void,
): void {
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition);
    try {
      assertMounted(app);
    } finally {
      try {
        app.loop.dispose();
      } finally {
        dispose();
      }
    }
    expect(dialog.mounted).toBe(false);
  });
}

/** Dispatch a plain key or Alt-hotkey through the real application loop. */
function press(app: ReturnType<typeof buildLabExample>['app'], key: string, alt = false): void {
  dispatchExampleAction(app, { kind: 'key', key, modifiers: alt ? ['Alt'] : [] });
}

describe('control example lifecycle', () => {
  test.each(NEW_CONTROL_EXAMPLE_IDS)('%s rebuilds with identical frame and focus', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    let firstFrame = '';
    let firstFocus = '';
    withExample(exampleId, definition, (app) => {
      firstFrame = frameText(app);
      firstFocus = app.loop.getFocused()?.constructor.name ?? 'none';
      press(app, 'tab');
    });
    withExample(exampleId, definition, (app) => {
      expect(frameText(app)).toBe(firstFrame);
      expect(app.loop.getFocused()?.constructor.name ?? 'none').toBe(firstFocus);
    });
  });

  test.each(NEW_CONTROL_EXAMPLE_IDS)('%s has no duplicate dialog accelerator', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    withExample(exampleId, definition, (app) => {
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error(`${exampleId} did not create a desktop`);
      const accelerators = desktop.children.flatMap((child) => viewsIn(child).flatMap((view) => view.accelerators()));
      expect(new Set(accelerators).size).toBe(accelerators.length);
    });
  });
});

describe('focus, reset, and disabled control behavior', () => {
  test('Label reset clears both fields after a linked hotkey changes focus', async () => {
    const definition = await loadDefinition('controls/label');
    withExample('controls/label', definition, (app) => {
      press(app, 'e', true);
      press(app, 'a');
      expect(frameText(app)).toContain('Email value: a');
      press(app, 'r', true);
      expect(frameText(app)).toContain('Name value: (empty)');
      expect(frameText(app)).toContain('Email value: (empty)');
    });
  });

  test('CheckGroup skips its disabled final row while wrapping upward', async () => {
    const definition = await loadDefinition('controls/check-group');
    withExample('controls/check-group', definition, (app) => {
      press(app, 'u', true);
      expect(frameText(app)).toContain('Selected: Bold');
      expect(frameText(app)).not.toContain('Selected: Bold, Underline');
      press(app, 'up');
      press(app, 'space');
      expect(frameText(app)).toContain('Selected: Bold, Strike');
    });
  });

  test('RadioGroup ignores disabled Justify and wraps to Right', async () => {
    const definition = await loadDefinition('controls/radio-group');
    withExample('controls/radio-group', definition, (app) => {
      press(app, 'j', true);
      expect(frameText(app)).toContain('Alignment: Left');
      press(app, 'up');
      expect(frameText(app)).toContain('Alignment: Right');
    });
  });

  test('MultiCheckGroup ignores disabled Remote and preserves other states', async () => {
    const definition = await loadDefinition('controls/multi-check-group');
    withExample('controls/multi-check-group', definition, (app) => {
      press(app, 'm', true);
      expect(frameText(app)).toContain('Raw indexes: [0, 2, 1, 0]');
      press(app, 'b', true);
      expect(frameText(app)).toContain('Raw indexes: [0, 0, 1, 0]');
    });
  });

  test('Switch reset restores enabled values while disabled Locked stays inert', async () => {
    const definition = await loadDefinition('controls/switch');
    withExample('controls/switch', definition, (app) => {
      press(app, 'l', true);
      press(app, 'w', true);
      press(app, 's', true);
      expect(frameText(app)).toContain('Wi-Fi: On · Sync: Off · Locked: Off');
      press(app, 'r', true);
      expect(frameText(app)).toContain('Wi-Fi: Off · Sync: On · Locked: Off');
    });
  });
});

describe('selection and callback boundaries', () => {
  test.each([
    ['controls/label', 'Alt+N/E or click focuses · Tab skips Labels · Alt+R resets'],
    ['controls/check-group', 'Alt+B/I/S/U targets rows · Alt+R resets'],
    ['controls/radio-group', 'Alt+L/C/R/J selects · disabled J is inert · Alt+E resets'],
    ['controls/multi-check-group', 'Alt+S/B/C/M cycles · disabled M is inert · Alt+R resets'],
    ['controls/switch', 'Alt+W/S/L toggles · disabled L is inert · Alt+R resets'],
  ] as const)('%s renders its complete instruction suffix', async (exampleId, instruction) => {
    const definition = await loadDefinition(exampleId);
    withExample(exampleId, definition, (app) => {
      expect(frameText(app)).toContain(instruction);
    });
  });

  test('Slider reports one callback pair per changed key and none at a clamped boundary', async () => {
    const definition = await loadDefinition('controls/slider');
    withExample('controls/slider', definition, (app) => {
      press(app, 'end');
      press(app, 'end');
      expect(frameText(app)).toContain('Horizontal: 100 · previews 1 · commits 1');
      press(app, 'home');
      expect(frameText(app)).toContain('Horizontal: 0 · previews 2 · commits 2');
    });
  });

  test('MultiCheckGroup normalizes a negative pressed row without rewriting other external indexes', () => {
    const value = signal([-2, 9]);
    const group = new MultiCheckGroup({
      items: ['~A~lpha', '~B~eta'],
      states: ' xX',
      value,
    });
    group.onEvent({
      event: { type: 'key', key: 'a', ctrl: false, alt: true, shift: false },
      handled: false,
      focusView: () => undefined,
    });
    expect(value()).toEqual([2, 9]);
  });
});
