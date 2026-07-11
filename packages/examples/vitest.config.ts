import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the @jsvision/examples package (the probe harness
 * tests). Mirrors core's two-project layout (AR-7): a fast `unit` project and
 * an isolated single-fork `e2e` project for the child-spawning `probe.e2e`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.{spec,impl}.test.ts'],
          exclude: ['test/**/*.e2e.test.ts', 'node_modules/**'],
          // Generous over vitest's 5s default: a few tests here pay a large one-time cost on a cold
          // Windows CI worker — a dynamic import that pulls in the whole @jsvision/ui graph, and the
          // TypeScript compiler API run by the plugin barrel-coverage check — which can exceed 15s.
          testTimeout: 60_000,
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
