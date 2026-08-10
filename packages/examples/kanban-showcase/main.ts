import { resolveCapabilities } from '@jsvision/core';

import { createKanbanShowcase } from './shell.js';

/** Composes and runs the standalone Kanban kitchen sink in a real interactive terminal. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:kanban needs a real interactive terminal (TTY).\n' +
        'Run it directly: yarn workspace @jsvision/examples demo:kanban\n',
    );
    return 0;
  }
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      unicode: { utf8: true },
    },
  }).profile;
  return createKanbanShowcase(caps).run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
