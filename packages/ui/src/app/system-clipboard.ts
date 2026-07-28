import type { ClipboardTextReader, ClipboardTextWriter } from '../event/index.js';

/**
 * The asynchronous plain-text operations required from the system clipboard dependency.
 *
 * This narrow internal shape keeps dependency-specific types out of the public UI API.
 */
export interface SystemClipboardMethods {
  /** Read the current operating-system clipboard as exact plain text. */
  read(): Promise<string>;
  /** Write exact plain text to the operating-system clipboard. */
  write(text: string): Promise<void>;
}

/** Load the platform clipboard implementation when the first clipboard operation needs it. */
export type SystemClipboardLoader = () => Promise<SystemClipboardMethods>;

/** Host-neutral callbacks installed on an application event loop. */
export interface SystemClipboardAdapter {
  /** Read native clipboard text for an accepted paste command. */
  readonly readClipboardText: ClipboardTextReader;
  /** Mirror canonical copied or cut text to the native clipboard. */
  readonly writeClipboardText: ClipboardTextWriter;
  /**
   * Prevent queued operations from starting after application teardown.
   *
   * A platform operation that already started cannot be cancelled through the clipboard API, but
   * later work waiting behind it is rejected without touching the operating-system clipboard.
   */
  stop(): void;
}

/**
 * Load the cross-platform system clipboard implementation.
 *
 * The import stays behind the first user clipboard gesture. Headless composition and applications
 * that never copy or paste therefore do not load or execute platform clipboard helpers.
 */
async function loadClipboardy(): Promise<SystemClipboardMethods> {
  const { default: clipboard } = await import('clipboardy');
  return clipboard;
}

/**
 * Create the default ordered system clipboard adapter used by terminal applications.
 *
 * Loading and operations share one rejection-safe queue. This guarantees that an immediate paste
 * cannot overtake an earlier copy, while a failed platform operation does not prevent later
 * gestures from trying again. Errors deliberately propagate to the event loop, which applies its
 * payload-free diagnostics and app-local fallback policy.
 *
 * @param load Load the platform implementation. Tests supply an inert fake; production loads
 *   `clipboardy` lazily.
 * @returns Raw-text reader and writer callbacks for the event loop.
 */
export function createSystemClipboardAdapter(load: SystemClipboardLoader = loadClipboardy): SystemClipboardAdapter {
  let methodsPromise: Promise<SystemClipboardMethods> | undefined;
  let operationTail = Promise.resolve();
  let stopped = false;

  const methods = (): Promise<SystemClipboardMethods> => {
    methodsPromise ??= load();
    return methodsPromise;
  };

  const enqueue = <T>(operation: (clipboard: SystemClipboardMethods) => Promise<T>): Promise<T> => {
    const result = operationTail.then(async () => {
      if (stopped) throw new Error('system clipboard adapter stopped');
      const clipboard = await methods();
      if (stopped) throw new Error('system clipboard adapter stopped');
      return operation(clipboard);
    });
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    readClipboardText: () => enqueue((clipboard) => clipboard.read()),
    writeClipboardText: (text) => enqueue((clipboard) => clipboard.write(text)),
    stop: () => {
      stopped = true;
    },
  };
}
