import { resolveCapabilities } from '@jsvision/core';

import { createKanbanWindowLab } from './app.js';

/** Runs the focused real-window Kanban interaction laboratory. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:kanban-window needs a real interactive terminal (TTY).\n' +
        'Run it directly: yarn workspace @jsvision/examples demo:kanban-window\n',
    );
    return 0;
  }
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      unicode: { utf8: true },
    },
  }).profile;
  return createKanbanWindowLab(caps).run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
