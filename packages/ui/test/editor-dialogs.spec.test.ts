/**
 * Specification tests (immutable oracles) — RD-08 Phase-6 dialog builders (ST-21).
 *
 * Source: RD-08 AC-9 / PA-7 / PA-11 → ST-21 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; 03-03 §dialogs.ts). TV decode (`examples/tvedit/tvedit2.cpp:55-112`):
 * Find `TDialog(0,0,38,12)` — input maxLen 80 at `(3,3,32,4)`, `~T~ext to find` label, the 2-box
 * cluster `(3,5,35,7)` [Case sensitive, Whole words only], OK `(14,9,24,11)` default, Cancel
 * `(26,9,36,11)`; Replace `TDialog(0,0,40,16)` — two inputs `(3,3,34,4)`/`(3,6,34,7)`, the 4-box
 * cluster `(3,8,37,12)`, OK `(17,13,27,15)`, Cancel `(28,13,38,15)`. The records round-trip the
 * `ef*` flags as booleans (AC-9). `replacePrompt` (`tvedit3.cpp:177-189`, PA-11): the 40×7 box
 * `TRect(0,1,40,8)` h-centred at the top; when the cursor's global y ≤ box bottom + 1 (PF-009,
 * `:184-186`) it moves so its top = `size.y − height − 2`. TV rects are end-exclusive → width =
 * c−a, height = d−b; children sit at VERBATIM dialog-relative rects (the files `padding:0`
 * convention). Expectations derive from RD-08 + the decode, never the implementation.
 *
 * Trace: RD-08 03-03 · PA-7 / PA-11 / PF-002 · ST-21.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Input, CheckGroup, Button } from '../src/controls/index.js';
import type { View } from '../src/view/index.js';
import { findDialog, replaceDialog, replacePrompt } from '../src/editor/dialogs.js';
import type { EditorDialogHost } from '../src/editor/dialogs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

function makeHost(width = 60, height = 20) {
  const app = createApplication({ caps, viewport: { width, height } });
  const host: EditorDialogHost = { loop: app.loop, desktop: app.desktop };
  return { app, host };
}

/** Collect all descendants of a view (children walk). */
function descendants(v: View): View[] {
  const out: View[] = [];
  const kids = (v as unknown as { children?: View[] }).children ?? [];
  for (const c of kids) {
    out.push(c, ...descendants(c));
  }
  return out;
}

// ST-21 / AC-9 — the Find dialog's decoded geometry + record round-trip.
test('ST-21: findDialog composes at the decoded 38×12 rects and round-trips the record', async () => {
  const { app, host } = makeHost();
  const promise = findDialog(host, { find: 'seed', options: { caseSensitive: true, wholeWords: false } });
  app.loop.renderRoot.flush();

  const dlg = app.desktop.activeWindow();
  expect(dlg).not.toBeNull();
  expect(dlg!.bounds.width).toBe(38);
  expect(dlg!.bounds.height).toBe(12);

  const kids = descendants(dlg!);
  const input = kids.find((k2): k2 is Input => k2 instanceof Input);
  expect(input?.layout.rect).toEqual({ x: 3, y: 3, width: 29, height: 1 }); // TRect(3,3,32,4)
  const cluster = kids.find((k2): k2 is CheckGroup => k2 instanceof CheckGroup);
  expect(cluster?.layout.rect).toEqual({ x: 3, y: 5, width: 32, height: 2 }); // TRect(3,5,35,7)
  const buttons = kids.filter((k2): k2 is Button => k2 instanceof Button);
  expect(buttons.map((b) => b.layout.rect)).toEqual([
    { x: 14, y: 9, width: 10, height: 2 }, // OK  TRect(14,9,24,11)
    { x: 26, y: 9, width: 10, height: 2 }, // Cancel TRect(26,9,36,11)
  ]);

  // Type into the focused input and accept: the record round-trips text + flags.
  app.loop.dispatch(key('end'));
  app.loop.dispatch(key('!'));
  app.loop.emitCommand('ok');
  const rec = await promise;
  expect(rec).toEqual({ find: 'seed!', options: { caseSensitive: true, wholeWords: false } });
});

test('ST-21: findDialog cancel resolves null', async () => {
  const { app, host } = makeHost();
  const promise = findDialog(host);
  app.loop.renderRoot.flush();
  app.loop.emitCommand('cancel');
  expect(await promise).toBeNull();
});

// ST-21 / AC-9 — the Replace dialog's decoded geometry + the 4 flag booleans round-trip.
test('ST-21: replaceDialog composes at the decoded 40×16 rects and round-trips all four flags', async () => {
  const { app, host } = makeHost();
  const initial = {
    find: 'from',
    replace: 'to',
    options: { caseSensitive: false, wholeWords: true },
    promptOnReplace: true,
    replaceAll: true,
  };
  const promise = replaceDialog(host, initial);
  app.loop.renderRoot.flush();

  const dlg = app.desktop.activeWindow();
  expect(dlg!.bounds.width).toBe(40);
  expect(dlg!.bounds.height).toBe(16);
  const kids = descendants(dlg!);
  const inputs = kids.filter((k2): k2 is Input => k2 instanceof Input);
  expect(inputs.map((i) => i.layout.rect)).toEqual([
    { x: 3, y: 3, width: 31, height: 1 }, // TRect(3,3,34,4)
    { x: 3, y: 6, width: 31, height: 1 }, // TRect(3,6,34,7)
  ]);
  const cluster = kids.find((k2): k2 is CheckGroup => k2 instanceof CheckGroup);
  expect(cluster?.layout.rect).toEqual({ x: 3, y: 8, width: 34, height: 4 }); // TRect(3,8,37,12)
  const buttons = kids.filter((k2): k2 is Button => k2 instanceof Button);
  expect(buttons.map((b) => b.layout.rect)).toEqual([
    { x: 17, y: 13, width: 10, height: 2 }, // OK  TRect(17,13,27,15)
    { x: 28, y: 13, width: 10, height: 2 }, // Cancel TRect(28,13,38,15)
  ]);

  app.loop.emitCommand('ok');
  expect(await promise).toEqual(initial); // the ef* booleans round-trip unchanged (AC-9)
});

// ST-21 / PA-11 — the replace prompt's avoid-cursor placement.
test('ST-21: replacePrompt sits at top rows 1-8 h-centred, or drops to the bottom over the cursor', async () => {
  // Cursor well below the box → the box stays at the top.
  const a = makeHost(60, 20);
  const p1 = replacePrompt(a.host, { x: 5, y: 15 });
  a.app.loop.renderRoot.flush();
  const top = a.app.desktop.activeWindow();
  expect(top!.bounds).toMatchObject({ x: 10, y: 1, width: 40, height: 7 }); // (60−40)/2 = 10
  a.app.loop.emitCommand('yes');
  expect(await p1).toBe('yes');

  // Cursor at/above box bottom + 1 (y ≤ 9) → moved so its top = size.y − height − 2.
  const b = makeHost(60, 20);
  const p2 = replacePrompt(b.host, { x: 5, y: 4 });
  b.app.loop.renderRoot.flush();
  const moved = b.app.desktop.activeWindow();
  expect(moved!.bounds.y).toBe(20 - 7 - 2); // 11
  b.app.loop.emitCommand('cancel');
  expect(await p2).toBe('cancel');
});
