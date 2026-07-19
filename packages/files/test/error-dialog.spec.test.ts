/**
 * Specification test (immutable oracle) — the `errorBox` modal.
 *
 * The box is being recomposed from hand-placed absolute children into nested flex containers, so its
 * geometry may move. What must not move is its interaction contract: a single OK button is the only
 * thing the user can Tab to, and pressing OK dismisses the box.
 *
 * The expectation derives from the documented contract ("a message plus an OK button"), never from
 * the implementation — a caption is a `Text` decoration, and decorations are never Tab stops.
 * `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication, Button, Commands } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { errorBox } from '../src/dialog/error-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): ReturnType<typeof createApplication> {
  return createApplication({ caps, viewport: { width: 80, height: 24 } });
}

/** A stable name for a focusable view: buttons by their `~X~` hotkey, everything else by class. */
function label(v: View | null): string {
  if (v === null) return '<none>';
  if (v instanceof Button) return `btn:${v.accelerators()[0] ?? '?'}`;
  return v.constructor.name;
}

/** The box's focusable ring in Tab order, walked until focus returns to where it started. */
function focusRing(app: ReturnType<typeof createApplication>, max = 8): string[] {
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

// ST-03 — OK is the sole tab stop; Tab returns to it.
test('ST-03: errorBox Tab-traverses [OK] — the message Text is not a tab stop', async () => {
  const app = makeApp();
  const p = errorBox(app, 'Invalid directory');
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o']);

  app.loop.emitCommand(Commands.ok);
  await p;
});

// ST-03 — the contract holds for a long message too (which wraps across several rows).
test('ST-03: a long message still leaves OK as the sole tab stop', async () => {
  const app = makeApp();
  const long = 'The file could not be opened because the directory it lives in is not readable by this user account.';
  const p = errorBox(app, long);
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o']);

  app.loop.emitCommand(Commands.ok);
  await p;
});
