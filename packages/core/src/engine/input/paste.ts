/**
 * Bracketed-paste markers & assembly helpers.
 *
 * Bracketed paste wraps pasted content between `ESC [ 200 ~` and `ESC [ 201 ~`.
 * Between the markers every byte is paste content — including bytes that would
 * otherwise be keys or escape sequences — so the decoder accumulates them and
 * emits a single {@link PasteEvent}, never per-key events. This module provides
 * the chunk-boundary-safe marker matcher and the content decoder; the
 * accumulation, size cap, and state threading live in the decoder scan loop.
 *
 * Paste content is bounded by the size cap and is never logged or retained beyond
 * the emitted event.
 */
import { PASTE_CAP_BYTES } from './events.js';

/** Reused encoder for bounding direct string paste without first allocating its full UTF-8 form. */
const pasteTextEncoder = new TextEncoder();

/** Reused decoder for completed, encoder-produced UTF-8 prefixes. */
const boundedPasteTextDecoder = new TextDecoder();

/**
 * A plain-text paste after applying its UTF-8 byte boundary.
 *
 * `truncated` distinguishes an empty clipboard from a non-empty value that could not fit. The
 * returned text is always an exact Unicode-scalar prefix of the input.
 */
export interface BoundedPasteText {
  /** The original text when it fits, otherwise the longest complete prefix within the byte cap. */
  readonly text: string;
  /** Whether one or more input code points were omitted because they exceeded the byte cap. */
  readonly truncated: boolean;
}

/**
 * Bound direct string paste using the same UTF-8 byte limit as terminal bracketed paste.
 *
 * `TextEncoder.encodeInto` stops before a code point that cannot fit, so decoding the written bytes
 * cannot introduce a replacement character or split a supplementary-plane character. The helper
 * allocates only the configured bounded buffer instead of encoding an arbitrarily large input into
 * a second full-size byte array.
 *
 * @param text Untrusted plain text supplied by a host clipboard.
 * @param capBytes Maximum encoded UTF-8 bytes; defaults to {@link PASTE_CAP_BYTES}.
 * @returns The unchanged input when it fits, otherwise its longest complete bounded prefix.
 * @throws {RangeError} When `capBytes` is negative, non-integral, or not a safe integer.
 *
 * @example
 * import { boundPasteText } from '@jsvision/core';
 *
 * const bounded = boundPasteText('A😀B', 5);
 * // bounded === { text: 'A😀', truncated: true }
 */
export function boundPasteText(text: string, capBytes = PASTE_CAP_BYTES): BoundedPasteText {
  if (!Number.isSafeInteger(capBytes) || capBytes < 0) {
    throw new RangeError('paste byte cap must be a non-negative safe integer');
  }
  if (text.length === 0) return { text, truncated: false };

  const bytes = new Uint8Array(capBytes);
  const { read, written } = pasteTextEncoder.encodeInto(text, bytes);
  if (read === text.length) return { text, truncated: false };

  return {
    text: boundedPasteTextDecoder.decode(bytes.subarray(0, written)),
    truncated: true,
  };
}

/** The bracketed-paste start marker `ESC [ 200 ~`. */
export const PASTE_START = Uint8Array.from([0x1b, 0x5b, 0x32, 0x30, 0x30, 0x7e]);

/** The bracketed-paste end marker `ESC [ 201 ~`. */
export const PASTE_END = Uint8Array.from([0x1b, 0x5b, 0x32, 0x30, 0x31, 0x7e]);

/**
 * The outcome of matching a fixed marker at an offset: the index just past the
 * marker on a full match, `'incomplete'` when the buffer ends mid-marker (a
 * prefix matched — carry and retry), or `null` when the bytes are not the marker.
 */
export type MarkerMatch = number | 'incomplete' | null;

/** Reused decoder for paste content (UTF-8, lenient: invalid bytes → U+FFFD). */
const pasteTextDecoder = new TextDecoder();

/**
 * Try to match the fixed `marker` byte-for-byte at `buf[i]`.
 *
 * @param buf The working buffer.
 * @param i The offset to match at.
 * @param marker The fixed marker bytes.
 * @returns `i + marker.length` on a full match, `'incomplete'` when a prefix
 *   matched but the buffer ended, or `null` on a mismatch.
 */
export function matchMarker(buf: Uint8Array, i: number, marker: Uint8Array): MarkerMatch {
  for (let k = 0; k < marker.length; k += 1) {
    if (i + k >= buf.length) {
      return 'incomplete'; // the available prefix matched; need more bytes
    }
    if (buf[i + k] !== marker[k]) {
      return null;
    }
  }
  return i + marker.length;
}

/**
 * Decode accumulated paste content bytes to text (UTF-8, lenient).
 *
 * @param bytes The accumulated content bytes (already capped).
 * @returns The decoded paste text.
 */
export function decodePasteText(bytes: number[]): string {
  return pasteTextDecoder.decode(Uint8Array.from(bytes));
}
