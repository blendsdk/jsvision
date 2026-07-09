import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for `@jsvision/theme-designer`, mirroring the repo's two-project split: a fast
 * `unit` run (`*.spec.test.ts` / `*.impl.test.ts`) and an isolated, single-fork `e2e` run
 * (`*.e2e.test.ts`) for the piped walkthrough that spawns the app as a child process.
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
          singleFork: true,
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
