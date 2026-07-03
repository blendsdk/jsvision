/**
 * `BoingClock` — the Amiga "Boing" ball, reborn as a clock, for the `demo:amiga-clock` showcase.
 *
 * The 1984 Amiga Boing demo bounced a red/white checkerboard sphere around a purple grid room. This
 * `View` recreates it: `draw(ctx)` maps every cell inside the ball's disc back onto a unit sphere,
 * bins it into longitude/latitude segments for the checkerboard, and shades each cell by its surface
 * normal's `z` so the ball reads as round. The ball spins and bounces off the window walls, the room
 * grid sits behind it, and the current time is overlaid along the bottom.
 *
 * It binds to both a frame counter (spin + bounce) and a `Date` (the overlay), so the timer drives
 * the whole animation reactively. Novel art — outside the TV-fidelity gate.
 *
 * Cells are ~twice as tall as wide, so horizontal radius = vertical radius × {@link ASPECT}. The
 * `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';
import { Attr } from '@jsvision/core';
import type { Style } from '@jsvision/core';
import { shade } from './colors.js';
import type { Rgb } from './colors.js';

const ASPECT = 2;
const RED: Rgb = [235, 40, 55];
const WHITE: Rgb = [240, 240, 245];
const ROOM_BG = '#1a0a2a'; // dark purple room
const GRID = '#3a1a5a'; // magenta grid lines
const SHADOW = '#0c0518'; // near-black floor shadow
const OVERLAY = '#ffdd55';

const LON_SEGMENTS = 8; // checkerboard columns around the equator
const LAT_SEGMENTS = 8; // checkerboard rows pole-to-pole
const SPIN_PER_FRAME = 0.14; // radians of longitude per frame

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** A triangle wave in `[0, 1]`, period `2` — turns a rising counter into a wall-to-wall bounce. */
function triangle(t: number): number {
  const p = ((t % 2) + 2) % 2;
  return p < 1 ? p : 2 - p;
}

export class BoingClock extends View {
  private frame = 0;
  private now = new Date(0);

  /**
   * @param readFrame Reactive accessor for the animation frame counter.
   * @param readNow Reactive accessor for the current `Date`.
   */
  constructor(
    private readonly readFrame: () => number,
    private readonly readNow: () => Date,
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
        () => this.readNow(),
        (d) => {
          this.now = d;
        },
      );
    });
  }

  /** Claim the full window interior so the room fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    ctx.fill(' ', { fg: GRID, bg: ROOM_BG });
    if (width < 6 || height < 5) return;

    this.drawRoom(ctx, width, height);

    // Size the ball to ~20% of the window area. The elliptical footprint is π·rx·ry with rx = ry·2,
    // so 2π·ry² = 0.2·W·H → ry = √(0.1·W·H/π). Clamp so it still fits inside the walls/floor.
    const ideal = Math.sqrt((0.1 * width * height) / Math.PI);
    const ry = Math.max(2, Math.min(ideal, height / 2 - 1, width / (2 * ASPECT) - 1));
    const rx = ry * ASPECT;

    // Horizontal: constant-speed wall bounce (a triangle wave reflects off left/right).
    const cx = rx + triangle(this.frame * 0.045) * (width - 2 * rx);
    // Vertical: gravity bounce — fast at the floor, hanging at the apex (parabolic arc per bounce).
    const p = (this.frame * 0.028) % 1;
    const height01 = 4 * p * (1 - p); // 0 at floor (p=0,1), 1 at apex (p=0.5)
    const yTop = ry;
    const yFloor = height - ry - 1;
    const cy = yFloor - height01 * (yFloor - yTop);
    const spin = this.frame * SPIN_PER_FRAME;

    this.drawShadow(ctx, cx, rx, height, height01);
    this.drawBall(ctx, cx, cy, rx, ry, spin);
    this.drawOverlay(ctx, width, height);
  }

  /** The purple grid room behind the ball — faint verticals + horizontals. */
  private drawRoom(ctx: DrawContext, width: number, height: number): void {
    const line: Style = { fg: GRID, bg: ROOM_BG };
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 1) ctx.text(x, y, '─', line);
    for (let x = 0; x < width; x += 4) for (let y = 0; y < height; y += 1) ctx.text(x, y, '│', line);
  }

  /**
   * A floor shadow on the bottom row: widest and darkest when the ball is on the floor
   * (`height01 → 0`), shrinking as it rises — the visual cue that sells the bounce.
   *
   * @param height01 Ball height, `0` at the floor to `1` at the apex.
   */
  private drawShadow(ctx: DrawContext, cx: number, rx: number, height: number, height01: number): void {
    const nearness = 1 - height01; // 1 on the floor, 0 at the apex
    const shRx = rx * (0.45 + 0.55 * nearness);
    const y = height - 1;
    const x0 = Math.max(0, Math.floor(cx - shRx));
    const x1 = Math.ceil(cx + shRx);
    for (let x = x0; x <= x1; x += 1) {
      if (Math.abs((x - cx) / shRx) <= 1) ctx.text(x, y, ' ', { fg: SHADOW, bg: SHADOW });
    }
  }

  /** Ray-map each cell in the ball's disc onto a unit sphere and paint the shaded checkerboard. */
  private drawBall(ctx: DrawContext, cx: number, cy: number, rx: number, ry: number, spin: number): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.ceil(cy + ry);

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue; // outside the disc

        const nz = Math.sqrt(1 - d2);
        const lat = Math.asin(Math.max(-1, Math.min(1, ny))); // -π/2 … π/2
        const lon = Math.atan2(nx, nz) + spin; // rotate around the vertical axis
        const latBin = Math.floor(((lat + Math.PI / 2) / Math.PI) * LAT_SEGMENTS);
        const lonBin = Math.floor((lon / (Math.PI * 2)) * LON_SEGMENTS);
        const checker = (latBin + lonBin) & 1;
        const base = checker === 0 ? RED : WHITE;
        const brightness = 0.35 + 0.65 * nz; // terminator → limb shading
        const col = shade(base, brightness);
        ctx.text(x, y, ' ', { fg: col, bg: col });
      }
    }
  }

  /** Overlay `HH:MM:SS` along the bottom, centered. */
  private drawOverlay(ctx: DrawContext, width: number, height: number): void {
    const label = `${pad2(this.now.getHours())}:${pad2(this.now.getMinutes())}:${pad2(this.now.getSeconds())}`;
    const x = Math.max(0, Math.floor((width - label.length) / 2));
    ctx.text(x, height - 1, label, { fg: OVERLAY, bg: ROOM_BG, attrs: Attr.bold });
  }
}
