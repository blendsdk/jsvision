import { createHost, resolveCapabilities } from '@jsvision/core';

import { createKanbanDragHarness } from './drag-harness.js';
import { deriveKanbanSemanticHostBoardResult } from './semantic-host-board.js';

if (process.env.JSVISION_KANBAN_HOST_CHILD !== '1') process.exit(64);

const events = createKanbanDragHarness();
const caps = resolveCapabilities({
  env: process.env,
  platform: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
  override: { altScreen: false, mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
let settled = false;
let sawFocusLoss = false;

/** Publishes one bounded sanitized result before ending the native terminal child. */
async function finish(code: number): Promise<void> {
  if (settled) return;
  settled = true;
  clearTimeout(guard);
  let semantic: Awaited<ReturnType<typeof deriveKanbanSemanticHostBoardResult>> | undefined;
  try {
    semantic = await deriveKanbanSemanticHostBoardResult(events.events(), { onFrame: (frame) => host.render(frame) });
  } catch {
    // The parent treats a missing semantic envelope as bounded fixture failure.
  }
  try {
    await host.stop();
  } finally {
    events.dispose();
    const result = Buffer.from(
      JSON.stringify({ tty: process.stdin.isTTY === true && process.stdout.isTTY === true, semantic }),
      'utf8',
    ).toString('base64');
    process.stdout.write(`\r\nJSVISION_KANBAN_RESULT:${result}\r\n`, () => process.exit(code));
  }
}

const guard = setTimeout(() => void finish(70), 8_000);
const host = createHost({
  caps,
  input: process.stdin,
  output: process.stdout,
  onInput: (event) => {
    events.accept(event);
    if (event.type === 'focus' && !event.focused) sawFocusLoss = true;
    if (sawFocusLoss && event.type === 'mouse' && event.kind === 'up') void finish(0);
  },
});

await host.start();
process.stdout.write('\r\nJSVISION_KANBAN_READY\r\n');
