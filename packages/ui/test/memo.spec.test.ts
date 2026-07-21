/**
 * Specification tests (immutable oracles) — RD-08 Phase-7 `Memo` (ST-22/ST-23).
 *
 * Source: RD-08 AC-10 / AR-263 → ST-22/ST-23 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; 03-04 §memo.ts). TV decode: `TMemo : TEditor` (`tmemo.cpp:27-98`,
 * `editors.h:363-391`) — the dialog-embedded editor; palette `cpMemo "\x1A\x1B"` →
 * `cpGrayDialog[26/27]` → **`0x30` black-on-cyan / `0x2F` white-on-green** (PA-8);
 * `handleEvent` drops `kbTab` entirely (`tmemo.cpp:69-73`) so dialog Tab-nav works; the
 * `ushort`-blob data surface is modernized to a two-way `Signal<string>` (AR-263) with the
 * ComboBox feedback guard. Expectations derive from RD-08 + the decode, never the implementation.
 *
 * Trace: RD-08 03-04 · AR-263 / PA-8 · ST-22/ST-23.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { Memo } from '../src/editor/memo.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** A memo above an Input (the dialog-form shape), memo focused. */
function mountMemo(value = signal('hi')) {
  const memo = new Memo({ value });
  const input = new Input({ value: signal('') });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  memo.setLayout({ size: { kind: 'fixed', cells: 3 } });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(memo);
  root.add(input);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(memo);
  return { loop, memo, input, value };
}

// ST-22 / AC-10 — the two-way Signal<string> bind, same-tick, no feedback loop; Tab passes through.
test('ST-22: shows the bound value; typing writes it back the same tick', () => {
  const { loop, memo, value } = mountMemo();
  expect(memo.getText()).toBe('hi');
  memo.execute('textEnd');
  loop.dispatch(key('!'));
  expect(value()).toBe('hi!'); // same-tick write-back
});

test('ST-22: an external signal write updates the buffer (no feedback loop)', () => {
  const { memo, value } = mountMemo();
  value.set('new');
  expect(memo.getText()).toBe('new');
  expect(value()).toBe('new'); // no ping-pong
});

test('ST-22: Tab moves dialog focus — nothing is inserted (the tmemo.cpp:69-73 drop)', () => {
  const { loop, memo, input } = mountMemo();
  loop.dispatch(key('tab'));
  expect(memo.getText()).toBe('hi'); // no \t inserted
  expect(input.state.focused).toBe(true); // focus moved to the next control
});

// ST-23 / PA-8 — the memo colours: 0x30 black-on-cyan / 0x2F white-on-green.
test('ST-23: memo cells paint memoNormal; the selection paints memoSelected', () => {
  const { loop, memo } = mountMemo(signal('abc'));
  loop.dispatch(key('right', { shift: true })); // select "a"
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 0)?.fg).toBe(defaultTheme.memoSelected.fg); // 0x2F white…
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.memoSelected.bg); // …on green
  expect(buf.get(1, 0)?.fg).toBe(defaultTheme.memoNormal.fg); // 0x30 black…
  expect(buf.get(1, 0)?.bg).toBe(defaultTheme.memoNormal.bg); // …on cyan
  void memo;
});
