/**
 * Throwing placeholders for the two Node built-ins the `@jsvision/core` module graph statically
 * imports — `node:fs` (`writeSync`/`openSync`/`closeSync`) and `node:tty` (`ReadStream`/`WriteStream`).
 *
 * A browser has no `node:fs` or `node:tty`, yet the core barrel pulls both in for their top-level
 * bindings: the native `tty` host (`host/streams.ts`, `host/platform.ts`) and the screen-safe logger's
 * default filesystem (`safety/logger.ts`). None of those code paths run in a browser — the browser host
 * replaces the native host, and the logger's file sink is off by default. So point a bundler alias at
 * this module for both specifiers: the named imports resolve, and every symbol here throws loudly the
 * instant it is actually invoked — which would only happen if the app reached into a native facility
 * that cannot exist in the browser. Fail loud, never silent.
 *
 * This module is reachable **only** through the `@jsvision/web/browser-stubs` subpath, never the
 * package barrel, so importing `@jsvision/web` never drags these placeholders into a consumer's graph.
 *
 * @example
 * // vite.config.ts (consumer, e.g. the docs site)
 * import { fileURLToPath } from 'node:url';
 * const stub = fileURLToPath(new URL('@jsvision/web/browser-stubs', import.meta.url));
 * export default defineConfig({ resolve: { alias: { 'node:fs': stub, 'node:tty': stub } } });
 */

/** Throw a clear, loud error naming the native call that is unavailable in the browser. */
function unavailable(name: string): never {
  throw new Error(`@jsvision/web: node built-in "${name}" is not available in the browser`);
}

/**
 * `node:fs` `writeSync` placeholder — resolves the named import but throws if ever called (the native
 * TTY host, which writes through it, never runs in the browser).
 *
 * @throws always — a call means native `fs.writeSync` was reached in a browser context.
 * @example
 * // Never called directly; a bundler aliases `node:fs` to this module.
 * import { writeSync } from '@jsvision/web/browser-stubs';
 */
export function writeSync(): never {
  return unavailable('fs.writeSync');
}

/**
 * `node:fs` `openSync` placeholder — resolves the named import but throws if ever called. This is the
 * first call the screen-safe logger's file sink would make, so enabling that sink in a browser without
 * injecting a real filesystem fails here, loudly, rather than silently doing nothing.
 *
 * @throws always — a call means native `fs.openSync` was reached in a browser context.
 * @example
 * // Never called directly; a bundler aliases `node:fs` to this module.
 * import { openSync } from '@jsvision/web/browser-stubs';
 */
export function openSync(): never {
  return unavailable('fs.openSync');
}

/**
 * `node:fs` `closeSync` placeholder — resolves the named import but throws if ever called.
 *
 * @throws always — a call means native `fs.closeSync` was reached in a browser context.
 * @example
 * // Never called directly; a bundler aliases `node:fs` to this module.
 * import { closeSync } from '@jsvision/web/browser-stubs';
 */
export function closeSync(): never {
  return unavailable('fs.closeSync');
}

/**
 * `node:tty` `ReadStream` placeholder — resolves the named import but throws on construction (the
 * native host would build one to read raw stdin, which the browser host never does).
 *
 * @throws always on construction — the native TTY read stream has no browser equivalent.
 * @example
 * // Never constructed directly; a bundler aliases `node:tty` to this module.
 * import { ReadStream } from '@jsvision/web/browser-stubs';
 */
export class ReadStream {
  constructor() {
    unavailable('tty.ReadStream');
  }
}

/**
 * `node:tty` `WriteStream` placeholder — resolves the named import but throws on construction (the
 * native host would build one to write to stdout, which the browser host never does).
 *
 * @throws always on construction — the native TTY write stream has no browser equivalent.
 * @example
 * // Never constructed directly; a bundler aliases `node:tty` to this module.
 * import { WriteStream } from '@jsvision/web/browser-stubs';
 */
export class WriteStream {
  constructor() {
    unavailable('tty.WriteStream');
  }
}
