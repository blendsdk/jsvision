/**
 * Specification tests (immutable oracles) — RD-08 Phase-3 WordStar keymap (ST-8/ST-9).
 *
 * Source: RD-08 AC-3 → ST-8/ST-9 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; the decode in 03-02-editor-view.md §keymap.ts). The three tables are
 * TV's, transcribed 1:1 (`firstKeys`/`quickKeys`/`blockKeys`, `teditor1.cpp:44-111`; first match
 * wins in `scanKeyMap` `:117-167` — so the trailing dead `kbCtrlDel → cmClear` duplicate resolves
 * to `delWord`). Prefixes: Ctrl-Q → the quick table, Ctrl-K → the block table (TV escapes
 * `0xFF01`/`0xFF02` become the `KeyState` machine); the follow-up key is case-normalized and an
 * unknown follow-up clears the prefix, consumed, with no edit. Actions are internal PA-15 ids —
 * NOT registry commands. Expectations derive from RD-08 + the decode, never the implementation.
 *
 * Trace: RD-08 03-02 · PA-15 / PF-005 · ST-8/ST-9.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveKey } from '../src/editor/keymap.js';
import type { KeyState } from '../src/editor/keymap.js';

/** Build the resolver's key-event shape (core decoder naming: lowercase letters + named specials). */
function k(key: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return { key, ctrl: mods.ctrl ?? false, shift: mods.shift ?? false, alt: mods.alt ?? false };
}

const IDLE: KeyState = 0;

// ST-8 / AC-3 — the decoded firstKeys actions (WordStar Ctrl-letters + special keys).
test('ST-8: WordStar Ctrl-letters resolve to the decoded firstKeys actions', () => {
  expect(resolveKey(IDLE, k('s', { ctrl: true })).action).toBe('charLeft');
  expect(resolveKey(IDLE, k('d', { ctrl: true })).action).toBe('charRight');
  expect(resolveKey(IDLE, k('e', { ctrl: true })).action).toBe('lineUp');
  expect(resolveKey(IDLE, k('x', { ctrl: true })).action).toBe('lineDown');
  expect(resolveKey(IDLE, k('a', { ctrl: true })).action).toBe('selectAll');
  expect(resolveKey(IDLE, k('f', { ctrl: true })).action).toBe('wordRight');
  expect(resolveKey(IDLE, k('g', { ctrl: true })).action).toBe('delChar');
  expect(resolveKey(IDLE, k('l', { ctrl: true })).action).toBe('searchAgain');
  expect(resolveKey(IDLE, k('t', { ctrl: true })).action).toBe('delWord');
  expect(resolveKey(IDLE, k('u', { ctrl: true })).action).toBe('undo');
  expect(resolveKey(IDLE, k('v', { ctrl: true })).action).toBe('toggleInsert');
  expect(resolveKey(IDLE, k('y', { ctrl: true })).action).toBe('delLine');
  expect(resolveKey(IDLE, k('o', { ctrl: true })).action).toBe('toggleIndent');
});

test('ST-8: arrows, Home/End, PgUp/PgDn, Ins/Del/Backspace resolve per firstKeys', () => {
  expect(resolveKey(IDLE, k('left')).action).toBe('charLeft');
  expect(resolveKey(IDLE, k('right')).action).toBe('charRight');
  expect(resolveKey(IDLE, k('up')).action).toBe('lineUp');
  expect(resolveKey(IDLE, k('down')).action).toBe('lineDown');
  expect(resolveKey(IDLE, k('home')).action).toBe('lineStart');
  expect(resolveKey(IDLE, k('end')).action).toBe('lineEnd');
  expect(resolveKey(IDLE, k('pageup')).action).toBe('pageUp');
  expect(resolveKey(IDLE, k('pagedown')).action).toBe('pageDown');
  expect(resolveKey(IDLE, k('insert')).action).toBe('toggleInsert');
  expect(resolveKey(IDLE, k('delete')).action).toBe('delChar');
  expect(resolveKey(IDLE, k('backspace')).action).toBe('backSpace');
  expect(resolveKey(IDLE, k('enter')).action).toBe('newLine'); // kbCtrlM = CR
  expect(resolveKey(IDLE, k('left', { ctrl: true })).action).toBe('wordLeft');
  expect(resolveKey(IDLE, k('right', { ctrl: true })).action).toBe('wordRight');
  expect(resolveKey(IDLE, k('home', { ctrl: true })).action).toBe('textStart');
  expect(resolveKey(IDLE, k('end', { ctrl: true })).action).toBe('textEnd');
  expect(resolveKey(IDLE, k('backspace', { ctrl: true })).action).toBe('delWordLeft');
  expect(resolveKey(IDLE, k('backspace', { alt: true })).action).toBe('delWordLeft');
  // The kbCtrlDel first-match rule: cmDelWord (entry 25) wins over the dead trailing cmClear (PF-005).
  expect(resolveKey(IDLE, k('delete', { ctrl: true })).action).toBe('delWord');
  // The DOS clipboard chords.
  expect(resolveKey(IDLE, k('insert', { shift: true })).action).toBe('paste');
  expect(resolveKey(IDLE, k('delete', { shift: true })).action).toBe('cut');
  expect(resolveKey(IDLE, k('insert', { ctrl: true })).action).toBe('copy');
});

// ST-9 / AC-3 — the Ctrl-Q/Ctrl-K prefixes: case-normalized second key; unknown clears silently.
test('ST-9: Ctrl-Q enters the quick table; f and F both resolve to find', () => {
  const pre = resolveKey(IDLE, k('q', { ctrl: true }));
  expect(pre.action).toBeUndefined();
  expect(pre.nextState).toBe('ctrlQ');
  expect(pre.consumed).toBe(true);

  const lower = resolveKey('ctrlQ', k('f'));
  expect(lower.action).toBe('find');
  expect(lower.nextState).toBe(0);
  const upper = resolveKey('ctrlQ', k('F', { shift: true }));
  expect(upper.action).toBe('find');
  const held = resolveKey('ctrlQ', k('f', { ctrl: true })); // WordStar lets Ctrl stay held
  expect(held.action).toBe('find');
});

test('ST-9: Ctrl-K enters the block table; b starts a selection', () => {
  expect(resolveKey(IDLE, k('k', { ctrl: true })).nextState).toBe('ctrlK');
  const res = resolveKey('ctrlK', k('b'));
  expect(res.action).toBe('startSelect');
  expect(res.nextState).toBe(0);
  expect(resolveKey('ctrlK', k('c')).action).toBe('paste');
  expect(resolveKey('ctrlK', k('h')).action).toBe('hideSelect');
  expect(resolveKey('ctrlQ', k('a')).action).toBe('replace');
  expect(resolveKey('ctrlQ', k('y')).action).toBe('delEnd');
});

test('ST-9: an unknown key after a prefix clears it — consumed, no action, no edit', () => {
  const res = resolveKey('ctrlQ', k('z'));
  expect(res.action).toBeUndefined();
  expect(res.nextState).toBe(0);
  expect(res.consumed).toBe(true);
});

test('ST-8: an unmapped idle key is not consumed (falls through to typing)', () => {
  const res = resolveKey(IDLE, k('a'));
  expect(res.action).toBeUndefined();
  expect(res.consumed).toBe(false);
  expect(res.nextState).toBe(0);
});
