import { Group, Scroller, Surface, SurfaceView, Text, View, at, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

const EXTENT = { width: 48, height: 16 } as const;

/** Paints a deterministic oversized live child for the Scroller comparison. */
class ScrollingRows extends View {
  /** Paints all authored rows; the Scroller clips them to its current visible window. */
  public override draw(ctx: DrawContext): void {
    const style = ctx.color('listNormal');
    ctx.fill(' ', style);
    for (let row = 0; row < EXTENT.height; row += 1) {
      ctx.text(0, row, `live row ${String(row + 1).padStart(2, '0')} · composed child`, style);
    }
  }
}

/** Creates bounded offscreen content whose coordinates remain easy to inspect. */
function createTeachingSurface(): Surface {
  return Surface.from(
    Array.from({ length: EXTENT.height }, (_, row) =>
      `surface ${String(row + 1).padStart(2, '0')} · ${'canvas '.repeat(6)}`.slice(0, EXTENT.width),
    ),
  );
}

/**
 * Compares a focusable Scroller with a caller-driven passive SurfaceView.
 *
 * The live status reads the public offsets, so keyboard navigation, buttons, resize, and clamping
 * remain observable without relying on colour.
 */
export class ViewportStrategyPanel extends Group {
  /** Stable teaching label used by the focused course specification. */
  public readonly lessonName = 'Viewport strategies';

  /** Focusable owner over one oversized live child and its vertical bar. */
  public readonly scroller: Scroller;

  /** Passive projection over deterministic offscreen cells. */
  public readonly surfaceView: SurfaceView;

  /** Caller-owned offset supplied to the passive surface projection. */
  protected readonly surfaceDelta = signal({ x: 0, y: 0 });

  /** Non-colour feedback that distinguishes keyboard and mouse actions. */
  protected readonly actionSource = signal<'ready' | 'keyboard' | 'mouse'>('ready');

  /** Creates both real public viewport surfaces and their non-colour status evidence. */
  public constructor() {
    super();
    this.scroller = new Scroller({
      content: new ScrollingRows(),
      extent: EXTENT,
    });
    this.surfaceView = new SurfaceView({
      surface: createTeachingSurface(),
      delta: this.surfaceDelta,
    });

    this.add(at(new Text('Scroller: focusable; owns vertical bar'), 0, 0, 32, 1));
    this.add(at(new Text('SurfaceView: passive; external commands'), 34, 0, 32, 1));
    this.add(at(this.scroller, 0, 1, 32, 4));
    this.add(at(this.surfaceView, 34, 1, 32, 4));
    this.add(at(new Text(`Extent: ${EXTENT.width}x${EXTENT.height} · bounded visible windows`), 0, 5, 66, 1));
    this.add(
      at(
        new Text(
          () =>
            `Scroller offset: ${this.scroller.delta.x},${this.scroller.delta.y} · clamped | ` +
            `Surface offset: ${this.surfaceDelta().x},${this.surfaceDelta().y} · clamped`,
        ),
        0,
        6,
        66,
        1,
      ),
    );
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 7, 66, 1));
  }

  /**
   * Pan the passive surface through its clamping public method.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public panSurface(source: 'keyboard' | 'mouse'): void {
    this.surfaceView.panBy(3, 2);
    this.actionSource.set(source);
  }

  /**
   * Reset the externally owned surface offset.
   *
   * Scroller reset remains reachable with Home while it is focused, preserving the distinction
   * between an owned keyboard path and an application command.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public resetSurface(source: 'keyboard' | 'mouse'): void {
    this.surfaceView.scrollTo({ x: 0, y: 0 });
    this.actionSource.set(source);
  }
}
