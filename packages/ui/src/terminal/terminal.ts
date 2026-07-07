/**
 * A passive, scrolling log view — a place to stream program output, log lines, or
 * command results into. Feed it with {@link Terminal.write}/{@link Terminal.writeLine};
 * it keeps the most recent output (backed by a fixed-capacity {@link LineRing})
 * and shows the newest lines at the bottom.
 *
 * Behavior worth knowing:
 * - **Auto-scrolls to the bottom.** New lines appear at the bottom; a fresh
 *   write always snaps the view back to the newest line.
 * - **Scroll-back is mouse-wheel only.** The view is not focusable and takes no
 *   keyboard input, so scroll up with the wheel to review older lines; the next
 *   write jumps back to the bottom.
 * - **Reactive.** Each write coalesces into a single repaint on the next frame.
 * - **Safe with untrusted text.** Incoming text may contain control bytes; every
 *   cell is sanitized as it is drawn, so hostile output can't corrupt the screen.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal } from '../reactive/index.js';
import { LineRing } from './ring.js';

/** Wheel scroll-back step (the house 3-line wheel unit). */
const WHEEL_STEP = 3;

/** Options for {@link Terminal}. */
export interface TerminalOptions {
  /** How much scroll-back to retain, in UTF-16 code units (default 32000). Older lines are dropped. */
  capacity?: number;
}

/**
 * A scrolling log-output view. Write text into it; it shows the newest lines,
 * auto-scrolls to the bottom, and lets the user wheel back through history.
 *
 * @example
 * import { Group, Terminal } from '@jsvision/ui';
 *
 * const group = new Group();
 * const log = new Terminal({ capacity: 8000 });
 * log.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 60, height: 10 } };
 * group.add(log);
 *
 * log.writeLine('Build started...');
 * log.write('compiling');
 * log.write('.'.repeat(3) + '\n');
 * log.writeLine('Done.');
 */
export class Terminal extends View {
  override focusable = false; // a passive log sink never joins the Tab order

  /** @internal The ring store. */
  protected readonly ring: LineRing;
  /** @internal Bumped per write → one coalesced repaint. */
  protected readonly version = signal(0);
  /** @internal Wheel scroll-back, in lines up from the bottom (0 = pinned to the newest). */
  protected readonly scrollBack = signal(0);

  constructor(options: TerminalOptions = {}) {
    super();
    this.ring = new LineRing(options.capacity);
    // Repaint whenever content changes or the user scrolls. Bound on mount because the view's
    // reactive scope doesn't exist yet in the constructor.
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

  /** Render the visible window: the newest lines, pinned to the bottom (offset up by any scroll-back). */
  override draw(ctx: DrawContext): void {
    const style = ctx.color('terminalNormal');
    ctx.fill(' ', style);
    const h = ctx.size.height;
    const total = this.ring.lineCount();
    const maxBack = Math.max(0, total - h);
    const back = Math.min(this.scrollBack(), maxBack);
    const start = Math.max(0, total - h - back);
    for (let y = 0; y < h && start + y < total; y++) {
      ctx.text(0, y, this.ring.line(start + y), style); // ctx.text sanitizes control bytes as it writes
    }
  }

  /** Scroll-back is mouse-wheel only; mouse buttons are inert on this passive sink. */
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
 * Wrap a {@link Terminal} as a plain `(text) => void` sink, so anything that
 * writes strings to a callback — a logger, a subprocess `stdout` handler, a
 * progress reporter — can stream into the view.
 *
 * @param term The terminal view to append into.
 * @returns A function that writes each string into `term`.
 * @example
 * import { Terminal, terminalWriter } from '@jsvision/ui';
 *
 * const log = new Terminal();
 * const write = terminalWriter(log);
 *
 * // Feed it from anywhere that emits text lines.
 * write('server listening on :8080\n');
 * childProcess.stdout.on('data', (chunk) => write(String(chunk)));
 */
export function terminalWriter(term: Terminal): (s: string) => void {
  return (s) => term.write(s);
}
