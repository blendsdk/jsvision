import { Group, Spinner, Text, at, signal } from '@jsvision/ui';

/** Input route reported without relying on colour. */
export type LatestResultActionSource = 'ready' | 'keyboard' | 'mouse';

/** One deterministic request generation retained until completion or cancellation. */
interface PendingRequest {
  /** Stable request identifier. */
  readonly id: number;
  /** Generation captured when the request started. */
  readonly generation: number;
  /** Cooperative cancellation owner. */
  readonly controller: AbortController;
}

/**
 * Demonstrates latest-result-wins publication with deliberately out-of-order completions.
 */
export class LatestResultPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Latest result wins';

  /** Number of deterministic requests created. */
  public requestedRuns = 0;

  /** Number of newest results allowed to publish. */
  public publishedRuns = 0;

  /** Number of older completions rejected by their generation guard. */
  public staleDrops = 0;

  /** Number of explicit pending-generation cancellations. */
  public cancelledRuns = 0;

  /** Number of pending request controllers that received an abort signal. */
  public abortedRuns = 0;

  /** Number of request controllers released exactly once. */
  public cleanupCount = 0;

  /** Human-readable request identities for the current pair. */
  protected readonly requested = signal('none');

  /** Latest stale identity discarded. */
  protected readonly dropped = signal('none');

  /** Latest identity allowed to publish. */
  protected readonly published = signal('none');

  /** Number of request controllers still owned. */
  protected readonly pendingCount = signal(0);

  /** Current workflow status. */
  protected readonly status = signal('idle');

  /** Most recent input route. */
  protected readonly actionSource = signal<LatestResultActionSource>('ready');

  /** Caller-driven busy frame. */
  protected readonly frame = signal(0);

  /** Reactive invalidation token for public ownership counters. */
  protected readonly ownershipVersion = signal(0);

  /** Monotonic generation used to reject stale completions. */
  protected generation = 0;

  /** Pending deterministic requests by identity. */
  protected readonly pending = new Map<number, PendingRequest>();

  /** Create the readout and invalidate all pending generations when the panel unmounts. */
  public constructor() {
    super();
    this.add(at(new Text(() => `Requested: ${this.requested()}`), 0, 0, 62, 1));
    this.add(at(new Text(() => `Dropped stale: ${this.dropped()}`), 0, 1, 62, 1));
    this.add(at(new Text(() => `Published: ${this.published()}`), 0, 2, 62, 1));
    this.add(at(new Text(() => `Pending: ${this.pendingCount()}`), 0, 3, 62, 1));
    this.add(at(new Text(() => `State: ${this.status()}`), 0, 4, 62, 1));
    this.add(
      at(
        new Text(() => {
          this.ownershipVersion();
          return `Ownership: aborted ${this.abortedRuns} · cleaned ${this.cleanupCount}`;
        }),
        0,
        5,
        62,
        1,
      ),
    );
    this.add(
      at(
        new Spinner({
          frame: this.frame,
          preset: 'line',
          label: () => (this.pendingCount() > 0 ? 'requests pending' : this.status()),
        }),
        0,
        6,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 7, 62, 1));
    this.onMount(() => {
      this.onCleanup(() => {
        this.generation += 1;
        this.releaseAll(true);
      });
    });
  }

  /** Start two generations whose completions can be delivered newest-first. */
  public requestPair(source: Exclude<LatestResultActionSource, 'ready'>): void {
    this.generation += 1;
    this.releaseAll(true);
    const older = this.createRequest();
    const newer = this.createRequest();
    this.requested.set(`${older.id}, ${newer.id}`);
    this.dropped.set('none');
    this.published.set('none');
    this.status.set('running');
    this.actionSource.set(source);
  }

  /** Complete the newest pending request and publish it through the generation guard. */
  public completeNewest(source: Exclude<LatestResultActionSource, 'ready'>): void {
    const newest = [...this.pending.values()].at(-1);
    if (newest === undefined) return;
    this.complete(newest, source);
  }

  /** Complete the oldest pending request, which should now be stale. */
  public completeOlder(source: Exclude<LatestResultActionSource, 'ready'>): void {
    const older = this.pending.values().next().value;
    if (older === undefined) return;
    this.complete(older, source);
  }

  /** Invalidate the current generation and cooperatively release every pending request. */
  public cancelPending(source: Exclude<LatestResultActionSource, 'ready'>): void {
    if (this.pending.size === 0) return;
    this.generation += 1;
    this.cancelledRuns += 1;
    this.releaseAll(true);
    this.status.set('cancelled · pending invalidated');
    this.actionSource.set(source);
  }

  /** Create one request whose generation becomes the latest authoritative result. */
  protected createRequest(): PendingRequest {
    const id = this.requestedRuns + 1;
    this.requestedRuns = id;
    const request = {
      id,
      generation: ++this.generation,
      controller: new AbortController(),
    };
    this.pending.set(id, request);
    this.pendingCount.set(this.pending.size);
    this.frame.update((current) => current + 1);
    return request;
  }

  /** Deliver one deterministic completion through the same guard used for real host results. */
  protected complete(request: PendingRequest, source: Exclude<LatestResultActionSource, 'ready'>): void {
    if (!this.pending.has(request.id)) return;
    this.release(request, false);
    if (request.controller.signal.aborted || request.generation !== this.generation) {
      this.staleDrops += 1;
      this.dropped.set(String(request.id));
      this.status.set('stale completion ignored');
    } else {
      this.publishedRuns += 1;
      this.published.set(String(request.id));
      this.status.set('newest result published');
    }
    this.actionSource.set(source);
    this.frame.update((current) => current + 1);
  }

  /** Release one request controller and increment cleanup only for its first release. */
  protected release(request: PendingRequest, abort: boolean): void {
    if (!this.pending.delete(request.id)) return;
    if (abort && !request.controller.signal.aborted) {
      request.controller.abort();
      this.abortedRuns += 1;
    }
    this.cleanupCount += 1;
    this.ownershipVersion.update((current) => current + 1);
    this.pendingCount.set(this.pending.size);
  }

  /** Release every currently pending request. */
  protected releaseAll(abort: boolean): void {
    for (const request of [...this.pending.values()]) this.release(request, abort);
  }
}
