/**
 * Stream binding and TTY detection for the host, including the POSIX `/dev/tty`
 * fallback.
 *
 * The host uses this internally to resolve which input/output streams to drive
 * and whether both ends are a real TTY. On POSIX, when stdout is piped but a
 * controlling terminal exists, it transparently binds to `/dev/tty` so a piped
 * app can still own the terminal; any failure (or Windows) falls back to the
 * standard streams rather than throwing. The publicly useful export here is
 * {@link detectTty}, a lightweight pre-start "is this an interactive terminal?"
 * check.
 */
import { closeSync, openSync } from 'node:fs';
import { ReadStream, WriteStream } from 'node:tty';
import type { HostOptions } from './types.js';

/**
 * The stream-related subset of {@link HostOptions} — enough for {@link detectTty}
 * to run the same binding logic the host uses, before the host is started.
 */
export interface StreamOptions {
  /** Input stream. Default: `process.stdin`. */
  readonly input?: NodeJS.ReadStream;
  /** Output stream. Default: `process.stdout`. */
  readonly output?: NodeJS.WriteStream;
  /** When true (default) and stdout is piped but a controlling terminal exists, bind to `/dev/tty`. */
  readonly preferDevTty?: boolean;
}

/** The resolved streams and TTY state the host runs against. */
export interface BoundStreams {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WriteStream;
  /** True only when BOTH ends are TTYs (or a `/dev/tty` bind succeeded). */
  readonly isTTY: boolean;
  /** Close any stream this module opened (e.g. `/dev/tty` fds); a no-op for injected/standard streams. */
  dispose(): void;
}

/** A restore/dispose step that must never throw — secondary failures are swallowed. */
function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* best-effort cleanup — nothing actionable if it fails */
  }
}

/**
 * Attempt to bind to the controlling terminal via `/dev/tty` (POSIX only).
 * Opens separate read and write descriptors; returns `null` if either open
 * fails so the caller can fall back to the standard streams.
 */
function openDevTty(): BoundStreams | null {
  let readFd: number | undefined;
  let writeFd: number | undefined;
  try {
    readFd = openSync('/dev/tty', 'r');
    writeFd = openSync('/dev/tty', 'w');
    const input = new ReadStream(readFd);
    const output = new WriteStream(writeFd);
    let closed = false;
    return {
      input,
      output,
      isTTY: Boolean(input.isTTY && output.isTTY),
      dispose(): void {
        if (closed) return;
        closed = true;
        safely(() => input.destroy());
        safely(() => output.destroy());
        safely(() => closeSync(readFd as number));
        safely(() => closeSync(writeFd as number));
      },
    };
  } catch {
    if (readFd !== undefined) safely(() => closeSync(readFd as number));
    if (writeFd !== undefined) safely(() => closeSync(writeFd as number));
    return null;
  }
}

/**
 * Resolve the bound streams + TTY state from options.
 *
 * Defaults `input` to `process.stdin` and `output` to `process.stdout`. When
 * neither stream is injected, `preferDevTty` is not `false`, the platform is
 * POSIX, and stdout is piped, it tries `/dev/tty`; on any failure it falls back
 * to the standard streams. Injected streams are used verbatim.
 *
 * @param options - the host options (`input`/`output`/`preferDevTty`).
 * @returns the bound streams, TTY flag, and a `dispose()` that closes only what
 *   this module opened.
 */
function resolveStreams(options: StreamOptions): BoundStreams {
  const injected = options.input !== undefined || options.output !== undefined;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  // Default POSIX path: piped stdout but a controlling terminal may exist.
  if (!injected && options.preferDevTty !== false && process.platform !== 'win32' && !process.stdout.isTTY) {
    const devTty = openDevTty();
    if (devTty) return devTty;
  }

  return {
    input,
    output,
    isTTY: Boolean(input.isTTY && output.isTTY),
    dispose(): void {
      /* std/injected streams are owned elsewhere — nothing to close */
    },
  };
}

export function bindStreams(options: HostOptions): BoundStreams {
  return resolveStreams(options);
}

/**
 * Check whether the app has an interactive terminal, **before** starting the
 * host. Returns true when both ends are a real TTY (or the POSIX `/dev/tty` bind
 * succeeds).
 *
 * Use this to gate startup — a running `Host` exposes `host.isTTY`, but that is
 * only meaningful after `start()`, so a pre-start check needs `detectTty()`
 * instead. It is ephemeral: it binds the same streams the host would, reads the
 * flag, and immediately disposes anything it opened (e.g. a `/dev/tty` fd), so no
 * descriptor lingers.
 *
 * @param options Optional `input`/`output`/`preferDevTty`. Defaults match the
 *   host: the standard streams, with the POSIX `/dev/tty` fallback when piped.
 * @returns true when the terminal is interactive.
 * @example
 * import { detectTty, assertEssentials, resolveCapabilities } from '@jsvision/core';
 *
 * if (!detectTty()) {
 *   console.error('This program must be run in an interactive terminal.');
 *   process.exit(1);
 * }
 * // Or feed it straight into the essentials gate:
 * assertEssentials(resolveCapabilities().profile, { isTTY: detectTty() });
 */
export function detectTty(options: StreamOptions = {}): boolean {
  const bound = resolveStreams(options);
  try {
    return bound.isTTY;
  } finally {
    bound.dispose();
  }
}
