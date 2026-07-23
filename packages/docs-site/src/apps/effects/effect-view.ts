/**
 * A full-window animated visual effect, driven by a shared frame counter: a flying starfield, a
 * sinusoidal plasma field, and a classic bottom-up fire. One `EffectView` renders whichever effect a
 * reactive `mode` selects, so a single timer animates it and a keystroke switches between them.
 *
 * Every cell is coloured with a truecolor hex value; the engine downsamples to whatever the terminal
 * actually supports (256 / 16 / mono), so the effect renders sensibly everywhere while showing the
 * colour engine and the damage-diff renderer off at their most demanding.
 *
 * Plasma is stateless (a pure function of cell + time); the starfield and the fire carry per-view
 * state (star positions, a heat buffer) that is rebuilt whenever the window is resized.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';

/** The three effects, in cycle order. */
export const EFFECTS = ['starfield', 'plasma', 'fire'] as const;
/** One effect's index into {@link EFFECTS}. */
export type EffectMode = number;

const BLACK = '#000000';

/** Clamp `n` to `[0, 1]`. */
function unit(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Pack three 0–255 channels into a `#rrggbb` string. */
function hex(r: number, g: number, b: number): `#${string}` {
  const to2 = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** HSV (all 0–1) → `#rrggbb`. Used by the plasma field to sweep smoothly through the spectrum. */
function hsv(h: number, s: number, v: number): `#${string}` {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6] as [number, number, number];
  return hex(r * 255, g * 255, b * 255);
}

/** One fire palette stop as an `[at, r, g, b]` control point (`at` in 0–1). */
type Stop = readonly [number, number, number, number];
/** Black → deep red → orange → yellow → white — the canonical fire ramp. */
const FIRE_STOPS: readonly Stop[] = [
  [0.0, 0, 0, 0],
  [0.25, 90, 0, 0],
  [0.5, 200, 40, 0],
  [0.72, 255, 130, 20],
  [0.88, 255, 220, 90],
  [1.0, 255, 255, 235],
];

/** Sample the fire ramp at heat `h` (0–1), linearly interpolating between the two surrounding stops. */
function fireColor(h: number): `#${string}` {
  const heat = unit(h);
  for (let i = 1; i < FIRE_STOPS.length; i += 1) {
    const [a, ar, ag, ab] = FIRE_STOPS[i - 1]!;
    const [b, br, bg, bb] = FIRE_STOPS[i]!;
    if (heat <= b) {
      const k = b === a ? 0 : (heat - a) / (b - a);
      return hex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
    }
  }
  return hex(255, 255, 235);
}

/** One star flying toward the viewer: `x`/`y` in `[-1, 1]`, `z` its depth (1 far, →0 near). */
interface Star {
  x: number;
  y: number;
  z: number;
}

export class EffectView extends View {
  private frame = 0;
  private mode: EffectMode = 0;

  // Grid the current per-effect state was built for; a mismatch (resize/zoom) triggers a rebuild.
  private gw = -1;
  private gh = -1;

  private stars: Star[] = [];
  private heat: number[] = []; // fire heat, row-major, 0–1

  /**
   * @param readFrame Reactive accessor for a monotonically increasing frame counter — the animation
   * clock; one timer can drive any number of effect views.
   * @param readMode Reactive accessor for the selected effect index into {@link EFFECTS}.
   */
  constructor(
    private readonly readFrame: () => number,
    private readonly readMode: () => EffectMode,
  ) {
    super();
    // Bind on mount, not in the constructor: the reactive scope exists only once the view is mounted.
    this.onMount(() => {
      this.bind(
        () => this.readFrame(),
        (f) => {
          this.frame = f;
        },
      );
      this.bind(
        () => this.readMode(),
        (m) => {
          this.mode = m;
        },
      );
    });
  }

  /** Claim the whole window interior so the effect fills it edge to edge. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    if (width < 1 || height < 1) return;
    if (width !== this.gw || height !== this.gh) this.rebuild(width, height);

    const t = this.frame * 0.1;
    const effect = EFFECTS[this.mode % EFFECTS.length];
    if (effect === 'plasma') this.drawPlasma(ctx, t);
    else if (effect === 'fire') this.drawFire(ctx);
    else this.drawStarfield(ctx);
  }

  /** Allocate per-effect state for a new grid size — first draw and every resize. */
  private rebuild(width: number, height: number): void {
    this.gw = width;
    this.gh = height;
    this.stars = Array.from({ length: Math.max(40, Math.floor((width * height) / 12)) }, () => this.spawnStar());
    this.heat = new Array<number>(width * height).fill(0);
  }

  /** A fresh star at a random position and depth. */
  private spawnStar(): Star {
    return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.9 + 0.1 };
  }

  /** Plasma: each cell is a pure function of its position and time — no state, just sines. */
  private drawPlasma(ctx: DrawContext, t: number): void {
    const { width, height } = ctx.size;
    const cx = width / 2;
    const cy = height / 2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const v =
          Math.sin(x * 0.16 + t) +
          Math.sin(y * 0.13 - t * 0.7) +
          Math.sin((x + y) * 0.08 + t * 0.5) +
          Math.sin(Math.hypot(x - cx, y - cy) * 0.15 - t);
        const hue = (v / 8 + 0.5 + t * 0.02) % 1;
        const color = hsv((hue + 1) % 1, 0.65, 1);
        ctx.text(x, y, ' ', { fg: color, bg: color });
      }
    }
  }

  /** Fire: seed a hot, flickering bottom row, then diffuse heat upward with cooling. */
  private drawFire(ctx: DrawContext): void {
    const w = this.gw;
    const h = this.gh;
    // Seed the bottom row: mostly hot, with random cold gaps so the flames flicker and lick.
    const base = (h - 1) * w;
    for (let x = 0; x < w; x += 1) {
      this.heat[base + x] = Math.random() < 0.8 ? 0.7 + Math.random() * 0.3 : 0;
    }
    // Propagate upward: each cell averages the three below it, loses a little to cooling, and drifts
    // sideways by a random cell so the flames are not perfectly vertical.
    for (let y = 0; y < h - 1; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const below = (y + 1) * w;
        const l = this.heat[below + Math.max(0, x - 1)] ?? 0;
        const c = this.heat[below + x] ?? 0;
        const r = this.heat[below + Math.min(w - 1, x + 1)] ?? 0;
        const cooled = ((l + c + r) / 3) * 0.965 - 0.008;
        const drift = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? -1 : 1;
        const dst = x + drift;
        if (dst >= 0 && dst < w) this.heat[y * w + dst] = unit(cooled);
      }
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const color = fireColor(this.heat[y * w + x] ?? 0);
        ctx.text(x, y, ' ', { fg: color, bg: color });
      }
    }
  }

  /** Starfield: fly every star toward the viewer, project it, and brighten it as it nears. */
  private drawStarfield(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    const cx = width / 2;
    const cy = height / 2;
    ctx.fill(' ', { fg: BLACK, bg: BLACK });
    for (const star of this.stars) {
      star.z -= 0.012;
      if (star.z <= 0.02) {
        Object.assign(star, this.spawnStar());
        star.z = 1;
      }
      const sx = Math.round(cx + (star.x / star.z) * cx);
      const sy = Math.round(cy + (star.y / star.z) * cy);
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      const near = 1 - star.z; // 0 far … 1 near
      const shade = Math.round(90 + near * 165);
      const glyph = near > 0.8 ? '✦' : near > 0.55 ? '✧' : near > 0.3 ? '•' : '·';
      ctx.text(sx, sy, glyph, { fg: hex(shade, shade, Math.min(255, shade + 20)), bg: BLACK });
    }
  }
}
