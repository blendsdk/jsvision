/**
 * A modal or modeless dialog window — a movable, closable {@link Window} painted in the gray `dialog`
 * frame role (title + close box, but no zoom box and not resizable). Host form controls in it
 * (`Input`, `CheckGroup`, buttons, …); their bound signals hold the form data.
 *
 * Show it **modally** with the event loop's `execView(dialog)`, which returns a promise that resolves
 * to the terminating command string (`'ok'` / `'cancel'` / `'yes'` / `'no'`) once the dialog closes.
 * Add it to a desktop instead (`desktop.add(dialog)`) to show it **modeless**, as an ordinary window.
 *
 * Closing is gated by `valid()`: `cancel` (Esc, the frame close-box, or a Cancel button) always
 * closes, while `ok` / `yes` / `no` close only if every hosted control's own `valid()` passes —
 * otherwise the dialog stays open and focus jumps to the first invalid control.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { center, at } from '../view/dsl/index.js';
import { Window, drawFrame, frameZoneAt } from '../window/index.js';
import type { Rect } from '../layout/index.js';
import type { ModalHost, ModalHostAware } from '../event/index.js';
import { Commands } from '../status/index.js';
import { reportDuplicateAccelerators } from '../menu/accelerators.js';

/** A view that exposes a zero-arg blocking `valid()` (such as an `Input`), for the child sweep. */
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
   * Center the dialog in its parent. Defaults to `true` when a size is given via `width`/`height`
   * (with no explicit `rect` position) — the modern convention; `false` for an explicit `rect`. Set
   * explicitly to override either.
   */
  centered?: boolean;
}

/**
 * A modal/modeless gray dialog: a `Window` in the `dialog` role with a `valid()` close-gate.
 *
 * @example
 * import { Dialog, Input, Label, okButton, cancelButton, createEventLoop, signal, range, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const age = signal('42');
 * // A width/height with no explicit rect auto-centers the dialog and casts a drop-shadow.
 * const dialog = new Dialog({ title: ' Person ', width: 34, height: 9 });
 * const input = new Input({ value: age, validator: range(0, 120) });
 * const label = new Label('~A~ge (0–120)', input);
 * at(label, 1, 1, 14, 1);
 * at(input, 16, 1, 14, 1);
 * const ok = at(okButton(), 6, 4, 10, 2);
 * dialog.add(label);
 * dialog.add(input);
 * dialog.add(ok);
 * dialog.add(cancelButton());
 *
 * const loop = createEventLoop({ width: 40, height: 12 }, { caps });
 * loop.mount(dialog);
 * // Resolves to 'ok' only once Age validates; an out-of-range Age keeps the dialog open.
 * const command = await loop.execView<string>(dialog);
 */
export class Dialog extends Window implements ModalHostAware {
  /** Caught after the focused chain so the hosted buttons' command events are seen dialog-wide. */
  override postProcess = true;
  /** Roots the dialog's accelerator scope — its mount-time duplicate check stops at nested scopes. */
  override acceleratorScope = true;

  /** @internal The modal host injected by `execView`; `null` when modeless. */
  protected modalHost: ModalHost | null = null;
  /** @internal The first child that failed the last `valid()` sweep (for refocus). */
  protected firstInvalid: View | null = null;

  /**
   * @param opts `title`, plus either an explicit `rect` or a `width`/`height` (which auto-centers).
   */
  constructor(opts: DialogOptions = {}) {
    super(opts.title);
    // Movable + closable, but not resizable or zoomable.
    this.resizable = false;
    this.zoomable = false;
    // Every dialog casts a drop-shadow. A modal dialog is added to the tree by `execView` (which
    // bypasses the desktop's window-registration path, the only other place a shadow is enabled), so
    // opt in here to guarantee the compose walker paints it.
    this.castsShadow = true;
    // A dialog given a size but no explicit `rect` position centers in its parent (the reflow pass
    // applies `origin = (parent - self) / 2`). An explicit `rect` is a manual placement (honored, not
    // centered); an explicit `centered` overrides either default.
    const width = opts.width ?? opts.rect?.width;
    const height = opts.height ?? opts.rect?.height;
    const centered = opts.centered ?? (width !== undefined && height !== undefined && opts.rect === undefined);
    if (width !== undefined && height !== undefined) {
      // Pin the dialog's own 1-cell padding. It is already inherited from `Window`; restating it
      // here keeps the dialog correct if that ever changes. The placement builders below merge over
      // it and set `position` themselves: `center()` for a sized-but-unplaced dialog, `at()` for an
      // explicit rect.
      this.setLayout({ padding: 1 });
      if (opts.rect === undefined) {
        center(this, width, height);
      } else {
        at(this, { x: opts.rect.x, y: opts.rect.y, width, height });
      }
    }
    // `center()` force-sets `centered = true` as a side effect; the opt-out (`centered:false`) and
    // explicit-rect cases need our computed flag to win, so assign it after the builders run.
    this.centered = centered;
    // Dev-only: on mount, flag two controls in this dialog's focus scope that claim the same
    // `Alt`+hotkey. The walk sees statically-added children present at mount; a reactively-inserted
    // (addDynamic/Show/For) control is not re-checked — acceptable, dialog chrome is composed statically.
    this.onMount(() => {
      const chars: string[] = [];
      this.collectAccelerators(this, chars);
      reportDuplicateAccelerators('dialog', chars);
    });
  }

  /**
   * Depth-first collect of the accelerator chars claimed within this dialog's focus scope. Descends
   * the tree from `view`, gathering each view's `accelerators()`, but stops at a nested accelerator
   * scope boundary (another `Dialog` or a `TabView`) — that scope runs its own check.
   */
  private collectAccelerators(view: View, out: string[]): void {
    if (view !== this && view.acceleratorScope) return; // nested scope owns its own check
    for (const char of view.accelerators()) out.push(char);
    if (view instanceof Group) {
      for (const child of view.children) this.collectAccelerators(child, out);
    }
  }

  /** @internal Receive the modal-host handle when opened via `execView`. */
  attachModalHost(host: ModalHost): void {
    this.modalHost = host;
  }

  /** Paint the frame in the `dialog` role — close box, no zoom box. A modal dialog always draws active. */
  override draw(ctx: DrawContext): void {
    const active = this.manager !== null ? this.manager.activeWindow() === this : true;
    drawFrame(
      ctx,
      ctx.size,
      {
        title: this.title(),
        active,
        zoomed: false,
        resizable: this.resizable,
        closable: this.closable,
        zoomable: false,
      },
      'dialog',
    );
  }

  /**
   * The close-gate: `cancel` always closes; any other terminating command runs a depth-first sweep of
   * the hosted controls, returning `false` on the first one whose own `valid()` is `false` and
   * remembering it in {@link firstInvalid} so it can be refocused.
   *
   * @param command The terminating command being validated.
   * @returns Whether the dialog may close for this command.
   */
  valid(command: string): boolean {
    if (command === Commands.cancel) return true; // cancel bypasses the sweep — it always closes
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
   * Route events: catch a terminating command → `valid()` gate → close; and (when modal) route the
   * frame close-box + Esc to the `cancel` path. Everything else delegates to `Window` (raise/move for
   * a modeless dialog).
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
      // Esc closes a modal dialog as `cancel`.
      if (inner.type === 'key' && inner.key === 'escape') {
        this.resolveCancel(ev);
        return;
      }
      // A frame close-box click resolves the modal to `cancel` — NOT `Window.close()`, which would
      // remove the view without ending modality and leave the `execView` promise hanging forever.
      if (inner.type === 'mouse' && inner.kind === 'down' && ev.local !== undefined) {
        const size = { width: this.bounds.width, height: this.bounds.height };
        const flags = { movable: this.movable, resizable: this.resizable, zoomable: false, closable: this.closable };
        if (frameZoneAt(size, ev.local, flags) === 'close') {
          this.resolveCancel(ev);
          return;
        }
      }
    }

    super.onEvent(ev); // modeless: raise/move/close via the Window/WM path
  }

  /** Apply a terminating command: `cancel` bypasses; `ok`/`yes`/`no` run the `valid()` gate first. */
  protected handleTerminating(command: string, ev: DispatchEvent): void {
    if (this.modalHost === null) return; // modeless: there is no modal to end — the app decides
    if (!this.modalHost.isCommandEnabled(command)) return; // a disabled command is ignored
    if (this.valid(command)) {
      this.modalHost.endModal(command);
      // The modal session ended — release the host so this view reverts to a plain window.
      this.modalHost = null;
    } else if (this.firstInvalid !== null) {
      ev.focusView?.(this.firstInvalid); // vetoed: keep open and refocus the first invalid control
    }
    ev.handled = true;
  }

  /** Resolve the modal to `cancel` (bypasses `valid()`), for the frame close-box and Esc. */
  protected resolveCancel(ev: DispatchEvent): void {
    if (this.modalHost === null) return;
    this.modalHost.endModal(Commands.cancel);
    // Clear the host so a dialog left mounted after its modal ends stops swallowing global Esc (and
    // can no longer end an unrelated later modal); it reverts to a plain window.
    this.modalHost = null;
    ev.handled = true;
  }
}

/** Duck-type guard: does `view` expose a zero-arg `valid()` (the child-sweep predicate)? */
function isValidatable(view: View): view is View & Validatable {
  return typeof (view as Partial<Validatable>).valid === 'function';
}
