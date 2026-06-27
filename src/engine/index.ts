/**
 * `@blendsdk/tui` — public entry point of the SDK foundation.
 *
 * Re-exports the public API of each landed subsystem so consumers import
 * everything from `@blendsdk/tui`. Currently: the package {@link VERSION}
 * (RD-01), the capability detection core (RD-02), and the input decoder
 * (RD-06). Renderer and host subsystems are added by later RDs.
 *
 * The `.js` extension in the import specifiers is required by NodeNext ESM
 * resolution (it resolves to the `.ts` source during development via tsx).
 */
export { VERSION } from './version.js';

// RD-02 — capability detection core.
export { resolveCapabilities, resolveCapabilitiesAsync } from './capability/index.js';
export type {
  CapabilityProfile,
  CapabilityReasons,
  CapabilityResolution,
  ColorDepth,
  DeepPartial,
  GlyphCaps,
  KeyboardCaps,
  MouseCaps,
  OscCaps,
  Platform,
  ReasonLayer,
  ResolveOptions,
  SyncResolveOptions,
  TerminalQuery,
  UnicodeCaps,
} from './capability/index.js';

// RD-06 — input decoder.
export { createDecoderState, decode, flush, createKeymap } from './input/index.js';
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
  DecodeOptions,
  Keymap,
} from './input/index.js';
export { ESC_TIMEOUT_MS, PASTE_CAP_BYTES } from './input/index.js';
