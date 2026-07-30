import { bindField, createForm } from '@jsvision/forms';
import { Button, Group, Input, Label, Text, at, createRouter, signal } from '@jsvision/ui';
import type { Router } from '@jsvision/ui';
import { z } from 'zod';

/** Record accepted by the capstone's persistence boundary. */
export interface WorkflowRecord {
  readonly id: number;
  readonly name: string;
}

/** Authorized, injected persistence port used by the browser laboratory. */
export interface AuthorizedRecordStore {
  /** Decide whether this concrete write capability is currently authorized. */
  authorize(record: WorkflowRecord): boolean;
  /** Persist one validated, bounded record or report denied authorization. */
  save(record: WorkflowRecord, abort: AbortSignal): Promise<{ ok: true }>;
}

/** Injected refresh port used to produce a real cancellable late result. */
export interface WorkflowRefreshService {
  load(abort: AbortSignal): Promise<readonly WorkflowRecord[]>;
}

/** Observable phases spanning loading, editing, persistence, cancellation, and recovery. */
export type WorkflowPhase = 'idle' | 'loading' | 'editing' | 'saving' | 'saved' | 'error' | 'cancelled';

/**
 * Coordinates one complete record workflow through injected, authorized persistence.
 *
 * The browser fixture uses only a deterministic in-memory store. Generation identity and
 * `AbortController` suppress stale work after cancellation, navigation, or cleanup.
 */
export class CapstoneWorkflowPanel extends Group {
  /** Stable identity used by the course specification. */
  public readonly lessonName = 'Complete application workflow';
  /** Number of writes that completed through the authorized store. */
  public persistenceWrites = 0;
  /** Number of records presented to the authorization boundary. */
  public authorizedSeamCalls = 0;
  /** Number of saves rejected by form validation. */
  public validationFailures = 0;
  /** Number of pending refreshes explicitly cancelled by the learner. */
  public cancellations = 0;
  /** Number of late async results ignored after cancellation or cleanup. */
  public staleResultsSuppressed = 0;
  /** Number of successful retries from a recoverable error. */
  public recoveries = 0;
  /** Number of refresh operations currently owned by the panel. */
  public pendingWork = 0;
  /** Number of times the mounted workflow owner completed cleanup. */
  public cleanupCount = 0;

  /** Bound editor control retained outside disposable route views. */
  public readonly nameInput: Input;
  /** Stable records-screen focus target restored after Back. */
  public readonly recordButton: Button;
  /** Current typed route and its screen ownership boundary. */
  protected readonly router: Router<{ records: void; editor: { id: number } }>;
  /** Current workflow phase used to derive available actions and feedback. */
  protected readonly currentPhase = signal<WorkflowPhase>('idle');
  /** Visible, non-color status for the latest action outcome. */
  protected readonly message = signal('Records ready · choose Open editor');
  /** Validated editing owner shared across disposable route views. */
  protected readonly form = createForm({
    schema: z.object({ name: z.string().trim().min(1).max(40) }),
    initial: { name: 'Quarterly report' },
  });
  /** Identity of the newest async operation allowed to publish state. */
  protected generation = 0;
  /** Cancellation owner for the current save or refresh. */
  protected controller: AbortController | null = null;
  /** Whether the panel is mounted and may accept actions. */
  protected active = false;

  /** Build visible state, route, authorization, and action evidence. */
  public constructor(
    protected readonly store: AuthorizedRecordStore,
    protected readonly refreshService: WorkflowRefreshService = createDeterministicRefreshService(),
  ) {
    super();
    const name = this.form.field('name');
    this.nameInput = new Input({ value: name.value, placeholder: 'required' });
    bindField(name, this.nameInput);
    this.recordButton = new Button('Record 1 · Quarterly report');
    this.router = createRouter<{ records: void; editor: { id: number } }>({
      initial: { name: 'records' },
      routes: {
        records: {
          keepAlive: true,
          build: () => {
            const screen = new Group();
            screen.add(at(new Text('RECORDS'), 0, 0, 8, 1));
            screen.add(at(this.recordButton, 10, 0, 30, 2));
            return { view: screen };
          },
        },
        editor: {
          build: ({ params }) => {
            const screen = new Group();
            screen.add(at(new Text(`EDITOR · record ${params.id}`), 0, 0, 18, 1));
            screen.add(at(new Label('~N~ame', this.nameInput), 20, 0, 8, 1));
            screen.add(at(this.nameInput, 29, 0, 29, 1));
            return { view: screen };
          },
        },
      },
    });
    this.add(at(this.router, 0, 0, 58, 2));
    this.add(
      at(new Text(() => `Route: ${String(this.router.location().name)} · phase: ${this.currentPhase()}`), 0, 2, 58, 1),
    );
    this.add(at(new Text(() => `Status: ${this.message()}`), 0, 4, 58, 1));
    this.add(
      at(new Text(() => `Auth attempts: ${this.authorizedSeamCalls} · writes: ${this.persistenceWrites}`), 0, 6, 31, 1),
    );
    this.add(at(new Text(() => `Pending:${this.pendingWork} stale:${this.staleResultsSuppressed}`), 32, 6, 26, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.generation += 1;
        this.controller?.abort();
        this.pendingWork = 0;
        this.form.dispose();
        this.cleanupCount += 1;
      });
    });
  }

  public get routeName(): 'records' | 'editor' {
    return this.router.location().name;
  }

  public get phase(): WorkflowPhase {
    return this.currentPhase();
  }

  public get feedback(): string {
    return this.message();
  }

  /** Replace the raw editor value for deterministic validation exercises. */
  public setRecordName(rawName: string): void {
    if (!this.active) return;
    this.form.field('name').value.set(rawName);
  }

  /** Navigate to the editor while preserving one stable record identity. */
  public openEditor(): void {
    if (!this.active) return;
    this.router.push('editor', { id: 1 });
    this.currentPhase.set('editing');
    this.message.set('Editor focused · record 1');
  }

  /** Return to the records screen through the real router stack. */
  public backToRecords(): void {
    if (!this.active) return;
    this.router.back();
    this.currentPhase.set('idle');
    this.message.set('Records restored · focus returned by stable record 1');
  }

  /** Validate, sanitize, bound, authorize, and persist through the injected store. */
  public async saveRecord(): Promise<void> {
    if (!this.active || this.router.location().name !== 'editor') return;
    const values = this.form.values();
    if (values === null) {
      this.validationFailures += 1;
      this.currentPhase.set('error');
      this.message.set('Invalid save · correct the visible name error');
      return;
    }
    const generation = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.currentPhase.set('saving');
    this.authorizedSeamCalls += 1;
    const record = { id: 1, name: values.name };
    if (!this.store.authorize(record)) {
      this.currentPhase.set('error');
      this.message.set('Save denied · retry after authorization');
      return;
    }
    await this.store.save(record, controller.signal);
    if (!this.active || controller.signal.aborted || generation !== this.generation) {
      this.staleResultsSuppressed += 1;
      return;
    }
    this.persistenceWrites += 1;
    this.currentPhase.set('saved');
    this.message.set('Saved through authorized in-memory seam');
  }

  /** Acquire deterministic refresh work that remains pending until cancelled. */
  public startRefresh(): void {
    if (!this.active) return;
    this.controller?.abort();
    this.controller = new AbortController();
    this.generation += 1;
    this.pendingWork = 1;
    this.currentPhase.set('loading');
    this.message.set('Refresh loading · cancellation available');
    void this.finishRefresh(this.generation, this.controller);
  }

  /** Abort pending work and invalidate any late completion. */
  public cancelWork(): void {
    if (!this.active || this.pendingWork === 0) return;
    this.controller?.abort();
    this.generation += 1;
    this.pendingWork = 0;
    this.cancellations += 1;
    this.currentPhase.set('cancelled');
    this.message.set('Cancelled · stale completion suppressed');
  }

  /** Enter a deterministic recoverable failure state. */
  public simulateFailure(): void {
    if (!this.active) return;
    this.currentPhase.set('error');
    this.message.set('Service error · input and editor route preserved');
  }

  /** Recover without discarding the current route or form input. */
  public retry(): void {
    if (!this.active || this.currentPhase() !== 'error') return;
    this.recoveries += 1;
    this.currentPhase.set('editing');
    this.message.set('Recovered · retry ready with input preserved');
  }

  /** Publish only the newest non-aborted refresh completion. */
  protected async finishRefresh(generation: number, controller: AbortController): Promise<void> {
    let records: readonly WorkflowRecord[];
    try {
      records = await this.refreshService.load(controller.signal);
    } catch {
      if (!this.active || controller.signal.aborted || generation !== this.generation) {
        this.staleResultsSuppressed += 1;
        return;
      }
      this.pendingWork = 0;
      this.currentPhase.set('error');
      this.message.set('Refresh failed · retry with current state preserved');
      return;
    }
    if (!this.active || controller.signal.aborted || generation !== this.generation) {
      this.staleResultsSuppressed += 1;
      return;
    }
    this.pendingWork = 0;
    this.currentPhase.set('idle');
    this.message.set(`Refresh ready · ${records.length} bounded record`);
  }
}

/** Create the laboratory's permission-checked, deterministic in-memory persistence adapter. */
export function createAuthorizedMemoryStore(allowWrite = true): AuthorizedRecordStore {
  return {
    authorize: () => allowWrite,
    save: async (_record, _abort) => {
      await Promise.resolve();
      return { ok: true };
    },
  };
}

/**
 * Create a real async refresh that remains pending until cancellation.
 *
 * Resolving after the abort event deliberately models a dependency that cannot stop immediately.
 * The panel must therefore suppress the late completion with both abort state and generation
 * identity.
 */
export function createDeterministicRefreshService(): WorkflowRefreshService {
  return {
    load: (abort) =>
      new Promise((resolve) => {
        abort.addEventListener(
          'abort',
          () => {
            queueMicrotask(() => resolve([{ id: 1, name: 'Quarterly report' }]));
          },
          { once: true },
        );
      }),
  };
}
