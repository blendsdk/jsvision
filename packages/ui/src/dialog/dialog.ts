/**
 * `Dialog` — a Turbo Vision `TDialog` (RD-11 AC-8/AC-9/AC-10, PA-1/PA-6/PA-7; realizes DEF-16).
 *
 * TV decode (`source/tvision/tdialog.cpp`, GATE-1 + GATE-2):
 *   • **is-a `TWindow`** (`:25`) drawing the standard `TFrame` chrome in the gray-dialog palette;
 *     `flags = wfMove | wfClose` (movable + closable, **NOT** resizable/zoomable), `growMode = 0`,
 *     `wnNoNumber`, min `{16,6}`. Here: `Dialog extends Window`, `resizable=false`, `zoomable=false`,
 *     and `draw()` uses the `dialog` frame role (white lines/title + brightGreen icon, PA-19) with the
 *     close box present and no zoom box (the `frame.ts` gating, PF-001).
 *   • **`valid(command)`** (`:95`) — `cmCancel ⇒ True` (bypass), else `TGroup::valid` = `firstThat
 *     (isInvalid)` over all children (`tgroup.cpp:566`): closes only if no hosted control reports
 *     invalid, else refocuses the first invalid child (PA-7). This is the DEF-16 close-gate.
 *   • **Close triggers** (`:57-89`) — Esc ⇒ `cmCancel`, the frame `[×]` ⇒ `cmCancel`; on
 *     `cmOK/cmCancel/cmYes/cmNo` while modal ⇒ `endModal(command)`. Commands `cmOK=10…cmNo=13`.
 *
 * A modal `Dialog` is shown via `execView(dialog)` (resolves to the terminating command string, AR-108);
 * form data lives in the hosted controls' bound signals (AR-100). Shown modeless via `desktop.add` it
 * is an ordinary window (AC-10). It implements {@link ModalHostAware} so `execView` hands it the modal
 * host (PA-1). It is `postProcess` to catch the buttons' command events, and overrides `onEvent` so the
 * frame-close/Esc path resolves the modal to `cancel` (PF-002) rather than `Window.close()` — which
 * would remove the view without ending modality and hang the `execView` promise. `.js` per NodeNext.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { Window, drawFrame, frameZoneAt } from '../window/index.js';
import type { Rect } from '../layout/index.js';
import type { ModalHost, ModalHostAware } from '../event/index.js';
import { Commands } from '../status/index.js';

/** A view that exposes a zero-arg blocking `valid()` (the RD-06 `Input`), for the child sweep. */
interface Validatable {
  valid(): boolean;
}

/** The four standard terminating commands a {@link Dialog} resolves to. */
const TERMINATING = new Set<string>([Commands.ok, Commands.cancel, Commands.yes, Commands.no]);

/** Construction options for {@link Dialog}. */
export interface DialogOptions {
  /** Initial title (centered in the top border). */
  title?: string;
  /** Optional initial absolute placement rect (the host/desktop may override). An explicit rect is a
   * manual placement: it is honored verbatim and is NOT centered unless `centered` is set true. */
  rect?: Rect;
  /** Dialog width in cells (alternative to a full `rect` when you want the dialog auto-centered). */
  width?: number;
  /** Dialog height in cells (alternative to a full `rect` when you want the dialog auto-centered). */
  height?: number;
  /**
   * Center the dialog in its parent (the TV `ofCentered` option). Defaults to `true` when a size is
   * given via `width`/`height` (no explicit `rect` position), matching every standard TV system
   * dialog and modern convention; `false` for an explicit `rect`. Set explicitly to override either.
   */
  centered?: boolean;
}

/** A modal/modeless gray dialog: a `Window` in the `dialog` role with a `valid()` close-gate. */
export class Dialog extends Window implements ModalHostAware {
  /** Catch the buttons' command events in the post-sweep (PA-1). */
  override postProcess = true;

  /** @internal The modal host injected by `execView` (PA-1); `null` when modeless. */
  protected modalHost: ModalHost | null = null;
  /** @internal The first child that failed the last `valid()` sweep (for refocus). */
  protected firstInvalid: View | null = null;

  /**
   * @param opts `title` + optional initial `rect`.
   */
  constructor(opts: DialogOptions = {}) {
    super(opts.title);
    // TV `wfMove | wfClose`, growMode 0: movable + closable, not resizable/zoomable (PA-6).
    this.resizable = false;
    this.zoomable = false;
    // TV fidelity: `TDialog` is a `TWindow`, and `TWindow::TWindow` sets `state |= sfShadow`
    // unconditionally (twindow.cpp:49) — every dialog casts a drop-shadow. A modal dialog is added
    // to the tree by `execView` (event-loop.ts), bypassing `Desktop.addWindow` — the only other
    // place `castsShadow` is set — so opt in here so the compose walker paints the `shadowSize {2,1}`
    // L-shadow (render-root.ts `drawDropShadow`). Mirrors the menu/dropdown popups (controller.ts:175).
    this.castsShadow = true;
    // TV `ofCentered` (views.h:88): standard system dialogs (file/change-dir/help/color) all center
    // in their owner. Extend that to our default — a dialog given a size but no explicit `rect`
    // position centers (the reflow pass applies `origin = (parent - self)/2`, tgroup.cpp:395-397).
    // An explicit `rect` is a manual placement (honored, not centered); `centered` overrides either.
    const width = opts.width ?? opts.rect?.width;
    const height = opts.height ?? opts.rect?.height;
    this.centered = opts.centered ?? (width !== undefined && height !== undefined && opts.rect === undefined);
    if (width !== undefined && height !== undefined) {
      const x = opts.rect?.x ?? 0;
      const y = opts.rect?.y ?? 0;
      this.layout = { position: 'absolute', padding: 1, rect: { x, y, width, height } };
    }
  }

  /** @internal Receive the modal-host handle when opened via `execView` (PA-1). */
  attachModalHost(host: ModalHost): void {
    this.modalHost = host;
  }

  /** Paint the frame in the `dialog` role — close box, no zoom box (PA-6/PA-19). Modal ⇒ always active. */
  override draw(ctx: DrawContext): void {
    const active = this.manager !== null ? this.manager.activeWindow() === this : true;
    drawFrame(
      ctx,
      ctx.size,
      { title: this.title(), active, zoomed: false, resizable: false, closable: this.closable, zoomable: false },
      'dialog',
    );
  }

  /**
   * TV `TDialog::valid` — `cancel` bypasses (always closes); any other terminating command runs the
   * `TGroup::valid` child sweep (DEF-16): return `false` on the first hosted control whose `valid()`
   * is `false`, remembering it in {@link firstInvalid} for refocus.
   *
   * @param command The terminating command being validated.
   * @returns Whether the dialog may close for this command.
   */
  valid(command: string): boolean {
    if (command === Commands.cancel) return true; // cmCancel ⇒ True (bypass)
    this.firstInvalid = this.firstInvalidChild(this);
    return this.firstInvalid === null;
  }

  /** Depth-first: the first descendant control whose zero-arg `valid()` returns false, or `null`. */
  protected firstInvalidChild(view: View): View | null {
    if (view !== this && isValidatable(view) && !view.valid()) return view;
    if (view instanceof Group) {
      for (const child of view.children) {
        const invalid = this.firstInvalidChild(child);
        if (invalid !== null) return invalid;
      }
    }
    return null;
  }

  /**
   * Route events: catch the terminating command (post-sweep) → `valid()` gate → `endModal`; and (when
   * modal) route the frame close-zone + Esc to the `cancel` path (PF-002). Everything else delegates
   * to `Window` (raise/move for a modeless dialog).
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;

    if (inner.type === 'command' && TERMINATING.has(inner.command)) {
      this.handleTerminating(inner.command, ev);
      return;
    }

    if (this.modalHost !== null) {
      // Esc ⇒ cancel (PF-002; TV `tdialog.cpp:60`).
      if (inner.type === 'key' && inner.key === 'escape') {
        this.resolveCancel(ev);
        return;
      }
      // Frame close-box click ⇒ cancel — NOT `Window.close()` (that would hang the modal, PF-002).
      if (inner.type === 'mouse' && inner.kind === 'down' && ev.local !== undefined) {
        const size = { width: this.bounds.width, height: this.bounds.height };
        const flags = { movable: this.movable, resizable: false, zoomable: false, closable: this.closable };
        if (frameZoneAt(size, ev.local, flags) === 'close') {
          this.resolveCancel(ev);
          return;
        }
      }
    }

    super.onEvent(ev); // modeless: raise/move/close via the Window/WM path
  }

  /** Apply a terminating command: `cancel` bypasses; ok/yes/no run the `valid()` gate (PF-007 guard). */
  protected handleTerminating(command: string, ev: DispatchEvent): void {
    if (this.modalHost === null) return; // modeless: the app decides — no modal to end
    if (!this.modalHost.isCommandEnabled(command)) return; // a disabled command is ignored (PF-007)
    if (this.valid(command)) {
      this.modalHost.endModal(command);
      this.modalHost = null; // HR-37: the modal session ended — release the host (see resolveCancel)
    } else if (this.firstInvalid !== null) {
      ev.focusView?.(this.firstInvalid); // keep open + refocus the first invalid control (PA-7)
    }
    ev.handled = true;
  }

  /** Resolve the modal to `cancel` (bypasses `valid()`), for the frame close-box + Esc (PF-002). */
  protected resolveCancel(ev: DispatchEvent): void {
    if (this.modalHost === null) return;
    this.modalHost.endModal(Commands.cancel);
    // HR-37: clear the host so a dialog left MOUNTED after its modal ends stops swallowing global Esc
    // (and can no longer end an unrelated later modal with `cancel`); it reverts to a plain window.
    this.modalHost = null;
    ev.handled = true;
  }
}

/** Duck-type guard: does `view` expose a zero-arg `valid()` (the child-sweep predicate)? */
function isValidatable(view: View): view is View & Validatable {
  return typeof (view as Partial<Validatable>).valid === 'function';
}
