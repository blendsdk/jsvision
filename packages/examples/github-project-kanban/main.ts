import { resolveCapabilities } from '@jsvision/core';

import { DEFAULT_GITHUB_PROJECT_URL } from './github-project.js';
import { createGitHubProjectKanbanApp } from './shell.js';

/** Composes and runs the standalone public GitHub Projects Kanban playground. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:github-kanban needs a real interactive terminal (TTY).\n' +
        'Run it directly: yarn workspace @jsvision/examples demo:github-kanban\n',
    );
    return 0;
  }
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      unicode: { utf8: true },
    },
  }).profile;
  const showcase = createGitHubProjectKanbanApp(caps, { initialUrl: DEFAULT_GITHUB_PROJECT_URL });
  void showcase.load(DEFAULT_GITHUB_PROJECT_URL);
  return showcase.run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
