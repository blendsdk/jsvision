/**
 * Browser stub for the two Node built-ins the `@jsvision/core` module graph
 * statically imports (`node:fs`, `node:tty`) — see `vite.config.ts`.
 *
 * The web demo never calls `createHost` (it drives the loop with a purpose-built
 * `browser-host.ts` instead), so `streams.ts` / `platform.ts` are pulled into the
 * bundle only for their top-level `import { ... }` bindings — none of the named
 * symbols below are ever invoked. They exist purely so the ESM named imports
 * resolve; if one is ever called it throws, which is the correct, loud failure
 * (it would mean the demo accidentally reached into the native TTY host).
 */

/** Loud placeholder for an unexpected native call. */
function unavailable(name: string): never {
  throw new Error(`web-xterm: node built-in "${name}" is not available in the browser`);
}

// node:fs — imported by host/streams.ts and host/platform.ts.
export function writeSync(): never {
  return unavailable('fs.writeSync');
}
export function openSync(): never {
  return unavailable('fs.openSync');
}
export function closeSync(): never {
  return unavailable('fs.closeSync');
}

// node:tty — imported by host/streams.ts.
export class ReadStream {
  constructor() {
    unavailable('tty.ReadStream');
  }
}
export class WriteStream {
  constructor() {
    unavailable('tty.WriteStream');
  }
}
