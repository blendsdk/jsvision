import { createForm } from '@jsvision/forms';
import { Group, Text, at, signal } from '@jsvision/ui';
import { z } from 'zod';

/** Input route reported without relying on colour. */
export type FormAsyncActionSource = 'ready' | 'keyboard' | 'mouse';

interface ManualValidation {
  /** Stable learner-visible run identity. */
  readonly id: number;
  /** Value checked by this run. */
  readonly value: string;
  /** Cooperative cancellation owner. */
  readonly controller: AbortController;
  /** Resolve the real pending Promise for this generation. */
  readonly resolve: (message: string | null) => void;
  /** Whether the Promise still accepts a learner-controlled settlement. */
  pending: boolean;
  /** Whether its Promise continuation has already run. */
  completed: boolean;
}

interface ControlledRun {
  /** Resolve the pending availability verdict. */
  readonly resolve: (message: string | null) => void;
  /** Whether the real form validator is still awaiting a verdict. */
  pending: boolean;
}

interface ControlledPersistence {
  /** Resolve the pending persistence attempt. */
  readonly resolve: () => void;
  /** Reject the pending persistence attempt. */
  readonly reject: (reason: unknown) => void;
}

/**
 * Demonstrates deterministic supersession and a real forced-validation submit gate.
 */
export class FormAsyncSubmitPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Async form submission';

  /** Number of manual and store-owned validator invocations. */
  public validationRuns = 0;

  /** Number of validators that observed cooperative abort. */
  public abortedValidations = 0;

  /** Number of settled manual generations rejected as stale. */
  public staleValidationResults = 0;

  /** Number of settled manual generations accepted as current. */
  public acceptedValidationResults = 0;

  /** Number of settled successful persistence attempts. */
  public successfulSubmissions = 0;

  /** Number of settled failed persistence attempts. */
  public failedSubmissions = 0;

  /** Number of panel-owned cleanup executions. */
  public cleanupCount = 0;

  /** Current deterministic workflow result. */
  protected readonly result = signal('idle');

  /** Current value or generation label. */
  protected readonly currentValue = signal('none');

  /** Manual validation activity. */
  protected readonly manualValidating = signal(false);

  /** Persistence activity. */
  protected readonly persistenceState = signal('none');

  /** Retry availability. */
  protected readonly retryState = signal('unavailable');

  /** Whether the next persistence attempt should reject. */
  protected readonly failNextPersistence = signal(false);

  /** Most recent input route. */
  protected readonly actionSource = signal<FormAsyncActionSource>('ready');

  /** Reactive invalidation token for public counters. */
  protected readonly counterVersion = signal(0);

  /** All manual generations retained so their out-of-order settlement is observable. */
  protected readonly manualRuns: ManualValidation[] = [];

  /** Currently authoritative manual validation. */
  protected manualCurrent: ManualValidation | null = null;

  /** Controlled async-validator invocations made by the real form store. */
  protected readonly controlledRuns: ControlledRun[] = [];

  /** Current controlled persistence attempt. */
  protected persistence: ControlledPersistence | null = null;

  /** Whether asynchronous continuations may still publish into this mounted lesson. */
  protected active = true;

  /** Real headless form used for forced validation and submit/persistence behavior. */
  protected readonly form = createForm({
    schema: z.object({ username: z.string().min(3) }),
    initial: { username: 'available' },
    asyncValidators: {
      username: (_value, { signal: abortSignal }) => {
        this.validationRuns += 1;
        this.observeAbort(abortSignal);
        return new Promise<string | null>((resolve) => {
          this.controlledRuns.push({ resolve, pending: true });
          this.counterVersion.update((current) => current + 1);
        });
      },
    },
  });

  /** Build the complete non-colour async-state readout and own teardown. */
  public constructor() {
    super();
    this.add(
      at(
        new Text(
          () =>
            `Current: ${this.currentValue()} · Validating: ${
              this.manualValidating() || this.form.validating() ? 'yes' : 'no'
            }`,
        ),
        0,
        0,
        62,
        1,
      ),
    );
    this.add(
      at(
        new Text(
          () =>
            `Submitting: ${this.form.submitting() ? 'yes' : 'no'} · Validating: ${
              this.manualValidating() || this.form.validating() ? 'yes' : 'no'
            }`,
        ),
        0,
        1,
        62,
        1,
      ),
    );
    this.add(at(new Text(() => `Result: ${this.result()}`), 0, 2, 62, 1));
    this.add(at(new Text(() => `Persistence: ${this.persistenceState()}`), 0, 3, 62, 1));
    this.add(at(new Text(() => `Next persistence: ${this.failNextPersistence() ? 'fail' : 'succeed'}`), 0, 4, 62, 1));
    this.add(at(new Text(() => `Retry: ${this.retryState()}`), 0, 5, 62, 1));
    this.add(
      at(
        new Text(() => {
          this.counterVersion();
          return `Runs: ${this.validationRuns} · Aborted: ${this.abortedValidations} · Saved: ${this.successfulSubmissions}`;
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
        this.active = false;
        for (const run of this.manualRuns) {
          if (run.completed) continue;
          run.controller.abort();
          if (run.pending) {
            run.pending = false;
            run.resolve(null);
          }
        }
        this.manualRuns.length = 0;
        this.manualCurrent = null;
        this.manualValidating.set(false);
        this.form.dispose();
        for (const run of this.controlledRuns) {
          if (!run.pending) continue;
          run.pending = false;
          run.resolve(null);
        }
        this.controlledRuns.length = 0;
        this.persistence?.reject(new Error('lesson disposed'));
        this.persistence = null;
        this.cleanupCount += 1;
      });
    });
  }

  /** Start the first controlled availability check. */
  public validate(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    this.startManualValidation('older value 1', source);
  }

  /** Supersede the current check with a newer generation and abort the older controller. */
  public supersede(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    this.startManualValidation('newer value 2', source);
  }

  /** Deliver the older result after supersession so it is visibly dropped. */
  public settleOlder(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    const older = this.manualRuns[0];
    if (older === undefined || !older.pending || older === this.manualCurrent) return;
    older.pending = false;
    older.resolve(null);
    this.counterVersion.update((current) => current + 1);
    this.actionSource.set(source);
  }

  /** Deliver the newest result and publish its clean availability verdict. */
  public settleNewest(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    const newest = this.manualCurrent;
    if (newest === null || !newest.pending || this.manualRuns.length < 2) return;
    newest.pending = false;
    newest.resolve(null);
    this.counterVersion.update((current) => current + 1);
    this.actionSource.set(source);
  }

  /** Configure the next persistence attempt to reject after validation succeeds. */
  public failNext(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    this.failNextPersistence.set(true);
    this.actionSource.set(source);
  }

  /** Start a real form submission whose async validator and persistence are learner-controlled. */
  public submit(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    this.startSubmit(source);
  }

  /** Resolve the active store-owned async validator as available. */
  public settleValidation(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    const run = this.controlledRuns.at(-1);
    if (run === undefined || !run.pending || !this.form.submitting()) return;
    run.pending = false;
    run.resolve(null);
    this.counterVersion.update((current) => current + 1);
    this.actionSource.set(source);
  }

  /** Settle the active persistence attempt through its configured success or failure route. */
  public settlePersistence(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    const persistence = this.persistence;
    if (persistence === null || this.persistenceState.peek() !== 'pending') return;
    this.persistence = null;
    if (this.failNextPersistence.peek()) {
      persistence.reject(new Error('simulated bounded save failure'));
    } else {
      persistence.resolve();
    }
    this.actionSource.set(source);
  }

  /** Retry with a fresh forced validation and a successful persistence policy. */
  public retry(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    if (this.retryState.peek() !== 'available') return;
    this.failNextPersistence.set(false);
    this.startSubmit(source);
  }

  /** Whether a pending manual generation can be superseded. */
  public canSupersede(): boolean {
    this.counterVersion();
    return this.manualCurrent?.pending === true;
  }

  /** Whether the aborted older Promise can now be settled out of order. */
  public canSettleOlder(): boolean {
    this.counterVersion();
    const older = this.manualRuns[0];
    return older !== undefined && older.pending && older !== this.manualCurrent;
  }

  /** Whether the authoritative newer Promise can now be settled. */
  public canSettleNewest(): boolean {
    this.counterVersion();
    return this.manualRuns.length >= 2 && this.manualCurrent?.pending === true;
  }

  /** Whether a fresh form submission can begin. */
  public canSubmit(): boolean {
    return !this.form.submitting();
  }

  /** Whether the real form validator is currently waiting for its controlled verdict. */
  public canSettleValidation(): boolean {
    this.counterVersion();
    return this.form.submitting() && this.controlledRuns.at(-1)?.pending === true;
  }

  /** Whether the real onValid persistence callback is waiting to settle. */
  public canSettlePersistence(): boolean {
    return this.form.submitting() && this.persistenceState() === 'pending';
  }

  /** Whether a failed persistence attempt currently offers retry. */
  public canRetry(): boolean {
    return !this.form.submitting() && this.retryState() === 'available';
  }

  /** Number of manual Promise generations still awaiting settlement. */
  public pendingManualRuns(): number {
    return this.manualRuns.filter((run) => run.pending).length;
  }

  /** Start one manual generation and cooperatively abort the previous one. */
  protected startManualValidation(value: string, source: Exclude<FormAsyncActionSource, 'ready'>): void {
    this.manualCurrent?.controller.abort();
    let resolveRun!: (message: string | null) => void;
    const completion = new Promise<string | null>((resolve) => {
      resolveRun = resolve;
    });
    const run: ManualValidation = {
      id: this.manualRuns.length + 1,
      value,
      controller: new AbortController(),
      resolve: resolveRun,
      pending: true,
      completed: false,
    };
    this.observeAbort(run.controller.signal);
    this.manualRuns.push(run);
    this.manualCurrent = run;
    this.validationRuns += 1;
    this.counterVersion.update((current) => current + 1);
    this.manualValidating.set(true);
    this.currentValue.set(`${value} · pending`);
    this.result.set('pending');
    this.actionSource.set(source);
    void completion.then(() => this.completeManualValidation(run));
  }

  /** Publish one real Promise settlement only when its generation still owns the result. */
  protected completeManualValidation(run: ManualValidation): void {
    run.completed = true;
    if (!this.active) return;
    if (run.controller.signal.aborted || run !== this.manualCurrent) {
      this.staleValidationResults += 1;
      this.counterVersion.update((current) => current + 1);
      this.result.set(`stale older ${run.id} dropped`);
      return;
    }
    this.acceptedValidationResults += 1;
    this.manualCurrent = null;
    this.manualValidating.set(false);
    this.currentValue.set(`${run.value} · settled`);
    this.counterVersion.update((current) => current + 1);
    this.result.set(
      this.staleValidationResults > 0
        ? `stale older dropped · newer ${run.id} available · clean accepted`
        : `newer ${run.id} available · clean accepted`,
    );
  }

  /** Observe one abort signal and count its first cooperative cancellation. */
  protected observeAbort(abortSignal: AbortSignal): void {
    abortSignal.addEventListener(
      'abort',
      () => {
        this.abortedValidations += 1;
        this.counterVersion.update((current) => current + 1);
      },
      { once: true },
    );
  }

  /** Run the real forced-validation submit and retain only settled callback evidence. */
  protected startSubmit(source: Exclude<FormAsyncActionSource, 'ready'>): void {
    if (this.form.submitting()) return;
    this.retryState.set('unavailable');
    this.persistenceState.set('none');
    this.result.set('forced validation pending');
    this.actionSource.set(source);
    void this.form
      .submit(() => this.startPersistence())
      .then((submitted) => {
        if (!this.active) return;
        if (!submitted) {
          this.result.set('validation rejected');
          this.retryState.set('available');
          return;
        }
        this.successfulSubmissions += 1;
        this.counterVersion.update((current) => current + 1);
        this.persistenceState.set('saved');
        this.result.set('success · saved');
      })
      .catch(() => {
        if (!this.active) return;
        this.failedSubmissions += 1;
        this.counterVersion.update((current) => current + 1);
        this.persistenceState.set('failed · bounded error');
        this.result.set('error · retry available');
        this.retryState.set('available');
      });
  }

  /** Enter persistence only from the real onValid callback and expose its controlled Promise. */
  protected startPersistence(): Promise<void> {
    if (!this.active) return Promise.resolve();
    this.persistenceState.set('pending');
    return new Promise<void>((resolve, reject) => {
      this.persistence = { resolve, reject };
    });
  }
}
