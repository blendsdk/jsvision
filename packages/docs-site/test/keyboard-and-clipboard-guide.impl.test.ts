/**
 * Implementation hardening for the Keyboard & clipboard course and laboratory.
 *
 * The immutable specification proves the learner-facing contract. These checks stress selection
 * routes, application keymap precedence, browser denial, missing host adapters, repeated virtual
 * authorization transitions, and deterministic teardown.
 */
import { createKeymap } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, Input, buildKeymap, createEventLoop, createRoot, signal } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { setClipboard as setBrowserClipboard } from '@jsvision/web';
import { describe, expect, test, vi } from 'vitest';
import clipboardExample from '../examples/guides/clipboard-boundary.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import {
  copyOutcome,
  nextClipboardAuthorization,
  type ClipboardAuthorization,
} from '../src/example-fixtures/keyboard-and-clipboard/boundary.js';
import { demoShell } from '../src/demo-shell.js';
import { EXAMPLE_CAPS, EXAMPLE_VIEWPORT, buildLabExample, frameText, key } from './example-lab-harness.js';

const GUIDE_SOURCE = readFileSync(
  fileURLToPath(new URL('../guide/keyboard-and-clipboard.md', import.meta.url)),
  'utf8',
);

/** Create a one-based mouse event for a zero-based local cell in the mounted input. */
function mouse(kind: MouseEvent['kind'], x: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: 1 };
}

/** Mount one focused input with optional host clipboard callbacks. */
function mountInput(
  text: string,
  clipboard: {
    readonly writeClipboardText?: (value: string) => void | Promise<void>;
    readonly readClipboardText?: () => string | Promise<string>;
  } = {},
): {
  readonly appValue: Signal<string>;
  readonly input: Input;
  readonly loop: ReturnType<typeof createEventLoop>;
} {
  const appValue = signal(text);
  const input = new Input({ value: appValue });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  const loop = createEventLoop(
    { width: 24, height: 3 },
    {
      caps: EXAMPLE_CAPS,
      writeClipboardText: clipboard.writeClipboardText,
      readClipboardText: clipboard.readClipboardText,
    },
  );
  loop.mount(root);
  loop.focusView(input);
  return { appValue, input, loop };
}

/** Let promise-based clipboard work settle without depending on wall-clock timing. */
async function drainClipboardQueue(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

/** Build the laboratory through the browser demo host's cleanup registration seam. */
function buildThroughHostLifecycle(definition: ExampleDefinition): {
  readonly app: Application;
  readonly cleanups: Array<() => void>;
} {
  const cleanups: Array<() => void> = [];
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: 'app',
    caps: EXAMPLE_CAPS,
    viewport: EXAMPLE_VIEWPORT,
    onCleanup: (cleanup) => cleanups.push(cleanup),
  });
  app.loop.resize(EXAMPLE_VIEWPORT);
  return { app, cleanups };
}

test('keyboard and mouse selections contribute their exact ranges to canonical copy', async () => {
  const writes: string[] = [];
  const { input, loop } = mountInput('hello world', {
    writeClipboardText: (text) => {
      writes.push(text);
    },
  });

  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true }));
  expect(input.selection).toEqual({ start: 0, end: 3 });
  loop.dispatch(key('c', { ctrl: true }));

  loop.dispatch(mouse('down', 3));
  loop.dispatch(mouse('drag', 8));
  loop.dispatch(mouse('up', 8));
  expect(input.selection).toEqual({ start: 2, end: 7 });
  loop.dispatch(key('insert', { ctrl: true }));
  await drainClipboardQueue();

  expect(writes).toEqual(['hel', 'llo w']);
  loop.dispose();
});

test('application bindings win modern and classic conflicts without removing unrelated defaults', () => {
  const application = createKeymap({
    'ctrl+c': 'inspect',
    'shift+insert': 'insertTemplate',
  });
  const combined = buildKeymap('both', application);

  expect(combined?.lookup(key('c', { ctrl: true }))).toBe('inspect');
  expect(combined?.lookup(key('insert', { shift: true }))).toBe('insertTemplate');
  expect(combined?.lookup(key('x', { ctrl: true }))).toBe('cut');
  expect(combined?.lookup(key('delete', { shift: true }))).toBe('cut');
  expect(buildKeymap('none', application)?.lookup(key('c', { ctrl: true }))).toBe('inspect');
  expect(buildKeymap('none', application)?.lookup(key('v', { ctrl: true }))).toBeUndefined();
});

test('a denied browser write attempts only the outbound bridge and preserves exact text', async () => {
  const writes: string[] = [];
  let reads = 0;
  const bridge = {
    writeText: async (text: string) => {
      writes.push(text);
      throw new Error('NotAllowedError');
    },
    readText: async () => {
      reads += 1;
      return 'visitor-owned text';
    },
  };

  await expect(setBrowserClipboard('line 1\r\nUnicode 🧪', EXAMPLE_CAPS, bridge)).rejects.toThrow('NotAllowedError');
  expect(writes).toEqual(['line 1\r\nUnicode 🧪']);
  expect(reads).toBe(0);
});

test('an unavailable adapter leaves canonical copy and paste usable inside the application', () => {
  const { appValue, loop } = mountInput('local');

  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true }));
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('backspace'));
  expect(appValue()).toBe('');

  loop.dispatch(key('v', { ctrl: true }));
  expect(appValue()).toBe('local');
  loop.dispose();
});

test('strict app-local guidance consumes outbound fallback and disposes the event loop', () => {
  expect(GUIDE_SOURCE).toMatch(/systemClipboard:\s*false,[\s\S]{0,180}writeClipboardText:\s*\(\)\s*=>\s*undefined/);
  expect(GUIDE_SOURCE).toMatch(/dispose\(\): void[\s\S]{0,220}app\.loop\.dispose\(\)[\s\S]{0,120}disposeOwner\(\)/);
});

test('the virtual authorization state and copy outcome wrap deterministically', () => {
  const states: ClipboardAuthorization[] = [];
  let state: ClipboardAuthorization = 'unavailable';
  for (let step = 0; step < 4; step += 1) {
    states.push(state);
    state = nextClipboardAuthorization(state);
  }

  expect(states).toEqual(['unavailable', 'denied', 'authorized', 'unavailable']);
  expect(states.map(copyOutcome)).toEqual([
    'Copy: local success > host unavailable',
    'Copy: local success > host denied',
    'Copy: local success > host authorized',
    'Copy: local success > host unavailable',
  ]);
});

describe('clipboard laboratory lifecycle', () => {
  test('repeats authorization transitions without exposing a visitor clipboard', () => {
    createRoot((dispose) => {
      const { app } = buildLabExample('guides/clipboard-boundary', clipboardExample);
      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toContain('Host write: unavailable (no bridge call)');
      expect(frameText(app)).toContain('Diagnostic: none');

      for (const expected of ['denied', 'authorized', 'unavailable']) {
        app.loop.dispatch(key('a', { alt: true }));
        app.loop.dispatch(key('c', { alt: true }));
        expect(frameText(app)).toContain(`Authorization: ${expected}`);
        expect(frameText(app)).toContain(`Copy: local success > host ${expected}`);
        if (expected === 'denied') {
          expect(frameText(app)).toContain('Diagnostic: host clipboard write failed');
        } else {
          expect(frameText(app)).toContain('Diagnostic: none');
        }
        expect(frameText(app)).not.toContain('visitor-owned text');
      }
      app.loop.dispose();
      dispose();
    });
  });

  test('uses the real reader for failure fallback and accepted delivery', async () => {
    const built = createRoot((dispose) => ({
      ...buildLabExample('guides/clipboard-boundary', clipboardExample),
      dispose,
    }));
    try {
      built.app.loop.dispatch(key('f', { alt: true }));
      built.app.loop.dispatch(key('v', { alt: true }));
      await drainClipboardQueue();
      expect(frameText(built.app)).toContain('Host reads: 1');
      expect(frameText(built.app)).toContain('Paste events: 1');
      expect(frameText(built.app)).toContain('Paste: canonical fallback');

      built.app.loop.dispatch(key('p', { alt: true }));
      await Promise.resolve();
      await Promise.resolve();
      expect(frameText(built.app)).toContain('Host reads: 2');
      expect(frameText(built.app)).toContain('Native read: pending');
      built.app.loop.dispatch(key('r', { alt: true }));
      await drainClipboardQueue();
      expect(frameText(built.app)).toContain('Paste events: 2');
      expect(frameText(built.app)).toContain('Paste: virtual result accepted');
    } finally {
      built.app.loop.dispose();
      built.dispose();
    }
  });

  test('does not let an early resolve arm the next pending read', async () => {
    const built = createRoot((dispose) => ({
      ...buildLabExample('guides/clipboard-boundary', clipboardExample),
      dispose,
    }));
    try {
      built.app.loop.dispatch(key('r', { alt: true }));
      expect(frameText(built.app)).toContain('Paste: no read pending');

      built.app.loop.dispatch(key('p', { alt: true }));
      await drainClipboardQueue();
      expect(frameText(built.app)).toContain('Native read: pending');
      expect(frameText(built.app)).toContain('Paste events: 0');

      built.app.loop.dispatch(key('r', { alt: true }));
      await drainClipboardQueue();
      expect(frameText(built.app)).toContain('Paste events: 1');
      expect(frameText(built.app)).toContain('Paste: virtual result accepted');
    } finally {
      built.app.loop.dispose();
      built.dispose();
    }
  });

  test('discards a real deferred read after focus changes', async () => {
    const built = createRoot((dispose) => ({
      ...buildLabExample('guides/clipboard-boundary', clipboardExample),
      dispose,
    }));
    try {
      built.app.loop.dispatch(key('p', { alt: true }));
      await Promise.resolve();
      await Promise.resolve();
      expect(frameText(built.app)).toContain('Host reads: 1');
      built.app.loop.dispatch(key('n', { alt: true }));
      built.app.loop.dispatch(key('r', { alt: true }));
      await drainClipboardQueue();

      expect(frameText(built.app)).toContain('Paste: stale result discarded');
      expect(frameText(built.app)).toContain('Paste events: 0');
      expect(frameText(built.app)).toContain('Reason: focus changed');
    } finally {
      built.app.loop.dispose();
      built.dispose();
    }
  });

  test('registers one idempotent host cleanup and ignores commands after teardown', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { app, cleanups } = buildThroughHostLifecycle(clipboardExample);
    try {
      expect(cleanups).toHaveLength(1);
      expect(() => {
        cleanups[0]?.();
        cleanups[0]?.();
        app.loop.dispose();
      }).not.toThrow();
      app.loop.dispatch(key('a', { alt: true }));
      expect(warning.mock.calls.flat().join('\n')).not.toContain('created outside any createRoot() scope');
    } finally {
      app.loop.dispose();
      warning.mockRestore();
    }
  });
});
