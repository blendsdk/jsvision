/** Setup stages exposed by the deterministic board lifecycle harness. */
export type KanbanBoardSetupStage = 'coordinator' | 'viewport' | 'controller' | 'input';

/** Options for forcing one setup stage to fail after its earlier resources are acquired. */
export interface KanbanBoardSetupHarnessOptions {
  /** Stage that throws during {@link KanbanBoardSetupHarness.mount}. */
  readonly failAt: KanbanBoardSetupStage;
}

/** Detached resource evidence returned by the deterministic setup harness. */
export interface KanbanBoardSetupHarnessSnapshot {
  /** Input becomes true only after every earlier owner is ready. */
  readonly inputEnabled: boolean;
  /** Setup owners that have not yet been released, in acquisition order. */
  readonly liveResources: readonly KanbanBoardSetupStage[];
  /** Active synthetic capture leases retained by the harness. */
  readonly captureLeases: number;
  /** Active synthetic timers retained by the harness. */
  readonly timers: number;
  /** Active synthetic subscriptions retained by the harness. */
  readonly subscriptions: number;
}

/**
 * Deterministic model of the board's cancellation-first setup transaction.
 *
 * The helper contains no application records or host handles. It lets consumers verify failure
 * injection and cleanup expectations without reaching into production-private owners.
 *
 * @example
 * ```ts
 * const harness = createKanbanBoardSetupHarness({ failAt: 'controller' });
 * expect(() => harness.mount()).toThrow();
 * expect(harness.snapshot().liveResources).toEqual([]);
 * ```
 */
export interface KanbanBoardSetupHarness {
  /** Runs the ordered setup transaction and throws at the configured stage. */
  mount(): void;
  /** Returns immutable payload-free ownership counters. */
  snapshot(): KanbanBoardSetupHarnessSnapshot;
}

/** Creates a deterministic board setup transaction with reverse-order rollback. */
export function createKanbanBoardSetupHarness(options: KanbanBoardSetupHarnessOptions): KanbanBoardSetupHarness {
  const stages: readonly KanbanBoardSetupStage[] = Object.freeze(['coordinator', 'viewport', 'controller', 'input']);
  if (!stages.includes(options.failAt)) throw new RangeError('Invalid Kanban board setup failure stage.');
  const live: KanbanBoardSetupStage[] = [];
  let inputEnabled = false;
  let captureLeases = 0;
  let timers = 0;
  let subscriptions = 0;

  const rollback = (): void => {
    inputEnabled = false;
    captureLeases = 0;
    timers = 0;
    subscriptions = 0;
    while (live.length > 0) live.pop();
  };

  return Object.freeze({
    mount(): void {
      if (live.length > 0 || inputEnabled) throw new Error('Kanban setup harness is already mounted.');
      try {
        for (const stage of stages) {
          if (stage === options.failAt) throw new Error(`Kanban setup failed at ${stage}.`);
          live.push(stage);
          if (stage === 'viewport') captureLeases = 1;
          if (stage === 'controller') {
            timers = 1;
            subscriptions = 1;
          }
          if (stage === 'input') inputEnabled = true;
        }
      } catch (error) {
        rollback();
        throw error;
      }
    },
    snapshot(): KanbanBoardSetupHarnessSnapshot {
      return Object.freeze({
        inputEnabled,
        liveResources: Object.freeze([...live]),
        captureLeases,
        timers,
        subscriptions,
      });
    },
  });
}
