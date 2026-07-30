import type { BrowserKeyEvent, MountedApp, TerminalLike } from '@jsvision/web';
import { buildBrowserCaps, mountApp } from '@jsvision/web';
import { Group, Text, View, at, createApplication, signal } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';

/** Deterministic xterm-shaped terminal used only by the browser lifecycle lesson. */
class LessonTerminal {
  /** Structural terminal passed to `mountApp`. */
  public readonly term: TerminalLike;

  /** ANSI and text written by the real browser host. */
  public readonly writes: string[] = [];

  /** Number of optional focus calls. */
  public focusCount = 0;

  /** Number of terminal disposals. */
  public disposeCount = 0;

  protected dataHandler: ((data: string) => void) | undefined;
  protected resizeHandler: ((size: { cols: number; rows: number }) => void) | undefined;
  protected keyHandler: ((event: BrowserKeyEvent) => boolean) | undefined;

  /** Build the bounded terminal seam and its controllable subscriptions. */
  public constructor() {
    this.term = {
      write: (data) => this.writes.push(data),
      onData: (handler) => {
        this.dataHandler = handler;
        return { dispose: () => (this.dataHandler = undefined) };
      },
      onResize: (handler) => {
        this.resizeHandler = handler;
        return { dispose: () => (this.resizeHandler = undefined) };
      },
      attachCustomKeyEventHandler: (handler) => {
        this.keyHandler = handler;
      },
      focus: () => {
        this.focusCount += 1;
      },
      dispose: () => {
        this.disposeCount += 1;
        this.keyHandler = undefined;
      },
    };
  }

  /** Deliver terminal bytes through the real browser decoder. */
  public sendData(data: string): void {
    this.dataHandler?.(data);
  }

  /** Deliver terminal cell geometry through the real resize subscription. */
  public resize(cols: number, rows: number): void {
    this.resizeHandler?.({ cols, rows });
  }
}

/** Focusable nested-app view that records one decoded key without duplicating the decoder. */
class BrowserInputProbe extends View {
  /** Number of decoded key events routed to this focused view. */
  public keyEvents = 0;

  /** Make the probe a real focus and event target. */
  public constructor() {
    super();
    this.focusable = true;
  }

  /** Paint stable first-frame evidence into the in-memory terminal. */
  public override draw(context: DrawContext): void {
    context.text(0, 0, 'Browser probe');
  }

  /** Count decoded keys delivered by the mounted host. */
  public override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key') {
      this.keyEvents += 1;
      event.handled = true;
    }
  }
}

/**
 * Drives the real `mountApp` lifecycle over a deterministic terminal without nesting a DOM terminal.
 */
export class BrowserHostLifecyclePanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Browser host lifecycle';

  /** Number of real browser mounts created by the lesson. */
  public mounts = 0;

  /** Number of decoded input events observed by the nested application. */
  public inputEvents = 0;

  /** Number of terminal resize events delivered. */
  public resizeEvents = 0;

  /** Number of completed outer-panel cleanups. */
  public cleanupCount = 0;

  /** Number of nested terminals disposed across replacement, explicit close, and cleanup. */
  public hostDisposals = 0;

  /** Optional focus calls observed on the structural terminal. */
  public focusCalls = 0;

  /** Whether input retained after close was unable to reach the disposed loop. */
  public postDisposeInputInert = false;

  /** Whether resize retained after close was unable to change the disposed loop. */
  public postDisposeResizeInert = false;

  protected mountedHandle: MountedApp | null = null;
  protected terminal: LessonTerminal | null = null;
  protected probe: BrowserInputProbe | null = null;
  protected nestedApp: ReturnType<typeof createApplication> | null = null;
  protected readonly mountedState = signal('no');
  protected readonly paintState = signal('pending');
  protected readonly inputState = signal('not sent');
  protected readonly viewportState = signal('40x12');
  protected readonly hostState = signal('ready');
  protected readonly actionSource = signal('ready');

  /** Build the bounded lifecycle readout. */
  public constructor() {
    super();
    this.add(at(new Text(() => `Mounted: ${this.mountedState()} · Host: ${this.hostState()}`), 0, 0, 56, 1));
    this.add(at(new Text(() => `First paint: ${this.paintState()} · focus calls: ${this.focusCalls}`), 0, 1, 56, 1));
    this.add(at(new Text(() => `Decoded input: ${this.inputState()}`), 0, 2, 56, 1));
    this.add(at(new Text(() => `Viewport: ${this.viewportState()} · resize routes to loop`), 0, 3, 56, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()} · deterministic text status`), 0, 4, 56, 1));
    this.onMount(() =>
      this.onCleanup(() => {
        this.disposeNested();
        this.cleanupCount += 1;
      }),
    );
  }

  /** Mount one unchanged nested application through the public browser runtime. */
  public mountHost(source: 'keyboard' | 'mouse'): void {
    this.disposeNested();
    const caps = buildBrowserCaps();
    const probe = new BrowserInputProbe();
    const app = createApplication({ caps, viewport: { width: 40, height: 12 }, content: probe });
    app.loop.focusView(probe);
    const terminal = new LessonTerminal();
    this.mountedHandle = mountApp({ element: { tagName: 'DIV' }, app, caps, term: terminal.term });
    this.terminal = terminal;
    this.probe = probe;
    this.nestedApp = app;
    this.mounts += 1;
    this.focusCalls = terminal.focusCount;
    this.mountedState.set('yes');
    this.hostState.set('active');
    this.paintState.set(terminal.writes.join('').includes('Browser probe') ? 'pass' : 'FAIL');
    this.actionSource.set(source);
  }

  /** Send an up-arrow byte sequence through the public browser host decoder. */
  public sendInput(source: 'keyboard' | 'mouse'): void {
    this.terminal?.sendData('\x1b[A');
    this.inputEvents = this.probe?.keyEvents ?? 0;
    this.inputState.set(this.inputEvents > 0 ? 'up · pass' : 'not mounted');
    this.actionSource.set(source);
  }

  /** Resize the mounted terminal and observe the nested loop's resulting buffer. */
  public resizeHost(source: 'keyboard' | 'mouse'): void {
    this.terminal?.resize(52, 15);
    if (this.nestedApp !== null) {
      this.resizeEvents += 1;
      this.viewportState.set(
        `${this.nestedApp.loop.renderRoot.buffer().width}x${this.nestedApp.loop.renderRoot.buffer().height}`,
      );
    }
    this.actionSource.set(source);
  }

  /** Dispose the mounted loop, resize subscription, and terminal. */
  public disposeHost(source: 'keyboard' | 'mouse'): void {
    const hadTerminal = this.terminal !== null;
    this.disposeNested();
    this.mountedState.set('no');
    if (!hadTerminal) this.hostState.set('disposed · no active terminal');
    this.actionSource.set(source);
  }

  /** Release the current nested mount exactly once. */
  protected disposeNested(): void {
    const terminal = this.terminal;
    const probe = this.probe;
    const app = this.nestedApp;
    const keysBefore = probe?.keyEvents ?? 0;
    const sizeBefore =
      app === null ? null : { width: app.loop.renderRoot.buffer().width, height: app.loop.renderRoot.buffer().height };
    this.mountedHandle?.dispose();
    if (terminal !== null) {
      this.hostDisposals += terminal.disposeCount;
      terminal.sendData('\x1b[A');
      terminal.resize(70, 20);
      this.postDisposeInputInert = (probe?.keyEvents ?? 0) === keysBefore;
      this.postDisposeResizeInert =
        app !== null &&
        sizeBefore !== null &&
        app.loop.renderRoot.buffer().width === sizeBefore.width &&
        app.loop.renderRoot.buffer().height === sizeBefore.height;
      this.inputState.set(this.postDisposeInputInert ? 'post-dispose inert · pass' : 'FAIL after dispose');
      this.viewportState.set(
        this.postDisposeResizeInert ? `${sizeBefore?.width ?? 0}x${sizeBefore?.height ?? 0} · resize inert` : 'FAIL',
      );
      this.hostState.set(`disposed · terminal ${terminal.disposeCount}`);
    }
    this.mountedHandle = null;
    this.terminal = null;
    this.probe = null;
    this.nestedApp = null;
  }
}
