/**
 * `StoryWindow` — the fixed, full-screen grey canvas that hosts the current story — plus a small
 * `CommandSink` for the showcase's own commands.
 *
 * `StoryWindow` extends `Window` for the WM plumbing but is fixed (not movable/resizable/zoomable/
 * closable) and paints its frame in the grey `dialog` role — the habitat the datagrid controls are
 * calibrated for. The frame geometry follows the Turbo Vision `TFrame` shape: a double-line border when
 * active, a single-line border when inactive, and a centered title.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View, Window } from '@jsvision/ui';
import type { DrawContext, DispatchEvent } from '@jsvision/ui';

/** Double-line border — active/focused. */
const DOUBLE = { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' } as const;
/** Single-line border — inactive. */
const SINGLE = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' } as const;

/** The fixed grey canvas window that hosts one story at a time. */
export class StoryWindow extends Window {
  override movable = false;
  override resizable = false;
  override zoomable = false;
  override closable = false;

  /** Paint the grey frame chrome (double border when active, centered title; no close box). */
  override draw(ctx: DrawContext): void {
    const active = this.manager?.activeWindow() === this;
    const role = ctx.role('dialog');
    const border = { fg: role.border, bg: role.bg };
    const titleStyle = { fg: role.title, bg: role.bg };
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 2) return;

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

    const title = this.title();
    if (title.length > 0) {
      const label = ` ${title} `;
      const i = Math.max(1, Math.floor((w - label.length) / 2));
      ctx.text(i, 0, label, titleStyle);
    }
  }
}

/**
 * An invisible post-process command sink — the showcase's hook for its own commands (story ids +
 * `showcase.*` navigation). It never draws; a routed `CommandEvent` whose name has a handler is invoked
 * and consumed.
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
