import { resolveCapabilities } from '@jsvision/core';
import { Group, Text, View, at, createEventLoop, createRenderRoot, fixed, row, signal } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';

type ActionSource = 'keyboard' | 'mouse';

/** Deterministic deferred scheduler used to distinguish repaint from reflow. */
function capturingScheduler(): {
  readonly schedule: (flush: () => void) => void;
  readonly run: () => void;
} {
  let pending: (() => void) | null = null;
  return {
    schedule: (flush) => {
      pending = flush;
    },
    run: () => {
      const flush = pending;
      pending = null;
      flush?.();
    },
  };
}

/** Small measurable leaf that exposes its real draw count. */
class DrawProbe extends View {
  /** Number of completed paints. */
  public draws = 0;

  /** @param glyph One-cell evidence glyph. */
  public constructor(protected readonly glyph: string) {
    super();
  }

  /** Advertise a bounded two-cell natural size. */
  public override measure(available: Size2D): Size2D {
    return { width: Math.min(2, available.width), height: Math.min(1, available.height) };
  }

  /** Paint within the assigned buffer and count the draw. */
  public override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill(this.glyph, ctx.color('staticText'));
  }
}

/** Resource-owning leaf that visibly marks its mounted position and reports exact cleanup. */
class OwnedProbe extends View {
  /**
   * @param glyph One-cell ownership marker.
   * @param release Records release in the parent-owned lesson state.
   */
  public constructor(
    protected readonly glyph: string,
    protected readonly release: () => void,
  ) {
    super();
    this.onMount(() => this.onCleanup(this.release));
  }

  /** Paint the ownership marker. */
  public override draw(ctx: DrawContext): void {
    ctx.fill(this.glyph, ctx.color('staticText'));
  }
}

/** Draw a capability-selected mark after attempting to overwrite an earlier sibling. */
class CapabilityProbe extends View {
  /** Paint the selected mark and attempt a clipped overflow. */
  public override draw(ctx: DrawContext): void {
    const glyph = ctx.caps.glyphs.halfBlocks ? '█' : '#';
    ctx.fill('.', ctx.color('staticText'));
    ctx.text(0, 0, glyph, ctx.color('staticText'));
    ctx.text(-1, 0, 'X', ctx.color('staticText'));
  }
}

/** Adjacent child whose sentinel proves overflow cannot cross a child clipping boundary. */
class SentinelProbe extends View {
  /** Fill the complete sibling region with a stable marker. */
  public override draw(ctx: DrawContext): void {
    ctx.fill('S', ctx.color('staticText'));
  }
}

/** Convert the first buffer row to plain text. */
function firstLine(render: ReturnType<typeof createRenderRoot>): string {
  return (
    render
      .buffer()
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('') ?? ''
  );
}

/** Run the real subtree invalidation paths and return their observed sibling draw behavior. */
function repaintAndReflowEvidence(): { readonly repaintLocal: boolean; readonly reflowFull: boolean } {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const first = new DrawProbe('A');
  const second = new DrawProbe('B');
  const root = row(fixed(first, 2), fixed(second, 2));
  const scheduler = capturingScheduler();
  const render = createRenderRoot({ width: 4, height: 1 }, { caps, schedule: scheduler.schedule });
  render.mount(root);
  const initialFirst = first.draws;
  const initialSecond = second.draws;
  first.invalidate();
  scheduler.run();
  const repaintLocal = first.draws > initialFirst && second.draws === initialSecond;
  first.invalidateLayout();
  scheduler.run();
  const reflowFull = second.draws > initialSecond;
  render.unmount();
  return { repaintLocal, reflowFull };
}

/** Prove bounded clipping and both capability-selected marks through real buffers. */
function capabilityEvidence(): {
  readonly clipping: boolean;
  readonly unicode: boolean;
  readonly ascii: boolean;
} {
  const unicodeCaps = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { glyphs: { halfBlocks: true }, unicode: { utf8: true } },
  }).profile;
  const unicode = createRenderRoot({ width: 4, height: 1 }, { caps: unicodeCaps });
  unicode.mount(row(fixed(new SentinelProbe(), 2), fixed(new CapabilityProbe(), 2)));
  const unicodeText = firstLine(unicode);
  unicode.unmount();

  const asciiCaps = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { glyphs: { halfBlocks: false }, unicode: { utf8: false } },
  }).profile;
  const ascii = createRenderRoot({ width: 4, height: 1 }, { caps: asciiCaps });
  ascii.mount(row(fixed(new SentinelProbe(), 2), fixed(new CapabilityProbe(), 2)));
  const asciiText = firstLine(ascii);
  ascii.unmount();

  return {
    clipping: unicodeText === 'SS█.' && asciiText === 'SS#.',
    unicode: unicodeText === 'SS█.',
    ascii: asciiText === 'SS#.',
  };
}

/** Prove mounting, focus, handled input, bounded output, and cleanup without a terminal. */
function headlessEvidence(): boolean {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  let cleaned = 0;
  const probe = new OwnedProbe('H', () => {
    cleaned += 1;
  });
  probe.focusable = true;
  const loop = createEventLoop({ width: 4, height: 1 }, { caps });
  loop.mount(row(fixed(probe, 4)));
  loop.focusView(probe);
  const focused = loop.getFocused() === probe;
  const bounded = loop.renderRoot.buffer().width === 4 && firstLine(loop.renderRoot).includes('H');
  loop.dispose();
  return focused && bounded && cleaned === 1;
}

/**
 * Demonstrates responsive parent ownership and independently observed render, layout, clipping,
 * capability, headless, and cleanup behavior.
 */
export class WidgetCompositionPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Widget composition and evidence';

  /** Number of completed local-repaint checks. */
  public repaintChecks = 0;

  /** Number of completed full-reflow checks. */
  public reflowChecks = 0;

  /** Number of completed bounded-clipping checks. */
  public clippingChecks = 0;

  /** Number of completed Unicode/ASCII capability checks. */
  public capabilityChecks = 0;

  /** Number of released mounted owners. */
  public cleanupCount = 0;

  protected readonly repaintState = signal('not run');
  protected readonly reflowState = signal('not run');
  protected readonly clippingState = signal('not run');
  protected readonly capabilityState = signal('not run');
  protected readonly headlessState = signal('not run');
  protected readonly actionSource = signal<ActionSource | 'ready'>('ready');

  /** Build the composition evidence surface with two resource-owning children. */
  public constructor() {
    super();
    this.add(new Text('Viewport: bounded · Ownership: mounted'));
    this.add(new Text(() => `Repaint: ${this.repaintState()} · Sibling draws: unchanged`));
    this.add(new Text(() => `Reflow: ${this.reflowState()} · Sibling draws: changed`));
    this.add(new Text(() => `Clipping: ${this.clippingState()} · Overflow: none`));
    this.add(new Text(() => `Unicode: █ · ASCII: # · Meaning: ${this.capabilityState()}`));
    this.add(new Text(() => `Headless: ${this.headlessState()} · Action source: ${this.actionSource()}`));
    this.add(at(new OwnedProbe('1', () => (this.cleanupCount += 1)), 52, 0, 2, 1));
    this.add(at(new OwnedProbe('2', () => (this.cleanupCount += 1)), 54, 0, 2, 1));
    this.setLayout({ direction: 'col' });
  }

  /** Verify a subtree repaint without redrawing its sibling. */
  public checkRepaint(source: ActionSource): void {
    const evidence = repaintAndReflowEvidence();
    this.repaintChecks += 1;
    this.repaintState.set(evidence.repaintLocal ? 'local' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Verify that layout invalidation measures and recomposes the complete sibling run. */
  public checkReflow(source: ActionSource): void {
    const evidence = repaintAndReflowEvidence();
    this.reflowChecks += 1;
    this.reflowState.set(evidence.reflowFull ? 'full' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Verify that out-of-bounds writes never reach the bounded buffer. */
  public checkClipping(source: ActionSource): void {
    const evidence = capabilityEvidence();
    this.clippingChecks += 1;
    this.clippingState.set(evidence.clipping ? 'pass' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Verify same-meaning Unicode and ASCII marks through separate capability profiles. */
  public checkCapabilities(source: ActionSource): void {
    const evidence = capabilityEvidence();
    this.capabilityChecks += 1;
    this.capabilityState.set(evidence.unicode && evidence.ascii ? 'same' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Run a bounded public render/event-loop ownership check. */
  public checkHeadless(source: ActionSource): void {
    this.headlessState.set(headlessEvidence() ? 'pass' : 'FAIL');
    this.actionSource.set(source);
  }
}
