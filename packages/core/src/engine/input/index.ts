/**
 * Public entry point of the input subsystem.
 *
 * Exposes the pure byte-to-event decoder ({@link decode}/{@link flush}/
 * {@link createDecoderState}), the pluggable {@link createKeymap}, and the
 * event/result/option types. The decoder is pure and host-agnostic — it never
 * touches `stdin` or timers, so you wire it to your own byte source (the SDK's
 * host does this for you).
 */
export { createDecoderState, decode, flush } from './decoder.js';
export { createKeymap } from './keymap.js';
export type { Keymap } from './keymap.js';
export type {
  KeyEvent,
  MouseEvent,
  WheelEvent,
  PasteEvent,
  FocusEvent,
  InputEvent,
  QueryResponse,
  DecodeResult,
  DecoderState,
  PasteState,
  DecodeOptions,
} from './events.js';
export { ESC_TIMEOUT_MS, PASTE_CAP_BYTES, KEY_NAMES } from './events.js';
