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
import type { BrowserHost, BrowserKeyEvent, TerminalLike } from './host.js';
import { createBrowserDomInputAdapter } from './dom-input.js';
import type { BrowserDomInputAdapter, BrowserDomInputSurface } from './dom-input.js';
import { setClipboard } from './clipboard.js';
import type { ClipboardBridge } from './clipboard.js';

/**
 * The DOM element the terminal is mounted in (a narrow local type — no DOM lib needed). A real
 * `HTMLElement` satisfies it. It documents the mount point; a `createTerminal` factory opens the
 * terminal into it.
 */
export interface HostElement {
  /** The element's tag name (e.g. `'DIV'`) — present on every DOM element. */
  readonly tagName: string;
  /** Optional DOM capture listener available on real browser elements. */
  addEventListener?(type: string, listener: (event: unknown) => void, options?: boolean): void;
  /** Optional matching listener removal. */
  removeEventListener?(type: string, listener: (event: unknown) => void, options?: boolean): void;
  /** Optional browser geometry used to map pointer coordinates to terminal cells. */
  getBoundingClientRect?(): {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  /** Optional pointer-capture operation. */
  setPointerCapture?(pointerId: number): void;
  /** Optional pointer-release operation. */
  releasePointerCapture?(pointerId: number): void;
}

/** Optional pre-xterm DOM input configuration for {@link mountApp}. */
export interface BrowserDomMountOptions {
  /** Explicit terminal surface; defaults to the mount element when it exposes the required DOM methods. */
  readonly surface?: BrowserDomInputSurface;
  /** Platform label; defaults to `navigator.platform` when the browser exposes it. */
  readonly platform?: string;
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
  /**
   * Browser clipboard bridge used for outbound copy/cut. Defaults to `navigator.clipboard` when
   * available. Inject a bridge for non-DOM hosts and deterministic permission/error tests.
   */
  readonly clipboard?: ClipboardBridge;
  /** Set false to force ordinary xterm input, or supply DOM input overrides. */
  readonly domInput?: false | BrowserDomMountOptions;
}

/** The handle returned by {@link mountApp}. */
export interface MountedApp {
  /** The terminal the app was mounted onto. */
  readonly term: TerminalLike;
  /** The browser host driving the terminal. */
  readonly host: BrowserHost;
  /** Pre-xterm adapter, including `available: false` on headless/fallback hosts. */
  readonly domInput: BrowserDomInputAdapter;
  /** Release host input, the app loop, browser bridges, resize handling, and the optional terminal. */
  dispose(): void;
}

/** Uses a real mount element as the DOM input surface only when every required method is present. */
function surfaceFromElement(element: HostElement): BrowserDomInputSurface | undefined {
  if (
    element.addEventListener === undefined ||
    element.removeEventListener === undefined ||
    element.getBoundingClientRect === undefined
  ) {
    return undefined;
  }
  return {
    addEventListener: element.addEventListener.bind(element),
    removeEventListener: element.removeEventListener.bind(element),
    getBoundingClientRect: element.getBoundingClientRect.bind(element),
    ...(element.setPointerCapture === undefined ? {} : { setPointerCapture: element.setPointerCapture.bind(element) }),
    ...(element.releasePointerCapture === undefined
      ? {}
      : { releasePointerCapture: element.releasePointerCapture.bind(element) }),
  };
}

/** Reads the browser platform without making it a requirement for headless hosts. */
function defaultBrowserPlatform(): string {
  try {
    return typeof navigator === 'undefined' ? '' : navigator.platform;
  } catch {
    return '';
  }
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
  const domOptions = options.domInput === false ? undefined : options.domInput;
  const domInput = createBrowserDomInputAdapter({
    ...(domOptions?.surface === undefined
      ? { surface: options.domInput === false ? undefined : surfaceFromElement(options.element) }
      : { surface: domOptions.surface }),
    cells: () => ({
      columns: loop.renderRoot.buffer().width,
      rows: loop.renderRoot.buffer().height,
    }),
    platform: domOptions?.platform ?? defaultBrowserPlatform(),
    onInput: (event) => loop.dispatch(event),
  });
  const host = createBrowserHost({
    term,
    caps,
    onInput: (event) => loop.dispatch(event),
    acceptInput: domInput.acceptTerminalInput,
  });

  // Point the loop's output sinks at the host (the browser mirror of run()).
  loop.onFrame = (buffer) => host.render(buffer);
  loop.onCaret = (cell) => host.setCaret(cell);
  loop.writeClipboardText = (text) => setClipboard(text, caps, options.clipboard);

  // xterm.js reserves Ctrl+Shift+C for its own terminal selection, which is separate from a
  // JSVision control's selection. Consume that one gesture and route it as a decoded key so the
  // loop's normal keymap and focused-control command path remain the only copy implementation.
  term.attachCustomKeyEventHandler?.((event) => routeBrowserClipboardKey(event, loop.dispatch.bind(loop)));

  host.start();
  host.render(loop.renderRoot.buffer()); // paint the first frame
  loop.refreshCaret(); // position the initial caret (the first render is not a loop tick)

  const resizeSub = term.onResize(({ cols, rows }) => loop.resize({ width: cols, height: rows }));
  term.focus?.(); // absent on @xterm/headless — always optional

  return {
    term,
    host,
    domInput,
    dispose(): void {
      // Mirror run()'s shutdown for a detached browser surface: stop the loop's painter and unmount
      // the view tree so every view's onCleanup fires (releasing timers/subscriptions) before the
      // terminal goes. Without this a long-lived page leaks an app's reactive tree on every close.
      domInput.dispose();
      host.dispose();
      loop.dispose();
      loop.writeClipboardText = undefined;
      term.attachCustomKeyEventHandler?.(() => true);
      resizeSub.dispose();
      term.dispose?.();
    },
  };
}

/**
 * Route the browser-owned copy gesture into JSVision's normal decoded-key pipeline.
 *
 * @param event The minimal browser keyboard event supplied by xterm.js.
 * @param dispatch The mounted event loop's decoded-input sink.
 * @returns `false` when the copy gesture was consumed; `true` for xterm.js to handle every other key.
 */
function routeBrowserClipboardKey(
  event: BrowserKeyEvent,
  dispatch: (event: { type: 'key'; key: string; ctrl: boolean; alt: boolean; shift: boolean }) => void,
): boolean {
  const isCopy =
    event.type === 'keydown' &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    (event.code === 'KeyC' || event.key.toLowerCase() === 'c');
  if (!isCopy) return true;
  dispatch({ type: 'key', key: 'c', ctrl: true, alt: false, shift: true });
  return false;
}
