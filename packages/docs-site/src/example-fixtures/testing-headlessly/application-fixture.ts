import { createLogger, resolveCapabilities } from '@jsvision/core';
import type { Logger } from '@jsvision/core';
import {
  Group,
  Text,
  View,
  at,
  createApplication,
  createKeymap,
  createRenderRoot,
  fixed,
  row,
  signal,
} from '@jsvision/ui';
import type { Application, DispatchEvent, DrawContext, Signal, Size2D } from '@jsvision/ui';

/** Stable command used by both the fixture keymap and application handler. */
export const HEADLESS_SAVE_COMMAND = 'testing-headlessly.save';

/** Focusable leaf whose rendered cells derive from genuinely routed input. */
export class HeadlessActionView extends View {
  public override focusable = true;

  /**
   * @param count Shared action count rendered by the leaf.
   * @param record Records a routed input kind and optional local coordinate.
   */
  public constructor(
    protected readonly count: Signal<number>,
    protected readonly record: (route: string) => void,
  ) {
    super();
    this.onMount(() => this.bind(() => this.count()));
  }

  /** Advertise a bounded natural row for direct event-loop tests. */
  public override measure(available: Size2D): Size2D {
    return { width: Math.min(14, available.width), height: Math.min(1, available.height) };
  }

  /** Paint exact focus and action evidence with semantic theme roles. */
  public override draw(ctx: DrawContext): void {
    const style = ctx.color(this.state.focused ? 'buttonFocused' : 'button');
    ctx.fill(' ', style);
    ctx.text(0, 0, `${this.state.focused ? '>' : ' '} Count:${this.count()}`, style);
  }

  /** Consume the owned X key or local mouse-down after recording its real routed provenance. */
  public override onEvent(event: DispatchEvent): void {
    const input = event.event;
    if (input.type === 'key' && input.key === 'x') {
      this.record('key:x');
      event.handled = true;
      return;
    }
    if (input.type === 'mouse' && input.kind === 'down' && event.local !== undefined) {
      this.record(`mouse:${event.local.x},${event.local.y}`);
      event.handled = true;
    }
  }
}

/** Application body exposing state that tests can compare with exact rendered cells. */
export class HeadlessFixturePanel extends Group {
  /** Number of routed key and mouse actions. */
  public routedActions = 0;

  /** Number of application commands accepted by the real command registry. */
  public commandActions = 0;

  /** Number of times mounted panel ownership has been released. */
  public cleanupCount = 0;

  /** Last route observed by the action view. */
  public lastRoute = 'ready';

  /** Focusable input target mounted at a stable screen coordinate. */
  public readonly actionView: HeadlessActionView;

  protected readonly count = signal(0);
  protected readonly route = signal('ready');
  protected readonly commands = signal(0);

  /** Build a deterministic application body with exact cell anchors. */
  public constructor() {
    super();
    this.actionView = new HeadlessActionView(this.count, (route) => {
      this.routedActions += 1;
      this.lastRoute = route;
      this.count.update((current) => current + 1);
      this.route.set(route);
    });
    this.add(at(this.actionView, 2, 1, 14, 1));
    this.add(at(new Text(() => `Route:${this.route()}`), 2, 2, 20, 1));
    this.add(at(new Text(() => `Command:${this.commands()}`), 2, 3, 20, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.cleanupCount += 1;
      }),
    );
  }

  /** Record one command outcome through the same reactive frame evidence as routed input. */
  public recordCommand(): void {
    this.commandActions += 1;
    this.commands.set(this.commandActions);
  }
}

/** Options controlling the deterministic application fixture. */
export interface HeadlessFixtureOptions {
  /** Explicit cell viewport; defaults to 24×6. */
  readonly viewport?: Size2D;
}

/** Mounted application fixture returned to the authentic Vitest artifact. */
export interface HeadlessApplicationFixture {
  /** Real host-neutral JSVision application. */
  readonly app: Application;
  /** Mounted application body and its observable state. */
  readonly panel: HeadlessFixturePanel;
  /** Convert the current composed buffer into exact fixed-width rows. */
  readonly frameLines: () => readonly string[];
  /** Idempotently release commands, the event loop, and mounted view ownership. */
  readonly dispose: () => void;
}

/**
 * Build one isolated application fixture with fixed capabilities, viewport, keymap, and cleanup.
 *
 * @param options Optional deterministic viewport override.
 * @returns A mounted application, observable panel, frame reader, and idempotent disposer.
 * @example
 * const fixture = createHeadlessApplicationFixture();
 * fixture.app.loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
 * fixture.dispose();
 */
export function createHeadlessApplicationFixture(options: HeadlessFixtureOptions = {}): HeadlessApplicationFixture {
  const caps = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: {
      colorDepth: 'truecolor',
      unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'narrow' },
    },
  }).profile;
  const viewport = options.viewport ?? { width: 24, height: 6 };
  const panel = new HeadlessFixturePanel();
  const app = createApplication({
    caps,
    content: panel,
    viewport,
    keymap: createKeymap({ 'ctrl+s': HEADLESS_SAVE_COMMAND }),
  });
  const stopCommand = app.onCommand(HEADLESS_SAVE_COMMAND, () => panel.recordCommand());
  app.loop.focusView(panel.actionView);
  let disposed = false;

  return {
    app,
    panel,
    frameLines: () =>
      app.loop.renderRoot
        .buffer()
        .rows()
        .map((cells) => cells.map((cell) => cell.char).join('')),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopCommand();
      app.loop.dispose();
    },
  };
}

/** Exact observable result of an isolated draw failure. */
export interface HeadlessFailureEvidence {
  /** Complete bounded frame after the failing and healthy siblings draw. */
  readonly frame: string;
  /** Number of bounded diagnostics recorded by the real renderer logger. */
  readonly diagnostics: number;
  /** Whether the diagnostic avoided copying the thrown sensitive payload. */
  readonly redacted: boolean;
}

/** Leaf that throws a payload which must never be copied into learner-visible diagnostics. */
class ThrowingFixtureView extends View {
  /** Throw from the real draw boundary. */
  public override draw(): void {
    throw new Error('fixture-secret-payload');
  }
}

/** Healthy sibling that must remain visible after another child's draw fails. */
class HealthyFixtureView extends View {
  /** Paint a stable three-cell recovery marker. */
  public override draw(ctx: DrawContext): void {
    ctx.fill('G', ctx.color('staticText'));
  }
}

/**
 * Wrap a bounded logger so structured diagnostic values cannot copy application data.
 *
 * The renderer deliberately preserves the original error in a structured field. Applications
 * that may process sensitive values therefore need to redact at their logging boundary.
 */
function createRedactedRingLogger(): Logger {
  const ring = createLogger({ sink: 'ring', size: 4 });
  const redact = (fields?: Record<string, unknown>): Record<string, unknown> | undefined =>
    fields === undefined ? undefined : Object.fromEntries(Object.keys(fields).map((name) => [name, '[redacted]']));

  return {
    enabled: ring.enabled,
    debug: (component, msg, fields) => ring.debug(component, msg, redact(fields)),
    info: (component, msg, fields) => ring.info(component, msg, redact(fields)),
    warn: (component, msg, fields) => ring.warn(component, msg, redact(fields)),
    error: (component, msg, fields) => ring.error(component, msg, redact(fields)),
    entries: () => ring.entries(),
    close: () => ring.close(),
  };
}

/** Render one failing child beside a healthy sibling and return bounded observable evidence. */
export function renderHeadlessFailureEvidence(): HeadlessFailureEvidence {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const logger = createRedactedRingLogger();
  const render = createRenderRoot({ width: 6, height: 1 }, { caps, logger });
  render.mount(row(fixed(new ThrowingFixtureView(), 3), fixed(new HealthyFixtureView(), 3)));
  const frame =
    render
      .buffer()
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('') ?? '';
  const entries = logger.entries();
  render.unmount();
  return {
    frame,
    diagnostics: entries.length,
    redacted: !JSON.stringify(entries).includes('fixture-secret-payload'),
  };
}
