/**
 * Shared view types: the `View` state flags, the named-theme-role key type, the clipped paint
 * facade (`DrawContext`), and the render-root options. Internal class wiring lives with the classes
 * in `view.ts` to avoid a type cycle.
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
 * A view's state flags. `focused`/`disabled` are driven by the event loop; a widget's `draw()` reads
 * them to pick the right theme role (e.g. `buttonFocused`). `visible: false` means the view is
 * skipped when drawing and omitted from layout entirely (like CSS `display: none`).
 */
export interface ViewState {
  visible: boolean;
  disabled: boolean;
  focused: boolean;
}

/**
 * A theme-role name — any key of the active `Theme`, e.g. `'window'`, `'button'`, `'buttonFocused'`.
 * Pass one to `DrawContext.color(role)` to get its foreground/background style.
 */
export type ThemeRoleName = keyof Theme;

/**
 * The stateless, view-local, auto-clipped paint API handed to `View.draw(ctx)`. Coordinates are
 * view-local: `(0, 0)` is this view's top-left. The context offsets to the view's absolute screen
 * position and clips to the view's rect intersected with its ancestors', silently dropping any write
 * that falls outside — so a widget can draw freely without worrying about overflow.
 */
export interface DrawContext {
  text(x: number, y: number, str: string, style?: Style): void;
  fillRect(x: number, y: number, w: number, h: number, char: string, style?: Style): void;
  /** Fill the whole view rect. */
  fill(char: string, style?: Style): void;
  box(x: number, y: number, w: number, h: number, style?: Style, title?: string): void;
  shadow(x: number, y: number, w: number, h: number, style?: Style): void;
  /** Resolve a named theme role to a `Style` (foreground/background). */
  color(role: ThemeRoleName): Style;
  /**
   * Resolve a named theme role to its **full** role object, including extras that {@link color} drops
   * (a desktop background `pattern` glyph, a window's `border`/`title` colors). Chrome widgets use
   * this; the generic `K` keeps `role('window').border` type-safe with no cast.
   */
  role<K extends ThemeRoleName>(name: K): Theme[K];
  /** The view's content size, in cells. */
  readonly size: Size2D;
  /**
   * The resolved terminal capabilities for this frame. Read `caps.glyphs`/`caps.unicode` at draw time
   * to pick an ASCII vs. Unicode glyph form (e.g. a progress bar's `#`/`-` fallback on a terminal
   * that can't render block characters). This is the same capability profile the renderer encodes
   * with, so your glyph choice and the renderer's fallback always agree.
   */
  readonly caps: CapabilityProfile;
  /**
   * Whether the accelerator (hotkey) overlay is revealed this frame. While `true`, a widget that
   * draws a `~X~` hotkey should underline the hot glyph so every reachable shortcut lights up at
   * once. The render root toggles it via `setRevealAccelerators` and clamps it to the active dispatch
   * scope, so a background window behind a modal draws it as `false`. Default `false`; widgets that
   * ignore it are unaffected.
   */
  readonly revealAccelerators: boolean;
}

/**
 * Options for {@link createRenderRoot}. `caps` is required (it drives depth-aware color encoding);
 * the scheduler and logger are injectable, mainly so tests can drive frames deterministically.
 */
export interface RenderRootOptions {
  /** REQUIRED — the terminal capability profile used to encode each frame's output. */
  caps: CapabilityProfile;
  /** Active theme; defaults to the built-in default theme. */
  theme?: Theme;
  /** How a pending repaint is scheduled; defaults to `queueMicrotask` (one coalesced frame per tick). */
  schedule?: (flush: () => void) => void;
  /** Where a widget's `draw()` errors are logged; defaults to a disabled logger (silent). */
  logger?: Logger;
  /**
   * Hook to re-home focus after a group removes its currently-focused child. The event loop wires
   * this so focus lands on a sensible sibling; a standalone (non-interactive) render root leaves it
   * unset.
   */
  healFocus?: (group: View) => void;
}

// --- Event-handler contract types ---------------------------------------------------------------
// Declared here (alongside `View`) rather than in the event module, so `View.onEvent` can reference
// the dispatch envelope without an import cycle. The event module imports these and re-exports them,
// so both view/ and event/ expose them through `@jsvision/ui`.

/** A typed command raised within the app (e.g. from a button or menu) and routed to handlers. */
export interface CommandEvent {
  /** Discriminant tag. */
  readonly type: 'command';
  /** The command name, compared by equality, e.g. `'ok'` | `'cancel'` | `'quit'`. */
  readonly command: string;
  /** Optional payload carried with the command. */
  readonly arg?: unknown;
}

/** Any event the loop dispatches: a decoded terminal input event or an internal command. */
export type AppEvent = InputEvent | CommandEvent;

/**
 * The envelope wrapped around each event before it is routed to views. This — not the raw read-only
 * input event — is what `View.onEvent(ev)` receives. A handler reads the event and sets `handled` to
 * consume it, and uses the optional seams below (`emit`, `focusView`, capture, clipboard, …) to act
 * on the app. Those seams are present during real dispatch and `undefined` in a bare envelope you
 * might construct in a test, so always call them optional-chained (`ev.emit?.(…)`).
 */
export interface DispatchEvent {
  /** The wrapped decoded input event or internal command. */
  readonly event: AppEvent;
  /** Set `true` by a handler to stop the event propagating to the remaining phases/views. */
  handled: boolean;
  /** Mouse/wheel coordinates translated to this view's local cells; absent for keys and commands. */
  readonly local?: Point;
  /**
   * For a mouse-down, how many consecutive clicks landed on the same cell (1 = single, 2 = double,
   * 3 = triple…). Present only on a mouse-down during real dispatch; `undefined` otherwise. A row
   * widget that activates on double-click checks `ev.clickCount === 2`.
   */
  readonly clickCount?: number;
  /**
   * Raise a typed command onto the current dispatch tick — how a widget signals an action (e.g. a
   * button emitting `'ok'`) for a menu/status/app handler to pick up.
   */
  readonly emit?: (command: string, arg?: unknown) => void;
  /**
   * Move focus to another view — used e.g. by a `Label` to focus the control it labels. A
   * non-focusable target is a no-op.
   */
  readonly focusView?: (view: View) => void;
  /**
   * Capture the pointer to `view`: while captured, all mouse/wheel events route to `view` until
   * {@link releaseCapture}. Used for drag gestures such as dragging a scrollbar thumb.
   */
  readonly setCapture?: (view: View) => void;
  /** Release the pointer capture; a no-op if none is set. Pairs with {@link setCapture}. */
  readonly releaseCapture?: () => void;
  /**
   * Whether `view` currently holds the pointer capture. A view mid-gesture (a window drag, a status
   * press) checks this before applying a move, so if the capture was lost externally (a modal opened
   * or closed mid-drag) the gesture aborts cleanly instead of jumping to the cursor.
   */
  readonly hasCapture?: (view: View) => boolean;
  /**
   * Write `text` to the system clipboard — used by `Input` copy/cut. A no-op when the terminal has no
   * clipboard support; the control never touches I/O directly.
   */
  readonly setClipboard?: (text: string) => void;
  /**
   * The currently-focused view. A dropdown control saves it before opening its popup and restores it
   * on dismiss.
   */
  readonly getFocused?: () => View | null;
  /**
   * The overlay host a dropdown control mounts its anchored popup into. Present when an app shell (or
   * a `Dialog`) has provided one; `undefined` in a headless/no-shell setup.
   */
  readonly popupHost?: PopupHost;
}

/**
 * The overlay + focus host an anchored popup needs to mount and focus itself. Supplied by the app
 * shell (or a bare `Dialog`) and reached by a leaf control through `ev.popupHost`. It exposes the
 * overlay to mount into plus focus save/restore.
 */
export interface PopupHost {
  /** The full-viewport, top-most overlay `Group` to mount the popup (and its outside-click catcher) into. */
  readonly overlay: Group;
  /** Focus a view — the popup focuses its list on open; a non-focusable target is a no-op. */
  focusView(view: View): void;
  /** The currently-focused view (saved before the popup opens, restored on dismiss), or `null`. */
  getFocused(): View | null;
}
