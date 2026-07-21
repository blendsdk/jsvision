/**
 * Conway's Game of Life on a toroidal grid, driven by a shared frame counter: while `playing`, the
 * board advances one generation each new frame; paused, it holds so you can draw on it. Click or drag
 * to paint live cells. Cells are tinted by age — bright when freshly born, cooling to teal as they
 * survive — so gliders and oscillators read at a glance.
 *
 * The board is plain typed-array state (not signals — a whole grid of signals would be wasteful);
 * `invalidate()` requests a repaint after any mutation. It rebuilds with a random seed whenever the
 * window is resized.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, DispatchEvent, Size2D } from '@jsvision/ui';

const BLACK = '#000000';
const CELL = '█';
/** Generations of survival after which a cell reaches its "old" colour. */
const AGE_CAP = 16;

/** Pack three 0–255 channels into a `#rrggbb` string (contextually typed so it satisfies `Color`). */
function hex(r: number, g: number, b: number): `#${string}` {
  const to2 = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Age → colour: bright mint when young (age 1), cooling to teal as a cell survives. */
function ageColor(age: number): `#${string}` {
  const k = Math.min(1, (age - 1) / AGE_CAP); // 0 young … 1 old
  return hex(200 - 190 * k, 255 - 105 * k, 220 - 110 * k);
}

export class LifeView extends View {
  override focusable = true;

  private frame = 0;
  private playing = false;
  private lastStep = -1;

  private gw = -1;
  private gh = -1;
  private cur = new Uint8Array(0); // 1 = alive
  private nxt = new Uint8Array(0);
  private age = new Uint16Array(0);

  /**
   * @param readFrame Reactive accessor for a monotonically increasing frame counter (the clock).
   * @param readPlaying Reactive accessor for whether the simulation is running.
   */
  constructor(
    private readonly readFrame: () => number,
    private readonly readPlaying: () => boolean,
  ) {
    super();
    this.onMount(() => {
      this.bind(
        () => this.readFrame(),
        (f) => {
          this.frame = f;
        },
      );
      this.bind(
        () => this.readPlaying(),
        (p) => {
          this.playing = p;
        },
      );
    });
  }

  /** Claim the whole window interior so the board fills it edge to edge. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  /** Wipe the board to empty and repaint. */
  clear(): void {
    this.cur.fill(0);
    this.age.fill(0);
    this.invalidate();
  }

  /** Reseed the board with ~28% random live cells and repaint. */
  randomize(): void {
    for (let i = 0; i < this.cur.length; i += 1) {
      const alive = Math.random() < 0.28 ? 1 : 0;
      this.cur[i] = alive;
      this.age[i] = alive;
    }
    this.invalidate();
  }

  /** Advance exactly one generation, even while paused, and repaint. */
  stepOnce(): void {
    if (this.gw > 0) this.step();
    this.invalidate();
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    if (width < 1 || height < 1) return;
    if (width !== this.gw || height !== this.gh) this.rebuild(width, height);

    // Advance once per new frame while running; a partial recompose can call draw() twice for one
    // frame, so guard on the frame value. Paused, the board holds.
    if (this.playing && this.frame !== this.lastStep) {
      this.step();
      this.lastStep = this.frame;
    }

    ctx.fill(' ', { fg: BLACK, bg: BLACK });
    for (let y = 0; y < this.gh; y += 1) {
      for (let x = 0; x < this.gw; x += 1) {
        const i = y * this.gw + x;
        if (this.cur[i]) ctx.text(x, y, CELL, { fg: ageColor(this.age[i] ?? 1), bg: BLACK });
      }
    }
  }

  /** (Re)allocate the board for a new grid size and seed it randomly. */
  private rebuild(width: number, height: number): void {
    this.gw = width;
    this.gh = height;
    this.lastStep = -1;
    this.cur = new Uint8Array(width * height);
    this.nxt = new Uint8Array(width * height);
    this.age = new Uint16Array(width * height);
    this.randomize();
  }

  /** One Conway generation with wrap-around edges (a toroidal board — patterns never fall off). */
  private step(): void {
    const w = this.gw;
    const h = this.gh;
    for (let y = 0; y < h; y += 1) {
      const up = ((y - 1 + h) % h) * w;
      const mid = y * w;
      const down = ((y + 1) % h) * w;
      for (let x = 0; x < w; x += 1) {
        const l = (x - 1 + w) % w;
        const r = (x + 1) % w;
        const n =
          (this.cur[up + l] ?? 0) +
          (this.cur[up + x] ?? 0) +
          (this.cur[up + r] ?? 0) +
          (this.cur[mid + l] ?? 0) +
          (this.cur[mid + r] ?? 0) +
          (this.cur[down + l] ?? 0) +
          (this.cur[down + x] ?? 0) +
          (this.cur[down + r] ?? 0);
        const i = mid + x;
        const alive = this.cur[i] === 1 ? n === 2 || n === 3 : n === 3;
        this.nxt[i] = alive ? 1 : 0;
        this.age[i] = alive ? Math.min(AGE_CAP + 1, (this.age[i] ?? 0) + 1) : 0;
      }
    }
    [this.cur, this.nxt] = [this.nxt, this.cur];
  }

  /** Paint live cells with the mouse: down/drag sets the cell under the pointer alive. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse') return;
    const local = ev.local;
    if (inner.kind === 'down') {
      if (local) this.paint(local.x, local.y);
      ev.setCapture?.(this); // keep tracking a drag even off the board
      ev.handled = true;
    } else if (inner.kind === 'drag' || inner.kind === 'move') {
      if (local) this.paint(local.x, local.y);
      ev.handled = true;
    } else if (inner.kind === 'up') {
      ev.releaseCapture?.();
      ev.handled = true;
    }
  }

  /** Bring one cell to life at a view-local pointer position. */
  private paint(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return;
    const i = y * this.gw + x;
    if (this.cur[i] !== 1) {
      this.cur[i] = 1;
      this.age[i] = 1;
      this.invalidate();
    }
  }
}
