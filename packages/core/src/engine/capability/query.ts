/**
 * The live terminal probe: ask the terminal what it supports and parse its replies.
 *
 * Writes the capability query sequences through an injected {@link TerminalQuery},
 * then reads the replies under a single timeout into a length-bounded buffer.
 * Recognised replies become capability hints; every other byte is returned as
 * `passthrough` (real input the user typed during the probe) so the caller can
 * hand it to the input decoder — a query reply never leaks as a keystroke.
 *
 * Security posture: replies are untrusted. The buffer never grows past
 * {@link RESPONSE_BUFFER_CAP}; on overflow it is discarded and detection falls
 * back to the other sources. Only exact, fully-terminated grammar matches become
 * capabilities; partial or malformed bytes are treated as passthrough. Replies
 * are parsed as data only — never evaluated.
 */
import type { CapabilityProfile, DeepPartial, TerminalQuery } from './profile.js';
import { matchResponse } from './responses.js';
import type { RuntimeHint } from './responses.js';

/** Default probe timeout in milliseconds. */
export const DEFAULT_QUERY_TIMEOUT_MS = 200;

/** Maximum retained reply buffer in bytes; a reply larger than this is discarded. */
export const RESPONSE_BUFFER_CAP = 1024;

/** The capability query sequences sent to the terminal. */
const QUERY_REQUESTS: readonly string[] = [
  '\x1b[c', // Primary DA
  '\x1b[>c', // Secondary DA
  '\x1b[>q', // XTVERSION
  '\x1b[?2026$p', // Synchronized-output mode (DECRQM ?2026)
];

/** The result of a probe: parsed capabilities + bytes to forward as input. */
export interface QueryResult {
  /** Capabilities parsed from recognised terminal replies. */
  readonly parsed: DeepPartial<CapabilityProfile>;
  /** Unrecognised bytes to forward to the app's input stream (real keystrokes). */
  readonly passthrough: Uint8Array;
}

/** Empty result used whenever the probe yields nothing usable. */
const EMPTY_RESULT: QueryResult = { parsed: {}, passthrough: new Uint8Array(0) };

/**
 * Send the capability queries to a {@link TerminalQuery} and parse the replies.
 *
 * Always resolves, never rejects: a silent terminal hits the timeout, an
 * oversized reply hits the cap, and a throwing `write()`/`read()` falls back —
 * each simply returns whatever was parsed plus the passthrough bytes.
 *
 * @param query The injected terminal stream seam.
 * @param timeoutMs Whole-step timeout in ms (default {@link DEFAULT_QUERY_TIMEOUT_MS}).
 * @returns The parsed capability partial and the passthrough bytes.
 */
export async function runQueries(
  query: TerminalQuery,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<QueryResult> {
  try {
    for (const request of QUERY_REQUESTS) {
      query.write(request);
    }
  } catch {
    // A failing write means we cannot query; skip the probe entirely.
    return EMPTY_RESULT;
  }

  const collected = await collectBytes(query, timeoutMs);
  if (collected === null) {
    // Oversized reply: the buffer was discarded at the cap; fall back.
    return EMPTY_RESULT;
  }
  return parseResponses(collected);
}

/**
 * Read bytes from the seam into a bounded buffer under a timeout.
 *
 * @returns The collected bytes, or `null` if the cap was exceeded (oversized).
 */
async function collectBytes(query: TerminalQuery, timeoutMs: number): Promise<Uint8Array | null> {
  const bytes: number[] = [];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  // The read loop never rejects: a throwing stream resolves to 'error' so the
  // race always settles and we fall back gracefully.
  const readLoop: Promise<'cap' | 'end' | 'error'> = (async () => {
    try {
      for await (const chunk of query.read()) {
        for (const byte of chunk) {
          bytes.push(byte);
          if (bytes.length > RESPONSE_BUFFER_CAP) {
            return 'cap';
          }
        }
      }
      return 'end';
    } catch {
      return 'error';
    }
  })();

  try {
    const outcome = await Promise.race([readLoop, timeout]);
    if (outcome === 'cap') {
      return null; // oversized → discard
    }
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer); // always clear the timer, even on the timeout path
    }
  }

  return Uint8Array.from(bytes);
}

/**
 * Scan a byte buffer, consuming recognised reply grammars into `parsed` and
 * forwarding every other byte to `passthrough` (splitting replies from input).
 */
function parseResponses(bytes: Uint8Array): QueryResult {
  const parsed: RuntimeHint = {};
  const passthrough: number[] = [];

  let i = 0;
  while (i < bytes.length) {
    const match = matchResponse(bytes, i);
    // Both `null` (not a reply) and `'incomplete'` (an opened-but-unterminated
    // sequence) are treated as passthrough input here, because this scans one
    // fixed captured buffer and does not carry a partial reply across chunks.
    if (match === null || match === 'incomplete') {
      passthrough.push(bytes[i]);
      i += 1;
      continue;
    }
    if (match.hint.sync2026 !== undefined) {
      parsed.sync2026 = match.hint.sync2026;
    }
    i = match.end; // consume the recognised sequence
  }

  return { parsed, passthrough: Uint8Array.from(passthrough) };
}
