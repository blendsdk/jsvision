/**
 * Demo-local widgets for `demo:controls-live` — a faithful grey Turbo Vision **dialog** frame plus a
 * tiny command sink. Both are the disciplined-hybrid escape hatch (plain `@jsvision/ui` subclasses),
 * kept in the example so the framework's RD-11-reserved `Dialog` is not pre-built here.
 *
 * Why a custom frame: the RD-06 controls are calibrated for Turbo Vision's **grey** dialog palette
 * (`cpGrayDialog` — black-on-lightGray labels, blue input fields, cyan clusters, green buttons), so
 * the honest habitat to audit them in is a grey dialog, not the blue `Window`. `Window.draw` paints
 * the blue window/`windowInactive` chrome via `frame.ts` (whose `FrameRole` is window-only), so this
 * subclass overrides `draw` to paint the same `TFrame` geometry in the `dialog` role instead. The
 * border glyphs, double-line-when-active rule, centered title, and close-box columns (2–4) replicate
 * Turbo Vision `TFrame::draw` exactly (`magiblot/tvision` `source/tvision/tframe.cpp:35-124`); a
 * `TDialog` is a `TWindow` carrying `cpGrayDialog` with the same frame, so this is faithful.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View, Window } from '@jsvision/ui';
import type { DrawContext, DispatchEvent } from '@jsvision/ui';

/** Double-line border (CP437 0xC9/CD/BB/BA/C8/BC) — the active (focused) dialog, as in Turbo Vision. */
const DOUBLE = { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' } as const;
/** Single-line border (CP437 0xDA/C4/BF/B3/C0/D9) — the inactive/passive dialog. */
const SINGLE = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' } as const;
/** Close-box inner glyph. `×` (not TV's ambiguous-width CP437 `■`) — matches the Window frame (AGENTS.md). */
const CLOSE_GLYPH = '×';

/**
 * A movable, closable **grey** Turbo Vision dialog. Extends {@link Window} for the WM plumbing
 * (raise-on-click, drag-move, close box, the manager seam) but is neither resizable nor zoomable
 * (TV `TDialog` default flags = `wfMove | wfClose`), and repaints its frame in the grey `dialog`
 * role so the RD-06 controls sit on their intended palette.
 */
export class Dialog extends Window {
  /** TV dialogs do not grow — no SE/SW resize grip, and the bottom row is inert. */
  override resizable = false;
  /** TV dialogs do not zoom — the top-right zoom box is suppressed. */
  override zoomable = false;

  /** Paint the grey `TFrame` chrome: border (double when active), centered title, and the close box. */
  override draw(ctx: DrawContext): void {
    const active = this.manager?.activeWindow() === this;
    const role = ctx.role('dialog');
    const border = { fg: role.border, bg: role.bg };
    const titleStyle = { fg: role.title, bg: role.bg };
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 2) return; // too small for a frame — degrade to nothing

    // Border box (fills the interior opaquely so content children inset over a solid grey field).
    const g = active ? DOUBLE : SINGLE;
    ctx.fillRect(0, 0, w, h, ' ', border);
    ctx.text(0, 0, g.tl, border);
    ctx.text(w - 1, 0, g.tr, border);
    ctx.text(0, h - 1, g.bl, border);
    ctx.text(w - 1, h - 1, g.br, border);
    for (let col = 1; col < w - 1; col += 1) {
      ctx.text(col, 0, g.h, border);
      ctx.text(col, h - 1, g.h, border);
    }
    for (let row = 1; row < h - 1; row += 1) {
      ctx.text(0, row, g.v, border);
      ctx.text(w - 1, row, g.v, border);
    }

    // Centered title with a one-space pad each side (TV `TFrame` title placement).
    const title = this.title();
    if (title.length > 0) {
      const label = ` ${title} `;
      const i = Math.max(1, Math.floor((w - label.length) / 2));
      ctx.text(i, 0, label, titleStyle);
    }

    // Close box `[×]` at cols 2–4, drawn only on the active dialog — matches `frameZoneAt`'s hit-zone.
    if (active && w >= 6) {
      ctx.text(2, 0, '[', border);
      ctx.text(3, 0, CLOSE_GLYPH, border);
      ctx.text(4, 0, ']', border);
    }
  }
}

/**
 * An invisible post-process command sink — the demo's hook for app-level commands the shell does not
 * itself handle (OK/Cancel/Help here). It never draws; when a routed `CommandEvent`'s name has a
 * handler it invokes it and consumes the event. Mirrors the app's internal quit sink.
 */
export class CommandSink extends View {
  override postProcess = true;

  /**
   * @param handlers Map of command name → handler invoked (and the event consumed) when it routes.
   */
  constructor(private readonly handlers: Readonly<Record<string, () => void>>) {
    super();
    this.state.visible = false;
  }

  override draw(_ctx: DrawContext): void {
    // intentionally empty — the sink is invisible (state.visible = false)
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'command') return;
    const handler = this.handlers[inner.command];
    if (handler !== undefined) {
      handler();
      ev.handled = true;
    }
  }
}
