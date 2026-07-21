/**
 * Specification tests (immutable oracles) — the editor dialog builders.
 *
 * Find and Replace are composed with the layout DSL rather than the hand-computed cell geometry the
 * original Turbo Vision dialogs used. That is a deliberate, recorded divergence: their **behavior** is
 * still held to the original — the outer dialog sizes (38×12 and 40×16), the record round-trips of the
 * option flags as booleans, the focus order, and the return contracts — while their child *positions*
 * are whatever the composed column/row tree solves to. The child rectangles asserted below were
 * therefore re-derived from that structure; the outer sizes and the round-trips still come from the
 * original specification and must not drift.
 *
 * `replacePrompt` keeps its caret-anchored outer placement verbatim — the 40×7 box near the top,
 * dropping to the bottom when the caret would otherwise be covered — and only its inner body is
 * composed with flex. Its assertion below is deliberately about the OUTER window only.
 *
 * Child geometry is read from the SOLVED layout (`renderRoot.originOf` + `bounds`) rather than from
 * `layout.rect`: a flex child is placed by the layout pass and carries no static rectangle of its own.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { Input, CheckGroup, Button } from '../src/controls/index.js';
import type { View } from '../src/view/index.js';
import { findDialog, replaceDialog, replacePrompt, infoBox, confirmBox } from '../src/editor/dialogs.js';
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

/**
 * A child's solved rectangle relative to its dialog's top-left. Flex children carry no `layout.rect`,
 * so position comes from the composed origins and size from the solved bounds.
 */
function rectIn(app: DesktopApplication, dialog: View, child: View) {
  const root = app.loop.renderRoot;
  const origin = root.originOf(child)!;
  const base = root.originOf(dialog)!;
  return { x: origin.x - base.x, y: origin.y - base.y, width: child.bounds.width, height: child.bounds.height };
}

// ST-21 / AC-9 — the Find dialog's outer size + composed child geometry + record round-trip.
test('ST-21: findDialog composes at 38×12 and round-trips the record', async () => {
  const { app, host } = makeHost();
  const promise = findDialog(host, { find: 'seed', options: { caseSensitive: true, wholeWords: false } });
  app.loop.renderRoot.flush();

  const dlg = app.desktop.activeWindow();
  expect(dlg).not.toBeNull();
  expect(dlg!.bounds.width).toBe(38);
  expect(dlg!.bounds.height).toBe(12);

  const kids = descendants(dlg!);
  const input = kids.find((k2): k2 is Input => k2 instanceof Input)!;
  // The field shares its row with the history drop-down, which takes a fixed 3 cells on the right.
  expect(rectIn(app, dlg!, input)).toEqual({ x: 3, y: 3, width: 29, height: 1 });
  const cluster = kids.find((k2): k2 is CheckGroup => k2 instanceof CheckGroup)!;
  // The option cluster takes one row per checkbox; a spacer below it absorbs the leftover height.
  expect(rectIn(app, dlg!, cluster)).toEqual({ x: 3, y: 5, width: 32, height: 2 });
  const buttons = kids.filter((k2): k2 is Button => k2 instanceof Button);
  // A centred pair on the bottom interior row — the original placed them right of centre.
  expect(buttons.map((b) => rectIn(app, dlg!, b))).toEqual([
    { x: 8, y: 9, width: 10, height: 2 }, // OK
    { x: 20, y: 9, width: 10, height: 2 }, // Cancel
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

// ST-21 / AC-9 — the Replace dialog's outer size + composed child geometry + the 4 flag booleans.
test('ST-21: replaceDialog composes at 40×16 and round-trips all four flags', async () => {
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
  // Each field shares its row with that field's history drop-down (a fixed 3 cells on the right).
  expect(inputs.map((i) => rectIn(app, dlg!, i))).toEqual([
    { x: 3, y: 3, width: 31, height: 1 },
    { x: 3, y: 6, width: 31, height: 1 },
  ]);
  const cluster = kids.find((k2): k2 is CheckGroup => k2 instanceof CheckGroup)!;
  // The four-flag cluster takes one row per checkbox; a spacer below it absorbs the leftover height.
  expect(rectIn(app, dlg!, cluster)).toEqual({ x: 3, y: 8, width: 34, height: 4 });
  const buttons = kids.filter((k2): k2 is Button => k2 instanceof Button);
  // A centred pair on the bottom interior row — the original placed them right of centre.
  expect(buttons.map((b) => rectIn(app, dlg!, b))).toEqual([
    { x: 9, y: 13, width: 10, height: 2 }, // OK
    { x: 21, y: 13, width: 10, height: 2 }, // Cancel
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

// ST-19 — after the delegation refactor the editor helpers keep their exact return contracts:
// infoBox resolves void on OK; confirmBox resolves 'yes' | 'no' | 'cancel'.
test('ST-19: infoBox resolves void when OK is activated', async () => {
  const { app, host } = makeHost();
  const p = infoBox(host, 'Search string not found.');
  app.loop.renderRoot.flush();
  app.loop.emitCommand('ok');
  await expect(p).resolves.toBeUndefined();
});

test('ST-19: confirmBox resolves yes / no / cancel per the chosen button', async () => {
  for (const command of ['yes', 'no', 'cancel'] as const) {
    const { app, host } = makeHost();
    const p = confirmBox(host, `${command} the file has been modified. Save?`);
    app.loop.renderRoot.flush();
    app.loop.emitCommand(command);
    expect(await p).toBe(command);
  }
});
