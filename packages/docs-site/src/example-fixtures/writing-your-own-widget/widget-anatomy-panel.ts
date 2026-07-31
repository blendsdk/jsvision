import { resolveCapabilities } from '@jsvision/core';
import { Group, Text, View, createRenderRoot, fixed, row, signal } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Signal, Size2D } from '@jsvision/ui';

type ActionSource = 'keyboard' | 'mouse';

/** Callbacks that keep learner-visible evidence outside the custom leaf. */
interface MeterEvidence {
  /** Record one intrinsic measurement. */
  measured(size: Size2D): void;
  /** Record one completed draw. */
  drawn(): void;
  /**
   * Record one handled action and its originating input route.
   *
   * @param source Routed input kind.
   * @param local Mouse coordinate translated into the widget, or `null` for keyboard input.
   */
  acted(source: ActionSource, local: string | null): void;
}

/** Focusable reactive meter used to demonstrate the complete custom-leaf contract. */
class AnatomyMeter extends View {
  public override focusable = true;

  /**
   * @param value Writable lesson value.
   * @param evidence Observer for real measure, draw, and handled-input callbacks.
   */
  public constructor(
    protected readonly value: Signal<number>,
    protected readonly evidence: MeterEvidence,
  ) {
    super();
    this.onMount(() => this.bind(() => this.value()));
  }

  /** Advertise a bounded one-row natural size for auto layout. */
  public override measure(available: Size2D): Size2D {
    const size = {
      width: Math.min(24, Math.max(0, available.width)),
      height: Math.min(1, Math.max(0, available.height)),
    };
    this.evidence.measured(size);
    return size;
  }

  /** Paint through local coordinates, semantic roles, and the active capability profile. */
  public override draw(ctx: DrawContext): void {
    this.evidence.drawn();
    const role = this.state.focused ? 'buttonFocused' : 'button';
    const style = ctx.color(role);
    const marker = this.state.focused ? '>' : ' ';
    const glyph = ctx.caps.glyphs.halfBlocks ? '█' : '#';
    ctx.fill(' ', style);
    ctx.text(0, 0, `${marker} ${glyph} value ${this.value()}`, style);
    ctx.text(ctx.size.width + 2, 0, 'outside', style);
  }

  /** Increment for a focused Right/Enter key or local mouse-down and consume the owned event. */
  public override onEvent(event: DispatchEvent): void {
    const input = event.event;
    const keyboard = input.type === 'key' && (input.key === 'right' || input.key === 'enter');
    const mouse = input.type === 'mouse' && input.kind === 'down' && event.local !== undefined;
    if (!keyboard && !mouse) return;
    this.value.update((current) => current + 1);
    this.evidence.acted(mouse ? 'mouse' : 'keyboard', mouse ? `${event.local?.x},${event.local?.y}` : null);
    event.handled = true;
  }
}

/** Narrow leaf that deliberately writes backward into an already-painted adjacent sibling. */
class ClippingProbe extends View {
  /** Fill the legal region, then attempt an out-of-bounds write. */
  public override draw(ctx: DrawContext): void {
    ctx.fill('.', ctx.color('staticText'));
    ctx.text(-1, 0, 'X', ctx.color('staticText'));
  }
}

/** Adjacent child whose cells must survive the clipping probe's in-buffer overflow attempt. */
class SentinelProbe extends View {
  /** Fill the complete sibling region with a stable sentinel. */
  public override draw(ctx: DrawContext): void {
    ctx.fill('S', ctx.color('staticText'));
  }
}

/** Prove child clipping by attempting to overwrite an adjacent in-buffer sibling. */
function clippedDrawPasses(): boolean {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const render = createRenderRoot({ width: 4, height: 1 }, { caps });
  render.mount(row(fixed(new SentinelProbe(), 2), fixed(new ClippingProbe(), 2)));
  const line =
    render
      .buffer()
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('') ?? '';
  render.unmount();
  return line === 'SS..';
}

/**
 * Teaches natural measurement, local clipped drawing, focus, reactive repaint, and handled input.
 */
export class WidgetAnatomyPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Widget anatomy';

  /** Number of real intrinsic-measure calls made by the live custom widget. */
  public measurements = 0;

  /** Number of real draw calls made by the live custom widget. */
  public draws = 0;

  /** Number of handled keyboard actions. */
  public keyboardActions = 0;

  /** Number of handled actions reached from the mouse button. */
  public mouseActions = 0;

  /** Total number of actions consumed by the custom widget. */
  public handledEvents = 0;

  /** Number of completed panel cleanups. */
  public cleanupCount = 0;

  /** Focusable leaf that the example initially focuses. */
  public readonly meter: AnatomyMeter;

  protected readonly value = signal(1);
  protected readonly lastMeasure = signal('pending');
  protected readonly eventState = signal('waiting');
  protected readonly actionSource = signal<ActionSource | 'ready'>('ready');
  protected readonly mouseLocalState = signal('none');
  protected readonly clipped = clippedDrawPasses();

  /** Last local coordinate produced by routed mouse hit-testing, or `null` before a mouse action. */
  public lastMouseLocal: string | null = null;

  /** Build the anatomy evidence surface and its mounted owner. */
  public constructor() {
    super();
    this.meter = new AnatomyMeter(this.value, {
      measured: (size) => {
        this.measurements += 1;
        this.lastMeasure.set(`${size.width}x${size.height}`);
      },
      drawn: () => {
        this.draws += 1;
      },
      acted: (source, local) => {
        this.handledEvents += 1;
        if (source === 'keyboard') this.keyboardActions += 1;
        else {
          this.mouseActions += 1;
          this.lastMouseLocal = local;
          this.mouseLocalState.set(local ?? 'missing');
        }
        this.eventState.set('handled');
        this.actionSource.set(source);
      },
    });

    this.add(row(this.meter));
    this.add(
      new Text(
        () =>
          `Measure: ${this.lastMeasure() === 'pending' ? 'pass' : this.lastMeasure()} · Clipped draw: ${this.clipped ? 'pass' : 'FAIL'}`,
      ),
    );
    this.add(new Text(() => `Draw: ${this.draws} · Reactive value: ${this.value()}`));
    this.add(
      new Text(() => {
        this.meter.focusSignal()();
        return `Focus: ${this.meter.state.focused ? 'yes · visible > cue' : 'no'} · Event: ${this.eventState()}`;
      }),
    );
    this.add(
      new Text(() => `Action source: ${this.actionSource()} · Local: ${this.mouseLocalState()} · non-colour text cue`),
    );
    this.add(new Text('Right/Enter changes the same signal as the mouse action.'));
    this.setLayout({ direction: 'col' });
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }
}
