/**
 * Specification test (immutable oracle) — `attachKeyReclaim` + `UNRECLAIMABLE_CHORDS` (ST-5).
 *
 * ST-5: with reclaim attached and the terminal "focused" (an injected predicate — an `@xterm/headless`
 * terminal has no textarea), a fake `F1` keydown is `preventDefault()`-ed so it reaches the TUI instead
 * of the browser; when unfocused it is left alone. Separately, the F1 byte sequence decodes to the
 * `f1` key through the host. `UNRECLAIMABLE_CHORDS` is a non-empty exported array.
 *
 * The DOM is hand-mocked (no jsdom): a fake event target captures the capture-phase keydown handler so
 * the test dispatches a synthetic event. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { InputEvent } from '@jsvision/core';
import { attachKeyReclaim, UNRECLAIMABLE_CHORDS, createBrowserHost } from '@jsvision/web';
import { createFakeTerminal } from './helpers/fake-terminal.js';

const caps = resolveCapabilities({
  env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** A minimal TerminalLike stub — the reclaim listener is document-global, so it needs no real terminal. */
const noopTerm = {
  write: () => {},
  onData: () => ({ dispose: () => {} }),
  onResize: () => ({ dispose: () => {} }),
};

/** A synthetic keydown event matching the fields the reclaim matcher reads. */
interface FakeKeydown {
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
}
function keydown(over: Partial<FakeKeydown> = {}): FakeKeydown {
  return {
    key: 'F1',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...over,
  };
}

/** A hand-mocked event target that captures the capture-phase handler for the test to fire. */
function fakeTarget() {
  let handler: ((ev: FakeKeydown) => void) | undefined;
  return {
    target: {
      addEventListener: (_type: string, h: (ev: FakeKeydown) => void) => {
        handler = h;
      },
      removeEventListener: () => {
        handler = undefined;
      },
    },
    dispatch: (ev: FakeKeydown) => handler?.(ev),
    attached: () => handler !== undefined,
  };
}

// ST-5 — a focused F1 keydown is reclaimed; an unfocused one is left for the browser.
test('ST-5: reclaim preventDefault()s a focused chord and skips an unfocused one', () => {
  const ft = fakeTarget();
  let focused = true;
  const unsub = attachKeyReclaim(noopTerm, { target: ft.target, isFocused: () => focused });

  const focusedF1 = keydown({ key: 'F1' });
  ft.dispatch(focusedF1);
  expect(focusedF1.preventDefault).toHaveBeenCalledTimes(1);

  focused = false;
  const blurredF1 = keydown({ key: 'F1' });
  ft.dispatch(blurredF1);
  expect(blurredF1.preventDefault).not.toHaveBeenCalled();

  unsub();
  expect(ft.attached()).toBe(false);
});

// ST-5 — the corresponding F1 byte sequence decodes to the f1 key through the host.
test('ST-5: the F1 byte sequence (SS3 P) decodes to the f1 key', () => {
  const harness = createFakeTerminal();
  const events: InputEvent[] = [];
  const host = createBrowserHost({ term: harness.term, caps, onInput: (e) => events.push(e) });
  host.start();

  harness.sendData('\x1bOP'); // ESC O P = SS3 P = F1
  expect(events).toContainEqual(expect.objectContaining({ type: 'key', key: 'f1' }));
});

// ST-5 — the unreclaimable-chords advisory list is a non-empty exported array.
test('ST-5: UNRECLAIMABLE_CHORDS is a non-empty array', () => {
  expect(Array.isArray(UNRECLAIMABLE_CHORDS)).toBe(true);
  expect(UNRECLAIMABLE_CHORDS.length).toBeGreaterThan(0);
});
