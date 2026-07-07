/**
 * Shared view-spine types (RD-03). The `View` state flags, the named-theme-role key type, the
 * stateless clipped paint facade (`DrawContext`, implemented in Phase 3), and the render-root
 * options (consumed by the Phase-5 render root). Internal class wiring lives with the classes
 * (`view.ts`) to avoid a type cycle (RT-1).
 */
import type { Style, Theme, CapabilityProfile, Logger, InputEvent } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import type { Point } from './geometry.js';
// Type-only (erased at runtime) — `DispatchEvent.focusView` targets a `View`. A type-only cycle with
// `view.ts` (which imports the contract types here) is safe; no runtime import edge is created.
import type { View } from './view.js';
// Type-only (erased) — `PopupHost.overlay` is a `Group`. Same safe type-only cycle as `View` above.
import type { Group } from './group.js';

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
  /**
   * Resolve a named theme role → the **raw** `Theme[K]` role, including its role-only extras (the
   * desktop `pattern` glyph, the window `border`/`title` colors) that {@link color} drops. Used by
   * the RD-05 chrome (`Desktop.draw`, `drawFrame`); the generic `K` keeps `role('window').border`
   * type-safe with no cast. (RD-05 PA-16)
   */
  role<K extends ThemeRoleName>(name: K): Theme[K];
  /** The view's content size, in cells. */
  readonly size: Size2D;
  /**
   * The resolved terminal capabilities for this frame (RD-18 PA-1). A widget selects its ASCII
   * glyph form from `caps.glyphs`/`caps.unicode` at draw time (the `ProgressBar` whole-cell `#`/`-`
   * form, the `Spinner` `line`-preset swap). Sourced from the render root's `caps` — the same
   * profile `serialize()` encodes with — so a widget's glyph choice and the serializer's fallback
   * agree. Additive; existing widgets that don't read it are unaffected.
   */
  readonly caps: CapabilityProfile;
  /**
   * Whether this frame is drawing with the accelerator overlay revealed (accelerator-overlay FR-1).
   * A scope-wide boolean threaded exactly like {@link caps} (a plain re-read field, no Signal): while
   * `true`, each `~X~` accelerator drawer adds `Attr.underline` to its hot-glyph accent so every
   * reachable hotkey lights up at once. The render root flips it via `setRevealAccelerators` (forcing
   * one coalesced recompose) and clamps it to the active dispatch scope in the compose walk, so a
   * background window outside a modal composes with it `false`. Default `false`; additive — drawers
   * that ignore it (and bare unit-constructed contexts) are unaffected.
   */
  readonly revealAccelerators: boolean;
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
  /**
   * Focus re-home seam (RD-13 HR-10/PA-10): the event loop wires this so a group removing its
   * focused child can re-home focus through the focus manager. Unset in a view-only render root.
   */
  healFocus?: (group: View) => void;
}

// --- RD-04 event-handler contract types ---------------------------------------------------------
// Declared here (alongside `View`) — NOT in `event/` — so `View.onEvent` can reference the dispatch
// envelope without a `view/`→`event/` import cycle (PA-8). The `event/` module imports these and
// re-exports them, so both `view/index.ts` and `event/index.ts` expose them through `@jsvision/ui`.

/** A typed command raised within the app, routed through the 3-phase machine (AR-52). */
export interface CommandEvent {
  /** Discriminant tag. */
  readonly type: 'command';
  /** Opaque command name compared by equality, e.g. `'ok'` | `'cancel'` | `'quit'`. */
  readonly command: string;
  /** Optional payload carried with the command. */
  readonly arg?: unknown;
}

/** Any event the loop dispatches: a decoded core input event or an internal command. */
export type AppEvent = InputEvent | CommandEvent;

/**
 * The envelope the loop wraps each event in before 3-phase routing; this — not the readonly core
 * `InputEvent` — is what `View.onEvent(ev)` receives, keeping core's event model pure (AR-60).
 */
export interface DispatchEvent {
  /** The wrapped decoded input event or internal command. */
  readonly event: AppEvent;
  /** Set `true` by a handler to halt propagation through the remaining phases/views (AR-51). */
  handled: boolean;
  /** Mouse/wheel coordinates translated to view-local cells (AR-50, AR-63); absent for keys/commands. */
  readonly local?: Point;
  /**
   * Raise a typed command onto the current dispatch tick (RD-06 PA-1). Present when a `RouteContext`
   * is active (always, during real dispatch); `undefined` only in bare unit-constructed envelopes, so
   * controls call it optional-chained (`ev.emit?.(…)`).
   */
  readonly emit?: (command: string, arg?: unknown) => void;
  /**
   * Focus another view (RD-06 PA-10) — used by `Label` to focus its link. Same source/availability
   * as {@link emit}; a non-focusable target is a no-op (the focus manager guards it).
   */
  readonly focusView?: (view: View) => void;
  /**
   * Capture the pointer to `view` (RD-11 PA-16) — used by `ScrollBar` for thumb-drag: while set, all
   * mouse/wheel events route to `view` until {@link releaseCapture}. Same source/availability as
   * {@link emit} (present during real dispatch, absent in bare unit-constructed envelopes).
   */
  readonly setCapture?: (view: View) => void;
  /** Release the pointer capture (RD-11 PA-16); a no-op if none is set. Pairs with {@link setCapture}. */
  readonly releaseCapture?: () => void;
  /**
   * Whether `view` currently holds the pointer capture (RD-13 HR-14/PA-13). A read-only query beside
   * {@link setCapture}/{@link releaseCapture}: a view mid-gesture (Desktop drag, StatusLine press)
   * checks this before applying a move, so a capture lost externally (a modal opened/closed mid-drag)
   * cleanly aborts the gesture instead of teleporting to the cursor. Same source/availability as
   * {@link emit} (present during real dispatch, absent in bare unit-constructed envelopes).
   */
  readonly hasCapture?: (view: View) => boolean;
  /**
   * Write UTF-8 `text` to the system clipboard (RD-07 PA-5/PA-7) — used by `Input` copy/cut. Same
   * source/availability as {@link emit} (present during real dispatch, absent in bare unit-constructed
   * envelopes, so controls call it optional-chained). The loop's `routeContext` sources it to the
   * co-owned output stream via core `setClipboard(text, caps)` (OSC-52, base64 + sanitize); a
   * caps-gated no-op when the terminal lacks `osc.clipboard52`. The control never touches I/O — this
   * mirrors the {@link emit}/{@link setCapture} envelope seams.
   */
  readonly setClipboard?: (text: string) => void;
  /**
   * The currently-focused view (RD-14 PF-002). Present during real dispatch (sourced in the loop's
   * `routeContext`), `undefined` in bare unit-constructed envelopes — a dropdown control saves it
   * before opening its popup and restores it on dismiss. Same source/availability as {@link emit}.
   */
  readonly getFocused?: () => View | null;
  /**
   * The overlay host a dropdown control mounts its anchored popup into (RD-14 PF-002/PA-9). Present
   * during real dispatch when an app shell (or a bare `Dialog`) has wired one onto the loop;
   * `undefined` otherwise (headless / no shell), so controls call it optional-chained. Same
   * source/availability as {@link emit}.
   */
  readonly popupHost?: PopupHost;
}

/**
 * The overlay host + focus seam an anchored popup needs to mount + focus its list (RD-14 PF-002/PA-9).
 * Supplied by the app shell (the default) or a bare RD-11 `Dialog`, and reached by an app-created
 * leaf control through the {@link DispatchEvent} envelope (`ev.popupHost`). Mirrors the subset of the
 * loop seam a popup uses: the overlay to mount into, plus focus save/restore.
 */
export interface PopupHost {
  /** The full-viewport overlay `Group` to mount the popup + its outside-click catcher into (top-z). */
  readonly overlay: Group;
  /** Focus a view — the popup gives its list focus on open; a non-focusable target is a no-op. */
  focusView(view: View): void;
  /** The currently-focused view (saved before the popup opens, restored on dismiss), or `null`. */
  getFocused(): View | null;
}
