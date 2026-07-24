import { defineConfig } from 'vitest/config';

/**
 * Separates fast architecture and behavior checks from build-output and process-isolation tests.
 */
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
