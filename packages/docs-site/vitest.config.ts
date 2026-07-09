import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the @jsvision/docs-site package. A single `unit`
 * project headlessly smoke-tests every live example (paint-smoke), runs the
 * registry parity/drift checks, and drives the Play lifecycle leak test. Mirrors
 * the examples package's `unit` shape; no `e2e` project is needed — the leak test
 * uses @xterm/headless in-process and spawns no child.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.{spec,impl}.test.ts'],
          exclude: ['node_modules/**'],
          // A modest floor over vitest's 5s default for slow Windows runners.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
