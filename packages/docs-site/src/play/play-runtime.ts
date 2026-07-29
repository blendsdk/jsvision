import type { InjectionKey } from 'vue';
import { isNoKeyboardDevice } from './no-keyboard.js';
import type { HostElement, PlaySize } from './play-controller.js';

/** Callbacks and state needed to construct one lazy terminal session. */
export interface PlaySessionOptions {
  /** Registry ID of the example to load. */
  readonly id: string;
  /** Initial terminal size before the fit addon applies the available DOM space. */
  readonly size: PlaySize;
  /** Return whether the terminal currently owns keyboard focus. */
  readonly isFocused: () => boolean;
  /** Track terminal textarea focus so browser chord reclaim remains correctly scoped. */
  readonly onFocusChange: (focused: boolean) => void;
  /** Receive a readable error when loading or mounting fails. */
  readonly onError: (message: string) => void;
  /** Close the surrounding modal when the hosted application exits. */
  readonly onClose: () => void;
  /** Read a previously persisted terminal size. */
  readonly loadRememberedSize: () => PlaySize | null;
}

/** One lazily constructed terminal/controller pair owned by a PlayExample mount. */
export interface PlaySession {
  /** Load and mount the selected example into the terminal host. */
  open(element: HTMLElement): Promise<void>;
  /** Dispose the example, terminal, reclaim listener, and registered cleanups. */
  close(): void;
  /** Rebuild the mounted application, optionally with a new cell size. */
  remount(next: { readonly size?: PlaySize }): Promise<void>;
  /** Refit the terminal after its host changes size. */
  fit(): void;
  /** Convert the terminal host's current pixel size into terminal cells. */
  sizeInCells(element: HTMLElement): PlaySize | null;
}

/** Resize observer surface required by the live-example modal. */
export interface PlayResizeObserver {
  /** Start observing the terminal host. */
  observe(element: Element): void;
  /** Stop all observations owned by this modal. */
  disconnect(): void;
}

/** Browser dependencies the Vue launcher resolves through a mount-scoped injection. */
export interface PlayRuntime {
  /** Detect devices that cannot interact with a keyboard-driven terminal. */
  isNoKeyboardDevice(): boolean;
  /** Lazily construct xterm, its addons, the example registry, and the Play controller. */
  createSession(options: PlaySessionOptions): Promise<PlaySession | null>;
  /** Construct a resize observer owned by one open modal. */
  createResizeObserver(callback: ResizeObserverCallback): PlayResizeObserver;
  /** Schedule one fit operation for the next browser frame. */
  requestAnimationFrame(callback: FrameRequestCallback): number;
}

/** Vue injection key used by DOM tests to replace browser-heavy Play dependencies per mount. */
export const PLAY_RUNTIME_KEY: InjectionKey<PlayRuntime> = Symbol('JSVisionPlayRuntime');

/** Narrow the controller's host abstraction back to the real browser element supplied by Vue. */
function isHtmlElement(element: HostElement): element is HTMLElement {
  return (
    typeof HTMLElement !== 'undefined' &&
    element instanceof HTMLElement &&
    typeof element.clientWidth === 'number' &&
    typeof element.clientHeight === 'number'
  );
}

/**
 * Construct the real browser Play session without importing xterm before activation.
 *
 * @param options Example identity, sizing, focus, and lifecycle callbacks.
 * @returns A session for the selected registry entry, or `null` when the ID is unknown.
 */
async function createBrowserSession(options: PlaySessionOptions): Promise<PlaySession | null> {
  const [xterm, fitAddon, webglAddon, playController, registry] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-webgl'),
    import('./play-controller.js'),
    import('../../examples/index.js'),
  ]);
  await import('@xterm/xterm/css/xterm.css');

  const entry = registry.EXAMPLES.find((candidate) => candidate.id === options.id);
  if (entry === undefined) {
    options.onError(`Unknown example: ${options.id}`);
    return null;
  }

  let fit: { fit(): void } | null = null;
  let cellWidth = 0;
  let cellHeight = 0;
  const controller = playController.createPlayController({
    entry,
    size: options.size,
    isFocused: options.isFocused,
    onError: options.onError,
    onClose: options.onClose,
    createTerminal: (element) => {
      if (!isHtmlElement(element)) {
        throw new TypeError('Play runtime requires an HTMLElement terminal host');
      }
      const host = element;
      const preset = options.loadRememberedSize() ?? options.size;
      const terminal = new xterm.Terminal({
        cols: preset.width,
        rows: preset.height,
        allowProposedApi: true,
        cursorBlink: true,
        fontSize: 14,
      });
      const nextFit = new fitAddon.FitAddon();
      terminal.loadAddon(nextFit);
      terminal.open(host);
      try {
        terminal.loadAddon(new webglAddon.WebglAddon());
      } catch {
        // WebGL is an optional renderer; xterm's DOM renderer preserves behavior.
      }
      nextFit.fit();
      fit = nextFit;
      cellWidth = host.clientWidth / Math.max(1, terminal.cols);
      cellHeight = host.clientHeight / Math.max(1, terminal.rows);
      terminal.textarea?.addEventListener('focus', () => options.onFocusChange(true));
      terminal.textarea?.addEventListener('blur', () => options.onFocusChange(false));
      return terminal;
    },
  });

  return {
    open: (element) => controller.open(element),
    close: () => controller.close(),
    remount: (next) => controller.remount(next),
    fit: () => fit?.fit(),
    sizeInCells(element) {
      if (cellWidth <= 0 || cellHeight <= 0) return null;
      return {
        width: Math.max(1, Math.round(element.clientWidth / cellWidth)),
        height: Math.max(1, Math.round(element.clientHeight / cellHeight)),
      };
    },
  };
}

/** Production runtime used when a mount does not provide a deterministic replacement. */
export const browserPlayRuntime: PlayRuntime = {
  isNoKeyboardDevice,
  createSession: createBrowserSession,
  createResizeObserver: (callback) => new ResizeObserver(callback),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
};
