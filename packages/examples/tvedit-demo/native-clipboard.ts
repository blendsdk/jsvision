import type { ClipboardTextReader, ClipboardTextWriter } from '@jsvision/ui';

/**
 * The asynchronous plain-text subset required from a native clipboard implementation.
 *
 * Keeping this interface inside the private examples package prevents dependency-specific types
 * from leaking into the public UI SDK and lets automated tests supply inert fakes.
 */
export interface TveditClipboardMethods {
  /** Read the current operating-system clipboard as an unmodified string. */
  read(): Promise<string>;
  /** Write an unmodified string to the operating-system clipboard. */
  write(text: string): Promise<void>;
}

/** Host-neutral callbacks accepted by the JSVision application shell. */
export interface TveditClipboardAdapter {
  /** Read native clipboard text when the event loop accepts a paste gesture. */
  readonly readClipboardText: ClipboardTextReader;
  /** Mirror canonical copied or cut text to the native clipboard. */
  readonly writeClipboardText: ClipboardTextWriter;
}

/**
 * Adapt asynchronous native clipboard methods to the JSVision host boundary.
 *
 * The wrappers deliberately perform no normalization, logging, retry, or platform selection.
 * Those responsibilities belong to the injected clipboard implementation and the UI event loop.
 *
 * @param methods Asynchronous raw-text clipboard operations supplied by the native host.
 * @returns JSVision reader and writer callbacks.
 *
 * @example
 * ```ts
 * const adapter = createTveditClipboardAdapter({
 *   read: async () => 'native text',
 *   write: async (text) => saveNativeText(text),
 * });
 * ```
 */
export function createTveditClipboardAdapter(methods: TveditClipboardMethods): TveditClipboardAdapter {
  return {
    readClipboardText: () => methods.read(),
    writeClipboardText: (text) => methods.write(text),
  };
}
