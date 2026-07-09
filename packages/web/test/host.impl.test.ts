/**
 * Implementation tests — `createBrowserHost` internals/edges (beyond the ST-2/ST-3 spec oracle):
 * chunked decode across two `onData` calls, the exact caret show/hide/position sequences, and the
 * render no-op when a re-render produces no damage. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, ScreenBuffer, cursor } from '@jsvision/core';
import type { CapabilityProfile, InputEvent } from '@jsvision/core';
import { createBrowserHost } from '@jsvision/web';
import { createFakeTerminal, createFakeTimer } from './helpers/fake-terminal.js';

const caps: CapabilityProfile = resolveCapabilities({
  env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

// A CSI sequence split across two onData calls still decodes to one event (the decoder carries state).
test('decodes a CSI sequence delivered in two chunks as one key', () => {
  const harness = createFakeTerminal();
  const timer = createFakeTimer();
  const events: InputEvent[] = [];
  const host = createBrowserHost({ term: harness.term, caps, onInput: (e) => events.push(e), timer: timer.seam });
  host.start();

  harness.sendData('\x1b['); // incomplete CSI — held
  expect(events).toHaveLength(0);
  harness.sendData('A'); // completes the sequence
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'key', key: 'up' });
});

// setCaret positions the caret (show + 1-based move) and hides it on null.
test('setCaret writes show+move for a cell and hide for null', () => {
  const harness = createFakeTerminal();
  const host = createBrowserHost({ term: harness.term, caps, onInput: () => {} });

  host.setCaret({ x: 4, y: 2 });
  expect(harness.writes.at(-1)).toBe(cursor.show() + cursor.to(3, 5)); // 0-based (4,2) → 1-based (row 3, col 5)

  host.setCaret(null);
  expect(harness.writes.at(-1)).toBe(cursor.hide());
});

// A second render of an unchanged buffer produces no damage, so nothing is written.
test('render is a no-op when the frame is unchanged', () => {
  const harness = createFakeTerminal();
  const host = createBrowserHost({ term: harness.term, caps, onInput: () => {} });
  const buffer = new ScreenBuffer(8, 2, { fg: 'default', bg: 'default' });
  buffer.set(0, 0, 'A', { fg: '#ffffff', bg: '#000000' });

  host.render(buffer);
  const afterFirst = harness.writes.length;
  expect(afterFirst).toBeGreaterThan(0);

  host.render(buffer); // identical frame → empty diff → no write
  expect(harness.writes.length).toBe(afterFirst);
});
