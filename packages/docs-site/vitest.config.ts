import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the @jsvision/docs-site package. A single `unit`
 * project headlessly smoke-tests every live example (paint-smoke), runs the
 * registry parity/drift checks, and drives the Play lifecycle leak test. Mirrors
 * the examples package's `unit` shape; no `e2e` project is needed — the leak test
 * uses @xterm/headless in-process and spawns no child.
 *
 * The `__JSVISION_VERSION__` define mirrors the VitePress build so `site-meta.ts`
 * resolves the real root package.json version under test.
 */
const rootVersion = (
  JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as {
    version: string;
  }
).version;

export default defineConfig({
  test: {
    projects: [
      {
        // The define lives on the project (not the root) so it reaches the project's
        // module transform — a root-only define does not propagate to projects.
        define: { __JSVISION_VERSION__: JSON.stringify(rootVersion) },
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
