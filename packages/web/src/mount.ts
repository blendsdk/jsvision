/**
 * `mountApp` — the browser mirror of `@jsvision/ui`'s `run()`: wire a composed application's event
 * loop to a terminal in a few lines instead of the full boot dance. It points the loop's frame, caret,
 * and clipboard sinks at a {@link BrowserHost}, starts the host, paints the first frame, and maps
 * terminal resize back into the loop. It is the primary API a live-example runner builds on.
 *
 * `mountApp` never constructs a terminal itself — it does not import `@xterm/xterm` (a browser-only,
 * CommonJS-default package), so that value-import stays in the caller's bundle. Provide a ready `term`
 * (a test injects an `@xterm/headless` one; a browser app injects an opened `@xterm/xterm` one) or a
 * `createTerminal` factory. Attaching key-chord reclaim and a WebGL renderer is the caller's choice,
 * kept out so `mountApp` stays DOM-light and headless-testable.
 */
import type { Application } from '@jsvision/ui';
import type { CapabilityProfile } from '@jsvision/core';
import { createBrowserHost } from './host.js';
import type { BrowserHost, TerminalLike } from './host.js';

/**
 * The DOM element the terminal is mounted in (a narrow local type — no DOM lib needed). A real
 * `HTMLElement` satisfies it. It documents the mount point; a `createTerminal` factory opens the
 * terminal into it.
 */
export interface HostElement {
  /** The element's tag name (e.g. `'DIV'`) — present on every DOM element. */
  readonly tagName: string;
}

/** Options for {@link mountApp}. */
export interface MountAppOptions {
  /** The mount point the terminal lives in. */
  readonly element: HostElement;
  /** A composed `@jsvision/ui` application (its loop is wired to the terminal). */
  readonly app: Application;
  /** The capability profile (build one with `buildBrowserCaps`). */
  readonly caps: CapabilityProfile;
  /**
   * A ready terminal to drive. A test passes an `@xterm/headless` `Terminal`; a browser app passes an
   * opened `@xterm/xterm` one. Provide this **or** {@link createTerminal}.
   */
  readonly term?: TerminalLike;
  /**
   * A factory used when `term` is omitted, e.g. `() => { const t = new Terminal({…}); t.open(el);
   * return t; }`. Keeps the `@xterm/xterm` value-import in the caller's bundle.
   */
  readonly createTerminal?: () => TerminalLike;
}

/** The handle returned by {@link mountApp}. */
export interface MountedApp {
  /** The terminal the app was mounted onto. */
  readonly term: TerminalLike;
  /** The browser host driving the terminal. */
  readonly host: BrowserHost;
  /** Tear down the resize listener and the terminal. */
  dispose(): void;
}

/**
 * Mount an application onto a terminal and start it.
 *
 * @param options - the mount point, the app, the caps, and either a ready `term` or a `createTerminal`
 *   factory (one is required, or it throws).
 * @returns the {@link MountedApp} handle; call `dispose()` to tear it down.
 * @throws if neither `term` nor `createTerminal` is supplied.
 *
 * @example
 * import { Terminal } from '@xterm/xterm';
 * import { createApplication } from '@jsvision/ui';
 * import { mountApp, buildBrowserCaps } from '@jsvision/web';
 *
 * const caps = buildBrowserCaps();
 * const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
 * const el = document.getElementById('terminal')!;
 * const mounted = mountApp({
 *   element: el,
 *   app,
 *   caps,
 *   createTerminal: () => { const t = new Terminal({ allowProposedApi: true }); t.open(el); return t; },
 * });
 * // later: mounted.dispose();
 */
export function mountApp(options: MountAppOptions): MountedApp {
  const { app, caps } = options;
  const term = options.term ?? options.createTerminal?.();
  if (!term) {
    throw new Error('@jsvision/web: mountApp requires either `term` or `createTerminal`.');
  }

  const loop = app.loop;
  const host = createBrowserHost({ term, caps, onInput: (event) => loop.dispatch(event) });

  // Point the loop's output sinks at the host (the browser mirror of run()).
  loop.onFrame = (buffer) => host.render(buffer);
  loop.onCaret = (cell) => host.setCaret(cell);
  loop.writeClipboard = (seq) => term.write(seq);

  host.start();
  host.render(loop.renderRoot.buffer()); // paint the first frame
  loop.refreshCaret(); // position the initial caret (the first render is not a loop tick)

  const resizeSub = term.onResize(({ cols, rows }) => loop.resize({ width: cols, height: rows }));
  term.focus?.(); // absent on @xterm/headless — always optional

  return {
    term,
    host,
    dispose(): void {
      resizeSub.dispose();
      term.dispose?.();
    },
  };
}
