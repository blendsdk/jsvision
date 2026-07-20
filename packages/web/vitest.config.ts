import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `@jsvision/web`, mirroring `@jsvision/files`' two-project
 * split: a fast `unit` run (`*.spec.test.ts` / `*.impl.test.ts`) and an isolated,
 * single-fork `e2e` run (`*.e2e.test.ts`) for any child-spawning tests.
 *
 * The `test:e2e` script passes `--passWithNoTests` because this package ships no
 * e2e tests of its own — the live proof is the refactored `demo:web` spike in
 * `@jsvision/examples`.
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
