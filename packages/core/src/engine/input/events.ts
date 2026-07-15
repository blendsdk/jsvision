/**
 * The typed input-event model the decoder emits, plus the decoder state and
 * per-decode options.
 *
 * Every event type is `readonly` plain data (no behaviour). Capability-query
 * replies are deliberately NOT part of the {@link InputEvent} union: they are
 * returned on a separate `queries` channel so a terminal reply cannot leak into
 * your app as a keystroke.
 */
import type { CapabilityProfile } from '../capability/profile.js';

/** A printable character or named key press. */
export interface KeyEvent {
  readonly type: 'key';
  /** Printable → the character; named key → a lowercase name (see {@link KEY_NAMES}). */
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** Unicode code point when `key` is a printable character; omitted for named keys. */
  readonly codepoint?: number;
}

/**
 * A mouse button/motion report. Coordinates are 1-based, exactly as the terminal
 * sends them.
 *
 * The `ctrl`/`alt`/`shift` flags report the modifiers held during the report, decoded
 * from the SGR button byte — they let a click handler distinguish, e.g., a plain click
 * from a Ctrl+click. They are **optional** and populated only on decoded events; a
 * hand-built `MouseEvent` literal that omits them reads as an unmodified press
 * (`undefined` → falsy). Modifier reporting is best-effort per terminal — some
 * terminals intercept combinations such as Ctrl+click for their own use.
 */
export interface MouseEvent {
  readonly type: 'mouse';
  readonly kind: 'down' | 'up' | 'move' | 'drag';
  readonly button: number;
  readonly x: number;
  readonly y: number;
  /** Ctrl held during the report (from the SGR button byte). */
  readonly ctrl?: boolean;
  /** Meta/Alt held during the report. */
  readonly alt?: boolean;
  /** Shift held during the report. */
  readonly shift?: boolean;
}

/**
 * A wheel/scroll report. A wheel report is never delivered as a {@link MouseEvent}.
 *
 * The `shift`/`alt`/`ctrl` flags report the modifiers held during the scroll. They
 * let you distinguish, e.g., a plain vertical wheel from a Shift+wheel (a common
 * horizontal-scroll fallback on terminals that do not send dedicated left/right
 * wheel reports).
 */
export interface WheelEvent {
  readonly type: 'wheel';
  readonly dir: 'up' | 'down' | 'left' | 'right';
  readonly x: number;
  readonly y: number;
  /** Shift held during the wheel report. */
  readonly shift: boolean;
  /** Meta/Alt held during the wheel report. */
  readonly alt: boolean;
  /** Ctrl held during the wheel report. */
  readonly ctrl: boolean;
}

/** A completed bracketed paste. `truncated` is true when the paste size cap clipped the text. */
export interface PasteEvent {
  readonly type: 'paste';
  readonly text: string;
  readonly truncated: boolean;
}

/** A terminal focus-gained / focus-lost report (emitted only when the host enables focus reporting). */
export interface FocusEvent {
  readonly type: 'focus';
  readonly focused: boolean;
}

/** Any app-facing decoded event. Capability-query replies are NOT part of this union. */
export type InputEvent = KeyEvent | MouseEvent | WheelEvent | PasteEvent | FocusEvent;

/**
 * A recognised terminal query reply (device attributes, version, mode report),
 * used by capability detection.
 *
 * Never part of {@link InputEvent}; returned in {@link DecodeResult.queries} so a
 * reply cannot be delivered as a keystroke. `'unknown'` is reserved for reply
 * shapes the decoder routes here without classifying.
 */
export interface QueryResponse {
  /** The raw recognised bytes, for the capability layer to parse further. */
  readonly raw: Uint8Array;
  /** The reply classification. */
  readonly kind: 'da1' | 'da2' | 'xtversion' | 'decrpm' | 'unknown';
}

/**
 * The result of one {@link decode}/{@link flush} call.
 *
 * Thread decoding forward with `state = result.state`: it carries both the
 * incomplete trailing bytes and any in-progress bracketed paste, so a sequence or
 * paste split across chunks survives. `rest` is a convenience equal to
 * `state.carry` (the incomplete trailing bytes).
 */
export interface DecodeResult {
  readonly events: InputEvent[];
  readonly queries: QueryResponse[];
  /** Incomplete trailing bytes carried to the next decode() call (=== `state.carry`). */
  readonly rest: Uint8Array;
  /** The next decoder state to pass to the following decode() call. */
  readonly state: DecoderState;
}

/** Internal bracketed-paste accumulation state. */
export interface PasteState {
  readonly active: boolean;
  readonly bytes: number[];
  readonly truncated: boolean;
}

/**
 * The opaque carry threaded between {@link decode} calls. Create the first one
 * with `createDecoderState()`, then feed each call's `result.state` into the next.
 */
export interface DecoderState {
  /** Incomplete trailing bytes from the previous call (bounded, so a runaway sequence cannot grow it). */
  readonly carry: Uint8Array;
  /** In-progress bracketed-paste accumulation. */
  readonly paste: PasteState;
  /**
   * True while discarding the tail of an oversized, unterminated sequence: after
   * the carry bound trips, subsequent bytes are dropped (no events) until the next
   * `ESC` resynchronises the stream.
   */
  readonly resync: boolean;
}

/**
 * Per-decode configuration. All fields optional; `options` is read-only and never
 * mutated.
 */
export interface DecodeOptions {
  /** Resolved terminal capabilities; informs which keyboard grammar to use and focus handling. */
  readonly caps?: CapabilityProfile;
  /** Override the bracketed-paste size cap in bytes (default {@link PASTE_CAP_BYTES}). */
  readonly pasteCap?: number;
}

/** Lone-`ESC` disambiguation window, in milliseconds — the recommended delay before calling `flush()`. */
export const ESC_TIMEOUT_MS = 50;

/** Default bracketed-paste size cap in bytes. Override per call via {@link DecodeOptions.pasteCap}. */
export const PASTE_CAP_BYTES = 1_048_576; // 1 MiB

/**
 * The named (non-printable) keys the decoder can emit, all lowercase. A printable
 * key instead sets `key` to the decoded character plus its `codepoint`.
 */
export const KEY_NAMES = [
  'up',
  'down',
  'left',
  'right',
  'enter',
  'tab',
  'backspace',
  'escape',
  'space',
  'home',
  'end',
  'pageup',
  'pagedown',
  'insert',
  'delete',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
] as const;
