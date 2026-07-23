/**
 * Specification test (immutable oracle) — the `errorBox` modal.
 *
 * The box is being recomposed from hand-placed absolute children into nested flex containers, so its
 * geometry may move. What must not move is its interaction contract: a single OK button is the only
 * thing the user can Tab to, and pressing OK dismisses the box.
 *
 * The expectations derive from the documented contract ("a message plus an OK button"), never from
 * the implementation — a caption is a `Text` decoration, and decorations are never Tab stops.
 *
 * Sizing is half contract, half consequence. The **width** rule is fixed and stated here: wide enough
 * for the message plus its frame and padding, never below 24 columns nor above 60. The **height** is
 * whatever it takes to show the message in full at that width — the box is not permitted to clip what
 * it was called to display, which is the guarantee these oracles pin. Both are asserted through the
 * public surface: the desktop's active window for geometry, the painted screen for what the user
 * actually sees. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication, Button, Commands, wrapText } from '@jsvision/ui';
// `DesktopApplication`, not `ReturnType<typeof createApplication>`: the latter is a deferred
// conditional type that resolves to `any` here, which silently switches off checking for every
// helper below. These tests never pass `content`, so the app is always desktop-bodied.
import type { DesktopApplication } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { errorBox } from '../src/dialog/error-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function makeApp(): DesktopApplication {
  return createApplication({ caps, viewport: { width: 80, height: 24 } });
}

/** A stable name for a focusable view: buttons by their `~X~` hotkey, everything else by class. */
function label(v: View | null): string {
  if (v === null) return '<none>';
  if (v instanceof Button) return `btn:${v.accelerators()[0] ?? '?'}`;
  return v.constructor.name;
}

/** The box's focusable ring in Tab order, walked until focus returns to where it started. */
function focusRing(app: DesktopApplication, max = 8): string[] {
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

/** The whole painted frame as text, for "did this string reach the screen" assertions. */
function painted(app: DesktopApplication): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** The open box's outer rectangle, read through the desktop rather than any child locator. */
function boxBounds(app: DesktopApplication): { width: number; height: number } {
  const win = app.desktop.activeWindow();
  expect(win).not.toBeNull();
  return { width: win!.bounds.width, height: win!.bounds.height };
}

// ST-FE03 — OK is the sole tab stop; Tab returns to it.
test('ST-FE03: errorBox Tab-traverses [OK] — the message Text is not a tab stop', async () => {
  const app = makeApp();
  const p = errorBox(app, 'Invalid directory');
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o']);

  app.loop.emitCommand(Commands.ok);
  await p;
});

// ST-FE03 — the contract holds for a long message too (one past the box's 60-column width cap).
test('ST-FE03: a long message still leaves OK as the sole tab stop', async () => {
  const app = makeApp();
  const long = 'The file could not be opened because the directory it lives in is not readable by this user account.';
  const p = errorBox(app, long);
  app.loop.renderRoot.flush();

  expect(focusRing(app)).toEqual(['btn:o']);

  app.loop.emitCommand(Commands.ok);
  await p;
});

// ST-FE07 — the width rule: message plus frame and padding, clamped to [24, 60].
test('ST-FE07: errorBox width is min(60, max(24, message length + 6))', async () => {
  const cases = [
    { message: 'x', width: 24 }, // below the floor — clamped up
    { message: 'Invalid directory', width: 24 }, // 17 + 6 = 23, still under the floor
    { message: 'a'.repeat(30), width: 36 }, // between the bounds — sized to the message
    { message: 'a'.repeat(60), width: 60 }, // above the ceiling — clamped down
  ];
  for (const c of cases) {
    const app = makeApp();
    const p = errorBox(app, c.message);
    app.loop.renderRoot.flush();

    expect(boxBounds(app).width).toBe(c.width);

    app.loop.emitCommand(Commands.ok);
    await p;
  }
});

// ST-FE06 — the height rule: exactly tall enough for the message, its frame, and the button band.
test('ST-FE06: a short message yields a 5-row box', async () => {
  const app = makeApp();
  const p = errorBox(app, 'Invalid directory');
  app.loop.renderRoot.flush();

  // One wrapped line + a two-row frame + a two-row button band.
  expect(boxBounds(app).height).toBe(5);

  app.loop.emitCommand(Commands.ok);
  await p;
});

// ST-FE06 — a message far past the width cap is shown in full, never clipped.
test('ST-FE06: a long message is fully visible — every wrapped line reaches the screen', async () => {
  const app = makeApp();
  const long =
    'The file could not be opened because the directory it lives in is not readable by the current user account.';
  const p = errorBox(app, long);
  app.loop.renderRoot.flush();

  const { width, height } = boxBounds(app);
  const lines = wrapText(long, width - 2); // the content box is the frame interior less its padding
  expect(lines.length).toBeGreaterThan(1); // the fixture really does wrap, or this proves nothing

  // Tall enough to hold every line plus the frame and the button band...
  expect(height).toBeGreaterThanOrEqual(lines.length + 4);
  // ...and every line is actually on screen, including the last.
  const screen = painted(app);
  for (const line of lines) expect(screen).toContain(line.trim());

  app.loop.emitCommand(Commands.ok);
  await p;
});
