import { resolveCapabilities } from '@jsvision/core';
import { Group, Text, at, signal } from '@jsvision/ui';
import { collectBoundedDiagnostics } from '../in-production/bounded-diagnostics.js';
import {
  REQUIRED_PRODUCTION_CONCERNS,
  assessProductionReadiness,
  type ProductionConcern,
  type ProductionEvidence,
} from '../in-production/production-readiness.js';
import { decideSupervisorAction } from '../in-production/supervisor-decision.js';
import type { SupervisorAction } from '../in-production/supervisor-decision.js';

/** Fixed browser rehearsal scenarios; none claim native production proof. */
export type ReleaseScenario = 'Ready' | 'Non-TTY' | 'Crash loop' | 'Unsafe diagnostic' | 'Stale evidence';

const SCENARIOS: readonly ReleaseScenario[] = ['Ready', 'Non-TTY', 'Crash loop', 'Unsafe diagnostic', 'Stale evidence'];
const RELEASE_ID = 'capstone-release';
const ASSESSED_AT = 1_000;
const MAX_AGE = 200;

/** Build deterministic evidence for one release-rehearsal scenario. */
function evidenceFor(scenario: ReleaseScenario): ProductionEvidence[] {
  const recordedAt = scenario === 'Stale evidence' ? 100 : 900;
  return REQUIRED_PRODUCTION_CONCERNS.map((concern) => {
    const fails =
      (scenario === 'Non-TTY' && concern === 'tty') ||
      (scenario === 'Crash loop' && concern === 'runtime') ||
      (scenario === 'Unsafe diagnostic' && concern === 'diagnostics');
    return {
      concern,
      status: fails ? 'fail' : 'pass',
      recordedAt,
      releaseId: RELEASE_ID,
      reason: fails ? `${scenario} blocks ${concern}` : `${concern} verified`,
    };
  });
}

/** Deterministic ship/no-go rehearsal derived from authentic operational artifacts. */
export class ReleaseRehearsalPanel extends Group {
  /** Stable teaching label used by the course specification. */
  public readonly lessonName = 'Release rehearsal';
  /** Number of learner-requested scenario transitions. */
  public scenarioChanges = 0;
  /** Number of required readiness concerns assessed for the current scenario. */
  public releaseChecks = 0;
  /** Number of fresh passing restoration checks. */
  public restorationChecks = 0;
  /** Number of forbidden raw payloads found in the bounded diagnostic bundle. */
  public diagnosticLeaks = 0;
  /** Number of records retained by the bounded diagnostic bundle. */
  public diagnosticRecords = 0;
  /** Number of recovery rehearsals performed for the current scenario. */
  public recoveries = 0;
  /** Number of times the mounted release owner completed cleanup. */
  public cleanupCount = 0;
  /** First readiness concern that prevents shipment, or `none` when all checks pass. */
  public blockingConcern: ProductionConcern | 'none' = 'none';
  /** Derived reason associated with the first blocking concern. */
  public blockingReason = 'all controls pass';
  /** Derived supervisor response for the scenario's process observation. */
  public supervisorAction: SupervisorAction['action'] = 'stopped-clean';
  /** Serialized bounded bundle exposed so tests can prove payload redaction. */
  public diagnosticSnapshot = '';

  protected index = 0;
  protected readonly scenario = signal<ReleaseScenario>('Ready');
  protected readonly releaseDecision = signal<'ship' | 'no-go'>('ship');
  protected readonly fresh = signal(true);
  protected readonly message = signal('');
  protected active = false;

  /** Render derived readiness, diagnostic, supervisor, and restoration evidence. */
  public constructor() {
    super();
    this.evaluate('Ready');
    this.add(at(new Text(() => `Scenario: ${this.scenario()} · decision: ${this.releaseDecision()}`), 0, 0, 58, 1));
    this.add(
      at(
        new Text(() => `Evidence: ${this.fresh() ? 'fresh' : 'stale'} · records: ${this.diagnosticRecords}/6`),
        0,
        2,
        58,
        1,
      ),
    );
    this.add(at(new Text(() => `Status: ${this.message()}`), 0, 4, 58, 1));
    this.add(at(new Text('Browser rehearsal only · not native TTY or deployment proof'), 0, 6, 58, 1));
    this.onMount(() => {
      this.active = true;
      this.onCleanup(() => {
        if (!this.active) return;
        this.active = false;
        this.cleanupCount += 1;
      });
    });
  }

  public get scenarioName(): ReleaseScenario {
    return this.scenario();
  }

  public get decision(): 'ship' | 'no-go' {
    return this.releaseDecision();
  }

  public get evidenceFresh(): boolean {
    return this.fresh();
  }

  public get feedback(): string {
    return this.message();
  }

  /** Cycle one bounded fixture and recompute its release decision from real artifacts. */
  public nextScenario(): void {
    if (!this.active) return;
    this.index = (this.index + 1) % SCENARIOS.length;
    const next = SCENARIOS[this.index] ?? 'Ready';
    this.scenario.set(next);
    this.scenarioChanges += 1;
    this.evaluate(next);
  }

  /** Re-evaluate the selected fixture while retaining its honest browser evidence boundary. */
  public verifyRecovery(): void {
    if (!this.active) return;
    this.recoveries += 1;
    this.evaluate(this.scenario());
    this.message.set(`${this.message()} · recovery rehearsed; native proof still required`);
  }

  /** Derive every displayed control from deterministic Phase 28 operational artifacts. */
  protected evaluate(scenario: ReleaseScenario): void {
    const assessment = assessProductionReadiness(RELEASE_ID, evidenceFor(scenario), {
      assessedAt: ASSESSED_AT,
      maxAgeMs: MAX_AGE,
    });
    const diagnostic = collectBoundedDiagnostics({
      releaseId: RELEASE_ID,
      resolution: resolveCapabilities({ env: {}, platform: 'linux' }),
      event: { type: 'paste', text: 'fixture-secret-payload', truncated: false },
      displayCategory: scenario === 'Ready' ? 'ready' : 'failed',
      size: 6,
    });
    const supervisor = decideSupervisorAction(
      { mode: 'on-failure', maxAttempts: 3, windowSeconds: 60, backoffSeconds: [1, 5, 15] },
      {
        exit: scenario === 'Crash loop' ? 'failure' : scenario === 'Ready' ? 'clean' : 'permanent-startup',
        observedAt: ASSESSED_AT,
        previousFailureTimes: scenario === 'Crash loop' ? [700, 800, 900] : [],
      },
    );
    const restore = assessment.checks.find((check) => check.concern === 'restore');
    const blocking = assessment.checks.find((check) => check.status === 'fail');
    this.releaseChecks = assessment.checks.length;
    this.restorationChecks = restore?.status === 'pass' && restore.freshness === 'fresh' ? 1 : 0;
    this.diagnosticRecords = diagnostic.entries.length;
    this.diagnosticSnapshot = JSON.stringify(diagnostic);
    this.diagnosticLeaks = this.diagnosticSnapshot.includes('fixture-secret-payload') ? 1 : 0;
    this.blockingConcern = blocking?.concern ?? 'none';
    this.blockingReason = blocking?.reason ?? 'all controls pass';
    this.supervisorAction = supervisor.action;
    this.fresh.set(assessment.checks.every((check) => check.freshness === 'fresh'));
    this.releaseDecision.set(assessment.decision);
    this.message.set(
      `${this.blockingReason} · supervisor:${this.supervisorAction} · diagnostics:${this.diagnosticLeaks === 0 ? 'redacted' : 'leak'}`,
    );
  }
}
