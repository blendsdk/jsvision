/**
 * Specification tests (immutable oracles) — Tab-traversal order of the editor dialogs.
 *
 * These dialogs are being recomposed from hand-placed absolute children into nested flex containers.
 * Child *positions* may move; the **order the user Tabs through the focusable controls must not**.
 * These oracles pin that order per dialog, so the recomposition is provably behavior-invariant on the
 * one axis nesting is most likely to disturb.
 *
 * Expectations derive from the dialogs' documented contracts — which controls each offers, in reading
 * order — never from the implementation. Find offers its search field then the option cluster then the
 * buttons; Replace offers both fields (find before replace) then the cluster then the buttons; the
 * confirm boxes offer Yes, No, Cancel.
 *
 * Note the history drop-down beside each field is deliberately NOT in the Tab order: it opens on a
 * click, or on Down / Alt+Down while its linked field is focused — never by Tab. It is therefore
 * absent from every ring below by design.
 *
 * Focus is driven through the PUBLIC loop surface (`focusNext`/`getFocused`), mirroring
 * `event.focus-traversal.spec.test.ts`. The `.js` extension in import specifiers is required by
 * NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { Input, CheckGroup, Button } from '../src/controls/index.js';
import { Commands } from '../src/status/index.js';
import { findDialog, replaceDialog, confirmBox, replacePrompt } from '../src/editor/dialogs.js';
import type { EditorDialogHost } from '../src/editor/dialogs.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeHost(width = 60, height = 20) {
  const app = createApplication({ caps, viewport: { width, height } });
  const host: EditorDialogHost = { loop: app.loop, desktop: app.desktop };
  return { app, host };
}

/** All descendants of a view, in tree order. */
function descendants(v: View): View[] {
  const out: View[] = [];
  for (const c of (v as unknown as { children?: View[] }).children ?? []) out.push(c, ...descendants(c));
  return out;
}

/**
 * Name every view in the dialog by *what it is* plus its tree-order index among its own kind — so
 * `input#0` is the first field in reading order regardless of where flex lays it out. Buttons are
 * named by their `~X~` hotkey. These names survive the move from absolute rects into nested groups,
 * which a child index or a rectangle would not.
 */
function namesOf(dialog: View): Map<View, string> {
  const names = new Map<View, string>();
  let inputs = 0;
  let clusters = 0;
  for (const v of descendants(dialog)) {
    if (v instanceof Input) names.set(v, `input#${inputs++}`);
    else if (v instanceof CheckGroup) names.set(v, `cluster#${clusters++}`);
    else if (v instanceof Button) names.set(v, `btn:${v.accelerators()[0] ?? '?'}`);
  }
  return names;
}

/**
 * The dialog's focusable ring in Tab order, starting from whatever the modal focused on open.
 * Walks `focusNext()` until focus returns to the start, so the result is the complete cycle.
 */
function focusRing(app: DesktopApplication, max = 12): string[] {
  const dialog = app.desktop.activeWindow()!;
  const names = namesOf(dialog);
  const nameOf = (v: View | null): string => (v === null ? '<none>' : (names.get(v) ?? v.constructor.name));

  const start = app.loop.getFocused();
  const ring = [nameOf(start)];
  for (let i = 0; i < max; i++) {
    app.loop.focusNext();
    const current = app.loop.getFocused();
    if (current === start) return ring;
    ring.push(nameOf(current));
  }
  return ring; // no wrap within `max` — returned as-is so the assertion shows the runaway order
}

// ST-T2 — Find: the search field, then the options cluster, then the buttons.
test('ST-T2: findDialog Tab-traverses [input, cluster, OK, Cancel]', async () => {
  const { app, host } = makeHost();
  const p = findDialog(host, { find: 'seed', options: { caseSensitive: false, wholeWords: false } });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['input#0', 'cluster#0', 'btn:o', 'btn:c']);

  app.loop.emitCommand(Commands.cancel);
  await p;
});

// ST-T2 — Replace: both fields in reading order (find before replace), then the cluster, then buttons.
test('ST-T2: replaceDialog Tab-traverses [findInput, newInput, cluster, OK, Cancel]', async () => {
  const { app, host } = makeHost();
  const p = replaceDialog(host, {
    find: 'from',
    replace: 'to',
    options: { caseSensitive: false, wholeWords: false },
    promptOnReplace: true,
    replaceAll: false,
  });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['input#0', 'input#1', 'cluster#0', 'btn:o', 'btn:c']);

  app.loop.emitCommand(Commands.cancel);
  await p;
});

// ST-T2 — the three-way confirm box.
test('ST-T2: confirmBox Tab-traverses [Yes, No, Cancel]', async () => {
  const { app, host } = makeHost();
  const p = confirmBox(host, 'The file has been modified. Save?');
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:y', 'btn:n', 'btn:c']);

  app.loop.emitCommand(Commands.cancel);
  await p;
});

// ST-T2 — the replace prompt offers the same three answers as the confirm box.
test('ST-T2: replacePrompt Tab-traverses [Yes, No, Cancel]', async () => {
  const { app, host } = makeHost();
  const p = replacePrompt(host, { x: 5, y: 15 });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:y', 'btn:n', 'btn:c']);

  app.loop.emitCommand(Commands.cancel);
  await p;
});
