/**
 * A real, tty-backed {@link TerminalQuery} — the object that lets asynchronous
 * capability detection talk to a live terminal.
 *
 * Terminal capability detection can *ask* the terminal questions (e.g. "do you
 * support synchronized output?") by writing a request escape sequence and reading
 * the reply. This is a thin, dependency-free adapter over a pair of Node streams
 * that does exactly that: `write()` sends a request to the output stream, and
 * `read()` yields each input chunk as a `Uint8Array` (detaching its listener when
 * you stop iterating). Pass it as `resolveCapabilitiesAsync({ query })`.
 *
 * It does NOT change terminal modes — the caller must ensure the input stream is
 * already in raw mode and flowing before querying — so it has no lifecycle of its
 * own and no side effects on terminal state beyond the bytes it writes.
 */
import type { TerminalQuery } from '../capability/profile.js';

/**
 * Options for {@link createTerminalQuery}. Both streams default to the process
 * standard streams. The plain readable/writable stream types (not the tty
 * subtypes) are used so an in-memory stream can drive the adapter in tests;
 * `process.stdin`/`process.stdout` satisfy them too.
 */
export interface TerminalQueryOptions {
  /** Stream to read terminal responses from. Default: `process.stdin`. */
  readonly input?: NodeJS.ReadableStream;
  /** Stream to write query requests to. Default: `process.stdout`. */
  readonly output?: NodeJS.WritableStream;
}

/**
 * A {@link TerminalQuery} with an explicit {@link ManagedTerminalQuery.close} to
 * detach the input listener and end any active `read()` iteration.
 */
export interface ManagedTerminalQuery extends TerminalQuery {
  /** Detach the input 'data' listener and end any active `read()` iterator. Idempotent. */
  close(): void;
}

/** Coerce a Node 'data' payload (Buffer when no encoding is set, else string) to bytes. */
function toBytes(chunk: Buffer | string): Uint8Array {
  return typeof chunk === 'string' ? new Uint8Array(Buffer.from(chunk, 'latin1')) : new Uint8Array(chunk);
}

/**
 * Create a real, tty-backed {@link TerminalQuery} over a pair of Node streams.
 *
 * `write(data)` sends the request string to `output`. `read()` returns an
 * `AsyncIterable` that yields each input chunk as a `Uint8Array`; bytes arriving
 * between iterations are buffered so none are dropped, and the input listener is
 * detached when you stop iterating or call {@link ManagedTerminalQuery.close}.
 * The caller must ensure the input stream is already in raw mode and flowing.
 *
 * Always call `close()` when done so the input listener is released.
 *
 * @param options Injectable `input`/`output` streams (default: process standard streams).
 * @returns A managed query object; feed it to `resolveCapabilitiesAsync`.
 * @example
 * import { createTerminalQuery, resolveCapabilitiesAsync } from '@jsvision/core';
 *
 * // With stdin in raw mode and flowing, detect capabilities by asking the terminal.
 * const query = createTerminalQuery(); // defaults to process.stdin/stdout
 * try {
 *   const { profile } = await resolveCapabilitiesAsync({ query });
 *   console.error('color depth:', profile.colorDepth);
 * } finally {
 *   query.close();
 * }
 */
export function createTerminalQuery(options: TerminalQueryOptions = {}): ManagedTerminalQuery {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  const queue: Uint8Array[] = [];
  let dataListener: ((chunk: Buffer | string) => void) | null = null;
  let errorListener: (() => void) | null = null;
  let pending: ((result: IteratorResult<Uint8Array>) => void) | null = null;
  let ended = false;

  function detach(): void {
    if (dataListener) {
      input.removeListener('data', dataListener);
      dataListener = null;
    }
    if (errorListener) {
      input.removeListener('error', errorListener);
      errorListener = null;
    }
  }

  function ensureListening(): void {
    if (dataListener || ended) return;
    dataListener = (chunk): void => {
      const bytes = toBytes(chunk);
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve({ value: bytes, done: false });
      } else {
        queue.push(bytes);
      }
    };
    // A stream 'error' ends iteration gracefully rather than crashing the process
    // on an unhandled 'error' event; the consumer (runQueries) then falls back.
    errorListener = (): void => close();
    input.on('data', dataListener);
    input.on('error', errorListener);
    input.resume(); // ensure the stream is flowing
  }

  // A single reusable iterator: runQueries consumes one read() loop at a time.
  const iterator: AsyncIterator<Uint8Array> = {
    next(): Promise<IteratorResult<Uint8Array>> {
      const queued = queue.shift();
      if (queued !== undefined) {
        return Promise.resolve({ value: queued, done: false });
      }
      if (ended) {
        return Promise.resolve({ value: undefined, done: true });
      }
      ensureListening();
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    return(): Promise<IteratorResult<Uint8Array>> {
      detach();
      return Promise.resolve({ value: undefined, done: true });
    },
  };

  function close(): void {
    if (ended) return;
    ended = true;
    detach();
    if (pending) {
      const resolve = pending;
      pending = null;
      resolve({ value: undefined, done: true });
    }
  }

  return {
    write(data: string): void {
      output.write(data);
    },
    read(): AsyncIterable<Uint8Array> {
      ensureListening();
      return { [Symbol.asyncIterator]: () => iterator };
    },
    close,
  };
}
