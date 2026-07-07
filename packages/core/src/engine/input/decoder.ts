/**
 * The pure byte-to-event input decoder: turns raw terminal bytes into typed input
 * events (keys, mouse, wheel, paste, focus) and isolates capability-query replies
 * onto a separate channel.
 *
 * `decode(bytes, state, options?)` is a pure function of its inputs — it never
 * owns a timer, performs I/O, or logs bytes, so the same input always yields the
 * same output. It prepends any bytes carried from the previous call, scans
 * left-to-right consuming whole tokens, and carries an incomplete trailing token
 * forward in the returned `state`, so a sequence split across two chunks still
 * decodes correctly.
 *
 * The one genuinely time-dependent decision — a lone trailing `ESC` (was it the
 * Escape key, or the start of a longer arrow/function-key sequence?) — is
 * externalised to `flush()`, which the host calls when its inter-byte timer
 * (`ESC_TIMEOUT_MS`) fires with no further bytes. Always thread decoding forward
 * with `state = result.state` after every call: the state carries both the
 * incomplete bytes and any in-progress bracketed paste.
 *
 * At each scan position the decoder tries token types in priority order:
 * in-progress paste, capability-query reply, mouse/wheel, focus, bracketed-paste
 * start, then the keyboard fallback — so query replies, mouse, and paste are never
 * misread as keystrokes.
 */
import type {
  DecodeOptions,
  DecodeResult,
  DecoderState,
  FocusEvent,
  InputEvent,
  KeyEvent,
  PasteState,
  QueryResponse,
} from './events.js';
import { PASTE_CAP_BYTES } from './events.js';
import { decodeKey } from './keys.js';
import { decodeMouse } from './mouse.js';
import { PASTE_END, PASTE_START, matchMarker, decodePasteText } from './paste.js';
import { matchResponse } from '../capability/responses.js';
import { RESPONSE_BUFFER_CAP } from '../capability/query.js';

const ESC = 0x1b;
const CSI_INTRODUCER = 0x5b; // '['
const SS3_INTRODUCER = 0x4f; // 'O' — `ESC O <final>` (also collides with an Alt+Shift+O accelerator)
const FOCUS_IN = 0x49; // 'I'
const FOCUS_OUT = 0x4f; // 'O'
const EMPTY = new Uint8Array(0);

/** Outcome of attempting to decode a focus report at an offset. */
type FocusDecode =
  { readonly status: 'event'; readonly event: FocusEvent; readonly end: number } | { readonly status: 'none' };

/**
 * Create a fresh, empty decoder state to pass into the first {@link decode} call:
 * no carried bytes, no in-progress paste, not resyncing.
 *
 * @returns A new, empty {@link DecoderState}.
 * @example
 * import { createDecoderState, decode } from '@jsvision/core';
 *
 * let state = createDecoderState();
 * const enc = new TextEncoder();
 * const result = decode(enc.encode('\x1b[C'), state); // right-arrow: ESC [ C
 * state = result.state; // thread the state forward for the next chunk
 */
export function createDecoderState(): DecoderState {
  return { carry: EMPTY, paste: { active: false, bytes: [], truncated: false }, resync: false };
}

/**
 * Decode a chunk of terminal bytes into input events.
 *
 * Always feed the returned `state` back into the next call — it carries an
 * incomplete trailing sequence (or an in-progress paste) so a token split across
 * two chunks is not lost. Capability-query replies are returned on the separate
 * `queries` channel, never mixed into `events`.
 *
 * @param bytes The newly received bytes (e.g. a `stdin` `'data'` chunk).
 * @param state The state returned by the previous call, or `createDecoderState()`.
 * @param options Optional capability profile and paste-cap override.
 * @returns The decoded `events`, isolated query replies (`queries`), the incomplete
 *   trailing bytes (`rest`), and the next `state` to pass to the following call.
 * @example
 * import { createDecoderState, decode } from '@jsvision/core';
 *
 * const enc = new TextEncoder();
 * let state = createDecoderState();
 *
 * // A modified arrow key arriving split across two chunks. The partial CSI in the
 * // first chunk is carried; the second chunk completes it into one Ctrl+Right key.
 * let r = decode(enc.encode('\x1b[1'), state);
 * state = r.state; // r.events is empty — the sequence is not complete yet
 * r = decode(enc.encode(';5C'), state);
 * for (const ev of r.events) {
 *   if (ev.type === 'key') console.log(ev.key, ev.ctrl); // 'right' true
 * }
 */
export function decode(bytes: Uint8Array, state: DecoderState, options?: DecodeOptions): DecodeResult {
  return scan(concat(state.carry, bytes), state.paste, state.resync, options);
}

/**
 * Resolve a held, ambiguous trailing `ESC` as a standalone Escape keypress.
 *
 * A lone `ESC` at the end of a chunk could be the Escape key or the first byte of
 * a longer sequence, so {@link decode} holds it rather than guess. The host calls
 * `flush()` when its inter-byte timer (`ESC_TIMEOUT_MS`) fires with no more bytes:
 * a leading lone `ESC` in the carry then becomes a `key: 'escape'` event, and any
 * bytes after it decode normally. With no held `ESC`, this simply re-scans the
 * carry and typically returns nothing.
 *
 * @param state The current decoder state (its `carry` may hold the lone `ESC`).
 * @param options Optional decode options.
 * @returns The decode result, including the emitted Escape key when applicable.
 * @example
 * import { createDecoderState, decode, flush } from '@jsvision/core';
 *
 * // A bare ESC arrives with nothing after it.
 * let r = decode(Uint8Array.from([0x1b]), createDecoderState());
 * // r.events is empty — the ESC is held in r.state.carry.
 *
 * // Later, the host's timer fires with no further bytes:
 * r = flush(r.state);
 * console.log(r.events[0]); // { type: 'key', key: 'escape', ctrl: false, ... }
 */
export function flush(state: DecoderState, options?: DecodeOptions): DecodeResult {
  const buf = state.carry;
  if (!state.paste.active && !state.resync && buf.length > 0 && buf[0] === ESC) {
    // A two-byte `ESC O` / `ESC [` that never completed within the disambiguation window is an
    // Alt+letter accelerator (Alt+Shift+O / Alt+[), not the start of an SS3/CSI sequence — those
    // introducer bytes are ambiguous. Decode the letter as a standalone printable and set `alt`, so
    // it is byte-identical to any other Alt+<char>. This applies only at length 2: a longer carry
    // (e.g. `ESC [ 1 ;`) is a real in-progress sequence and must fall through to the escape path.
    if (buf.length === 2 && (buf[1] === SS3_INTRODUCER || buf[1] === CSI_INTRODUCER)) {
      const letter = decodeKey(copyOf(buf.subarray(1)), 0, options);
      if (letter.status === 'event') {
        return {
          events: [{ ...letter.event, alt: true }],
          queries: [],
          rest: EMPTY,
          state: { carry: EMPTY, paste: state.paste, resync: false },
        };
      }
    }
    const escape: KeyEvent = { type: 'key', key: 'escape', ctrl: false, alt: false, shift: false };
    const tail = scan(copyOf(buf.subarray(1)), state.paste, state.resync, options);
    return {
      events: [escape, ...tail.events],
      queries: tail.queries,
      rest: tail.rest,
      state: tail.state,
    };
  }
  return scan(buf, state.paste, state.resync, options);
}

/**
 * The core scan loop over a working buffer. At each position it tries the token
 * types in priority order: in-progress paste, query-response demux, mouse/wheel,
 * focus, bracketed-paste start, then the keyboard fallback. A complete token is
 * consumed and appended; an incomplete trailing token stops the scan (carried in
 * `rest`); a recognised-but-unmapped token is dropped.
 *
 * Query responses are pushed to `queries`, never `events`, so a terminal reply
 * physically cannot leak as a keystroke. The in-progress paste is accumulated into
 * local state and threaded out via the returned `state`.
 */
function scan(buf: Uint8Array, paste: PasteState, resync: boolean, options?: DecodeOptions): DecodeResult {
  const events: InputEvent[] = [];
  const queries: QueryResponse[] = [];
  const cap = options?.pasteCap ?? PASTE_CAP_BYTES;

  // Local, mutable copies so decode() never mutates the caller's state (it stays pure).
  let active = paste.active;
  let pasteBytes = active ? paste.bytes.slice() : [];
  let truncated = active ? paste.truncated : false;
  let resyncing = resync;

  let i = 0;
  scanLoop: while (i < buf.length) {
    // 0. Resync after a carry-bound overflow: drop bytes until the next ESC so an
    // oversized unterminated sequence (adversarial or corrupt) emits nothing.
    if (resyncing) {
      if (buf[i] !== ESC) {
        i += 1;
        continue;
      }
      resyncing = false; // reached a sequence boundary — resume normal decoding
    }

    // 1. In-progress paste: every byte is content until the end marker.
    if (active) {
      const endMarker = matchMarker(buf, i, PASTE_END);
      if (endMarker === 'incomplete') {
        break; // a partial end marker at the buffer end — carry & retry
      }
      if (typeof endMarker === 'number') {
        events.push({ type: 'paste', text: decodePasteText(pasteBytes), truncated });
        active = false;
        pasteBytes = [];
        truncated = false;
        i = endMarker;
        continue;
      }
      // Accumulate one content byte under the size cap; once exceeded, flag truncated.
      if (pasteBytes.length < cap) {
        pasteBytes.push(buf[i]);
      } else {
        truncated = true;
      }
      i += 1;
      continue;
    }

    // 2. Query-response demux → queries (never events), so a terminal reply cannot
    // be delivered as a keystroke.
    const response = matchResponse(buf, i);
    if (response === 'incomplete') {
      break; // an opened CSI/DCS response whose terminator has not arrived — carry it, never leak as keys
    }
    if (response !== null) {
      queries.push({ raw: copyOf(buf.subarray(i, response.end)), kind: response.kind });
      i = response.end;
      continue;
    }

    // 3. Mouse / wheel (SGR 1006).
    const mouse = decodeMouse(buf, i);
    if (mouse.status === 'incomplete') {
      break;
    }
    if (mouse.status === 'event') {
      events.push(mouse.event);
      i = mouse.end;
      continue;
    }

    // 4. Focus in/out (`CSI I` / `CSI O`).
    const focus = decodeFocus(buf, i);
    if (focus.status === 'event') {
      events.push(focus.event);
      i = focus.end;
      continue;
    }

    // 5. Bracketed-paste start marker.
    const startMarker = matchMarker(buf, i, PASTE_START);
    if (startMarker === 'incomplete') {
      break; // a partial start marker at the buffer end — carry & retry
    }
    if (typeof startMarker === 'number') {
      active = true;
      i = startMarker;
      continue;
    }

    // 6. Keyboard fallback (classic xterm grammar).
    const token = decodeKey(buf, i, options);
    switch (token.status) {
      case 'incomplete':
        break scanLoop; // incomplete trailing token — carry the remaining bytes
      case 'drop':
        i = token.end; // recognised shape, no key emitted — advance & resync
        continue;
      case 'event':
        events.push(token.event);
        i = token.end;
        continue;
    }
  }

  let rest = copyOf(buf.subarray(i));
  let nextResync = resyncing;
  // Carry bound: a trailing incomplete token longer than the shared cap is
  // adversarial garbage — drop it and resync rather than let the carry grow without
  // limit. (Paste content is bounded separately by the paste cap, not carried here.)
  if (rest.length > RESPONSE_BUFFER_CAP) {
    rest = EMPTY;
    nextResync = true; // discard the poisoned tail until the next ESC boundary
  }

  const nextPaste: PasteState = active
    ? { active: true, bytes: pasteBytes, truncated }
    : { active: false, bytes: [], truncated: false };

  return { events, queries, rest, state: { carry: rest, paste: nextPaste, resync: nextResync } };
}

/**
 * Decode a focus in/out report: `ESC [ I` → focused, `ESC [ O` → unfocused.
 * Returns `none` when the bytes are not a focus report (the decoder then tries the
 * bracketed-paste start and keyboard fallbacks).
 */
function decodeFocus(buf: Uint8Array, i: number): FocusDecode {
  if (buf[i] !== ESC || buf[i + 1] !== CSI_INTRODUCER) {
    return { status: 'none' };
  }
  const final = buf[i + 2];
  if (final === FOCUS_IN) {
    return { status: 'event', event: { type: 'focus', focused: true }, end: i + 3 };
  }
  if (final === FOCUS_OUT) {
    return { status: 'event', event: { type: 'focus', focused: false }, end: i + 3 };
  }
  return { status: 'none' };
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
