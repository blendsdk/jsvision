import { dumpCaps, resolveCapabilities } from '@jsvision/core';
import type { CapabilityResolution } from '@jsvision/core';
import { Group, Text, at, signal } from '@jsvision/ui';

/** Named deterministic inputs compared by the capability-resolution laboratory. */
export type ResolutionScenario = 'Unknown' | 'Environment' | 'Runtime query' | 'Override';

/** Precomputed real resolutions supplied by the example's public detection boundaries. */
export interface ResolutionFixtures {
  readonly runtime: Promise<CapabilityResolution>;
}

const SCENARIOS: readonly ResolutionScenario[] = ['Unknown', 'Environment', 'Runtime query', 'Override'];

/**
 * Exposes immutable profile and reason evidence for four deterministic resolution inputs.
 *
 * The runtime-query fixture is produced with `resolveCapabilitiesAsync()` through a deterministic
 * promise. The panel never reads the visitor's environment or terminal, and the example module
 * does not require browser-incompatible top-level await.
 */
export class CapabilityResolutionPanel extends Group {
  /** Stable teaching identity used by the terminal-capabilities course contract. */
  public readonly lessonName = 'Capability resolution evidence';

  /** Number of routed scenario changes. */
  public scenarioChanges = 0;

  /** Number of changes validated from a real profile and reason trace. */
  public evidenceChecks = 0;

  /** Number of claims not supported by the selected resolution. */
  public unsupportedClaims = 0;

  /** Number of unrelated input bytes preserved by the runtime probe. */
  public passthroughBytes = 0;

  /** Number of owner cleanup transitions. */
  public cleanupCount = 0;

  protected scenarioIndex = 0;
  protected readonly scenario = signal<ResolutionScenario>('Unknown');
  protected readonly selected = signal<CapabilityResolution>(resolveCapabilities({ env: {}, platform: 'linux' }));
  protected readonly evidence = signal('unknown input · default reason · PASS');
  protected runtimeResolution = resolveCapabilities({ env: {}, platform: 'linux' });
  protected runtimeReady = false;
  protected readonly runtimePromise: Promise<void>;
  protected disposed = false;
  protected active = false;

  /** @param fixtures Real precomputed async resolution evidence. */
  public constructor(fixtures: ResolutionFixtures) {
    super();
    this.runtimePromise = fixtures.runtime.then(
      (resolution) => {
        if (this.disposed) return;
        this.runtimeResolution = resolution;
        this.runtimeReady = true;
        if (this.scenario() === 'Runtime query') {
          this.selected.set(resolution);
          this.verifyResolution('Runtime query', resolution);
        }
      },
      () => {
        if (this.disposed) return;
        this.runtimeReady = true;
        this.unsupportedClaims = 1;
        this.evidence.set('runtime query failed · evidence unavailable');
      },
    );
    this.add(at(new Text(() => `Scenario: ${this.scenario()} · immutable profile + reasons`), 0, 0, 54, 1));
    this.add(
      at(
        new Text(
          () =>
            `colorDepth=${this.selected().profile.colorDepth} (${this.selected().reasons.colorDepth}) · ` +
            `mouse=${this.selected().profile.mouse.sgr ? 'sgr' : 'none'} (${this.selected().reasons.mouse})`,
        ),
        0,
        1,
        54,
        1,
      ),
    );
    this.add(
      at(
        new Text(
          () =>
            `sync2026=${String(this.selected().profile.sync2026)} (${this.selected().reasons.sync2026}) · ` +
            `multiplexer=${String(this.selected().profile.multiplexer)}`,
        ),
        0,
        2,
        54,
        1,
      ),
    );
    this.add(at(new Text(() => `Evidence: ${this.evidence()}`), 0, 3, 54, 1));
    this.add(at(new Text(() => `Safe trace: ${dumpCaps(this.selected()).slice(0, 42)}`), 0, 4, 54, 1));
    this.add(at(new Text('Deterministic fixtures; no visitor terminal query.'), 0, 5, 54, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.disposed = true;
        this.cleanupCount += 1;
      });
    });
  }

  /** Current deterministic scenario name. */
  public get scenarioName(): ResolutionScenario {
    return this.scenario();
  }

  /** Current authentic public capability resolution. */
  public get resolution(): CapabilityResolution {
    return this.selected();
  }

  /** Wait until the deterministic runtime-query fixture has resolved or failed. */
  public async whenRuntimeReady(): Promise<void> {
    await this.runtimePromise;
  }

  /** Advance through unknown, environment, runtime-query, and override evidence. */
  public explainNext(): void {
    if (!this.active) return;
    this.scenarioIndex = (this.scenarioIndex + 1) % SCENARIOS.length;
    const next = SCENARIOS[this.scenarioIndex] ?? 'Unknown';
    const resolution = this.resolveScenario(next);
    this.scenario.set(next);
    this.selected.set(resolution);
    this.scenarioChanges += 1;
    if (next === 'Runtime query' && !this.runtimeReady) {
      this.evidence.set('runtime query pending · deterministic fixture');
      return;
    }
    this.verifyResolution(next, resolution);
  }

  /** Resolve one scenario through the real public API or supplied async public result. */
  protected resolveScenario(scenario: ResolutionScenario): CapabilityResolution {
    if (scenario === 'Environment') {
      return resolveCapabilities({
        env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
        platform: 'linux',
      });
    }
    if (scenario === 'Runtime query') return this.runtimeResolution;
    if (scenario === 'Override') {
      return resolveCapabilities({
        env: { TERM: 'xterm-256color' },
        platform: 'linux',
        override: { colorDepth: 'mono', mouse: { sgr: false } },
      });
    }
    return resolveCapabilities({ env: {}, platform: 'linux' });
  }

  /** Accept evidence only when the immutable result contains the scenario's expected reason. */
  protected verifyResolution(scenario: ResolutionScenario, resolution: CapabilityResolution): void {
    const expected =
      scenario === 'Environment'
        ? 'env'
        : scenario === 'Runtime query'
          ? 'runtime'
          : scenario === 'Override'
            ? 'override'
            : 'default';
    const supported =
      Object.isFrozen(resolution.profile) &&
      Object.isFrozen(resolution.reasons) &&
      Object.values(resolution.reasons).includes(expected);
    this.unsupportedClaims = supported ? 0 : 1;
    if (!supported) {
      this.evidence.set('unsupported claim rejected');
      return;
    }
    this.evidenceChecks += 1;
    this.passthroughBytes = resolution.passthrough?.length ?? 0;
    this.evidence.set(`${expected} observed · pass=${this.passthroughBytes}B · PASS`);
  }
}
