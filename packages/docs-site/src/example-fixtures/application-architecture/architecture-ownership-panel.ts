import { Group, Text, at, signal } from '@jsvision/ui';
import type { ArchitectureActionSource } from './architecture-boundaries-panel.js';

/** Explicit service result used by the failure-isolation laboratory. */
export type ArchitectureFailureResult =
  { readonly ok: true } | { readonly ok: false; readonly code: 'SERVICE_UNAVAILABLE'; readonly unsafeDetail: string };

/** Injected service port whose deterministic implementation never crosses a real host boundary. */
export interface ArchitectureFailureService {
  /** Return one explicit result for the feature action to interpret. */
  load(): ArchitectureFailureResult;
}

/** Bounded value-free diagnostic collector used by the teaching fixture. */
class ArchitectureDiagnostics {
  protected readonly records: string[] = [];

  /** Store only a stable code and deliberately discard the unsafe service detail. */
  public record(code: 'SERVICE_UNAVAILABLE', _unsafeDetail: string): void {
    this.records.push(code);
    if (this.records.length > 4) this.records.shift();
  }

  /** Return a defensive snapshot of bounded diagnostic codes. */
  public entries(): readonly string[] {
    return this.records.slice();
  }
}

/** Concrete application-lifetime resource with observable use and idempotent disposal. */
class ArchitectureApplicationResource {
  /** Whether the acquired resource can still be used. */
  public active = true;

  /** Number of accepted operations while active. */
  public uses = 0;

  /** Number of actual active-to-disposed transitions. */
  public disposals = 0;

  /** Use the acquired resource only while its application owner remains active. */
  public use(): void {
    if (this.active) this.uses += 1;
  }

  /** Release the resource exactly once. */
  public dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.disposals += 1;
  }
}

/**
 * Exposes application, screen, and widget ownership through real mounted cleanup.
 *
 * Navigation replaces a mounted screen, failure changes an explicit error state without replacing
 * the application, and stale work is invoked only after its screen generation has ended.
 */
export class ArchitectureOwnershipPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Architecture ownership';

  /** Number of released screen owners. */
  public screenCleanups = 0;

  /** Number of released screen-widget owners. */
  public widgetCleanups = 0;

  /** Number of service failures converted into isolated feature state. */
  public isolatedFailures = 0;

  /** Number of late generations rejected after their owner ended. */
  public staleResultsSuppressed = 0;

  /** Aggregate cleanup evidence across panel, screen, and widget owners. */
  public cleanupCount = 0;

  /** Number of accepted current-generation result publications. */
  public resultPublications = 0;

  protected readonly screenName = signal<'home' | 'detail'>('home');
  protected readonly failure = signal('none');
  protected readonly staleResult = signal('not run');
  protected readonly published = signal('initial');
  protected readonly actionSource = signal('none');
  protected readonly diagnostics = new ArchitectureDiagnostics();
  protected readonly failureService: ArchitectureFailureService;
  protected pendingActionSource: ArchitectureActionSource | undefined;
  protected screenGeneration = 0;
  protected screen: Group;
  protected active = false;
  protected applicationResource: ArchitectureApplicationResource | undefined;

  /** Build one application-owned panel, injected service, and first screen-owned subtree. */
  public constructor(failureService: ArchitectureFailureService) {
    super();
    this.failureService = failureService;
    this.screen = this.buildScreen('home');
    this.add(at(this.screen, 0, 0, 60, 1));
    this.add(at(new Text(() => `Failure: ${this.failure()}`), 0, 1, 60, 1));
    this.add(at(new Text(() => `Application: alive · resource: ${this.applicationResources}`), 0, 2, 60, 1));
    this.add(at(new Text(() => `Screen: ${this.screenName()}`), 0, 3, 60, 1));
    this.add(at(new Text('Widget: mounted'), 0, 4, 60, 1));
    this.add(at(new Text(() => `Stale result: ${this.staleResult()}`), 0, 6, 60, 1));
    this.add(at(new Text(() => `Published result: ${this.published()}`), 0, 7, 60, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 8, 60, 1));
    this.add(at(new Text('Fixture: bounded in-memory · no network · non-colour cues'), 0, 10, 60, 1));
    this.onMount(() => {
      this.active = true;
      this.applicationResource = new ArchitectureApplicationResource();
      this.applicationResource.use();
      this.onCleanup(() => {
        this.active = false;
        const resource = this.applicationResource;
        resource?.dispose();
        if (resource?.disposals === 1) this.cleanupCount += 1;
        this.cleanupCount += 1;
      });
    });
  }

  /** Number of currently active application-lifetime resources. */
  public get applicationResources(): number {
    return this.applicationResource?.active === true ? 1 : 0;
  }

  /** Number of operations performed through the concrete application resource. */
  public get applicationResourceUses(): number {
    return this.applicationResource?.uses ?? 0;
  }

  /** Exact number of real application-resource disposal transitions. */
  public get applicationResourceDisposals(): number {
    return this.applicationResource?.disposals ?? 0;
  }

  /** Current accepted result that a stale completion must not overwrite. */
  public get publishedResult(): string {
    return this.published();
  }

  /** Defensive snapshot of bounded value-free diagnostic entries. */
  public get diagnosticEntries(): readonly string[] {
    return this.diagnostics.entries();
  }

  /** Replace the current screen and prove its screen and widget owners clean up together. */
  public navigate(source: ArchitectureActionSource): void {
    if (!this.active) return;
    const next = this.screenName() === 'home' ? 'detail' : 'home';
    this.replaceScreen(next);
    this.actionSource.set(this.consumeActionSource(source));
  }

  /** Convert one deterministic service fault into visible state while preserving the application. */
  public isolateFailure(source: ArchitectureActionSource): void {
    if (!this.active) return;
    const result = this.failureService.load();
    if (result.ok) {
      this.failure.set('none');
    } else {
      this.isolatedFailures += 1;
      this.diagnostics.record(result.code, result.unsafeDetail);
      this.failure.set(`isolated · code ${result.code}`);
    }
    this.actionSource.set(this.consumeActionSource(source));
  }

  /** Build a result callback owned by the current screen generation. */
  public createCompletion(payload: string): () => void {
    const ownedGeneration = this.screenGeneration;
    return () => {
      if (!this.active) return;
      if (ownedGeneration !== this.screenGeneration) {
        this.staleResultsSuppressed += 1;
        this.staleResult.set('suppressed');
        return;
      }
      this.resultPublications += 1;
      this.published.set(payload);
      this.staleResult.set('current result accepted');
    };
  }

  /** Publish one current-generation result to prove the successful branch exists. */
  public publishCurrent(source: ArchitectureActionSource): void {
    if (!this.active) return;
    this.createCompletion('current-generation')();
    this.actionSource.set(this.consumeActionSource(source));
  }

  /** Invoke a publish-capable completion after replacing its owner and reject its stale payload. */
  public suppressStale(source: ArchitectureActionSource): void {
    if (!this.active) return;
    const complete = this.createCompletion('stale-corruption');
    this.replaceScreen(this.screenName() === 'home' ? 'detail' : 'home');
    complete();
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

  /** Construct a screen with a separately observable widget cleanup. */
  protected buildScreen(name: 'home' | 'detail'): Group {
    this.screenGeneration += 1;
    const screen = new Group();
    const widget = new Text(`${name.toUpperCase()} screen widget`);
    widget.onMount(() =>
      widget.onCleanup(() => {
        this.widgetCleanups += 1;
        this.cleanupCount += 1;
      }),
    );
    screen.onMount(() =>
      screen.onCleanup(() => {
        this.screenCleanups += 1;
        this.cleanupCount += 1;
      }),
    );
    screen.add(at(widget, 0, 0, 30, 1));
    return screen;
  }

  /** Replace the mounted screen while retaining application-owned state and resources. */
  protected replaceScreen(name: 'home' | 'detail'): void {
    this.remove(this.screen);
    this.screen = this.buildScreen(name);
    this.add(at(this.screen, 0, 0, 60, 1));
    this.screenName.set(name);
  }
}
