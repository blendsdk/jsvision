import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `@jsvision/ui`, mirroring `@jsvision/core`'s two-project
 * split: a fast `unit` run (`*.spec.test.ts` / `*.impl.test.ts`) and an isolated,
 * single-fork `e2e` run (`*.e2e.test.ts`) for any future child-spawning tests.
 *
 * The `test:e2e` script passes `--passWithNoTests` because this scaffold ships no
 * e2e tests yet (a project-level flag is not honoured under `--project` in vitest
 * 4) — drop that flag once the first `*.e2e.test.ts` lands.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.{spec,impl}.test.ts'],
          exclude: ['test/**/*.e2e.test.ts', 'node_modules/**'],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.test.ts'],
          pool: 'forks',
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
