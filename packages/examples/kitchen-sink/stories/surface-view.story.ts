/**
 * Story: `SurfaceView` (RD-19) — a **pannable ASCII canvas**. An offscreen {@link Surface} (a labelled
 * grid, larger than its viewport) is displayed through a passive {@link SurfaceView} `delta`-window. The
 * `SurfaceView` takes no input (faithful `TSurfaceView`); a small focusable container drives `delta` —
 * arrows / PgUp / PgDn / Home / End + mouse wheel (Shift+wheel pans horizontally, a fallback for devices
 * with no native horizontal wheel) — and two `ScrollBar`s are two-way bound to `delta` for click / drag /
 * wheel-over-bar. The live `delta` is echoed so panning is visible.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Surface, SurfaceView, ScrollBar, Label, Text, signal } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

interface Point {
  x: number;
  y: number;
}

/** The offscreen canvas size (deliberately larger than any story viewport, so panning is meaningful). */
const CANVAS_W = 96;
const CANVAS_H = 36;

/** Build a labelled grid surface: `+`/`|`/`-` rules every 8×4 cells + `x,y` coordinate stamps. */
function buildCanvas(): Surface {
  const rows: string[] = [];
  for (let y = 0; y < CANVAS_H; y += 1) {
    let line = '';
    for (let x = 0; x < CANVAS_W; x += 1) {
      if (x % 8 === 0 && y % 4 === 0) line += '+';
      else if (x % 8 === 0) line += '|';
      else if (y % 4 === 0) line += '-';
      else line += ' ';
    }
    rows.push(line);
  }
  const surface = Surface.from(rows);
  // Stamp a coordinate label at each grid intersection so a pan is unmistakable.
  const ctx = surface.getDrawContext();
  for (let gy = 0; gy < CANVAS_H; gy += 4) {
    for (let gx = 0; gx < CANVAS_W; gx += 8) {
      ctx.text(gx + 1, gy, `${gx},${gy}`, { fg: 'brightCyan', bg: 'default' });
    }
  }
  return surface;
}

/**
 * A focusable viewport container: a passive `SurfaceView` + vertical/horizontal `ScrollBar`s, all bound
 * to one `delta` signal. It owns the keyboard (arrows/paging) + wheel; the bars own click/drag/wheel.
 * This is exactly how an app composes a scrollable offscreen canvas (RD-19 defers built-in scroll, DEF-31).
 */
class PannableCanvas extends Group {
  override focusable = true;

  private readonly view: SurfaceView;
  private readonly hval: Signal<number>;
  private readonly vval: Signal<number>;
  private readonly maxX: number;
  private readonly maxY: number;

  constructor(
    surface: Surface,
    private readonly delta: Signal<Point>,
    vw: number,
    vh: number,
  ) {
    super();
    this.maxX = Math.max(0, surface.size.x - vw);
    this.maxY = Math.max(0, surface.size.y - vh);
    this.hval = signal(0);
    this.vval = signal(0);
    this.view = new SurfaceView({ surface, delta });

    const vbar = new ScrollBar({ value: this.vval, min: 0, max: this.maxY, orientation: 'vertical' });
    const hbar = new ScrollBar({ value: this.hval, min: 0, max: this.maxX, orientation: 'horizontal' });

    // SurfaceView fills the viewport minus the 1-cell scrollbar gutters; bars line the right/bottom edges.
    this.add(at(this.view, 0, 0, vw, vh) as SurfaceView);
    this.add(at(vbar, vw, 0, 1, vh) as ScrollBar);
    this.add(at(hbar, 0, vh, vw, 1) as ScrollBar);

    this.onMount(() => {
      // Two-way bind delta ⟷ (hval, vval). The number signals guard on equality, so the mutual binds
      // converge without a feedback loop (the codebase's value⟷text idiom).
      this.bind(
        () => ({ x: this.hval(), y: this.vval() }),
        (d) => this.delta.set(d),
      );
      this.bind(
        () => this.delta(),
        (d) => {
          this.hval.set(d.x);
          this.vval.set(d.y);
        },
      );
    });
  }

  /** Keyboard + wheel → pan; the passive `SurfaceView` never sees input. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      // Shift+vertical-wheel is the horizontal-scroll fallback: many terminals/devices never emit a
      // native horizontal wheel (SGR 66/67), but do send Shift+wheel as a vertical report with the
      // shift bit set. Remap up→left, down→right so the canvas still pans horizontally.
      if (inner.shift && (inner.dir === 'up' || inner.dir === 'down')) {
        this.view.panBy(inner.dir === 'up' ? -1 : 1, 0);
      } else if (inner.dir === 'up') this.view.panBy(0, -1);
      else if (inner.dir === 'down') this.view.panBy(0, 1);
      else if (inner.dir === 'left') this.view.panBy(-1, 0);
      else this.view.panBy(1, 0);
      ev.handled = true;
      return;
    }
    if (inner.type !== 'key') return;
    switch (inner.key) {
      case 'left':
        this.view.panBy(-1, 0);
        break;
      case 'right':
        this.view.panBy(1, 0);
        break;
      case 'up':
        this.view.panBy(0, -1);
        break;
      case 'down':
        this.view.panBy(0, 1);
        break;
      case 'pageup':
        this.view.panBy(0, -4);
        break;
      case 'pagedown':
        this.view.panBy(0, 4);
        break;
      case 'home':
        this.view.scrollTo({ x: 0, y: 0 });
        break;
      case 'end':
        this.view.scrollTo({ x: this.maxX, y: this.maxY });
        break;
      default:
        return; // not a pan key — leave unconsumed
    }
    ev.handled = true;
  }
}

export const surfaceViewStory: Story = {
  id: 'surface/surface-view',
  category: 'Surface',
  title: 'SurfaceView',
  rd: 'RD-19',
  blurb: 'SurfaceView: a passive delta-viewport onto an offscreen Surface — a pannable ASCII canvas.',
  build(ctx: StoryContext) {
    const width = Math.max(20, ctx.width - 2);
    const vw = Math.max(10, width - 1); // reserve 1 col for the vertical scrollbar
    const vh = Math.max(6, ctx.height - 6); // reserve rows for label + echo + hints + the h-scrollbar

    const surface = buildCanvas();
    const delta = signal<Point>({ x: 0, y: 0 });
    const canvas = new PannableCanvas(surface, delta, vw, vh);

    const g = new Group();
    g.add(at(new Label('~C~anvas', canvas), 1, 0, 12, 1));
    g.add(at(canvas, 1, 1, vw + 1, vh + 1)); // +1 for each scrollbar gutter
    g.add(
      at(
        new Text(
          () => `delta: (${delta().x}, ${delta().y})   viewport ${vw}×${vh} over surface ${CANVAS_W}×${CANVAS_H}`,
        ),
        1,
        vh + 3,
        width,
        1,
      ),
    );
    g.add(
      at(
        new Text('Arrows / PgUp / PgDn / Home / End pan · wheel scrolls (Shift+wheel = horizontal) · drag the ▓ bars.'),
        1,
        vh + 4,
        width,
        1,
      ),
    );
    return g;
  },
};
