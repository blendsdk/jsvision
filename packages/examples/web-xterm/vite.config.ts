/**
 * Vite config for the `demo:web` browser example.
 *
 * Two adaptations are all it takes to run the terminal SDK in a browser:
 *
 *   1. `resolve.alias` maps the only two Node built-ins in the `@jsvision/core` module graph
 *      (`node:fs`, `node:tty`) to `@jsvision/web`'s shipped `browser-stubs` subpath — throwing
 *      placeholders for the native `tty` host + logger file sink, which this demo never calls. This
 *      is the canonical consumer recipe from the `@jsvision/web` README.
 *   2. `define` fixes `process.env.NODE_ENV` so the built `@jsvision/ui`'s dev-warning gate compiles
 *      to a constant (the `index.html` shim covers any residual `process` reads).
 *
 * `@jsvision/core`, `@jsvision/ui`, and `@jsvision/web` resolve through their workspace symlinks to
 * the built `dist/` (their package `exports`), so run `yarn build` first.
 */
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const stub = '@jsvision/web/browser-stubs';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      'node:fs': stub,
      'node:tty': stub,
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
