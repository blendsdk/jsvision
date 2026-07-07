/**
 * `Terminal` — the streaming log sink: a faithful `TTerminal` view over {@link LineRing}
 * (RD-08 03-05, AR-257).
 *
 * Decode (`textview.cpp:117-240`, re-verified 2026-07-07 @ 57b6f56): the draw walks line
 * boundaries backward from the queue front (`prevLines`, `ttprvlns.cpp:18-47`) and auto-scrolls
 * so the LAST line stays visible (`scrollTo(0, screenLines+1)` `:235` — top-anchored until the
 * content overflows, then bottom-pinned); colour `mapColor(1)` (`:125`) → `cpScroller "\x06"`
 * (`tscrolle.cpp:35`) → blue window → **`terminalNormal` `0x1E`** (PA-8). The C++
 * `streambuf`/`otstream` surface is replaced by `write()`/`writeLine()` (AR-257/AR-263).
 *
 * Reactive: a version signal bumps per write → one coalesced repaint. Content is HOSTILE — every
 * cell passes the `DrawContext` write-time sanitize (AC-17). Scroll-back is WHEEL-ONLY (PF-006:
 * key events reach only the focused chain, `dispatch.ts:13`, and this view is non-focusable —
 * TV's keyboard scrolling came from attached scrollbars our Terminal doesn't have), snapping back
 * to the bottom on the next write.
 * GATE-2 AFTER-diff (2026-07-07): rendered headlessly and diffed against the decode — bottom-anchor,
 * eviction, colour byte all match. No draw mismatch.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal } from '../reactive/index.js';
import { LineRing } from './ring.js';

/** Wheel scroll-back step (the house 3-line wheel unit). */
const WHEEL_STEP = 3;

/** Construction options. */
export interface TerminalOptions {
  /** Ring capacity in UTF-16 code units (default 32000, AR-257/PF-007). */
  capacity?: number;
}

/** The passive, non-focusable streaming log sink. */
export class Terminal extends View {
  override focusable = false; // PF-006 — a log sink never joins the Tab order

  /** @internal The ring store. */
  protected readonly ring: LineRing;
  /** @internal Bumped per write → one coalesced repaint. */
  protected readonly version = signal(0);
  /** @internal Wheel scroll-back, in lines up from the bottom (0 = pinned to the newest). */
  protected readonly scrollBack = signal(0);

  constructor(options: TerminalOptions = {}) {
    super();
    this.ring = new LineRing(options.capacity);
    this.onMount(() => {
      this.bind(() => [this.version(), this.scrollBack()] as const);
    });
  }

  /** Append raw text (hostile-safe — sanitized at draw); snaps the view back to the bottom. */
  write(text: string): void {
    this.ring.write(text);
    this.scrollBack.set(0);
    this.version.set(this.version() + 1);
  }

  /** Append one line. */
  writeLine(text: string): void {
    this.write(`${text}\n`);
  }

  /** Drop all content. */
  clear(): void {
    this.ring.clear();
    this.scrollBack.set(0);
    this.version.set(this.version() + 1);
  }

  /** Render the visible window: the newest lines, auto-scrolled (the `:235` decode). */
  override draw(ctx: DrawContext): void {
    const style = ctx.color('terminalNormal');
    ctx.fill(' ', style);
    const h = ctx.size.height;
    const total = this.ring.lineCount();
    const maxBack = Math.max(0, total - h);
    const back = Math.min(this.scrollBack(), maxBack);
    const start = Math.max(0, total - h - back);
    for (let y = 0; y < h && start + y < total; y++) {
      ctx.text(0, y, this.ring.line(start + y), style); // sanitized at the write boundary (AC-17)
    }
  }

  /** Wheel-only scroll-back (PF-006); mouse buttons are inert on a passive sink. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'wheel') return;
    const maxBack = Math.max(0, this.ring.lineCount() - this.viewH());
    if (inner.dir === 'up') this.scrollBack.set(Math.min(this.scrollBack() + WHEEL_STEP, maxBack));
    else if (inner.dir === 'down') this.scrollBack.set(Math.max(0, this.scrollBack() - WHEEL_STEP));
    else return;
    ev.handled = true;
  }

  /** @internal View height (0 pre-reflow). */
  protected viewH(): number {
    return this.bounds.height;
  }
}

/**
 * The Should-Have logger-sink adapter (PA-4): hand this to core `createLogger`-style consumers so
 * their lines stream into the terminal view.
 */
export function terminalWriter(term: Terminal): (s: string) => void {
  return (s) => term.write(s);
}
