/**
 * Pure byte→event input decoder core (RD-06, plan doc 03-02).
 *
 * `decode(bytes, state, options?)` is a pure function of its inputs: it never
 * owns a timer, performs I/O, or logs bytes (AC-8), so the same input always
 * yields the same output (replayable under a fuzz corpus). It concatenates the
 * carried bytes with the new chunk, scans left-to-right consuming complete
 * tokens, and carries any incomplete trailing token forward in the returned
 * state (chunk-boundary safety, AC-2).
 *
 * The single genuinely time-dependent decision — a lone trailing `ESC` (Escape
 * key vs the start of a CSI/SS3 sequence) — is externalised to `flush()`, driven
 * by the RD-07 host's `ESC_TIMEOUT_MS` timer (PL-3). The host threads decoding
 * forward with `state = result.state` (RT-1), which carries both the incomplete
 * bytes and any in-progress bracketed paste.
 *
 * Phase 2 ships the keyboard path; the mouse/paste/focus/query-demux matchers
 * (03-03) are inserted into the scan ordering in Phase 3.
 *
 * The `.js` extensions in the import specifiers are required by NodeNext ESM
 * resolution (they resolve to the `.ts` sources during development via tsx).
 */
import type {
  DecodeOptions,
  DecodeResult,
  DecoderState,
  InputEvent,
  KeyEvent,
  PasteState,
  QueryResponse,
} from './events.js';
import { decodeKey } from './keys.js';
import { RESPONSE_BUFFER_CAP } from '../capability/query.js';

const ESC = 0x1b;
const EMPTY = new Uint8Array(0);

/** A fresh, empty decoder state: no carried bytes, no in-progress paste. */
export function createDecoderState(): DecoderState {
  return { carry: EMPTY, paste: { active: false, bytes: [], truncated: false } };
}

/**
 * Decode a chunk of terminal bytes into input events.
 *
 * @param bytes The newly received bytes.
 * @param state The carry from the previous call (or `createDecoderState()`).
 * @param options Optional capability profile and paste-cap override.
 * @returns The decoded events, isolated query responses, the incomplete trailing
 *   bytes (`rest`), and the next `state` to pass to the following call (RT-1).
 */
export function decode(bytes: Uint8Array, state: DecoderState, options?: DecodeOptions): DecodeResult {
  return scan(concat(state.carry, bytes), state.paste, options);
}

/**
 * Force out a held ambiguous trailing `ESC` as a standalone Escape key (PL-3).
 *
 * Called by the host when its `ESC_TIMEOUT_MS` timer fires with no further bytes.
 * A leading lone `ESC` in the carry becomes `KeyEvent{ key:'escape' }`; any bytes
 * after it are decoded normally. With no held `ESC`, this just re-scans the carry.
 *
 * @param state The current decoder state (its `carry` may hold the lone `ESC`).
 * @param options Optional decode options.
 * @returns The decode result, including the emitted Escape key when applicable.
 */
export function flush(state: DecoderState, options?: DecodeOptions): DecodeResult {
  const buf = state.carry;
  if (!state.paste.active && buf.length > 0 && buf[0] === ESC) {
    const escape: KeyEvent = { type: 'key', key: 'escape', ctrl: false, alt: false, shift: false };
    const tail = scan(copyOf(buf.subarray(1)), state.paste, options);
    return {
      events: [escape, ...tail.events],
      queries: tail.queries,
      rest: tail.rest,
      state: tail.state,
    };
  }
  return scan(buf, state.paste, options);
}

/**
 * The core scan loop over a working buffer. Tries each token type in priority
 * order at every position; a complete token is consumed and appended, an
 * incomplete trailing token stops the scan (carried in `rest`), and a recognised
 * but unmapped token is dropped (advanced past, no event).
 */
function scan(buf: Uint8Array, paste: PasteState, options?: DecodeOptions): DecodeResult {
  const events: InputEvent[] = [];
  const queries: QueryResponse[] = [];

  let i = 0;
  while (i < buf.length) {
    // Phase 3 inserts active-paste / query-demux / mouse / focus / paste-start
    // matchers here, before the keyboard fallback.
    const token = decodeKey(buf, i, options);
    if (token.status === 'incomplete') {
      break; // incomplete trailing token — carry the remaining bytes
    }
    if (token.status === 'drop') {
      i = token.end; // recognised shape, no key emitted — advance & resync
      continue;
    }
    events.push(token.event);
    i = token.end;
  }

  let rest = copyOf(buf.subarray(i));
  // Carry bound (PL-6, AC-7/AC-8): a trailing incomplete token longer than the
  // shared cap is adversarial garbage — drop it and resync rather than grow.
  if (rest.length > RESPONSE_BUFFER_CAP) {
    rest = EMPTY;
  }

  return { events, queries, rest, state: { carry: rest, paste } };
}

/** Concatenate the carried bytes with the new chunk into one working buffer. */
function concat(carry: Uint8Array, bytes: Uint8Array): Uint8Array {
  if (carry.length === 0) {
    return bytes;
  }
  if (bytes.length === 0) {
    return carry;
  }
  const out = new Uint8Array(carry.length + bytes.length);
  out.set(carry, 0);
  out.set(bytes, carry.length);
  return out;
}

/** Copy a byte range into a standalone array (so carried bytes don't retain the buffer). */
function copyOf(view: Uint8Array): Uint8Array {
  return view.length === 0 ? EMPTY : Uint8Array.from(view);
}
