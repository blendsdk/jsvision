import { defineConfig } from 'vitest/config';

/** Separates fast contract tests from process and rendered-host integration tests. */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.{spec,impl,property,perf}.test.ts', 'src/**/*.{spec,impl,property,perf}.test.ts'],
          exclude: ['test/**/*.e2e.test.ts', 'node_modules/**'],
          testTimeout: 30_000,
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
