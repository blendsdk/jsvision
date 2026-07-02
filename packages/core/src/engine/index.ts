/**
 * `@jsvision/core` — public entry point of the SDK foundation.
 *
 * Re-exports the public API of each landed subsystem so consumers import
 * everything from `@jsvision/core`. Currently: the package {@link VERSION}
 * (RD-01), the capability detection core (RD-02), the input decoder
 * (RD-06), the rendering engine (RD-04), the host & lifecycle subsystem
 * (RD-07), the safety subsystem (RD-08), and the color & styling subsystem
 * (RD-05).
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
  PasteState,
  DecodeOptions,
  Keymap,
} from './input/index.js';
export { ESC_TIMEOUT_MS, PASTE_CAP_BYTES, KEY_NAMES } from './input/index.js';

// RD-04 — rendering engine.
export {
  ScreenBuffer,
  Attr,
  charWidth,
  serialize,
  defaultEncodeStyle,
  fallbackGlyph,
  hyperlink,
  setClipboard,
  setTitle,
  bell,
  notify,
  cursor,
  CSI,
  SGR_RESET,
  SYNC_BEGIN,
  SYNC_END,
  cursorTo,
} from './render/index.js';
export type {
  Cell,
  Style,
  Color,
  Ansi16Name,
  AttrMask,
  WidthMode,
  StyleEncoder,
  RenderOptions,
} from './render/index.js';

// RD-07 — host & lifecycle. (RD-03 adds the real tty-backed TerminalQuery;
// the RD-11 follow-up adds the ambiguous-width startup probe & warning.)
export {
  createHost,
  detectTty,
  createTerminalQuery,
  probeAmbiguousWidth,
  warnIfAmbiguousWide,
  parseCursorPosition,
  degradeCapsForWidth,
  degradeCapsFully,
  isAsciiSafe,
  AMBIGUOUS_PROBE_GLYPHS,
  BOX_PROBE_GLYPHS,
  WIDTH_WARNING_MESSAGE,
  WIDTH_ADAPTED_MESSAGE,
  DEFAULT_WIDTH_PROBE_TIMEOUT_MS,
} from './host/index.js';
export type {
  Host,
  HostOptions,
  ResizeEvent,
  RuntimeAdapter,
  HostSignal,
  TimerHandle,
  StreamOptions,
  TerminalQueryOptions,
  ManagedTerminalQuery,
  WidthProbeResult,
  WidthProbeGroupResult,
  WidthProbeOptions,
  WidthWarnOptions,
  CursorPosition,
} from './host/index.js';

// RD-08 — safety (essentials gate, errors, logging, redaction, sanitizer).
export {
  sanitize,
  evaluateEssentials,
  essentialsMet,
  assertEssentials,
  TuiError,
  EssentialsNotMetError,
  LoggerConfigError,
  createLogger,
  redactEvent,
  dumpCaps,
} from './safety/index.js';
export type {
  EssentialsReport,
  Degradation,
  HostFacts,
  Logger,
  LoggerOptions,
  LogLevel,
  LogRecord,
  LogSink,
  LoggerFs,
  RedactedEvent,
} from './safety/index.js';

// RD-05 — color & styling (depth-aware encoding, nearest-color, palette, theme).
export {
  encode,
  encodeStyle,
  styleKey,
  nearest256,
  nearest16,
  InvalidColorError,
  PALETTE,
  defaultTheme,
} from './color/index.js';
export type { ColorRole, Rgb, Theme, ThemeRole } from './color/index.js';
