import { Group, ProgressBar, Spinner, Text, at, signal } from '@jsvision/ui';

/** Learner-visible work states used by the deterministic cancellation laboratory. */
export type CancellableWorkState = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

/** Input route reported without relying on colour. */
export type CancellableWorkActionSource = 'ready' | 'keyboard' | 'mouse';

/**
 * Models one cooperative job with bounded progress, explicit cancellation, and exact cleanup.
 *
 * The fixture advances only when the learner asks it to, so tests and browser visitors never
 * depend on wall-clock timing or a privileged host service.
 */
export class CancellableWorkPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Cancellable work';

  /** Number of fresh job attempts started. */
  public startedRuns = 0;

  /** Number of jobs that published success. */
  public completedRuns = 0;

  /** Number of jobs ended through cooperative cancellation. */
  public cancelledRuns = 0;

  /** Number of jobs ended through the deterministic failure route. */
  public failedRuns = 0;

  /** Number of ordinary input events handled while work was pending. */
  public get inputTicks(): number {
    return this.heartbeatCount();
  }

  /** Number of owned controllers released by completion, cancellation, failure, or unmount. */
  public cleanupCount = 0;

  /** Current work state. */
  protected readonly workState = signal<CancellableWorkState>('idle');

  /** Current determinate progress in `[0, 1]`. */
  protected readonly progress = signal(0);

  /** Caller-driven spinner frame. */
  protected readonly frame = signal(0);

  /** Reactive heartbeat count proving input remains available during work. */
  protected readonly heartbeatCount = signal(0);

  /** Whether the current attempt was allowed to publish success. */
  protected readonly publishedSuccess = signal(false);

  /** Whether Retry is meaningful for the current state. */
  protected readonly retryState = signal('unavailable');

  /** Most recent input route. */
  protected readonly actionSource = signal<CancellableWorkActionSource>('ready');

  /** Bounded diagnostic text for the current state. */
  protected readonly diagnostic = signal('none');

  /** Controller owned by the current attempt, or `null` when no work is active. */
  protected controller: AbortController | null = null;

  /** Build the deterministic work-state readout and own any still-active attempt on unmount. */
  public constructor() {
    super();
    const readout = [
      at(new Text(() => `State: ${this.workState()}`), 0, 0, 62, 1),
      at(new Text(() => `Progress: ${Math.round(this.progress() * 100)}%`), 0, 1, 62, 1),
      at(new Text(() => `Heartbeat: ${this.inputTicks} · responsive input`), 0, 2, 62, 1),
      at(new Text(() => `Published success: ${this.publishedSuccess() ? 'yes' : 'no'}`), 0, 3, 62, 1),
      at(new Text(() => `Retry: ${this.retryState()}`), 0, 4, 62, 1),
      at(new Text(() => `Diagnostic: ${this.diagnostic()}`), 0, 5, 62, 1),
      at(
        new ProgressBar({
          value: this.progress,
          caption: true,
          label: () => this.workState(),
          labelPosition: 'left',
        }),
        0,
        6,
        62,
        1,
      ),
      at(
        new Spinner({
          frame: this.frame,
          preset: 'dots',
          label: () => (this.workState() === 'running' ? 'cooperative work pending' : this.workState()),
        }),
        0,
        7,
        62,
        1,
      ),
      at(new Text(() => `Action source: ${this.actionSource()}`), 0, 8, 62, 1),
    ];
    for (const child of readout) this.add(child);
    this.onMount(() => {
      this.onCleanup(() => this.releaseAttempt(true));
    });
  }

  /** Start a fresh attempt with a new controller and reset all per-attempt output. */
  public start(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    this.releaseAttempt(true);
    this.controller = new AbortController();
    this.startedRuns += 1;
    this.workState.set('running');
    this.progress.set(0);
    this.frame.set(0);
    this.publishedSuccess.set(false);
    this.retryState.set('unavailable');
    this.diagnostic.set('none');
    this.actionSource.set(source);
  }

  /** Advance one deterministic chunk while leaving normal input dispatch responsive. */
  public advance(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    if (this.workState.peek() !== 'running' || this.controller?.signal.aborted !== false) return;
    const next = Math.min(1, this.progress.peek() + 0.25);
    this.progress.set(next);
    this.frame.update((current) => current + 1);
    this.actionSource.set(source);
    if (next === 1) {
      this.completedRuns += 1;
      this.publishedSuccess.set(true);
      this.workState.set('success');
      this.releaseAttempt(false);
    }
  }

  /** Abort the current attempt; an aborted attempt can never publish success. */
  public cancel(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    if (this.workState.peek() !== 'running') return;
    this.controller?.abort();
    this.cancelledRuns += 1;
    this.workState.set('cancelled');
    this.publishedSuccess.set(false);
    this.retryState.set('available');
    this.diagnostic.set('cancelled cooperatively');
    this.actionSource.set(source);
    this.releaseAttempt(false);
  }

  /** End the current attempt through a bounded, recoverable failure. */
  public fail(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    if (this.workState.peek() !== 'running') return;
    this.failedRuns += 1;
    this.workState.set('error');
    this.publishedSuccess.set(false);
    this.retryState.set('available');
    this.diagnostic.set('simulated failure (no payload)');
    this.actionSource.set(source);
    this.releaseAttempt(true);
  }

  /** Start a fresh controller and generation after a cancelled or failed attempt. */
  public retry(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    if (this.retryState.peek() !== 'available') return;
    this.start(source);
  }

  /** Record ordinary input handled while an asynchronous attempt remains active. */
  public heartbeat(source: Exclude<CancellableWorkActionSource, 'ready'>): void {
    if (this.workState.peek() !== 'running') return;
    this.heartbeatCount.update((current) => current + 1);
    this.frame.update((current) => current + 1);
    this.actionSource.set(source);
  }

  /**
   * Release the current controller exactly once.
   *
   * @param abort Whether unfinished work must receive an abort signal before release.
   */
  protected releaseAttempt(abort: boolean): void {
    const current = this.controller;
    if (current === null) return;
    if (abort && !current.signal.aborted) current.abort();
    this.controller = null;
    this.cleanupCount += 1;
  }
}
