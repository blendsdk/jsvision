/**
 * Shared view-spine types (RD-03). The `View` state flags, the named-theme-role key type, the
 * stateless clipped paint facade (`DrawContext`, implemented in Phase 3), and the render-root
 * options (consumed by the Phase-5 render root). Internal class wiring lives with the classes
 * (`view.ts`) to avoid a type cycle (RT-1).
 */
import type { Style, Theme, CapabilityProfile, Logger } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';

/**
 * View state flags drawn-against in RD-03. `focused`/`disabled` are driven by RD-04 (the event
 * loop); RD-03 only reads them to pick a theme role (e.g. `buttonFocused`). `visible:false` is
 * `display:none` — the view is skipped in draw and omitted from the layout tree (AR-41).
 */
export interface ViewState {
  visible: boolean;
  disabled: boolean;
  focused: boolean;
}

/**
 * A resolvable named theme role — the keys of core's `Theme` (RD-03-owned; core exports no such
 * type, AR-45). e.g. `'window'`, `'button'`, `'buttonFocused'`.
 */
export type ThemeRoleName = keyof Theme;

/**
 * The stateless, view-local, auto-clipped paint API handed to `View.draw(ctx)` (AR-39).
 * Coordinates are view-local (origin = the view's top-left); the implementation offsets to the
 * view's absolute position and clips to the view's rect ∩ ancestor rects, silently dropping
 * out-of-clip writes. Implemented in Phase 3 (`draw-context.ts`).
 */
export interface DrawContext {
  text(x: number, y: number, str: string, style?: Style): void;
  fillRect(x: number, y: number, w: number, h: number, char: string, style?: Style): void;
  /** Fill the whole view rect. */
  fill(char: string, style?: Style): void;
  box(x: number, y: number, w: number, h: number, style?: Style, title?: string): void;
  shadow(x: number, y: number, w: number, h: number, style?: Style): void;
  /** Resolve a named theme role → `Style` (AR-35). */
  color(role: ThemeRoleName): Style;
  /** The view's content size, in cells. */
  readonly size: Size2D;
}

/**
 * Options for the render root (consumed in Phase 5). `caps` is required by core's `serialize()`
 * for depth-aware encoding (AR-44); the scheduler and logger are injectable for deterministic
 * frames (AR-32) and draw-error-log assertions (AR-42).
 */
export interface RenderRootOptions {
  /** REQUIRED — depth-aware encoding for `serialize()` (AR-44, PF-002). */
  caps: CapabilityProfile;
  /** Active theme; defaults to core's `defaultTheme` (AR-35). */
  theme?: Theme;
  /** Flush scheduler; defaults to `queueMicrotask` (AR-32). */
  schedule?: (flush: () => void) => void;
  /** Draw-error logger; defaults to a disabled `createLogger()` (AR-42). */
  logger?: Logger;
}
