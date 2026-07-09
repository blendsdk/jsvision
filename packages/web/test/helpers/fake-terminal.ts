/**
 * Test doubles for the browser host — a controllable terminal and a deterministic timer, mirroring the
 * repo's hand-built doubles (no jsdom, no wall-clock). Both are typed structurally so they satisfy the
 * host's internal `TerminalLike` / timer seam without importing those internal types (the package
 * barrel intentionally does not export them).
 */

/** The narrow terminal surface the host touches — matches the host's internal `TerminalLike`. */
export interface FakeTerminal {
  write(data: string): void;
  onData(handler: (data: string) => void): { dispose(): void };
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };
}

/** A {@link FakeTerminal} plus the levers a test pulls to drive it. */
export interface FakeTerminalHarness {
  /** The terminal to pass as `createBrowserHost({ term })`. */
  readonly term: FakeTerminal;
  /** Every string the host wrote, in order. */
  readonly writes: string[];
  /** Fire the host's `onData` handler with `data` (simulates user input bytes from xterm). */
  sendData(data: string): void;
  /** Fire the host's `onResize` handler (simulates a terminal resize). */
  sendResize(size: { cols: number; rows: number }): void;
}

/** Build a controllable terminal that records writes and lets the test fire input/resize. */
export function createFakeTerminal(): FakeTerminalHarness {
  const writes: string[] = [];
  let dataHandler: ((data: string) => void) | undefined;
  let resizeHandler: ((size: { cols: number; rows: number }) => void) | undefined;
  return {
    term: {
      write: (data) => {
        writes.push(data);
      },
      onData: (handler) => {
        dataHandler = handler;
        return { dispose: () => (dataHandler = undefined) };
      },
      onResize: (handler) => {
        resizeHandler = handler;
        return { dispose: () => (resizeHandler = undefined) };
      },
    },
    writes,
    sendData: (data) => dataHandler?.(data),
    sendResize: (size) => resizeHandler?.(size),
  };
}

/** A deterministic single-shot timer: records the armed callback so a test steps time by hand. */
export interface FakeTimer {
  /** Pass as `createBrowserHost({ timer })`. */
  readonly seam: {
    setTimeout(handler: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
  /** Run the armed callback (simulates the timeout firing), then disarm. No-op if nothing is armed. */
  fire(): void;
  /** Whether a callback is currently armed. */
  armed(): boolean;
}

/** Build a {@link FakeTimer} whose timeout fires only when the test calls {@link FakeTimer.fire}. */
export function createFakeTimer(): FakeTimer {
  let pending: (() => void) | null = null;
  let handle = 0;
  return {
    seam: {
      setTimeout: (fn) => {
        pending = fn;
        handle += 1;
        return handle;
      },
      clearTimeout: () => {
        pending = null;
      },
    },
    fire: () => {
      const fn = pending;
      pending = null;
      fn?.();
    },
    armed: () => pending !== null,
  };
}
