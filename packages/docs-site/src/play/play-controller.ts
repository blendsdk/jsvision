/**
 * The Play controller: the plain-TS lifecycle behind the client-only Play
 * component. Split out from the Vue so the open/close/dispose logic is drivable
 * headlessly (the leak test drives it directly) and never touches the DOM beyond
 * the mount element handle.
 *
 * `open` lazily loads the example module, composes it in the demo shell, mounts
 * it onto a terminal the caller supplies (the component keeps the `@xterm/xterm`
 * import client-side), and attaches key-chord reclaim. `close` disposes in
 * reverse and nulls every reference. A module-level one-dialog singleton closes
 * any other open Play before a new one opens, so at most one terminal is ever
 * live. If loading or mounting throws, the controller signals an error via
 * `onError` (the component renders a readable panel) and stays closed.
 */
import { mountApp, buildBrowserCaps, attachKeyReclaim } from '@jsvision/web';
import type { BrowserCapsOptions, MountedApp } from '@jsvision/web';
import { demoShell } from '../demo-shell.js';
import type { ExampleEntry } from '../../examples/index.js';

/** The colour depths the Play controller can mount at (reuses `buildBrowserCaps`'s union — never redeclared). */
export type ColorDepth = NonNullable<BrowserCapsOptions['colorDepth']>;

/** The mounted terminal size in cells. */
export interface PlaySize {
  width: number;
  height: number;
}

/** The DOM mount point (a narrow structural type — a real `HTMLElement` satisfies it). */
export interface HostElement {
  readonly tagName: string;
}

/** The narrow terminal surface `mountApp` drives (a real `@xterm/xterm` or an `@xterm/headless` terminal). */
export interface TerminalLike {
  write(data: string): void;
  onData(handler: (data: string) => void): { dispose(): void };
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };
  focus?(): void;
  dispose?(): void;
}

/** A keydown event as the reclaim matcher reads it. */
interface ReclaimKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  preventDefault(): void;
}

/** The event target the reclaim listener attaches to (defaults to `document`). */
export interface KeyEventTarget {
  addEventListener(type: string, handler: (event: ReclaimKeyEvent) => void, options?: { capture?: boolean }): void;
  removeEventListener(type: string, handler: (event: ReclaimKeyEvent) => void, options?: { capture?: boolean }): void;
  readonly activeElement?: { readonly className?: string } | null;
}

/** Options for {@link createPlayController}. */
export interface PlayControllerOptions {
  /** The registry entry to run. */
  readonly entry: ExampleEntry;
  /** Build the terminal to mount into (the caller keeps the `@xterm/xterm` import). */
  readonly createTerminal: (el: HostElement) => TerminalLike;
  /** Initial size; default 80×24. */
  readonly size?: PlaySize;
  /** Initial colour depth; default `'truecolor'`. */
  readonly depth?: ColorDepth;
  /** "Is the terminal focused" predicate for key-reclaim; default: open. */
  readonly isFocused?: () => boolean;
  /** The keydown target for reclaim; default `document`. */
  readonly reclaimTarget?: KeyEventTarget;
  /** Called when loading/mounting throws — the component renders a readable error panel. */
  readonly onError?: (message: string) => void;
}

/** The controller handle. */
export interface PlayController {
  /** Load, build, mount, and paint the example onto a terminal in `el`. */
  open(el: HostElement): Promise<void>;
  /** Dispose the mounted app + terminal and detach reclaim. Idempotent. */
  close(): void;
  /** Close then re-open with the merged size/depth — the shared Reset / size / depth seam. */
  remount(next: { size?: PlaySize; depth?: ColorDepth }): Promise<void>;
  /** Whether a terminal is currently mounted. */
  readonly isOpen: boolean;
}

/** The single open Play across the page — a new open closes it first (at most one live terminal). */
let activeController: PlayController | null = null;

/**
 * Create a Play controller for one registry entry.
 *
 * @param opts - the entry, a `createTerminal` factory, and optional size/depth/focus/error hooks.
 * @returns the {@link PlayController} handle.
 * @example
 * import { createPlayController } from '../src/play/play-controller.js';
 *
 * const controller = createPlayController({
 *   entry,
 *   createTerminal: (el) => { const t = new Terminal(); t.open(el); return t; },
 *   onError: (message) => showErrorPanel(message),
 * });
 * await controller.open(mountEl);
 * // later: controller.close();
 */
export function createPlayController(opts: PlayControllerOptions): PlayController {
  let mounted: MountedApp | null = null;
  let detachReclaim: (() => void) | null = null;
  let element: HostElement | null = null;
  let size: PlaySize = opts.size ?? { width: 80, height: 24 };
  let depth: ColorDepth = opts.depth ?? 'truecolor';
  let open = false;

  const controller: PlayController = {
    get isOpen() {
      return open;
    },

    async open(el: HostElement): Promise<void> {
      // One-dialog singleton: close any other open Play before this one paints.
      if (activeController !== null && activeController !== controller) activeController.close();
      activeController = controller;
      element = el;
      try {
        const def = (await opts.entry.load()).default;
        const caps = buildBrowserCaps({ colorDepth: depth });
        const app = demoShell({
          content: def.build({ width: size.width, height: size.height }),
          caps,
          viewport: size,
          chrome: opts.entry.chrome,
          onDepthChange: (nextDepth) => void controller.remount({ depth: nextDepth }),
        });
        const term = opts.createTerminal(el);
        mounted = mountApp({ element: el, app, caps, term });
        detachReclaim = attachKeyReclaim(term, {
          isFocused: opts.isFocused ?? (() => open),
          target: opts.reclaimTarget,
        });
        open = true;
      } catch (error) {
        // Never leave a blank/half-painted terminal: tear down, then surface a readable message.
        controller.close();
        const message = error instanceof Error ? error.message : String(error);
        opts.onError?.(message);
        console.error('[play] the example failed to load', error);
      }
    },

    close(): void {
      detachReclaim?.();
      detachReclaim = null;
      mounted?.dispose();
      mounted = null;
      open = false;
      element = null;
      if (activeController === controller) activeController = null;
    },

    async remount(next: { size?: PlaySize; depth?: ColorDepth }): Promise<void> {
      if (next.size !== undefined) size = next.size;
      if (next.depth !== undefined) depth = next.depth;
      const el = element;
      controller.close();
      if (el !== null) await controller.open(el);
    },
  };

  return controller;
}
