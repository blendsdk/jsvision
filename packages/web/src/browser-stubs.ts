/**
 * Throwing placeholders for the Node built-ins the `@jsvision/core` and `@jsvision/files` module
 * graphs statically import — `node:fs`, `node:tty`, `node:os`, and `node:path`.
 *
 * A browser has none of these, yet importing the `@jsvision/core` or `@jsvision/files` barrels pulls
 * them in for top-level bindings: the native `tty` host (`host/streams.ts`, `host/platform.ts`), the
 * screen-safe logger's default file sink (`safety/logger.ts`), the opt-in input diagnostics
 * (`host/diagnostics.ts`), and the default Node filesystem (`files` `fs/node-fs.ts`). None of those
 * code paths run in a browser — the browser host replaces the native host, the logger's file sink is
 * off by default, diagnostics are opt-in, and the browser uses an in-memory filesystem. So point a
 * bundler alias at this module for each specifier: the named imports resolve, and every function here
 * throws loudly the instant it is actually invoked — which would only happen if the app reached into a
 * native facility that cannot exist in the browser. Fail loud, never silent.
 *
 * The one non-throwing export is `path.sep`: it is *read at module load* (the `nodeFileSystem` literal
 * captures it), so it resolves to the POSIX `'/'` — a throwing value would break the bundle at import,
 * not at a call.
 *
 * This module is reachable **only** through the `@jsvision/web/browser-stubs` subpath, never the
 * package barrel, so importing `@jsvision/web` never drags these placeholders into a consumer's graph.
 *
 * @example
 * // vite.config.ts (consumer, e.g. the docs site)
 * import { fileURLToPath } from 'node:url';
 * const stub = fileURLToPath(new URL('@jsvision/web/browser-stubs', import.meta.url));
 * export default defineConfig({
 *   resolve: {
 *     alias: { 'node:fs': stub, 'node:tty': stub, 'node:os': stub, 'node:path': stub },
 *   },
 * });
 */

/** Throw a clear, loud error naming the native call that is unavailable in the browser. */
function unavailable(name: string): never {
  throw new Error(`@jsvision/web: node built-in "${name}" is not available in the browser`);
}

// --- node:fs — the native filesystem; the browser injects an in-memory FileSystem instead ---

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

/** `node:fs` `readFileSync` placeholder — throws if called; the browser reads through an injected filesystem. */
export function readFileSync(): never {
  return unavailable('fs.readFileSync');
}

/** `node:fs` `writeFileSync` placeholder — throws if called; the browser writes through an injected filesystem. */
export function writeFileSync(): never {
  return unavailable('fs.writeFileSync');
}

/** `node:fs` `appendFileSync` placeholder — throws if called (the opt-in input diagnostics append through it). */
export function appendFileSync(): never {
  return unavailable('fs.appendFileSync');
}

/** `node:fs` `existsSync` placeholder — throws if called; the browser filesystem answers existence itself. */
export function existsSync(): never {
  return unavailable('fs.existsSync');
}

/** `node:fs` `statSync` placeholder — throws if called; the browser filesystem provides its own stat. */
export function statSync(): never {
  return unavailable('fs.statSync');
}

/** `node:fs` `lstatSync` placeholder — throws if called; the browser filesystem provides its own lstat. */
export function lstatSync(): never {
  return unavailable('fs.lstatSync');
}

/** `node:fs` `readdirSync` placeholder — throws if called; the browser filesystem lists directories itself. */
export function readdirSync(): never {
  return unavailable('fs.readdirSync');
}

/** `node:fs` `renameSync` placeholder — throws if called; the browser filesystem renames through its own API. */
export function renameSync(): never {
  return unavailable('fs.renameSync');
}

/** `node:fs` `unlinkSync` placeholder — throws if called; the browser filesystem deletes through its own API. */
export function unlinkSync(): never {
  return unavailable('fs.unlinkSync');
}

// --- node:tty — raw stdin/stdout streams; the browser host reads/writes the terminal emulator instead ---

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

// --- node:os — home directory lookup; meaningless in a browser ---

/** `node:os` `homedir` placeholder — throws if called (only the Node filesystem's "home" shortcut uses it). */
export function homedir(): never {
  return unavailable('os.homedir');
}

// --- node:path — pure path math; the browser filesystem does its own POSIX path handling ---

/**
 * `node:path` POSIX separator. Unlike the functions below, this is *read at module load* by the Node
 * filesystem literal, so it resolves to a real `'/'` rather than throwing (a throw would break the
 * bundle at import time, not at a call).
 */
export const sep = '/';

/** `node:path` `join` placeholder — throws if called; the browser filesystem does its own pure-POSIX joins. */
export function join(): never {
  return unavailable('path.join');
}

/** `node:path` `resolve` placeholder — throws if called; the browser filesystem resolves paths itself. */
export function resolve(): never {
  return unavailable('path.resolve');
}

/** `node:path` `isAbsolute` placeholder — throws if called; the browser filesystem tests absoluteness itself. */
export function isAbsolute(): never {
  return unavailable('path.isAbsolute');
}

/** `node:path` `dirname` placeholder — throws if called; the browser filesystem derives dirnames itself. */
export function dirname(): never {
  return unavailable('path.dirname');
}

/** `node:path` `basename` placeholder — throws if called; the browser filesystem derives basenames itself. */
export function basename(): never {
  return unavailable('path.basename');
}
