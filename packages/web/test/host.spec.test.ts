/**
 * Specification test (immutable oracle) — `createBrowserHost` (ST-2, ST-3).
 *
 * ST-2 (the load-down invariant): with no previous frame, the bytes the host writes to the terminal
 * **exactly equal** `serialize(buffer, null, { caps })` — proving the engine is reused, not
 * reimplemented. Driven over a real `@xterm/headless` terminal (which structurally satisfies the host's
 * `TerminalLike`), spying on its `write`.
 *
 * ST-3: feeding `\x1b[A` yields exactly one `up` key event; a lone trailing `ESC` emits an Escape key
 * only after the disambiguation timeout fires (driven via the injected fake timer), never before.
 *
 * `@xterm/headless` is a CommonJS package whose runtime requires a default import. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import xtermHeadless from '@xterm/headless';
import { serialize, resolveCapabilities, ScreenBuffer } from '@jsvision/core';
import type { CapabilityProfile, InputEvent } from '@jsvision/core';
import { createBrowserHost } from '@jsvision/web';
import { createFakeTerminal, createFakeTimer } from './helpers/fake-terminal.js';

const { Terminal } = xtermHeadless;

/** The browser capability profile the host runs under (built inline to keep this file host-only). */
const caps: CapabilityProfile = resolveCapabilities({
  env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

// ST-2 — the first frame written to the terminal equals serialize(buffer, null, { caps }) byte-for-byte.
test('ST-2: render(buffer) writes exactly serialize(buffer, null, { caps })', () => {
  const term = new Terminal({ cols: 12, rows: 3, allowProposedApi: true });
  const spy = vi.spyOn(term, 'write');

  const host = createBrowserHost({ term, caps, onInput: () => {} });
  const buffer = new ScreenBuffer(12, 3, { fg: 'default', bg: 'default' });
  buffer.set(0, 0, 'X', { fg: '#ff0000', bg: '#0000a8' });
  buffer.set(1, 0, 'Y', { fg: '#00ff00', bg: '#0000a8' });

  host.render(buffer);

  const written = spy.mock.calls.map((call) => String(call[0])).join('');
  expect(written).toBe(serialize(buffer, null, { caps }));
});

// ST-3 — a complete CSI sequence decodes to exactly one key event, synchronously.
test('ST-3: \\x1b[A decodes to exactly one up-arrow key', () => {
  const harness = createFakeTerminal();
  const timer = createFakeTimer();
  const events: InputEvent[] = [];

  const host = createBrowserHost({ term: harness.term, caps, onInput: (e) => events.push(e), timer: timer.seam });
  host.start();

  harness.sendData('\x1b[A');

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'key', key: 'up', ctrl: false, alt: false, shift: false });
  expect(timer.armed()).toBe(false); // a complete sequence leaves no carried ESC
});

// ST-3 — a lone ESC is held, emitting the Escape key only when the disambiguation timeout fires.
test('ST-3: a lone ESC flushes an Escape key only after the timeout', () => {
  const harness = createFakeTerminal();
  const timer = createFakeTimer();
  const events: InputEvent[] = [];

  const host = createBrowserHost({ term: harness.term, caps, onInput: (e) => events.push(e), timer: timer.seam });
  host.start();

  harness.sendData('\x1b');
  expect(events).toHaveLength(0); // held, not yet flushed
  expect(timer.armed()).toBe(true); // the disambiguation timer is armed

  timer.fire(); // the ESC_TIMEOUT_MS gap elapses
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'key', key: 'escape' });
});
