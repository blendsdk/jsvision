/**
 * Specification tests (immutable oracles) — Tab-traversal order of the modal helpers.
 *
 * The modal helpers are being recomposed from hand-placed absolute children into nested flex
 * containers. Child *positions* may move; the **order the user Tabs through the focusable controls
 * must not**. These oracles pin that order per dialog variant, so the recomposition is provably
 * behavior-invariant on the one axis nesting is most likely to disturb.
 *
 * Expectations derive from the documented dialog contracts (which controls a variant offers, and in
 * which reading order), never from the implementation: an OK-only box offers just OK; an OK/Cancel box
 * offers OK then Cancel; a confirm box offers Yes then No; and a prompt offers its field first, then
 * OK, then Cancel — its caption is a `Label`, which is never in the Tab order.
 *
 * Focus is driven through the PUBLIC loop surface (`focusNext`/`getFocused`), mirroring
 * `event.focus-traversal.spec.test.ts`. The `.js` extension in import specifiers is required by
 * NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { messageBox, confirm, inputBox } from '../src/dialog/index.js';
import { Input, Button } from '../src/controls/index.js';
import { signal } from '../src/reactive/index.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): ReturnType<typeof createApplication> {
  return createApplication({ caps, viewport: { width: 80, height: 24 } });
}

/**
 * A stable, position-independent name for a focusable view. Buttons are identified by their
 * `~X~` hotkey (o/c/y/n) rather than by geometry or child index, so the label survives the move
 * from absolute rects into nested flex groups.
 */
function label(v: View | null): string {
  if (v === null) return '<none>';
  if (v instanceof Input) return 'input';
  if (v instanceof Button) return `btn:${v.accelerators()[0] ?? '?'}`;
  return v.constructor.name;
}

/**
 * The dialog's focusable ring in Tab order, starting from whatever the modal focused on open.
 * Walks `focusNext()` until focus returns to the start, so the result is the complete cycle.
 */
function focusRing(app: ReturnType<typeof createApplication>, max = 12): string[] {
  const start = app.loop.getFocused();
  const ring = [label(start)];
  for (let i = 0; i < max; i++) {
    app.loop.focusNext();
    const current = app.loop.getFocused();
    if (current === start) return ring;
    ring.push(label(current));
  }
  return ring; // no wrap within `max` — returned as-is so the assertion shows the runaway order
}

// ST-T1 — an OK-only message box offers exactly one focusable control.
test('ST-T1: an OK-only messageBox Tab-traverses [OK]', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi' });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o']);

  app.loop.emitCommand('ok');
  await p;
});

// ST-T1 — an OK/Cancel message box Tabs OK → Cancel.
test('ST-T1: an okCancel messageBox Tab-traverses [OK, Cancel]', async () => {
  const app = makeApp();
  const p = messageBox(app, { title: 'T', text: 'hi', buttons: 'okCancel' });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o', 'btn:c']);

  app.loop.emitCommand('cancel');
  await p;
});

// ST-T1 — a confirm box Tabs Yes → No.
test('ST-T1: confirm Tab-traverses [Yes, No]', async () => {
  const app = makeApp();
  const p = confirm(app, 'Discard unsaved changes?');
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:y', 'btn:n']);

  app.loop.emitCommand('no');
  await p;
});

// ST-T1 — a prompt Tabs field → OK → Cancel; its caption Label is never in the ring.
test('ST-T1: inputBox Tab-traverses [Input, OK, Cancel] — the Label is not in the Tab order', async () => {
  const app = makeApp();
  const value = signal('seed');
  const p = inputBox(app, { title: 'Rename', label: '~N~ew name', value });
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['input', 'btn:o', 'btn:c']);

  app.loop.emitCommand('cancel');
  await p;
});
