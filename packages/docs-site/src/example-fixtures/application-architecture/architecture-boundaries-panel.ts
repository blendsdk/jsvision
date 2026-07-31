import { Group, Text, at, signal } from '@jsvision/ui';

/** Source surface used to distinguish keyboard commands from mouse-triggered commands. */
export type ArchitectureActionSource = 'keyboard' | 'mouse';

/** Small injected service used by the laboratory's recommended layered path. */
export interface ArchitectureCounterService {
  /** Return the next domain value without knowing about views or signals. */
  increment(current: number): number;
}

/**
 * Compares a presentation-owned mutation with command → service → state → view flow.
 *
 * The coupled path is intentionally labeled as an anti-pattern. It changes only presentation
 * evidence, while the layered path crosses every boundary and publishes one reactive state value.
 */
export class ArchitectureBoundariesPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Architecture boundaries';

  /** Number of direct presentation mutations performed by the diagnostic anti-pattern. */
  public coupledMutations = 0;

  /** Number of layered commands accepted by the feature action. */
  public commandRuns = 0;

  /** Number of calls crossing the injected service port. */
  public serviceCalls = 0;

  /** Number of accepted values published to reactive feature state. */
  public statePublications = 0;

  /** Number of times the mounted teaching owner has been released. */
  public cleanupCount = 0;

  protected readonly domainValue = signal(0);
  protected readonly coupledEvidence = signal('not run');
  protected readonly flowEvidence = signal('waiting');
  protected readonly actionSource = signal('none');
  protected readonly service: ArchitectureCounterService;
  protected pendingActionSource: ArchitectureActionSource | undefined;
  protected active = false;

  /** Build the comparison around one deterministic injected service. */
  public constructor(service: ArchitectureCounterService) {
    super();
    this.service = service;
    this.add(at(new Text('Coupled path: anti-pattern · not recommended'), 0, 0, 60, 1));
    this.add(at(new Text('Layered path: recommended'), 0, 1, 60, 1));
    this.add(at(new Text(() => `Coupled evidence: ${this.coupledEvidence()}`), 0, 3, 60, 1));
    this.add(at(new Text(() => `Flow: ${this.flowEvidence()}`), 0, 4, 60, 1));
    this.add(at(new Text(() => `Domain value: ${this.domainValue()}`), 0, 5, 60, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 6, 60, 1));
    this.add(at(new Text('Fixture: deterministic in-memory · ASCII-safe text status'), 0, 8, 60, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        this.active = false;
        this.cleanupCount += 1;
      });
    });
  }

  /** Demonstrate why a view-owned direct mutation bypasses durable boundaries. */
  public runCoupled(source: ArchitectureActionSource): void {
    if (!this.active) return;
    this.coupledMutations += 1;
    this.coupledEvidence.set('boundary bypass · direct mutation');
    this.flowEvidence.set('view changed itself; domain stayed unchanged');
    this.actionSource.set(this.consumeActionSource(source));
  }

  /** Run the recommended command, service, state, and presentation sequence. */
  public runLayered(source: ArchitectureActionSource): void {
    if (!this.active) return;
    this.commandRuns += 1;
    this.serviceCalls += 1;
    const next = this.service.increment(this.domainValue());
    this.domainValue.set(next);
    this.statePublications += 1;
    this.flowEvidence.set('command -> service -> state -> view');
    this.actionSource.set(this.consumeActionSource(source));
  }

  /**
   * Tag the queued command emitted by a mouse activation.
   *
   * Button emits its command before invoking the click callback, while the application loop
   * handles that command after the callback returns. Keeping the provenance pending lets the
   * command remain the only action path without mislabeling it as a keyboard action.
   */
  public markNextActionSource(source: ArchitectureActionSource): void {
    if (!this.active) return;
    this.pendingActionSource = source;
  }

  /** Consume queued mouse provenance or retain the source supplied by a keyboard command. */
  protected consumeActionSource(source: ArchitectureActionSource): ArchitectureActionSource {
    const resolved = this.pendingActionSource ?? source;
    this.pendingActionSource = undefined;
    return resolved;
  }
}
