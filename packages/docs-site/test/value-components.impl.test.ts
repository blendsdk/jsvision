/**
 * Implementation hardening for feedback, date, and color laboratories.
 *
 * These checks cover timer ownership, date bounds, transient popup rebuilding, invalid custom
 * colors, deterministic manual animation, and complete teardown beyond the public behavior oracle.
 */
import {
  at,
  ColorSwatch,
  Calendar,
  ColorPicker,
  createEventLoop,
  createRoot,
  DatePicker,
  Dialog,
  Group,
  Input,
  resolveCapabilities,
  runSpinner,
  signal,
  Spinner,
  toISO,
  View,
} from '@jsvision/ui';
import type { Application, TimerSeam } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { absoluteOrigin, buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';
import { VALUE_COMPONENT_EXAMPLE_IDS } from './contracts/value-components.js';

/** Load a feedback/date/color definition from the public lazy registry. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing value-component example ${exampleId}`);
  return (await entry.load()).default;
}

/** Return the first descendant matching a public widget class. */
function widgetIn<T extends View>(root: View, type: abstract new (...args: never[]) => T): T {
  const widget = viewsIn(root).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in value-component laboratory`);
  return widget;
}

/**
 * Mount one family laboratory and guarantee loop and reactive-owner disposal.
 *
 * @param exampleId Registry ID to build.
 * @param inspect Assertions to run while mounted.
 */
async function withLab(exampleId: string, inspect: (app: Application, dialog: Dialog) => void): Promise<void> {
  const definition = await loadDefinition(exampleId);
  createRoot((dispose) => {
    const { app, dialog } = buildLabExample(exampleId, definition);
    try {
      inspect(app, dialog);
    } finally {
      try {
        app.loop.dispose();
      } finally {
        dispose();
      }
    }
  });
}

/** Build a deterministic one-shot timer seam with an explicitly fireable pending callback. */
function fakeTimer(): {
  readonly seam: TimerSeam;
  readonly fire: () => void;
  readonly cleared: () => number;
  readonly pending: () => boolean;
} {
  let callback: (() => void) | undefined;
  let clears = 0;
  let nextHandle = 1;
  const seam: TimerSeam = {
    setTimer: (fn) => {
      callback = fn;
      return nextHandle++;
    },
    clearTimer: () => {
      callback = undefined;
      clears += 1;
    },
  };
  return {
    seam,
    fire: () => {
      const pending = callback;
      callback = undefined;
      pending?.();
    },
    cleared: () => clears,
    pending: () => callback !== undefined,
  };
}

describe('feedback ownership and determinism', () => {
  test('runSpinner re-arms deterministically and stop clears exactly one pending timer', () => {
    const frame = signal(0);
    const timer = fakeTimer();
    const stop = runSpinner(frame, { intervalMs: 80, timer: timer.seam });
    expect(timer.pending()).toBe(true);
    timer.fire();
    timer.fire();
    expect(frame()).toBe(2);
    expect(timer.pending()).toBe(true);
    stop();
    stop();
    expect(timer.cleared()).toBe(1);
    expect(timer.pending()).toBe(false);
    timer.fire();
    expect(frame()).toBe(2);
  });

  test('Spinner laboratory advances only through its explicit manual command', async () => {
    await withLab('feedback/spinner', (app) => {
      expect(frameText(app)).toContain('Frame: 0');
      app.loop.renderRoot.flush();
      expect(frameText(app)).toContain('Frame: 0');
      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      expect(frameText(app)).toContain('Frame: 1');
    });
  });

  test('Spinner presets render distinct Unicode transitions when capabilities allow them', () => {
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { halfBlocks: true } },
    }).profile;
    const loop = createEventLoop({ width: 30, height: 3 }, { caps });
    const frame = signal(0);
    const root = new Group();
    root.add(at(new Spinner({ frame, preset: 'dots' }), 0, 0, 10, 1));
    root.add(at(new Spinner({ frame, preset: 'line' }), 0, 1, 10, 1));
    root.add(at(new Spinner({ frame, preset: 'blocks' }), 0, 2, 10, 1));
    loop.mount(root);
    try {
      loop.renderRoot.flush();
      expect([0, 1, 2].map((y) => loop.renderRoot.buffer().get(0, y)?.char)).toEqual(['⠋', '|', '▏']);
      frame.set(1);
      loop.renderRoot.flush();
      expect([0, 1, 2].map((y) => loop.renderRoot.buffer().get(0, y)?.char)).toEqual(['⠙', '/', '▎']);
    } finally {
      loop.dispose();
    }
  });
});

describe('date boundaries and popup rebuilding', () => {
  test('Calendar cursor clamps at the inclusive minimum after repeated navigation', async () => {
    await withLab('date/calendar', (app, dialog) => {
      const calendar = widgetIn(dialog, Calendar);
      for (let index = 0; index < 20; index += 1) {
        dispatchExampleAction(app, { kind: 'key', key: 'left', modifiers: [] });
      }
      dispatchExampleAction(app, { kind: 'key', key: 'enter', modifiers: [] });
      expect(calendar.value()).not.toBeNull();
      expect(toISO(calendar.value()!)).toBe('2026-07-10');
    });
  });

  test('DatePicker dismisses and rebuilds a fresh transient popup', async () => {
    await withLab('date/date-picker', (app, dialog) => {
      expect(widgetIn(dialog, DatePicker)).toBeDefined();
      const root = app.desktop?.parent ?? app.desktop;
      expect(root).toBeDefined();
      const count = (): number => (root === undefined ? 0 : viewsIn(root).length);
      const baseline = count();
      dispatchExampleAction(app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      expect(count()).toBeGreaterThan(baseline);
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(count()).toBe(baseline);
      dispatchExampleAction(app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      expect(count()).toBeGreaterThan(baseline);
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(count()).toBe(baseline);
    });
  });
});

describe('color validation and popup lifecycle', () => {
  test('ColorPicker custom field rejects a non-hex key without changing the color', async () => {
    await withLab('color/color-picker', (app, dialog) => {
      const picker = widgetIn(dialog, ColorPicker);
      dispatchExampleAction(app, { kind: 'key', key: 'down', modifiers: ['Alt'] });
      const root = app.desktop?.parent ?? app.desktop;
      if (root === undefined) throw new Error('missing application root');
      const popupInput = viewsIn(root).find(
        (view): view is Input => view instanceof Input && !viewsIn(dialog).includes(view),
      );
      expect(popupInput).toBeDefined();
      dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
      const before = popupInput?.getValueSignal()();
      dispatchExampleAction(app, { kind: 'key', key: 'g', modifiers: [] });
      expect(popupInput?.getValueSignal()()).toBe(before);
      expect(picker.value()).toBe('red');
      dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
      expect(viewsIn(root).includes(popupInput!)).toBe(false);
    });
  });

  test('ColorSwatch drag previews live and release over a cell commits once', async () => {
    await withLab('color/color-swatch', (app, dialog) => {
      const swatch = widgetIn(dialog, ColorSwatch);
      const origin = absoluteOrigin(swatch);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'drag',
        button: 'left',
        at: { x: origin.x + 4, y: origin.y },
        to: { x: origin.x + 7, y: origin.y },
      });
      expect(swatch.value()).toBe('blue');
      expect(frameText(app)).toContain('Commits: 1');
      const match = /Input: (\d+)/.exec(frameText(app));
      expect(Number(match?.[1] ?? 0)).toBeGreaterThan(1);
    });
  });
});

test('every feedback/date/color laboratory unmounts its complete dialog subtree', async () => {
  for (const exampleId of VALUE_COMPONENT_EXAMPLE_IDS) {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      const descendants = viewsIn(dialog);
      try {
        expect(descendants.every((view) => view.mounted)).toBe(true);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
      expect(descendants.every((view) => !view.mounted)).toBe(true);
    });
  }
});
