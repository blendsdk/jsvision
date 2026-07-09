/**
 * `@jsvision/core` — public entry point of the SDK foundation.
 *
 * Re-exports the public API of each subsystem so consumers import everything from
 * `@jsvision/core`: the package {@link VERSION}, terminal capability detection, the input
 * decoder, the rendering engine, the host & lifecycle subsystem, the safety subsystem, and the
 * color & styling subsystem.
 *
 * The `.js` extension in the import specifiers is required by NodeNext ESM resolution (it
 * resolves to the `.ts` source during development).
 */
export { VERSION } from './version.js';

// Capability detection — resolve the terminal's features (color depth, unicode, mouse, keyboard, OSC).
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

// Input decoder — turn raw terminal bytes into typed key/mouse/paste/focus events, plus a chord keymap.
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

// Rendering engine — width-correct ScreenBuffer, damage-diff serialize, glyph fallback, OSC, and cursor.
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

// Host & lifecycle — the native tty host (raw mode, alt-screen, signals, guaranteed restore on every
// exit), the real terminal query, and the ambiguous-width startup probe & warning.
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

// Safety — essentials gate, typed errors, screen-safe logging, redaction, and the sanitizer.
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

// Color & styling — depth-aware SGR encoding, nearest-color downsampling, the palette, and the theme.
export {
  encode,
  encodeStyle,
  styleKey,
  nearest256,
  nearest16,
  InvalidColorError,
  toRgb,
  PALETTE,
  ANSI16_ORDER,
  rgb256,
  defaultTheme,
  ramp,
  lighten,
  darken,
  mix,
  contrastRatio,
  createTheme,
  aliasesFromSeeds,
  rolesFromAliases,
  serializeTheme,
  parseTheme,
  InvalidThemeError,
  turboVisionTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
  PRESET_SEEDS,
} from './color/index.js';
export type { ColorRole, Rgb, Theme, ThemeRole, ThemeColors, ThemeOptions } from './color/index.js';
